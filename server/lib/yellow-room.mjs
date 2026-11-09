import { generatePrivateKey } from 'viem/accounts';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentProcess } from './agent-process.mjs';
import { assertHash, canonicalJson, hashJson, jsonSafe } from './canonical.mjs';

export const YELLOW_SANDBOX = 'wss://nitronode-sandbox.yellow.org/v1/ws';
export const APPLICATION_ID = 'yellow-court-demo-v1';
export const ROOM_SCHEMA = 'yellow-court-room-v1';
export const WIRE_SCHEMA = 'counterclaim-yellow-wire-v1';
export const MAX_WIRE_BYTES = 1024;
const DEFAULT_DIRECTORY = fileURLToPath(new URL('../.local/', import.meta.url));
const DEFAULT_PROOF_DIRECTORY = fileURLToPath(new URL('../proof/', import.meta.url));

export function assertMetadataBytes(encoded) {
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded, 'utf8') > MAX_WIRE_BYTES) {
    throw new Error('Complete compact Yellow session metadata exceeds the 1024 UTF-8 byte limit; nothing may be truncated.');
  }
  return encoded;
}

export function toWire(full) {
  if (!['AGREED', 'EVIDENCE_FROZEN', 'VERDICT_APPLIED', 'CLOSED', 'CANCELLED'].includes(full.phase)) throw new Error('Unsupported Yellow room phase.');
  if (assertHash(full.agreementHash, 'Agreement hash') !== hashJson(full.agreement)) throw new Error('Retained complete agreement differs from its commitment.');
  const wire = {schema: WIRE_SCHEMA, phase: full.phase, agreementHash: full.agreementHash,
    creditUnit: 'DEMO_CREDITS', creditTotal: 100, actualTokenAllocations: []};
  if (full.evidenceHash !== undefined) {
    if (assertHash(full.evidenceHash, 'Evidence hash') !== hashJson(full.evidence)) throw new Error('Retained complete evidence differs from its commitment.');
    wire.evidenceHash = full.evidenceHash;
  }
  if (full.verdict) {
    const verdict = full.verdict;
    if (assertHash(verdict.receiptHash, 'Receipt hash') !== hashJson(verdict.receipt)) throw new Error('Retained complete ruling differs from its commitment.');
    if (!/^0x[0-9a-fA-F]{64}$/.test(verdict.txHash) || !/^0x[0-9a-fA-F]{40}$/.test(verdict.contractAddress) ||
        !Number.isSafeInteger(verdict.chainId) || verdict.chainId <= 0 || !Number.isSafeInteger(verdict.caseId) || verdict.caseId < 0) {
      throw new Error('Invalid compact GenLayer ruling reference.');
    }
    validateAllocation(full.proposedAllocation);
    if (canonicalJson(full.proposedAllocation) !== canonicalJson(verdict.allocation)) throw new Error('Proposed allocation differs from the verified ruling.');
    wire.verdictReference = {chainId: verdict.chainId, contractAddress: verdict.contractAddress, txHash: verdict.txHash,
      caseId: verdict.caseId, receiptHash: verdict.receiptHash};
    wire.proposedAllocation = full.proposedAllocation;
  }
  if (['EVIDENCE_FROZEN', 'VERDICT_APPLIED', 'CLOSED'].includes(full.phase) && !wire.evidenceHash) throw new Error('Evidence commitment is required.');
  if (['VERDICT_APPLIED', 'CLOSED'].includes(full.phase) && !wire.verdictReference) throw new Error('Verified ruling reference is required.');
  assertMetadataBytes(canonicalJson(wire));
  return wire;
}

export function validateAgreementParties(agreement, participants) {
  if (!agreement?.parties) return;
  const parties = agreement.parties;
  if (Object.keys(parties).sort().join(',') !== 'buyer,seller' ||
      typeof parties.buyer !== 'string' || typeof parties.seller !== 'string' ||
      parties.buyer.toLowerCase() !== participants[0].toLowerCase() ||
      parties.seller.toLowerCase() !== participants[1].toLowerCase()) {
    throw new Error('Frozen buyer and seller must match the actual Yellow participant identities and order.');
  }
}

export function validateAllocation(allocation) {
  if (!allocation || Object.keys(allocation).sort().join(',') !== 'client,total,unit,worker' ||
      allocation.unit !== 'DEMO_CREDITS' || allocation.total !== 100 ||
      !Number.isSafeInteger(allocation.worker) || !Number.isSafeInteger(allocation.client) ||
      allocation.worker < 0 || allocation.client < 0 || allocation.worker + allocation.client !== allocation.total) {
    throw new Error('A complete allocation of exactly 100 nonmonetary DEMO_CREDITS is required.');
  }
  return allocation;
}

export function validateVerifiedVerdict(input, verified, frozen) {
  if (!verified || verified.verified !== true || !verified.receipt || !verified.binding) {
    throw new Error('An independent persisted GenLayer receipt read is required before co-signing.');
  }
  if (canonicalJson(input.receipt) !== canonicalJson(verified.receipt)) throw new Error('Input differs from the persisted GenLayer receipt.');
  for (const key of ['txHash', 'contractAddress', 'chainId']) {
    if (String(input[key]).toLowerCase() !== String(verified[key]).toLowerCase()) throw new Error('GenLayer authority mismatch: ' + key);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(verified.txHash) || !/^0x[0-9a-fA-F]{40}$/.test(verified.contractAddress) ||
      !Number.isSafeInteger(Number(verified.chainId)) || Number(verified.chainId) <= 0) throw new Error('Invalid GenLayer authority identity.');
  const binding = verified.binding;
  for (const key of ['appSessionId', 'agreementHash', 'evidenceHash']) {
    if (binding[key] !== frozen[key]) throw new Error('Persisted verdict does not bind the frozen ' + key + '.');
  }
  if (!Number.isSafeInteger(binding.caseId) || binding.caseId < 0) throw new Error('Exact onchain case identity is required.');
  validateAllocation(binding.allocation);
  const receipt = verified.receipt;
  if (receipt.decision !== 'RESOLVED' || receipt.settlement_allowed !== true ||
      receipt.case_id !== binding.caseId || receipt.session_id !== frozen.appSessionId ||
      receipt.agreement_hash !== frozen.agreementHash || receipt.evidence_hash !== frozen.evidenceHash ||
      Number(receipt.chain_id) !== Number(verified.chainId) ||
      String(receipt.contract_address).toLowerCase() !== verified.contractAddress.toLowerCase()) {
    throw new Error('The persisted receipt must itself bind this resolved case, session, source and authority.');
  }
  if (!receipt.allocation || receipt.allocation.total !== 100 || receipt.allocation.unit !== 'demo credits' ||
      receipt.allocation.seller !== binding.allocation.worker || receipt.allocation.buyer !== binding.allocation.client) {
    throw new Error('Normalized proposal differs from the exact persisted demo-credit allocation.');
  }
  return {receipt: jsonSafe(verified.receipt), receiptHash: hashJson(verified.receipt),
    txHash: verified.txHash, contractAddress: verified.contractAddress, chainId: Number(verified.chainId),
    caseId: binding.caseId, allocation: jsonSafe(binding.allocation)};
}

class YellowRoom {
  constructor(record, agents, options) {
    this.record = record;
    this.agents = agents;
    this.verifyGenLayer = options.verifyGenLayer;
    this.directory = options.directory ?? DEFAULT_DIRECTORY;
    this.proofDirectory = options.proofDirectory ?? DEFAULT_PROOF_DIRECTORY;
    this.queue = Promise.resolve();
  }
  get appSessionId() { return this.record.public.appSessionId; }
  get participants() { return [...this.record.public.participants]; }
  get agreement() { return jsonSafe(this.record.metadata.agreement); }
  exclusive(operation) {
    const pending = this.queue.then(operation);
    this.queue = pending.catch(() => {});
    return pending;
  }
  proof() { return jsonSafe(this.record.public); }
  async save() {
    await mkdir(this.directory, {recursive: true});
    await mkdir(this.proofDirectory, {recursive: true});
    await writeFile(path.join(this.directory, this.appSessionId + '.json'), JSON.stringify(this.record, null, 2) + '\n', {mode: 0o600});
    await writeFile(path.join(this.proofDirectory, this.appSessionId + '.json'), JSON.stringify(this.proof(), null, 2) + '\n');
  }
  async readSession() {
    const response = await this.agents[0].call('read', {appSessionId: this.appSessionId});
    const session = response.sessions.find((row) => row.appSessionId === this.appSessionId);
    if (!session) throw new Error('The exact Yellow session is absent from the sandbox node.');
    const expected = this.record.public.participants.map((a) => a.toLowerCase()).sort();
    const actual = session.appDefinition.participants.map((row) => row.walletAddress.toLowerCase()).sort();
    if (canonicalJson(expected) !== canonicalJson(actual) || session.appDefinition.quorum !== 2 ||
        session.appDefinition.participants.some((p) => p.signatureWeight !== 1) || session.allocations.length) {
      throw new Error('The live session participants/quorum/zero-allocation invariant changed.');
    }
    return session;
  }
  async update(sessionData, intent = 0) {
    const before = await this.readSession();
    if (before.isClosed) throw new Error('The Yellow session is closed.');
    const expectedCurrentWire = canonicalJson(toWire(this.record.metadata));
    if (before.sessionData !== expectedCurrentWire) throw new Error('Live compact metadata differs from the exact retained state commitments.');
    if (sessionData.agreementHash !== this.record.public.agreementHash ||
        hashJson(sessionData.agreement) !== this.record.public.agreementHash) throw new Error('Frozen complete agreement changed.');
    if (this.record.public.evidenceHash && (sessionData.evidenceHash !== this.record.public.evidenceHash ||
        hashJson(sessionData.evidence) !== this.record.public.evidenceHash)) throw new Error('Frozen complete evidence changed.');
    const update = {appSessionId: this.appSessionId, intent, version: (BigInt(before.version) + 1n).toString(),
      allocations: [], sessionData: assertMetadataBytes(canonicalJson(toWire(sessionData)))};
    const signatures = await Promise.all(this.agents.map((agent) => agent.call('signUpdate', {update})));
    await this.agents[0].call('submit', {update, signatures});
    const after = await this.readSession();
    if (after.version !== update.version || after.sessionData !== update.sessionData || after.isClosed !== (intent === 3)) {
      throw new Error('Yellow did not persist the exact proposed version, metadata and closure state.');
    }
    this.record.public.stages.push({phase: sessionData.phase, observedAt: new Date().toISOString(),
      update, signatures, snapshot: after});
    return after;
  }
  freezeEvidence({evidence, evidenceHash}) {
    return this.exclusive(async () => {
      if (this.record.public.phase !== 'AGREED') throw new Error('Evidence can be frozen exactly once before a verdict.');
      if (assertHash(evidenceHash, 'Evidence hash') !== hashJson(evidence)) throw new Error('Complete evidence hash mismatch.');
      const metadata = {...this.record.metadata, phase: 'EVIDENCE_FROZEN', evidence: jsonSafe(evidence), evidenceHash};
      const snapshot = await this.update(metadata);
      this.record.metadata = metadata;
      Object.assign(this.record.public, {phase: 'EVIDENCE_FROZEN', evidence: jsonSafe(evidence), evidenceHash, evidenceVersion: snapshot.version});
      await this.save();
      return {snapshot, evidenceHash, evidenceVersion: snapshot.version, proof: this.proof()};
    });
  }
  applyVerdict(input) {
    return this.exclusive(async () => {
      if (this.record.public.phase !== 'EVIDENCE_FROZEN') throw new Error('Only one verdict may bind the frozen evidence.');
      if (typeof this.verifyGenLayer !== 'function') throw new Error('Persisted GenLayer verification has not been configured.');
      const verified = await this.verifyGenLayer(input, this.proof());
      const verdict = validateVerifiedVerdict(input, verified, this.record.public);
      const metadata = {...this.record.metadata, phase: 'VERDICT_APPLIED', verdict,
        proposedAllocation: verdict.allocation, settlementMode: 'COOPERATIVE_DEMO_CREDITS_ONLY'};
      const snapshot = await this.update(metadata);
      this.record.metadata = metadata;
      Object.assign(this.record.public, {phase: 'VERDICT_APPLIED', verdict, proposedAllocation: verdict.allocation,
        verdictVersion: snapshot.version});
      await this.save();
      return {snapshot, proof: this.proof()};
    });
  }
  close() {
    return this.exclusive(async () => {
      if (this.record.public.phase !== 'VERDICT_APPLIED') throw new Error('A verified persisted verdict must be applied before closing.');
      const metadata = {...this.record.metadata, phase: 'CLOSED'};
      const snapshot = await this.update(metadata, 3);
      this.record.metadata = metadata;
      Object.assign(this.record.public, {phase: 'CLOSED', closedVersion: snapshot.version,
        closedAt: new Date().toISOString(), isClosed: true});
      await this.save();
      return {snapshot, proof: this.proof()};
    });
  }
  cancel() {
    return this.exclusive(async () => {
      if (!['AGREED', 'EVIDENCE_FROZEN'].includes(this.record.public.phase)) throw new Error('Only an unsettled zero-token demo may be cancelled.');
      const metadata = {...this.record.metadata, phase: 'CANCELLED', cancellationReason: 'DEMO_ABORTED_WITHOUT_APPLIED_RULING'};
      const snapshot = await this.update(metadata, 3);
      this.record.metadata = metadata;
      Object.assign(this.record.public, {phase: 'CANCELLED', cancelledAt: new Date().toISOString(),
        closedVersion: snapshot.version, isClosed: true});
      await this.save();
      return {snapshot, proof: this.proof()};
    });
  }
  async disconnect() { await Promise.allSettled(this.agents.map((agent) => agent.disconnect())); }
}

export async function createYellowRoom({agreement, agreementHash, agreementFactory, ...options}) {
  if (agreementFactory !== undefined && (typeof agreementFactory !== 'function' || agreement !== undefined || agreementHash !== undefined)) {
    throw new Error('Supply either an agreement factory or an exact agreement/hash, not both.');
  }
  if (!agreementFactory && assertHash(agreementHash, 'Agreement hash') !== hashJson(agreement)) throw new Error('Complete agreement hash mismatch.');
  const privateKeys = [generatePrivateKey(), generatePrivateKey()];
  const agents = [new AgentProcess(), new AgentProcess()];
  try {
    const initialized = await Promise.all(agents.map((agent, index) => agent.call('init', {endpoint: YELLOW_SANDBOX, privateKey: privateKeys[index]})));
    const participants = initialized.map((row) => row.address);
    if (agreementFactory) { agreement = await agreementFactory([...participants]); agreementHash = hashJson(agreement); }
    if (assertHash(agreementHash, 'Agreement hash') !== hashJson(agreement)) throw new Error('Complete agreement hash mismatch.');
    if (Buffer.byteLength(canonicalJson(agreement)) > 16000) throw new Error('Agreement exceeds the documented demo bound.');
    validateAgreementParties(agreement, participants);
    const definition = {applicationId: APPLICATION_ID, participants: participants.map((walletAddress) => ({walletAddress, signatureWeight: 1})),
      quorum: 2, nonce: (BigInt(Date.now()) * 1000000n + BigInt('0x' + randomBytes(3).toString('hex')) % 1000000n).toString()};
    const metadata = {schema: ROOM_SCHEMA, phase: 'AGREED', agreement: jsonSafe(agreement), agreementHash, actualTokenAllocations: [],
      creditUnit: 'DEMO_CREDITS', creditTotal: 100, settlementMode: 'COOPERATIVE_DEMO_CREDITS_ONLY'};
    const sessionData = assertMetadataBytes(canonicalJson(toWire(metadata)));
    const signatures = await Promise.all(agents.map((agent) => agent.call('signCreate', {definition, sessionData})));
    const created = await agents[0].call('create', {definition, sessionData, signatures});
    const record = {privateKeys, metadata, public: {schema: ROOM_SCHEMA, endpoint: YELLOW_SANDBOX, sdkVersion: '1.4.0',
      appSessionId: created.appSessionId, participants, agreement: jsonSafe(agreement), agreementHash,
      metadataEncoding: WIRE_SCHEMA, maxWireBytes: MAX_WIRE_BYTES, phase: 'AGREED', createdAt: new Date().toISOString(),
      actualTokenAllocations: [], creditUnit: 'DEMO_CREDITS', creditTotal: 100, isClosed: false, stages: []}};
    const room = new YellowRoom(record, agents, options);
    const snapshot = await room.readSession();
    if (snapshot.version !== created.version || snapshot.isClosed || snapshot.sessionData !== sessionData) throw new Error('Yellow creation read-back mismatch.');
    record.public.stages.push({phase: 'AGREED', observedAt: record.public.createdAt, definition, signatures, snapshot});
    await room.save();
    return room;
  } catch (error) { await Promise.allSettled(agents.map((agent) => agent.disconnect())); throw error; }
}

export async function restoreYellowRoom({appSessionId, ...options}) {
  if (!/^0x[0-9a-f]{64}$/.test(appSessionId)) throw new Error('Exact lowercase Yellow session ID required.');
  const directory = options.directory ?? DEFAULT_DIRECTORY;
  const record = JSON.parse(await readFile(path.join(directory, appSessionId + '.json'), 'utf8'));
  if (record.public.appSessionId !== appSessionId || record.privateKeys.length !== 2) throw new Error('Local room record mismatch.');
  if (record.public.metadataEncoding !== WIRE_SCHEMA) throw new Error('This older probe uses a different wire encoding; create a new compact-metadata room.');
  const agents = [new AgentProcess(), new AgentProcess()];
  try {
    const initialized = await Promise.all(agents.map((agent, index) => agent.call('init', {endpoint: YELLOW_SANDBOX, privateKey: record.privateKeys[index]})));
    if (canonicalJson(initialized.map((row) => row.address)) !== canonicalJson(record.public.participants)) throw new Error('Restored participant identity mismatch.');
    const room = new YellowRoom(record, agents, options);
    const live = await room.readSession();
    const finalSnapshot = record.public.stages.at(-1).snapshot;
    if (live.version !== finalSnapshot.version || live.sessionData !== finalSnapshot.sessionData || live.isClosed !== finalSnapshot.isClosed) {
      throw new Error('Stored room is not the current live Yellow state; reconcile before retrying.');
    }
    if (live.sessionData !== canonicalJson(toWire(record.metadata))) throw new Error('Restored complete source commitments do not match the live compact metadata.');
    return room;
  } catch (error) { await Promise.allSettled(agents.map((agent) => agent.disconnect())); throw error; }
}
