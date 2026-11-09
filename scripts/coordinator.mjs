import http from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createYellowRoom, restoreYellowRoom} from '../server/lib/yellow-room.mjs';
import {createGenLayerRuntime, ROOT, EXPLORER, saveProof} from './genlayer.mjs';
import {canonicalJson, hashJson} from './canonical.mjs';

const fixture = JSON.parse(await readFile(path.join(ROOT, 'fixtures/case.json'), 'utf8'));
const LOCAL = path.join(ROOT, '.local');
const STATE_FILE = path.join(LOCAL, 'current-demo.json');
const PORT = Number(process.env.PORT || 8787);
const now = () => new Date().toISOString();

export function buildAgreement(participants) {
  const agreement = Object.fromEntries(['title', 'pool', 'unit', 'milestones', 'claims', 'scope'].map(key => [key, structuredClone(fixture[key])]));
  agreement.parties = {buyer: participants[0].toLowerCase(), seller: participants[1].toLowerCase()};
  return agreement;
}

export async function createCoordinator() {
  const runtime = await createGenLayerRuntime();
  let room = null;
  let busy = false;
  let lastError = null;
  let state = {phase: 'idle', activity: [], agreement: {title: fixture.title, budget: '100', unit: 'demo credits'},
    deliverables: fixture.milestones.map((row, index) => ({id: row.id, title: row.title, description: row.criteria,
      weight: row.weight, status: 'pending', evidence: fixture.evidence[index].content, artifactName: fixture.evidence[index].artifact_name})),
    signatures: {buyer: false, seller: false}, scope: fixture.scope};
  try {
    const saved = JSON.parse(await readFile(STATE_FILE, 'utf8'));
    state = saved.state;
    if (saved.appSessionId) room = await restoreYellowRoom({appSessionId: saved.appSessionId, verifyGenLayer: runtime.verifyGenLayer});
  } catch (error) {
    if (error.code !== 'ENOENT') lastError = `Recovery requires attention: ${error.message}`;
  }

  const activity = (title, detail, status = 'complete', url) => state.activity.push({
    id: `${state.activity.length}-${Date.now()}`, title, detail, status, at: now(), ...(url ? {url} : {})});

  function view() {
    return {...structuredClone(state), busy, ...(lastError ? {error: lastError} : {}),
      network: {yellow: 'Yellow sandbox', genlayer: 'Studio Devnet', chainId: runtime.chainId},
      ...(runtime.deployment ? {contractAddress: runtime.deployment.address,
        contractUrl: runtime.deployment.explorerUrl} : {})};
  }

  async function persist() {
    await mkdir(LOCAL, {recursive: true});
    await writeFile(STATE_FILE, JSON.stringify({appSessionId: room?.appSessionId || null, state}, null, 2) + '\n', {mode: 0o600});
    const proof = {schema: 'counterclaim-demo-proof-v1', observedAt: now(), scope: fixture.scope,
      phase: state.phase, demo: view(), genlayer: runtime.deployment,
      yellow: room ? room.proof() : null, completeAgreement: room ? room.agreement : null,
      completeEvidence: fixture.evidence, actualTokenAllocations: [], fundsMoved: false};
    await saveProof('demo-proof', proof);
  }

  async function status() {
    return {application: 'counterclaim-partner-demo', mode: 'sandbox', yellow: {ready: true, connected: Boolean(room), network: 'Yellow sandbox',
      reason: room ? 'Actual signed session available' : 'Ready to open a zero-token signed session'},
      genlayer: {ready: Boolean(runtime.deployment), network: 'Studio Devnet', chainId: runtime.chainId,
        contractAddress: runtime.deployment?.address, reason: runtime.deployment ? 'Matching deployed court' : 'Run npm run setup:genlayer'},
      repositoryUrl: process.env.PUBLIC_REPOSITORY_URL || 'https://github.com/zakazaka95/Counterclaim', busy, ...(lastError ? {error: lastError} : {})};
  }

  async function session() {
    if (state.phase !== 'idle' || room) throw new Error('Reset or finish the current room before opening another');
    if (!runtime.deployment) throw new Error('Deploy the exact CounterclaimCourt source first');
    room = await createYellowRoom({agreementFactory: buildAgreement, verifyGenLayer: runtime.verifyGenLayer});
    const agreement = room.agreement;
    state.phase = 'session_open';
    state.startedAt = now();
    state.agreement = {title: agreement.title, budget: String(agreement.pool), unit: agreement.unit,
      buyer: agreement.parties.buyer, seller: agreement.parties.seller, hash: room.proof().agreementHash};
    activity('Agreement co-signed', 'Both isolated agents signed the complete 40 / 35 / 25 credit rubric.');
    await persist();
    const frozen = await room.freezeEvidence({evidence: fixture.evidence, evidenceHash: hashJson(fixture.evidence)});
    state.evidenceHash = frozen.evidenceHash;
    state.session = {id: room.appSessionId, status: 'open', version: Number(frozen.snapshot.version),
      actualTokenAllocations: [], evidenceFrozen: true, proofUrl: '/api/proof'};
    activity('Evidence frozen in Yellow', `Version ${frozen.snapshot.version}; complete artifact bundle, both signatures, zero token allocations.`);
    await persist();
    return view();
  }

  async function adjudicate() {
    if (!room || !['session_open', 'judging'].includes(state.phase)) throw new Error('Open a room and freeze its evidence first');
    const live = await room.readSession();
    const metadata = JSON.parse(live.sessionData);
    if (live.isClosed || metadata.phase !== 'EVIDENCE_FROZEN' ||
      metadata.agreementHash !== hashJson(room.agreement) || metadata.evidenceHash !== hashJson(fixture.evidence) ||
      hashJson(room.proof().evidence) !== hashJson(fixture.evidence)) throw new Error('Actual Yellow state no longer matches the frozen case');
    state.phase = 'judging';
    state.adjudication = {status: 'pending', totalDeliverables: fixture.milestones.length};
    activity('GenLayer review requested', 'Independent validators read the complete acceptance criteria and artifacts.', 'pending');
    await persist();
    if (state.caseId === undefined) {
      const opened = await runtime.openCase({sessionId: room.appSessionId, agreement: room.agreement, evidence: fixture.evidence});
      state.caseId = opened.caseId;
      state.caseOpenTx = opened.hash;
      activity('Case persisted on GenLayer', `Case ${opened.caseId}; exact session, agreement and evidence hashes.`, 'complete', opened.explorerUrl);
      await persist();
    }
    const result = await runtime.adjudicate(state.caseId);
    const receipt = result.stored.receipt;
    state.phase = 'verdict_ready';
    state.receipt = receipt;
    state.receiptHash = result.stored.receipt_hash;
    state.adjudication = {status: 'complete', decision: receipt.decision, summary: receipt.summary,
      finality: 'FINALIZED',
      transactionHash: result.hash, explorerUrl: result.explorerUrl, receiptHash: result.stored.receipt_hash,
      acceptedDeliverables: receipt.milestones.filter(row => row.status === 'SATISFIED').length,
      totalDeliverables: fixture.milestones.length, milestones: receipt.milestones};
    state.deliverables = state.deliverables.map(row => {
      const outcome = receipt.milestones.find(item => item.id === row.id)?.status;
      return {...row, status: outcome === 'SATISFIED' ? 'accepted' : outcome === 'NOT_SATISFIED' ? 'missing' : 'pending'};
    });
    if (receipt.allocation) state.allocation = {...receipt.allocation};
    state.activity = state.activity.map(row => row.status === 'pending' ? {...row, status: 'complete'} : row);
    activity('Persisted ruling received', `${receipt.decision}; ${state.adjudication.acceptedDeliverables} of ${fixture.milestones.length} milestones satisfied.`, 'complete', result.explorerUrl);
    await persist();
    return view();
  }

  async function settle() {
    if (!room || state.phase !== 'verdict_ready' || state.receipt?.settlement_allowed !== true) {
      throw new Error('Only a resolved, independently re-read persisted ruling can be co-signed');
    }
    const input = {receipt: state.receipt, txHash: state.adjudication.transactionHash,
      contractAddress: runtime.deployment.address, chainId: runtime.chainId};
    const phase = room.proof().phase;
    if (phase === 'EVIDENCE_FROZEN') {
      const applied = await room.applyVerdict(input);
      state.session.version = Number(applied.snapshot.version);
      activity('Both agents co-signed the proposal', `Yellow version ${applied.snapshot.version} binds the full GenLayer receipt and demo-credit split.`);
    } else if (phase === 'VERDICT_APPLIED' || phase === 'CLOSED') {
      await runtime.verifyGenLayer(input);
      if (room.proof().verdict?.receiptHash !== state.receiptHash) throw new Error('Recovered Yellow proposal binds another receipt');
    } else throw new Error('The actual Yellow phase cannot close this proposal');
    state.signatures = {buyer: true, seller: true};
    await persist();
    const closed = room.proof().phase === 'CLOSED' ? {snapshot: await room.readSession()} : await room.close();
    state.phase = 'settled';
    state.session = {...state.session, status: 'closed', version: Number(closed.snapshot.version), isClosed: true};
    state.finishedAt = now();
    activity('Yellow room closed', `Version ${closed.snapshot.version} read back as closed. No token allocations or funds moved.`);
    await persist();
    return view();
  }

  async function reset() {
    if (room) {
      const phase = room.proof().phase;
      if (['AGREED', 'EVIDENCE_FROZEN'].includes(phase)) await room.cancel();
      else if (phase === 'VERDICT_APPLIED') await room.close();
      await room.disconnect();
      await saveProof('archived-' + room.appSessionId, {demo: view(), yellow: room.proof()});
      room = null;
    }
    state = {phase: 'idle', activity: [], agreement: {title: fixture.title, budget: '100', unit: 'demo credits'},
      deliverables: fixture.milestones.map((row, index) => ({id: row.id, title: row.title, description: row.criteria,
        weight: row.weight, status: 'pending', evidence: fixture.evidence[index].content,
        artifactName: fixture.evidence[index].artifact_name})), signatures: {buyer: false, seller: false}, scope: fixture.scope};
    await persist();
    return view();
  }

  async function act(name) {
    if (busy) throw Object.assign(new Error('Another signed transition is still in progress'), {statusCode: 409});
    const action = {session, adjudicate, settle, reset}[name];
    if (!action) throw new Error('Unknown demo action');
    busy = true; lastError = null;
    try { return await action(); }
    catch (error) {
      lastError = error.message;
      if (name === 'adjudicate' && state.phase === 'judging') {
        state.phase = 'session_open';
        state.adjudication = {...state.adjudication, status: 'error'};
        state.activity = state.activity.map(row => row.status === 'pending' ? {...row, status: 'error'} : row);
      }
      throw error;
    }
    finally { busy = false; await persist(); }
  }

  if (room && state.receipt?.settlement_allowed === true && state.receipt.decision === 'RESOLVED' && state.adjudication?.transactionHash) {
    await runtime.verifyGenLayer({receipt: state.receipt, txHash: state.adjudication.transactionHash,
      contractAddress: runtime.deployment.address, chainId: runtime.chainId});
    state.adjudication.finality = 'FINALIZED';
    state.adjudication.lastVerifiedAt = now();
    await persist();
  }
  return {status, view, act, async proof() {return JSON.parse(await readFile(path.join(ROOT, 'proof/demo-proof.json'), 'utf8'));},
    async close() {if (room) await room.disconnect();}};
}

export async function startServer() {
  const coordinator = await createCoordinator();
  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      response.writeHead(403, {'Content-Type': 'application/json'}); response.end(JSON.stringify({error: 'Local demo accepts loopback browser origins only'})); return;
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let result;
      if (request.method === 'GET' && url.pathname === '/api/status') result = await coordinator.status();
      else if (request.method === 'GET' && url.pathname === '/api/demo') result = coordinator.view();
      else if (request.method === 'GET' && url.pathname === '/api/proof') result = await coordinator.proof();
      else if (request.method === 'POST' && /^\/api\/demo\/(session|adjudicate|settle|reset)$/.test(url.pathname)) {
        result = await coordinator.act(url.pathname.split('/').at(-1));
      } else {response.statusCode = 404; result = {error: 'Unknown local demo route'};}
      response.end(JSON.stringify(result));
    } catch (error) { response.statusCode = error.statusCode || 422; response.end(JSON.stringify({error: error.message, demo: coordinator.view()})); }
  });
  server.listen(PORT, '127.0.0.1', () => console.log(`Counterclaim coordinator http://127.0.0.1:${PORT}`));
  const shutdown = async () => {server.close(); await coordinator.close(); process.exit(0);};
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  return {server, coordinator};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer().catch(error => {console.error(error.message); process.exitCode = 1;});
}
