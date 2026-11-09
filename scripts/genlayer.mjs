import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createAccount, generatePrivateKey, createClient, isSuccessful} from 'genlayer-js';
import {studioDevnet} from 'genlayer-js/chains';
import {parseEther} from 'viem';
import {canonicalJson, hashJson, jsonValue} from './canonical.mjs';
import {assertStoredRuling, assertRulingTransaction} from './verify-ruling.mjs';
import {trackedWrite} from './tracked-write.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RPC = process.env.GENLAYER_RPC || 'https://studio-dev.genlayer.com/api';
export const EXPLORER = 'https://explorer-studio-dev.genlayer.com';
const LOCAL = path.join(ROOT, '.local');
const PROOF = path.join(ROOT, 'proof');
const HEADERS = {'Content-Type': 'application/json', Origin: new URL(RPC).origin, 'User-Agent': 'Mozilla/5.0 CounterclaimPartnerDemo/1.0'};
const nativeFetch = globalThis.fetch;

// The hosted Studio API expects its own Origin even for a local SDK client.
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url && new URL(url).origin === new URL(RPC).origin) {
    return nativeFetch(input, {...init, headers: {...Object.fromEntries(new Headers(init.headers || {})), ...HEADERS}});
  }
  return nativeFetch(input, init);
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
  await mkdir(PROOF, {recursive: true});
  await writeFile(path.join(PROOF, name + '.json'), JSON.stringify(jsonValue(value), null, 2) + '\n');
}

async function account() {
  await mkdir(LOCAL, {recursive: true});
  const target = path.join(LOCAL, 'genlayer-account.json');
  let saved;
  try { saved = JSON.parse(await readFile(target, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    saved = {privateKey: generatePrivateKey(), purpose: 'Isolated Studio-only synthetic demo account'};
    await writeFile(target, JSON.stringify(saved), {mode: 0o600, flag: 'wx'});
  }
  return createAccount(saved.privateKey);
}

export async function createGenLayerRuntime() {
  const chainId = Number(BigInt(await rpc('eth_chainId')));
  if (chainId !== 61997) throw new Error(`Expected Studio Devnet 61997, received ${chainId}`);
  const signer = await account();
  const client = createClient({chain: studioDevnet, endpoint: RPC, account: signer});
  let deployment = null;
  try { deployment = JSON.parse(await readFile(path.join(LOCAL, 'deployment.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Public proof is historical evidence, never a clone's signing configuration.
  // Only migrate an existing local run when its isolated signer is the same owner.
  if (!deployment) {
    try {
      const previous = JSON.parse(await readFile(path.join(PROOF, 'deployment.json'), 'utf8'));
      if (previous.account?.toLowerCase() === signer.address.toLowerCase()) {
        deployment = previous;
        await writeFile(path.join(LOCAL, 'deployment.json'), JSON.stringify(previous, null, 2) + '\n');
      }
    } catch (error) {if (error.code !== 'ENOENT') throw error;}
  }

  async function ensureFaucet() {
    const balance = BigInt(await rpc('eth_getBalance', [signer.address, 'latest']));
    if (balance < parseEther('10')) {
      await rpc('sim_fundAccount', [signer.address, parseEther('100').toString()]);
    }
    return {address: signer.address, balance: await rpc('eth_getBalance', [signer.address, 'latest'])};
  }

  async function wait(hash, name) {
    await saveProof(name + '-submitted', {hash, explorerUrl: `${EXPLORER}/tx/${hash}`, observedAt: new Date().toISOString()});
    const result = jsonValue(await client.waitForTransactionReceipt({hash, waitUntil: 'decided', interval: 2000,
      retries: 180, fullTransaction: true}));
    await saveProof(name + '-transaction', result);
    if (!isSuccessful(result)) {
      throw new Error(`${name} did not execute successfully: ${result.statusName || result.status}; inspect proof/${name}-transaction.json`);
    }
    return result;
  }

  async function deploy() {
    await ensureFaucet();
    const code = await readFile(path.join(ROOT, 'contracts/CounterclaimCourt.py'));
    const sourceSha256 = createHash('sha256').update(code).digest('hex');
    if (deployment && deployment.sourceSha256 === sourceSha256) {
      const stats = await read('get_stats');
      const deployedCode = await client.getContractCode(deployment.address);
      const normalize = text => text.replace(/\r\n/g, '\n').trim();
      if (stats.receipt_schema === 'counterclaim-ruling-v1' && stats.owner.toLowerCase() === signer.address.toLowerCase() &&
          normalize(deployedCode) === normalize(code.toString('utf8'))) return deployment;
      throw new Error('Cached deployment no longer matches the complete source and configured owner');
    }
    const schema = await client.getContractSchemaForCode(code);
    await saveProof('schema-check-sdk', schema);
    const fees = await client.estimateTransactionFees({appealRounds: 0});
    const tx = await client.deployContract({code, args: [], leaderOnly: false, fees});
    console.log(`GenLayer deployment submitted: ${tx}`);
    const receipt = await wait(tx, 'deployment');
    const address = receipt.data?.contract_address || receipt.txDataDecoded?.contractAddress || receipt.contractAddress;
    if (!address) throw new Error('Deployment succeeded without a decoded contract address; inspect receipt');
    deployment = {address, txHash: tx, chainId, rpc: RPC, explorerUrl: `${EXPLORER}/address/${address}`,
      sourceSha256, sourceFile: 'contracts/CounterclaimCourt.py', deployedAt: new Date().toISOString(),
      executionVerified: true, leaderOnly: false, value: '0', account: signer.address};
    const stats = await read('get_stats');
    if (stats.receipt_schema !== 'counterclaim-ruling-v1' || stats.owner.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error('Persisted deployed contract state does not match the intended source/account');
    }
    const deployedCode = await client.getContractCode(address);
    const normalize = text => text.replace(/\r\n/g, '\n').trim();
    if (normalize(deployedCode) !== normalize(code.toString('utf8'))) throw new Error('Deployed source differs from tracked source');
    deployment.sourceComparison = 'Complete deployed source matches after LF/edge-whitespace normalization';
    deployment.stats = stats;
    await writeFile(path.join(LOCAL, 'deployment.json'), JSON.stringify(deployment, null, 2) + '\n');
    await saveProof('deployment', deployment);
    return deployment;
  }

  async function read(functionName, args = []) {
    if (!deployment?.address) throw new Error('Deploy CounterclaimCourt first with npm run setup:genlayer');
    return jsonValue(await client.readContract({address: deployment.address, functionName, args}));
  }

  async function write(functionName, args, name) {
    const {hash, transaction} = await trackedWrite({directory: path.join(LOCAL, 'transactions'),
      identity: {chainId, contractAddress: deployment.address, functionName, args},
      submit: async () => {
        await ensureFaucet();
        const fees = await client.estimateTransactionFees({appealRounds: 0});
        const hash = await client.writeContract({address: deployment.address, functionName, args, value: 0n, leaderOnly: false, fees});
        console.log(`GenLayer ${functionName} submitted: ${hash}`);
        return hash;
      }, wait: hash => wait(hash, name)});
    return {hash, transaction, explorerUrl: `${EXPLORER}/tx/${hash}`};
  }

  async function openCase({sessionId, agreement, evidence}) {
    const tx = await write('open_case', [sessionId, canonicalJson(agreement), canonicalJson(evidence)], 'case-open');
    const caseId = await read('get_case_for_session', [sessionId]);
    const stored = await read('get_case', [caseId]);
    if (stored.snapshot.agreement_hash !== hashJson(agreement) || stored.snapshot.evidence_hash !== hashJson(evidence)) {
      throw new Error('Persisted GenLayer case does not bind the complete frozen inputs');
    }
    await saveProof('case-open-readback', {caseId, ...stored, txHash: tx.hash});
    return {caseId, stored, ...tx};
  }

  async function adjudicate(caseId) {
    const tx = await write('adjudicate', [caseId], 'adjudication');
    const finalized = jsonValue(await client.waitForFinalization({hash: tx.hash, interval: 2000, retries: 180, fullTransaction: true}));
    if (!isSuccessful(finalized) || finalized.statusName !== 'FINALIZED') throw new Error('Adjudication did not finalize successfully');
    await saveProof('adjudication-finalized-transaction', finalized);
    const stored = await read('get_case', [caseId]);
    if (!stored.receipt || stored.receipt_hash !== hashJson(stored.receipt)) throw new Error('Stored receipt digest mismatch');
    await saveProof('adjudication-readback', {caseId, ...stored, txHash: tx.hash, contractAddress: deployment.address});
    return {...tx, caseId, stored};
  }

  async function verifyGenLayer(input) {
    if (input.chainId !== chainId || input.contractAddress.toLowerCase() !== deployment.address.toLowerCase()) {
      throw new Error('Verdict comes from another chain or contract');
    }
    const stored = await read('get_case', [input.receipt.case_id]);
    const receipt = stored.receipt;
    assertStoredRuling(stored, {receipt: input.receipt, chainId, contractAddress: deployment.address});
    const transaction = jsonValue(await client.getTransaction({hash: input.txHash}));
    assertRulingTransaction({transaction, receipt, txHash: input.txHash, contractAddress: deployment.address, owner: signer.address});
    return {verified: true, receipt, txHash: input.txHash, contractAddress: deployment.address, chainId,
      binding: {appSessionId: receipt.session_id, agreementHash: receipt.agreement_hash, evidenceHash: receipt.evidence_hash,
        caseId: receipt.case_id, allocation: {worker: receipt.allocation.seller, client: receipt.allocation.buyer,
          total: receipt.allocation.total, unit: 'DEMO_CREDITS'}}};
  }

  return {client, chainId, signerAddress: signer.address, get deployment() {return deployment;},
    ensureFaucet, deploy, read, openCase, adjudicate, verifyGenLayer};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const runtime = await createGenLayerRuntime();
    if (process.argv[2] === 'deploy') console.log(JSON.stringify(await runtime.deploy(), null, 2));
    else console.log(JSON.stringify({chainId: runtime.chainId, account: runtime.signerAddress,
      deployment: runtime.deployment, feePolicy: jsonValue(await runtime.client.getCurrentFeePolicy())}, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
