import {createAccount, createClient, generatePrivateKey} from 'genlayer-js';
import {studioDevnet} from 'genlayer-js/chains';
import {keccak256, parseEther} from 'viem';
import type {Hex} from 'viem';
import courtSource from '../../../contracts/CounterclaimCourt.py?raw';
import fixtureText from '../../../fixtures/case.json?raw';
import recordedText from '../../../proof/reviewer-verification-v2.json?raw';
import {canonicalJson, hashJson, hashText, jsonSafe, sameAddress, assertStoredRuling,
  assertRulingTransaction, assertFinalTransaction, assertClaimTransfer} from './verify';
import {assertClaimDelivery} from './verify';
import {claimFeeSeed, assertClaimFeeEstimate} from './fees';
import {freezeYellow} from './yellow';
import {resumeStoredRecord} from './resume';

export const isHostedDemo = import.meta.env.VITE_HOSTED_DEMO === 'true';
export const isHosted = isHostedDemo;
export const COURT = '0xC68b67797C630cBBf2bb80D290d68A787c855E14' as const;
const CHAIN = 61997, EXPLORER = 'https://explorer-studio-dev.genlayer.com';
const STORAGE_KEY = 'counterclaim-browser-live-v2';
const ESCROW = parseEther('0.001'), FAUCET = parseEther('5');
const fixture = JSON.parse(fixtureText), recorded = JSON.parse(recordedText);
type Role = 'buyer' | 'seller';
type Actor = {privateKey: Hex; address: Hex};
type Journal = {identity: string; hash?: Hex; state?: string; finalized?: boolean};
type Record = {schema: string; actors: {buyer: Actor; seller: Actor}; reference?: Hex; agreement: any;
  deliveryDeadline: number; refundAfter: number; demo: any; journals: {[key: string]: Journal};
  proof: any; baselines: {[key: string]: any}; yellow?: any};
let live: Record | null = null;
let mode: 'recorded' | 'live' = 'recorded', busy = false, errorMessage = '';
let verifiedThisPage = false, currentOperation: string | null = null;
const endpoint = typeof location === 'undefined' ? '' : new URL('/api/rpc', location.origin).href;
const nativeFetch = globalThis.fetch.bind(globalThis);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let fetchQueue: Promise<unknown> = Promise.resolve(), lastRpcStarted = 0;

function persist() {
  if (!live) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jsonSafe(live)));
}
function savedRecord() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (value?.schema !== 'counterclaim-browser-live-v2' || !value.actors?.buyer || !value.actors?.seller) return null;
    for (const role of ['buyer', 'seller'] as Role[]) {
      const actor = value.actors[role];
      if (!/^0x[0-9a-fA-F]{64}$/.test(actor.privateKey) || !sameAddress(createAccount(actor.privateKey).address, actor.address)) return null;
    }
    if (sameAddress(value.actors.buyer.address, value.actors.seller.address)) return null;
    return resumeStoredRecord(value) as Record;
  } catch {return null;}
}

// Browser-local serialization complements the Worker-backed shared RPC queue.
// Record the exact signed envelope hash before transmission. Keys stay in this
// tab's sessionStorage; only already-signed public transaction bytes leave it.
if (isHostedDemo && typeof window !== 'undefined') {
  live = savedRecord();
  if (live) {mode = 'live'; persist();}
  globalThis.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== endpoint) return nativeFetch(input, init);
    const operation = async () => {
      let request: any;
      try {request = JSON.parse(String(init.body));} catch {throw new Error('Malformed local RPC request.');}
      const isBroadcast = request.method === 'eth_sendRawTransaction';
      if (isBroadcast) {
        if (!live || !currentOperation || typeof request.params?.[0] !== 'string') throw new Error('An active browser transaction journal is required.');
        const expectedHash = keccak256(request.params[0] as Hex);
        const journal = live.journals[currentOperation];
        if (!journal || journal.hash && journal.hash.toLowerCase() !== expectedHash.toLowerCase()) throw new Error('A previous broadcast must be inspected before signing again.');
        journal.hash = expectedHash; journal.state = 'BROADCAST_ATTEMPTED'; persist();
      }
      for (let attempt = 0; ; attempt++) {
        const remaining = 3500 - (Date.now() - lastRpcStarted);
        if (remaining > 0) await sleep(remaining);
        lastRpcStarted = Date.now();
        const response = await nativeFetch(input, init);
        let body: any;
        try {body = await response.clone().json();} catch {}
        const limited = response.status === 429 || /rate[\s_-]*limit|queue.*full/i.test(body?.error?.message || '');
        if (!isBroadcast && limited && attempt < 4) {await sleep(15000 + attempt * 5000); continue;}
        return response;
      }
    };
    const result = fetchQueue.then(operation);
    fetchQueue = result.catch(() => {});
    return result;
  };
}

function client(role?: Role): any {
  // This demo always resumes its exact signed hash. Nonce replacement detection
  // would add broad full-block RPC reads that the fixed-court gateway rejects.
  const chain = {...studioDevnet, supportsTransactionReplacementDetection: false};
  return createClient({chain, endpoint,
    ...(role && live ? {account: createAccount(live.actors[role].privateKey)} : {})});
}
async function rpc(method: string, params: any[] = []) {
  const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: Date.now(), method, params})});
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message || `Studio returned HTTP ${response.status}.`);
  return body.result;
}
const read = async (functionName: string, args: any[] = []) => jsonSafe(await client().readContract({address: COURT, functionName, args}));
function activity(title: string, detail: string, url?: string) {
  if (!live) return;
  live.demo.activity.push({id: String(live.demo.activity.length), title, detail, status: 'complete', at: new Date().toISOString(), ...(url ? {url} : {})});
  persist();
}
function safeError(error: any) {
  return String(error?.shortMessage || error?.message || 'The test-network step did not complete.').split('\n')[0].slice(0, 500);
}
async function verifyNetwork() {
  if (verifiedThisPage) return;
  const chainId = Number(BigInt(await rpc('eth_chainId')));
  if (chainId !== CHAIN) throw new Error('This demo only operates on Studio test chain 61997.');
  const source = await client().getContractCode(COURT);
  const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();
  if (hashText(normalize(source)) !== hashText(normalize(courtSource))) throw new Error('The live deployed source differs from this app.');
  const stats = await read('get_stats');
  if (stats.contract_version !== '2.0.0' || stats.receipt_schema !== 'counterclaim-ruling-v2' || stats.moves_funds !== true) throw new Error('The authenticated escrow court is unavailable.');
  verifiedThisPage = true;
  if (live) live.proof.network = {chainId, court: COURT, sourceMatchesDeployed: true, normalizedSourceSha256: hashText(normalize(courtSource)), observedAt: new Date().toISOString()};
}
async function ensureFaucet(role: Role) {
  if (!live) throw new Error('No live browser accounts exist.');
  const address = live.actors[role].address;
  const balance = BigInt(await rpc('eth_getBalance', [address, 'latest']));
  if (balance < parseEther('1')) {
    await rpc('sim_fundAccount', [address, FAUCET.toString()]);
    activity(`${role === 'buyer' ? 'Buyer' : 'Seller'} test account funded`, '5 faucet GEN; no personal wallet or mainnet funds.');
  }
}
async function wait(hash: Hex, label: string) {
  const transaction = jsonSafe(await client().waitForFinalization({hash, interval: 5000, retries: 180, fullTransaction: true}));
  assertFinalTransaction(transaction, hash);
  if (live) {
    live.proof.transactions ||= {};
    live.proof.transactions[label] = transaction;
    persist();
  }
  return transaction;
}

async function write(role: Role, functionName: string, args: any[], label: string, value = 0n) {
  if (!live) throw new Error('Start a live browser demo first.');
  await verifyNetwork();
  const identity = hashJson({chainId: CHAIN, court: COURT, sender: live.actors[role].address, functionName, args, value: value.toString()});
  let journal = live.journals[label];
  if (journal && journal.identity !== identity) throw new Error('This step already has a different immutable transaction journal.');
  if (!journal) {journal = live.journals[label] = {identity}; persist();}
  if (!journal.hash) {
    await ensureFaucet(role);
    const sdk = client(role);
    let seed;
    if (functionName === 'claim') seed = claimFeeSeed(await rpc('sim_getFeeConfig'), live.actors[role].address);
    const fees = ['open_case', 'claim'].includes(functionName)
      ? await sdk.estimateTransactionFeesForWrite({address: COURT, functionName, args, value, leaderOnly: false, appealRounds: 0,
        ...(seed ? {totalMessageFees: seed.budget, messageAllocations: [seed.allocation]} : {})})
      : await sdk.estimateTransactionFees({appealRounds: 0});
    if (seed) assertClaimFeeEstimate(fees, seed);
    live.proof.feeEstimates ||= {};
    live.proof.feeEstimates[label] = jsonSafe({distribution: fees.distribution, messageAllocations: fees.messageAllocations || [], feeValue: fees.feeValue});
    persist();
    currentOperation = label;
    try {
      const hash: Hex = await sdk.writeContract({address: COURT, functionName, args, value, leaderOnly: false, fees});
      const attemptedHash = (live.journals[label] as Journal).hash;
      if (attemptedHash && attemptedHash.toLowerCase() !== hash.toLowerCase()) throw new Error('The returned transaction hash differs from its signed envelope.');
      journal.hash = hash; journal.state = 'BROADCAST_CONFIRMED'; persist();
      activity(`${functionName} submitted`, 'Waiting for successful finalization.', `${EXPLORER}/tx/${hash}`);
    } catch (error) {
      if (journal.hash) throw new Error(`A signed transaction is recorded at ${EXPLORER}/tx/${journal.hash}. Retry this same step to resume it; a second transaction will not be signed.`);
      throw error;
    } finally {currentOperation = null;}
  }
  const transaction = await wait(journal.hash!, label);
  journal.finalized = true; persist();
  return {hash: journal.hash!, transaction, explorerUrl: `${EXPLORER}/tx/${journal.hash}`};
}

function initialDemo(actors: {buyer: Actor; seller: Actor}, agreement: any) {
  return {mode: 'live', readOnly: false, phase: 'idle', caseId: undefined, contractUrl: `${EXPLORER}/address/${COURT}`,
    activity: [], signatures: {buyer: false, seller: false}, authorization: {buyer: false, seller: false},
    agreement: {title: fixture.title, budget: '100', unit: 'demo credits', buyer: actors.buyer.address, seller: actors.seller.address, hash: hashJson(agreement)},
    deliverables: fixture.milestones.map((row: any, index: number) => ({id: row.id, title: row.title, description: row.criteria,
      weight: row.weight, status: 'pending', evidence: fixture.evidence[index].content, artifactName: fixture.evidence[index].artifact_name})),
    escrow: {totalWei: ESCROW.toString(), claims: {buyer: false, seller: false}, independent: true}};
}
function newRecord(): Record {
  const actors = Object.fromEntries((['buyer', 'seller'] as Role[]).map(role => {
    const privateKey = generatePrivateKey(); return [role, {privateKey, address: createAccount(privateKey).address}];
  })) as {buyer: Actor; seller: Actor};
  const agreement = {...Object.fromEntries(['title', 'pool', 'unit', 'milestones', 'claims', 'scope'].map(key => [key, structuredClone(fixture[key])])),
    parties: {buyer: actors.buyer.address.toLowerCase(), seller: actors.seller.address.toLowerCase()}};
  const now = Math.floor(Date.now() / 1000);
  return {schema: 'counterclaim-browser-live-v2', actors, agreement, deliveryDeadline: now + 86400,
    refundAfter: now + 172800, demo: initialDemo(actors, agreement), journals: {}, baselines: {},
    proof: {schema: 'counterclaim-browser-proof-v2', synthetic: true, testNetworkOnly: true, chainId: CHAIN, court: COURT,
      agreement, completeEvidence: fixture.evidence, privateKeysIncluded: false}};
}

async function session() {
  mode = 'live';
  if (live?.demo.phase && !['idle', 'settled'].includes(live.demo.phase)) return live.demo;
  if (!live || live.demo.phase === 'settled') {live = newRecord(); persist();}
  activity('Preparing an isolated live test', 'Two disposable accounts are generated in this tab. Their keys never reach the server.');
  await verifyNetwork();
  activity('Live court source verified', 'Studio 61997 and the complete v2 court source match this app.');
  await ensureFaucet('buyer'); await ensureFaucet('seller');
  if (!live.reference) {
    activity('Opening the auxiliary Yellow session', 'Attempting two genuine zero-allocation signatures. Settlement does not depend on Yellow.');
    try {
      live.yellow = await freezeYellow([live.actors.buyer.privateKey, live.actors.seller.privateKey],
        [live.actors.buyer.address, live.actors.seller.address], live.agreement, fixture.evidence);
      live.reference = live.yellow.appSessionId;
      live.proof.yellow = live.yellow;
      live.demo.optionalYellowConnected = true;
      live.demo.session = {id: live.reference, status: 'Yellow evidence frozen', version: Number(live.yellow.version), referenceOnly: false};
      activity('Agreement and evidence frozen on Yellow', 'Both genuine signatures and the current version were read back. Yellow signing connections are now closed.');
    } catch (error) {
      const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
      live.reference = ('0x' + [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')) as Hex;
      live.proof.yellow = {connected: false, error: safeError(error), referenceOnly: true};
      live.demo.optionalYellowConnected = false;
      live.demo.session = {id: live.reference, status: 'GenLayer-only reference (no Yellow session)', referenceOnly: true};
      activity('Continuing without Yellow', 'Its sandbox connection was unavailable. The random reference below is not a Yellow session; authenticated GenLayer escrow remains usable.');
    }
    persist();
  }
  live.demo.phase = 'session_open'; persist(); return live.demo;
}

function updateFromStored(stored: any) {
  if (!live) return;
  live.proof.storedCase = stored;
  const s = stored.snapshot;
  live.demo.caseId = s.case_id;
  live.demo.authorization = {buyer: sameAddress(s.authorization.buyer_opened_by, live.actors.buyer.address),
    seller: sameAddress(s.authorization.seller_accepted_by, live.actors.seller.address),
    deliveredBy: s.authorization.seller_delivered_by || undefined, termsHash: s.terms_hash};
  live.demo.escrow = {...live.demo.escrow, totalWei: s.escrow.total_wei,
    claimTxs: {buyer: live.proof.claims?.buyer?.exactRecipientAndValueMessageVerified === true ? live.proof.claims.buyer.hash : undefined,
      seller: live.proof.claims?.seller?.exactRecipientAndValueMessageVerified === true ? live.proof.claims.seller.hash : undefined},
    claims: {buyer: live.proof.claims?.buyer?.exactRecipientAndValueMessageVerified === true || stored.status === 'RESOLVED' && BigInt(stored.claims.buyer.amount_wei) === 0n,
      seller: live.proof.claims?.seller?.exactRecipientAndValueMessageVerified === true || stored.status === 'RESOLVED' && BigInt(stored.claims.seller.amount_wei) === 0n}};
  if (stored.receipt) {
    const r = stored.receipt;
    live.demo.receipt = r; live.demo.settlementAllowed = r.settlement_allowed;
    live.demo.allocation = r.allocation || undefined;
    if (r.settlement) Object.assign(live.demo.escrow, {buyerWei: r.settlement.buyer_wei, sellerWei: r.settlement.seller_wei});
    live.demo.deliverables = live.demo.deliverables.map((row: any) => ({...row,
      status: r.milestones.find((item: any) => item.id === row.id)?.status === 'SATISFIED' ? 'accepted' :
        r.milestones.find((item: any) => item.id === row.id)?.status === 'NOT_SATISFIED' ? 'missing' : 'pending'}));
  }
  persist();
}
async function adjudicate() {
  if (!live?.reference || !['session_open', 'judging', 'verdict_ready'].includes(live.demo.phase)) throw new Error('Open a fresh live demo first.');
  live.demo.phase = 'judging'; persist();
  activity('Buyer authorization and funding', 'The buyer signs its own complete terms and 0.001 test-GEN escrow deposit.');
  const opened = await write('buyer', 'open_case', [live.reference, canonicalJson(live.agreement), live.deliveryDeadline, live.refundAfter], 'buyer-open', ESCROW);
  if (live.demo.caseId === undefined) {
    live.demo.caseId = await read('get_case_for_session', [live.reference, live.actors.buyer.address]); persist();
  }
  const id = live.demo.caseId;
  let stored = await read('get_case', [id]); updateFromStored(stored);
  if (stored.snapshot.agreement_hash !== hashJson(live.agreement) || stored.snapshot.escrow.total_wei !== ESCROW.toString()) throw new Error('The funded contract case differs from these frozen terms.');
  activity('Seller accepts the exact onchain terms', 'Its separate account accepts the domain-bound terms hash.', opened.explorerUrl);
  await write('seller', 'accept_case', [id, stored.snapshot.terms_hash], 'seller-accept');
  activity('Seller submits the complete artifacts', 'The court stores these bytes from the seller account. The browser relay cannot substitute evidence at review.');
  await write('seller', 'deliver', [id, canonicalJson(fixture.evidence)], 'seller-deliver');
  stored = await read('get_case', [id]); updateFromStored(stored);
  if (stored.snapshot.evidence_hash !== hashJson(fixture.evidence) || !sameAddress(stored.snapshot.authorization.seller_delivered_by, live.actors.seller.address)) throw new Error('The authenticated delivery does not match this complete artifact bundle.');
  activity('Independent GenLayer review', 'Normal multi-validator consensus reads every complete artifact; waiting for successful finalization.');
  const result = await write('seller', 'adjudicate', [id], 'seller-adjudicate');
  stored = await read('get_case', [id]); updateFromStored(stored);
  const r = stored.receipt;
  live.demo.adjudication = {status: 'complete', decision: r?.decision || stored.status, summary: r?.summary,
    transactionHash: result.hash, explorerUrl: result.explorerUrl, receiptHash: stored.receipt_hash,
    acceptedDeliverables: r?.milestones?.filter((row: any) => row.status === 'SATISFIED').length || 0,
    totalDeliverables: fixture.milestones.length};
  if (r?.decision === 'RESOLVED') {
    assertStoredRuling(stored, CHAIN, COURT); assertRulingTransaction(result.transaction, stored, result.hash, COURT);
    live.proof.exactRulingVerified = true;
    activity('Finalized ruling verified', 'Stored complete context, seller authorization, transaction return and monetary allocation agree.', result.explorerUrl);
  } else activity('The jury did not make a conclusive award', 'No guessed payout is enabled. The preaccepted buyer-refund deadline remains in the onchain case.');
  live.demo.phase = 'verdict_ready'; persist(); return live.demo;
}

async function settle() {
  if (!live || live.demo.phase !== 'verdict_ready' || live.demo.settlementAllowed !== true) throw new Error('A conclusive finalized live award is required.');
  let stored = await read('get_case', [live.demo.caseId]);
  assertStoredRuling(stored, CHAIN, COURT);
  const rulingHash = live.journals['seller-adjudicate']?.hash;
  if (!rulingHash) throw new Error('The exact live adjudication journal is missing.');
  const rulingTx = jsonSafe(await client().getTransaction({hash: rulingHash}));
  assertRulingTransaction(rulingTx, stored, rulingHash, COURT);
  const role = (['seller', 'buyer'] as Role[]).find(key => live!.proof.claims?.[key]?.exactRecipientAndValueMessageVerified !== true && BigInt(stored.claims[key].amount_wei) > 0n);
  if (!role) {updateFromStored(stored); live.demo.phase = 'settled'; persist(); return live.demo;}
  await ensureFaucet(role);
  const amount = stored.claims[role].amount_wei, key = role + '-claim';
  if (!live.baselines[key]) {
    live.baselines[key] = {court: BigInt(await rpc('eth_getBalance', [COURT, 'latest'])).toString(),
      recipient: BigInt(await rpc('eth_getBalance', [live.actors[role].address, 'latest'])).toString(), amount}; persist();
  }
  activity(`${role === 'seller' ? 'Seller' : 'Buyer'} claims independently`, 'Only this account signs. No counterparty signature or Yellow update is requested.');
  const result = await write(role, 'claim', [live.demo.caseId], key);
  stored = await read('get_case', [live.demo.caseId]);
  const transaction = jsonSafe(await client().getTransaction({hash: result.hash}));
  assertFinalTransaction(transaction, result.hash); assertClaimTransfer(transaction.messages, live.actors[role].address, amount);
  const deliveredEffect = assertClaimDelivery(transaction, live.actors[role].address, amount);
  if (!stored.claims[role].emitted || stored.claims[role].amount_wei !== amount) throw new Error('The exact one-time award was not persisted.');
  const courtAfter = BigInt(await rpc('eth_getBalance', [COURT, 'latest']));
  // This public court may contain simultaneous visitors' escrows. Its shared
  // aggregate balance is observational; the exact finalized message is the
  // per-case recipient/value proof and never replaced by a global-balance guess.
  live.proof.claims ||= {};
  live.proof.claims[role] = {hash: result.hash, recipient: live.actors[role].address, amountWei: amount,
    finalized: true, exactRecipientAndValueMessageVerified: true, messages: transaction.messages,
    deliveredEffect,
    contractBalanceBeforeWei: live.baselines[key].court, contractBalanceAfterWei: courtAfter.toString(),
    recipientBeforeWei: live.baselines[key].recipient,
    recipientAfterWei: BigInt(await rpc('eth_getBalance', [live.actors[role].address, 'latest'])).toString(),
    recipientBalanceIncludesClaimantFees: true};
  updateFromStored(stored);
  activity(`${role === 'seller' ? 'Seller' : 'Buyer'} award claimed`, 'The successful finalized native transfer names the exact participant and amount. Yellow stayed unchanged.', result.explorerUrl);
  const outstanding = (['buyer', 'seller'] as Role[]).some(key => live!.proof.claims?.[key]?.exactRecipientAndValueMessageVerified !== true && BigInt(stored.claims[key].amount_wei) > 0n);
  live.demo.phase = outstanding ? 'verdict_ready' : 'settled'; persist(); return live.demo;
}

function recordedDemo() {
  const s = recorded.fullStoredCase.snapshot, r = recorded.fullStoredCase.receipt;
  const buyerClaimed = recorded.fullStoredCase.claims.buyer.emitted;
  return {mode: 'recorded', readOnly: true, phase: 'verdict_ready', caseId: recorded.caseId,
    contractUrl: recorded.contractUrl, optionalYellowConnected: true,
    agreement: {title: s.agreement.title, budget: String(s.agreement.pool), unit: 'demo credits',
      buyer: s.agreement.parties.buyer, seller: s.agreement.parties.seller, hash: s.agreement_hash},
    session: {id: recorded.yellow.appSessionId, status: 'Recorded Yellow session: remains open', version: Number(recorded.yellow.after.version), referenceOnly: false},
    deliverables: s.agreement.milestones.map((row: any, i: number) => ({id: row.id, title: row.title, description: row.criteria,
      weight: row.weight, status: r.milestones[i].status === 'SATISFIED' ? 'accepted' : 'missing',
      evidence: s.evidence[i].content, artifactName: s.evidence[i].artifact_name})),
    adjudication: {status: 'complete', decision: r.decision, summary: r.summary, transactionHash: recorded.ruling.hash,
      explorerUrl: recorded.ruling.url, receiptHash: recorded.fullStoredCase.receipt_hash,
      acceptedDeliverables: r.milestones.filter((row: any) => row.status === 'SATISFIED').length, totalDeliverables: r.milestones.length},
    allocation: r.allocation, settlementAllowed: true, signatures: {buyer: false, seller: false},
    authorization: {buyer: true, seller: true, deliveredBy: s.authorization.seller_delivered_by, termsHash: s.terms_hash},
    escrow: {totalWei: r.settlement.total_wei, sellerWei: r.settlement.seller_wei, buyerWei: r.settlement.buyer_wei,
      independent: true, claims: {seller: true, buyer: buyerClaimed}, claimTxs: {seller: recorded.sellerClaim.hash}},
    activity: [{id: 'recorded-ruling', title: 'Recorded finalized ruling · 24 Nov 2026', detail: 'This real 75/25 case is read-only. Start a live demo to create your own isolated test accounts.', url: recorded.ruling.url},
      {id: 'recorded-claim', title: 'Seller withdrew while the buyer did not cooperate', detail: 'Both Yellow signing processes were disconnected; no Yellow write followed evidence freezing.', url: recorded.sellerClaim.url}]};
}
function demoView() {return jsonSafe(mode === 'live' && live ? live.demo : recordedDemo());}
function statusView() {
  return {mode, busy, ...(errorMessage ? {error: errorMessage} : {}),
    yellow: {ready: true, connected: mode === 'live' ? live?.demo.optionalYellowConnected === true : true,
      network: mode === 'live' && live?.demo.optionalYellowConnected === false ? 'Optional · unavailable' : 'Yellow sandbox'},
    genlayer: {ready: true, network: 'Studio Devnet', chainId: CHAIN, contractAddress: COURT,
      reason: verifiedThisPage ? 'Complete live deployed source verified' : 'Source is checked before any live transaction'},
    repositoryUrl: 'https://github.com/zakazaka95/Counterclaim'};
}
function proofView() {
  if (mode === 'recorded' || !live) return structuredClone(recorded);
  return jsonSafe({...live.proof, observedAt: new Date().toISOString(), demo: live.demo,
    journals: live.journals, privateKeysIncluded: false, scope: 'Disposable browser accounts and faucet test GEN. No personal wallet, mainnet funds or server signing keys.'});
}

export async function requestLive(path: string, method = 'GET'): Promise<any> {
  if (method === 'GET') {
    if (path === '/api/status') return statusView();
    if (path === '/api/demo') return demoView();
    if (path === '/api/proof') return proofView();
    throw new Error('Unknown live-demo read.');
  }
  if (method !== 'POST') throw new Error('Unsupported demo request.');
  if (busy) throw new Error('A signed network step is already running.');
  busy = true; errorMessage = '';
  try {
    if (path === '/api/demo/recorded') {mode = 'recorded'; return demoView();}
    if (path === '/api/demo/session') return await session();
    if (mode !== 'live' || !live) throw new Error('Start a live demo; recorded accounts are never used to sign.');
    if (path === '/api/demo/adjudicate') return await adjudicate();
    if (path === '/api/demo/settle') return await settle();
    if (path === '/api/demo/reset') {
      if (live.demo.caseId !== undefined && live.demo.phase !== 'settled') throw new Error('Finish the existing escrow awards before starting another case.');
      live = null; sessionStorage.removeItem(STORAGE_KEY); return await session();
    }
    throw new Error('Unknown live-demo action.');
  } catch (error) {
    errorMessage = safeError(error);
    if (live?.demo.phase === 'judging') live.demo.phase = 'session_open';
    persist(); throw new Error(errorMessage);
  } finally {busy = false; persist();}
}
