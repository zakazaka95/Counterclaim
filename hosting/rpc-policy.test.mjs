import test from 'node:test';
import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
import {studioDevnet} from 'genlayer-js/chains';
import {encodeFunctionData} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {CHAIN_ID, COURT, CONSENSUS, MAX_BODY_BYTES, validateRpcRequest, readRpcBody} from './rpc-policy.mjs';
import {reserveRpcSlot, RPC_INTERVAL_MS, MAX_QUEUE_MS} from './pacing.mjs';

// Public deterministic test identity, never used on a network.
const account = privateKeyToAccount('0x' + '1'.repeat(64));
const other = '0x' + '9'.repeat(40);
const hash = '0x' + '2'.repeat(64);
const rpc = (method, params = []) => ({jsonrpc: '2.0', id: 1, method, params});
const call = (name, args = [], leader = false) => abi.transactions.serialize([abi.calldata.encode(abi.calldata.makeCalldataObject(name, args)), leader]);
function envelope(overrides = {}, name = 'adjudicate', args = [0], leader = false) {
  const distribution = {leaderTimeunitsAllocation: 100n, validatorTimeunitsAllocation: 200n, appealRounds: 0n,
    executionBudgetPerRound: 25_000_000_000_000_000n, executionConsumed: 0n, totalMessageFees: 0n,
    rotations: [3n], maxPriceGenPerTimeUnit: 2n, storageFeeMaxGasPrice: 300_000_000n, receiptFeeMaxGasPrice: 300_000_000n};
  const params = {sender: account.address, recipient: COURT, numOfInitialValidators: 5n, maxRotations: 3n,
    validUntil: 2_000_000_000n, saltNonce: 0n, userValue: 0n, feesDistribution: distribution,
    txCalldata: call(name, args, leader), messageAllocations: [], ...overrides};
  return {to: CONSENSUS, from: account.address, value: '0x100000', data: encodeFunctionData({abi: studioDevnet.consensusMainContract.abi,
    functionName: 'addTransaction', args: [params]})};
}
async function signed(transaction = envelope(), chainId = CHAIN_ID) {
  return account.signTransaction({to: transaction.to, data: transaction.data, value: BigInt(transaction.value),
    nonce: 0, gas: 200_000n, gasPrice: 1n, chainId});
}

test('locally signed normal consensus call targets the fixed court and is accepted', async () => {
  await validateRpcRequest(rpc('eth_sendRawTransaction', [await signed()]));
  await validateRpcRequest(rpc('eth_estimateGas', [envelope()]));
});
test('another chain, recipient or forged declared sender cannot use the gateway', async () => {
  await assert.rejects(validateRpcRequest(rpc('eth_sendRawTransaction', [await signed(envelope(), 1)])), /chain 61997/);
  for (const change of [{recipient: other}, {recipient: '0x' + '0'.repeat(40)}, {sender: other}]) {
    await assert.rejects(validateRpcRequest(rpc('eth_sendRawTransaction', [await signed(envelope(change))])));
  }
  await assert.rejects(validateRpcRequest(rpc('eth_sendRawTransaction', [await signed({...envelope(), to: other})])), /entry point/);
});
test('the proxy cannot turn into deployment, arbitrary writes or leader-only execution', async () => {
  for (const [name, args, leader] of [['deploy_contract', [], false], ['adjudicate', [0], true], ['get_case', [0], false]]) {
    await assert.rejects(validateRpcRequest(rpc('eth_sendRawTransaction', [await signed(envelope({}, name, args, leader))])));
  }
  await assert.rejects(validateRpcRequest(rpc('eth_sendTransaction', [envelope()])), /not available/);
});
test('views and simulations use the fixed contract, exact method class and bounded arguments', async () => {
  const view = {type: 'read', from: account.address, to: COURT, data: call('get_case', [0]), transaction_hash_variant: 'latest-nonfinal'};
  await validateRpcRequest(rpc('gen_call', [view]));
  await validateRpcRequest(rpc('sim_estimateTransactionFees', [{...view, type: 'write', data: call('claim', [0])}]));
  for (const changes of [{to: other}, {data: call('claim', [0])}, {data: call('get_case', [-1])}, {data: call('get_case', [0], true)}, {url: 'https://example.com'}]) {
    await assert.rejects(validateRpcRequest(rpc('gen_call', [{...view, ...changes}])));
  }
  await assert.rejects(validateRpcRequest(rpc('gen_getContractCode', [other])));
});
test('faucet and native user value cannot exceed the disposable test flow', async () => {
  await validateRpcRequest(rpc('sim_fundAccount', [account.address, '5000000000000000000']));
  for (const address of [COURT, CONSENSUS, '0x' + '0'.repeat(40)]) await assert.rejects(validateRpcRequest(rpc('sim_fundAccount', [address, '1'])));
  for (const value of ['0', '-1', '5000000000000000001', true]) await assert.rejects(validateRpcRequest(rpc('sim_fundAccount', [account.address, value])));
  await assert.rejects(validateRpcRequest(rpc('eth_estimateGas', [envelope({userValue: 1n})])), /bounded test/);
  const open = envelope({userValue: 10n ** 15n}, 'open_case', [hash, '{}', 1_900_000_000, 1_900_001_000]);
  open.value = '0x' + (10n ** 15n + 1000n).toString(16);
  await validateRpcRequest(rpc('eth_estimateGas', [open]));
});
test('claim allocation is external, finalized, capped and pays only the signing participant', async () => {
  const allocation = {messageType: 0, onAcceptance: false, parentIndex: 2n ** 256n - 1n,
    recipient: account.address, callKey: '0x' + '0'.repeat(64), budget: 1n, feeParams: '0x'};
  await validateRpcRequest(rpc('eth_estimateGas', [envelope({messageAllocations: [allocation]}, 'claim', [0])]));
  for (const changed of [{recipient: other}, {onAcceptance: true}, {messageType: 1}, {budget: 10n ** 16n + 1n}, {callKey: hash}]) {
    await assert.rejects(validateRpcRequest(rpc('eth_estimateGas', [envelope({messageAllocations: [{...allocation, ...changed}]}, 'claim', [0])])));
  }
});
test('RPC batches, notifications and unrecognized methods are rejected before forwarding', async () => {
  for (const payload of [[rpc('eth_chainId')], {jsonrpc: '2.0', method: 'eth_chainId'}, rpc('eth_accounts'), {...rpc('eth_chainId'), url: 'https://example.com'}, rpc('eth_chainId', [1])]) {
    await assert.rejects(validateRpcRequest(payload));
  }
  await validateRpcRequest(rpc('eth_getTransactionByHash', [hash]));
  await validateRpcRequest(rpc('gen_getTransactionLifecycle', [{txId: hash}]));
});
test('body limit counts streamed UTF-8 bytes before parsing, including misleading lengths', async () => {
  const request = new Request('https://demo.example/api/rpc', {method: 'POST', body: JSON.stringify(rpc('eth_chainId'))});
  assert.deepEqual(JSON.parse(await readRpcBody(request)), rpc('eth_chainId'));
  const large = new Request('https://demo.example/api/rpc', {method: 'POST', body: 'x'.repeat(MAX_BODY_BYTES + 1)});
  await assert.rejects(readRpcBody(large), /too large/);
  const unicode = new Request('https://demo.example/api/rpc', {method: 'POST', body: '🚀'.repeat(MAX_BODY_BYTES / 3)});
  await assert.rejects(readRpcBody(unicode), /too large/);
});
test('all scheduler reservations use one atomic bounded global record', async () => {
  let nextAt = 0;
  const db = {prepare(sql) {
    assert.match(sql, /ON CONFLICT\(key\) DO UPDATE/);
    assert.match(sql, /RETURNING next_at -/);
    return {bind(key, initial, now, interval, maximum, subtract) {
      assert.equal(key, 'studio'); assert.equal(interval, RPC_INTERVAL_MS); assert.equal(maximum, now + MAX_QUEUE_MS);
      return {async first() {
        if (nextAt > maximum) return null;
        nextAt = nextAt ? Math.max(nextAt, now) + interval : initial;
        return {slot: nextAt - subtract};
      }};
    }};
  }};
  const results = await Promise.all(Array.from({length: 8}, () => reserveRpcSlot(db, 100_000)));
  assert.deepEqual(results, [0, 3500, 7000, 10500, 14000, 17500, null, null]);
  assert.equal(await reserveRpcSlot(db, 200_000), 0);
});
