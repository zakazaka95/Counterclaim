import {readFile, writeFile, mkdir, cp, access} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createAccount, generatePrivateKey, createClient, isSuccessful,
  MESSAGE_ALLOCATION_ROOT_PARENT_INDEX, deriveExternalMessageCallKey,
  encodeExternalMessageFeeParams} from 'genlayer-js';
import {studioDevnet} from 'genlayer-js/chains';
import {parseEther, keccak256} from 'viem';
import {canonicalJson, hashJson, jsonValue} from './canonical.mjs';
import {assertStoredRuling, assertRulingTransaction, assertClaimTransferMessage} from './verify-ruling.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RPC = process.env.GENLAYER_RPC || 'https://studio-dev.genlayer.com/api';
export const EXPLORER = 'https://explorer-studio-dev.genlayer.com';
export const DEMO_ESCROW_WEI = parseEther('0.001');
const MAX_CLAIM_MESSAGE_BUDGET_WEI = parseEther('0.01');
const LOCAL = path.join(ROOT, '.local');
const PROOF = path.join(ROOT, 'proof');
const SCHEMA = 'counterclaim-ruling-v2';
const HEADERS = {'Content-Type': 'application/json', Origin: new URL(RPC).origin,
  'User-Agent': 'Mozilla/5.0 CounterclaimPartnerDemo/2.0'};
const nativeFetch = globalThis.fetch;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let rpcQueue = Promise.resolve(), lastRpcStart = 0, broadcastRecord = null;

async function load(file) {
  try {return JSON.parse(await readFile(file, 'utf8'));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}
async function save(file, value, options = {}) {
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, JSON.stringify(jsonValue(value), null, 2) + '\n', {mode: 0o600, ...options});
}

// All SDK and raw RPC fetches share the same limit, including receipt polling.
// A broadcast hash is journaled BEFORE the network request so an interrupted run
// never signs the same operation with a fresh nonce on its next invocation.
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url || new URL(url).origin !== new URL(RPC).origin) return nativeFetch(input, init);
  const operation = async () => {
    const remaining = 3500 - (Date.now() - lastRpcStart);
    if (remaining > 0) await pause(remaining);
    lastRpcStart = Date.now();
    let request;
    try {request = JSON.parse(init.body);} catch {}
    const record = broadcastRecord;
    if (record && request?.method === 'eth_sendRawTransaction') {
      const hash = keccak256(request.params[0]);
      await save(record.filename, {...record.value, hash, broadcastAttemptedAt: new Date().toISOString(),
        state: 'BROADCAST_ATTEMPTED'});
    }
    const response = await nativeFetch(input, {...init,
      headers: {...Object.fromEntries(new Headers(init.headers || {})), ...HEADERS}});
    if (record && request?.method === 'eth_sendRawTransaction') {
      const prior = await load(record.filename);
      let body;
      try {body = await response.clone().json();} catch {}
      await save(record.filename, {...prior, httpStatus: response.status,
        returnedHash: body?.result || null, rpcError: body?.error || null,
        state: body?.result ? 'BROADCAST_CONFIRMED' : 'BROADCAST_REQUIRES_INSPECTION'});
    }
    return response;
  };
  const result = rpcQueue.then(operation);
  rpcQueue = result.catch(() => {});
  return result;
};

export async function rpc(method, params = []) {
  const response = await fetch(RPC, {method: 'POST', headers: HEADERS,
    body: JSON.stringify({jsonrpc: '2.0', id: Date.now(), method, params})});
  if (!response.ok) throw new Error(`Studio API HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message || JSON.stringify(body.error)}`);
  return body.result;
}
export async function saveProof(name, value) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) throw new Error('Invalid proof name');
  await save(path.join(PROOF, name + '.json'), value);
}

/** Exact external EOA transfer envelope, quoted from the active Studio policy. */
export function claimFeeSeed(config, recipient) {
  const positive = (value, field, allowZero = false) => {
    if (typeof value !== 'bigint' && (typeof value !== 'string' || !/^[0-9]+$/.test(value))) {
      throw new Error(`Studio fee policy is missing a decimal ${field}; no claim broadcast`);
    }
    const result = BigInt(value);
    if (result < 0n || (!allowZero && result === 0n) || result >= (1n << 256n)) throw new Error(`Studio fee policy has an invalid ${field}; no claim broadcast`);
    return result;
  };
  if (config?.enabled !== true || config?.capabilities?.messageFees?.externalFinalization?.genvmExecution !== true) {
    throw new Error('Studio has not advertised funded external finalization; no claim broadcast');
  }
  if (typeof recipient !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error('Exact claim recipient is required');
  const minimumGas = positive(config.policy?.minExternalGasLimit, 'minExternalGasLimit', true);
  const defaultGas = positive(config.policy?.defaultExternalGasLimit, 'defaultExternalGasLimit');
  const receiptPrice = positive(config.policy?.receiptGasPrice, 'receiptGasPrice');
  const maxGasPrice = positive(config.defaultFees?.distribution?.receiptFeeMaxGasPrice, 'receiptFeeMaxGasPrice');
  if (maxGasPrice < receiptPrice) throw new Error('Studio external price cap is below its current quote; no claim broadcast');
  const gasLimit = defaultGas > minimumGas ? defaultGas : minimumGas;
  const budget = gasLimit * maxGasPrice;
  if (budget > MAX_CLAIM_MESSAGE_BUDGET_WEI) throw new Error('Quoted claim message fee exceeds the 0.01 test-GEN demo cap; no claim broadcast');
  const allocation = {messageType: 0, onAcceptance: false, parentIndex: MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
    recipient, callKey: deriveExternalMessageCallKey('0x'), budget,
    feeParams: encodeExternalMessageFeeParams({gasLimit, maxGasPrice})};
  return {gasLimit, maxGasPrice, budget, allocation};
}

export async function archiveV1Proofs() {
  const current = await load(path.join(PROOF, 'deployment.json'));
  if (!current || current.stats?.receipt_schema === SCHEMA) return;
  const target = path.join(ROOT, 'demo', 'historical-v1-proof');
  try {await access(path.join(target, 'deployment.json')); return;} catch {}
  await cp(PROOF, target, {recursive: true, filter: file => !file.endsWith('-transaction.json')});
}

async function account() {
  const target = path.join(LOCAL, 'genlayer-account.json');
  let saved = await load(target);
  if (!saved) {
    saved = {privateKey: generatePrivateKey(), purpose: 'Isolated Studio-only synthetic demo account'};
    await save(target, saved, {flag: 'wx'});
  }
  return createAccount(saved.privateKey);
}

export async function createGenLayerRuntime() {
  const chainId = Number(BigInt(await rpc('eth_chainId')));
  if (chainId !== 61997) throw new Error(`Expected Studio Devnet 61997, received ${chainId}`);
  const signer = await account();
  const clientFor = account => createClient({chain: studioDevnet, endpoint: RPC, account});
  const client = clientFor(signer);
  let deployment = await load(path.join(LOCAL, 'deployment-v2.json'));
  const trackedSourceSha256 = createHash('sha256').update(await readFile(path.join(ROOT, 'contracts/CounterclaimCourt.py'))).digest('hex');
  let participants = null;
  let writeQueue = Promise.resolve();

  function attachParticipants(privateKeys, expectedAddresses) {
    if (!Array.isArray(privateKeys) || privateKeys.length !== 2 || !Array.isArray(expectedAddresses) || expectedAddresses.length !== 2) {
      throw new Error('Exactly two isolated Yellow participant keys and their public addresses are required');
    }
    const accounts = privateKeys.map(createAccount);
    if (accounts.some((a, i) => a.address.toLowerCase() !== expectedAddresses[i].toLowerCase()) ||
        accounts[0].address.toLowerCase() === accounts[1].address.toLowerCase()) {
      throw new Error('GenLayer signers must be the exact distinct Yellow buyer and seller');
    }
    participants = Object.fromEntries(['buyer', 'seller'].map((role, i) => [role,
      {account: accounts[i], client: clientFor(accounts[i])}]));
    return Object.fromEntries(Object.entries(participants).map(([role, value]) => [role, value.account.address]));
  }
  const actor = role => {
    if (!participants?.[role]) throw new Error('Attach the exact Yellow participant signers first');
    return participants[role];
  };

  async function ensureFaucet(address = signer.address) {
    const permitted = [signer.address, ...Object.values(participants || {}).map(p => p.account.address)];
    if (!permitted.some(a => a.toLowerCase() === address.toLowerCase())) throw new Error('Only isolated demo accounts may be faucet funded');
    const balance = BigInt(await rpc('eth_getBalance', [address, 'latest']));
    if (balance < parseEther('10')) await rpc('sim_fundAccount', [address, parseEther('100').toString()]);
    return {address, balance: await rpc('eth_getBalance', [address, 'latest'])};
  }

  async function wait(hash, name) {
    await saveProof(name + '-submitted', {hash, explorerUrl: `${EXPLORER}/tx/${hash}`, observedAt: new Date().toISOString()});
    const transaction = jsonValue(await client.waitForFinalization({hash, interval: 5000,
      retries: 180, fullTransaction: true}));
    await saveProof(name + '-transaction', transaction);
    if (!isSuccessful(transaction) || transaction.statusName !== 'FINALIZED') {
      throw new Error(`${name} did not finalize successfully: ${transaction.statusName || transaction.status}; hash retained for inspection`);
    }
    return transaction;
  }

  async function trackedSubmit(identity, name, submit) {
    const perform = async () => {
      const identityHash = hashJson(jsonValue(identity));
      const filename = path.join(LOCAL, 'transactions-v2', identityHash + '.json');
      let prior = await load(filename);
      if (prior && prior.identityHash !== identityHash) throw new Error('Pending transaction identity changed');
      if (!prior) {
        const value = {identityHash, identity: jsonValue(identity), name, createdAt: new Date().toISOString()};
        broadcastRecord = {filename, value};
        try {
          const hash = await submit();
          prior = await load(filename);
          if (prior?.hash && prior.hash.toLowerCase() !== hash.toLowerCase()) throw new Error('Broadcast returned an unexpected transaction hash');
          prior = {...(prior || value), hash, state: 'BROADCAST_CONFIRMED'};
          await save(filename, prior);
          console.log(`GenLayer ${name} submitted: ${hash}`);
        } catch (error) {
          const attempted = await load(filename);
          if (attempted?.hash) {
            throw new Error(`${name} broadcast outcome requires inspection at ${EXPLORER}/tx/${attempted.hash}; the same operation will resume this hash, never re-sign. ${error.message}`);
          }
          throw error;
        } finally {broadcastRecord = null;}
      }
      if (!/^0x[0-9a-fA-F]{64}$/.test(prior.hash)) throw new Error('Stored operation has no valid transaction hash');
      const transaction = await wait(prior.hash, name);
      return {hash: prior.hash, transaction, explorerUrl: `${EXPLORER}/tx/${prior.hash}`};
    };
    const result = writeQueue.then(perform);
    writeQueue = result.catch(() => {});
    return result;
  }

  async function read(functionName, args = []) {
    if (!deployment?.address) throw new Error('Deploy CounterclaimCourt v2 first');
    return jsonValue(await client.readContract({address: deployment.address, functionName, args}));
  }
  async function verifySource(code) {
    const deployedCode = await client.getContractCode(deployment.address);
    const normalize = text => text.replace(/\r\n/g, '\n').trim();
    if (normalize(deployedCode) !== normalize(code.toString('utf8'))) throw new Error('Complete deployed source differs from tracked source');
    const stats = await read('get_stats');
    if (stats.receipt_schema !== SCHEMA) throw new Error('Deployed court is not the participant-authorized escrow version');
    deployment = {...deployment, executionVerified: true,
      sourceComparison: 'Complete deployed source matches after LF/edge-whitespace normalization', stats};
    await save(path.join(LOCAL, 'deployment-v2.json'), deployment);
    await saveProof('deployment', deployment);
    return deployment;
  }
  async function deploy() {
    await archiveV1Proofs();
    const code = await readFile(path.join(ROOT, 'contracts/CounterclaimCourt.py'));
    const sourceSha256 = createHash('sha256').update(code).digest('hex');
    if (deployment) {
      if (deployment.sourceSha256 !== sourceSha256) throw new Error('Cached v2 deployment source differs; archive its configuration before a deliberate new deployment');
      return verifySource(code);
    }
    await saveProof('schema-check-sdk', await client.getContractSchemaForCode(code));
    const tx = await trackedSubmit({kind: 'deployment', chainId, sourceSha256, account: signer.address}, 'deployment', async () => {
      await ensureFaucet();
      const fees = await client.estimateTransactionFees({appealRounds: 0});
      return client.deployContract({code, args: [], leaderOnly: false, fees});
    });
    const address = tx.transaction.data?.contract_address || tx.transaction.txDataDecoded?.contractAddress || tx.transaction.contractAddress;
    if (!address) throw new Error('Finalized deployment has no decoded contract address');
    deployment = {address, txHash: tx.hash, chainId, rpc: RPC, explorerUrl: `${EXPLORER}/address/${address}`,
      sourceSha256, sourceFile: 'contracts/CounterclaimCourt.py', deployedAt: new Date().toISOString(),
      executionVerified: false, leaderOnly: false, value: '0', account: signer.address};
    await save(path.join(LOCAL, 'deployment-v2.json'), deployment);
    return verifySource(code);
  }
  async function writeAs(role, functionName, args, name, value = 0n) {
    const acting = actor(role);
    if (!deployment?.executionVerified || deployment.sourceSha256 !== trackedSourceSha256) {
      throw new Error('Verify the complete matching deployed v2 source before writing');
    }
    return trackedSubmit({kind: 'write', chainId, contractAddress: deployment.address,
      account: acting.account.address, functionName, args, value: value.toString()}, name, async () => {
      await ensureFaucet(acting.account.address);
      let claimSeed = null;
      if (functionName === 'claim') {
        if (value !== 0n) throw new Error('A participant claim must not send additional value');
        const config = await rpc('sim_getFeeConfig');
        claimSeed = claimFeeSeed(config, acting.account.address);
        await saveProof(role + '-claim-fee-policy', {observedAt: new Date().toISOString(),
          policy: config.policy, defaultFees: config.defaultFees,
          exactExternalAllocation: claimSeed.allocation, messageBudgetWei: claimSeed.budget});
      }
      const fees = ['claim', 'open_case'].includes(functionName)
        ? await acting.client.estimateTransactionFeesForWrite({address: deployment.address, functionName, args,
          value, leaderOnly: false, appealRounds: 0,
          ...(claimSeed ? {totalMessageFees: claimSeed.budget, messageAllocations: [claimSeed.allocation]} : {})})
        : await acting.client.estimateTransactionFees({appealRounds: 0});
      if (functionName === 'claim') {
        await saveProof(role + '-claim-fee-estimate', {observedAt: new Date().toISOString(),
          concreteMessageBudgetSeedWei: claimSeed.budget.toString(),
          distribution: fees.distribution, messageAllocations: fees.messageAllocations || [],
          feeValue: fees.feeValue, observed: fees.observed || null});
        const allocation = fees.messageAllocations?.[0];
        if (fees.messageAllocations?.length !== 1 || allocation.messageType !== 0 || allocation.onAcceptance !== false ||
            allocation.recipient?.toLowerCase() !== acting.account.address.toLowerCase() ||
            allocation.callKey !== claimSeed.allocation.callKey || allocation.feeParams !== claimSeed.allocation.feeParams ||
            BigInt(allocation.budget) < claimSeed.budget || BigInt(allocation.budget) % claimSeed.budget !== 0n ||
            BigInt(fees.distribution.totalMessageFees) < BigInt(allocation.budget) ||
            BigInt(fees.distribution.totalMessageFees) > MAX_CLAIM_MESSAGE_BUDGET_WEI) {
          throw new Error('Authoritative claim estimate did not preserve the exact funded recipient, call key and finalization envelope; no transaction broadcast');
        }
      }
      return acting.client.writeContract({address: deployment.address, functionName, args, value, leaderOnly: false, fees});
    });
  }

  async function openCase({sessionId, agreement, evidence}) {
    const buyer = actor('buyer').account.address;
    const seller = actor('seller').account.address;
    if (agreement.parties.buyer.toLowerCase() !== buyer.toLowerCase() || agreement.parties.seller.toLowerCase() !== seller.toLowerCase()) {
      throw new Error('The frozen agreement must name the exact authenticated transaction signers');
    }
    const timingFile = path.join(LOCAL, 'case-timing-v2', hashJson({sessionId, buyer}) + '.json');
    let timing = await load(timingFile);
    if (!timing) {
      timing = {deliveryDeadline: Math.floor(Date.now() / 1000) + 3600, refundAfter: Math.floor(Date.now() / 1000) + 86400};
      await save(timingFile, timing, {flag: 'wx'});
    }
    const tx = await writeAs('buyer', 'open_case', [sessionId, canonicalJson(agreement), timing.deliveryDeadline, timing.refundAfter], 'case-open', DEMO_ESCROW_WEI);
    const caseId = await read('get_case_for_session', [sessionId, buyer]);
    let stored = await read('get_case', [caseId]);
    if (stored.snapshot.agreement_hash !== hashJson(agreement) || stored.snapshot.escrow.total_wei !== DEMO_ESCROW_WEI.toString()) {
      throw new Error('Buyer-funded case differs from the frozen agreement or escrow');
    }
    const accepted = await writeAs('seller', 'accept_case', [caseId, stored.snapshot.terms_hash], 'seller-accept');
    const delivered = await writeAs('seller', 'deliver', [caseId, canonicalJson(evidence)], 'seller-delivery');
    stored = await read('get_case', [caseId]);
    if (stored.snapshot.evidence_hash !== hashJson(evidence) ||
        stored.snapshot.authorization.seller_delivered_by?.toLowerCase() !== seller.toLowerCase() ||
        stored.snapshot.authorization.buyer_opened_by?.toLowerCase() !== buyer.toLowerCase() || stored.status !== 'FROZEN') {
      throw new Error('Contract did not authenticate and freeze the exact seller delivery');
    }
    await saveProof('case-open-readback', {caseId, ...stored, txHash: tx.hash,
      authorizationTransactions: {buyerOpened: tx.hash, sellerAccepted: accepted.hash, sellerDelivered: delivered.hash}});
    return {caseId, stored, ...tx, authorizationTransactions: {buyerOpened: tx, sellerAccepted: accepted, sellerDelivered: delivered}};
  }
  async function adjudicate(caseId, role = 'seller') {
    const tx = await writeAs(role, 'adjudicate', [caseId], 'adjudication');
    const stored = await read('get_case', [caseId]);
    if (!stored.receipt || stored.receipt_hash !== hashJson(stored.receipt)) throw new Error('Stored receipt digest mismatch');
    await saveProof('adjudication-readback', {caseId, ...stored, txHash: tx.hash, contractAddress: deployment.address,
      caller: actor(role).account.address});
    return {...tx, caseId, stored};
  }
  async function claim(caseId, role) {
    const before = await read('get_case', [caseId]);
    const allocation = before.claims[role];
    if (!allocation || BigInt(allocation.amount_wei) <= 0n) throw new Error('No positive finalized allocation for this participant');
    await ensureFaucet(actor(role).account.address);
    const balanceFile = path.join(LOCAL, 'claim-balances-v2', hashJson({contract: deployment.address, caseId, role}) + '.json');
    let baseline = await load(balanceFile);
    if (!baseline) {
      if (allocation.emitted) throw new Error('Claim was already emitted outside this runtime; inspect its exact transaction before resuming');
      baseline = {contractBalanceWei: BigInt(await rpc('eth_getBalance', [deployment.address, 'latest'])).toString(),
        recipientBalanceWei: BigInt(await rpc('eth_getBalance', [actor(role).account.address, 'latest'])).toString(),
        amountWei: allocation.amount_wei, observedAt: new Date().toISOString()};
      await save(balanceFile, baseline, {flag: 'wx'});
    }
    const tx = await writeAs(role, 'claim', [caseId], role + '-claim');
    const stored = await read('get_case', [caseId]);
    if (!stored.claims[role].emitted || stored.claims[role].amount_wei !== allocation.amount_wei) throw new Error('One-time participant claim was not persisted');
    let afterBalance;
    for (let attempt = 0; attempt < 18; attempt++) {
      afterBalance = BigInt(await rpc('eth_getBalance', [deployment.address, 'latest']));
      if (BigInt(baseline.contractBalanceWei) - afterBalance === BigInt(allocation.amount_wei)) break;
      if (attempt === 17) throw new Error('Claim finalized but its native transfer debit has not been observed; hash retained, do not claim again');
    }
    const balanceProof = {beforeWei: baseline.contractBalanceWei, afterWei: afterBalance.toString(),
      debitWei: (BigInt(baseline.contractBalanceWei) - afterBalance).toString(), exactClaimDebitObserved: true,
      recipientBeforeWei: baseline.recipientBalanceWei,
      recipientAfterWei: BigInt(await rpc('eth_getBalance', [actor(role).account.address, 'latest'])).toString(),
      recipientBalanceIncludesClaimantNetworkFees: true};
    const finalTransaction = jsonValue(await client.getTransaction({hash: tx.hash}));
    const transferMessages = {messages: finalTransaction.messages || [],
      triggeredTransactions: finalTransaction.triggered_transactions || [], fees: finalTransaction.fees || null};
    assertClaimTransferMessage(transferMessages.messages, {recipient: actor(role).account.address, amountWei: allocation.amount_wei});
    balanceProof.exactRecipientAndValueMessageVerified = true;
    balanceProof.recipientNetChangeWei = (BigInt(balanceProof.recipientAfterWei) - BigInt(balanceProof.recipientBeforeWei)).toString();
    const result = {...tx, role, recipient: actor(role).account.address, amountWei: allocation.amount_wei, stored, balanceProof, transferMessages};
    await saveProof(role + '-claim-readback', {caseId, recipient: result.recipient, amountWei: result.amountWei,
      transactionHash: tx.hash, finalized: true, persistedClaim: stored.claims[role], balanceProof, transferMessages,
      note: 'The finalized participant claim and exact native contract-balance debit were both observed.'});
    return result;
  }
  async function verifyGenLayer(input) {
    if (input.chainId !== chainId || input.contractAddress.toLowerCase() !== deployment.address.toLowerCase()) throw new Error('Verdict comes from another chain or contract');
    const stored = await read('get_case', [input.receipt.case_id]);
    const receipt = stored.receipt;
    assertStoredRuling(stored, {receipt: input.receipt, chainId, contractAddress: deployment.address});
    const transaction = jsonValue(await client.getTransaction({hash: input.txHash}));
    const caller = transaction.from_address || transaction.sender;
    if (![stored.snapshot.agreement.parties.buyer, stored.snapshot.agreement.parties.seller].some(a => a.toLowerCase() === caller?.toLowerCase())) {
      throw new Error('Adjudication was not submitted by an authorized participant');
    }
    assertRulingTransaction({transaction, receipt, txHash: input.txHash, contractAddress: deployment.address, owner: caller});
    return {verified: true, receipt, txHash: input.txHash, contractAddress: deployment.address, chainId,
      binding: {appSessionId: receipt.session_id, agreementHash: receipt.agreement_hash, evidenceHash: receipt.evidence_hash,
        caseId: receipt.case_id, allocation: {worker: receipt.allocation.seller, client: receipt.allocation.buyer,
          total: receipt.allocation.total, unit: 'DEMO_CREDITS'}}};
  }
  return {client, chainId, signerAddress: signer.address, get deployment() {return deployment;},
    attachParticipants, ensureFaucet, deploy, read, writeAs, openCase, adjudicate, claim, verifyGenLayer};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const runtime = await createGenLayerRuntime();
    if (process.argv[2] === 'deploy') console.log(JSON.stringify(await runtime.deploy(), null, 2));
    else console.log(JSON.stringify({chainId: runtime.chainId, account: runtime.signerAddress, deployment: runtime.deployment}, null, 2));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
