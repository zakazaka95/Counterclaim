import {abi} from 'genlayer-js';
import {studioDevnet} from 'genlayer-js/chains';
import {decodeFunctionData, fromRlp, hexToBytes, parseTransaction, recoverTransactionAddress} from 'viem';

export const CHAIN_ID = 61997;
export const COURT = '0xc68b67797c630cbbf2bb80d290d68a787c855e14';
export const CONSENSUS = studioDevnet.consensusMainContract.address.toLowerCase();
export const MAX_BODY_BYTES = 128_000;
const FIVE_GEN = 5n * 10n ** 18n;
const DEPOSIT = 10n ** 15n;
const TWO_GEN = 2n * 10n ** 18n;
const MAX_MESSAGE_FEE = 10n ** 16n;
const ZERO_KEY = '0x' + '0'.repeat(64);
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x(?:[0-9a-fA-F]{2})*$/;
const READS = new Set(['get_case', 'get_case_for_session', 'get_attempt', 'get_stats']);
const WRITES = new Set(['open_case', 'accept_case', 'deliver', 'adjudicate', 'claim', 'refund_timeout']);
const EMPTY = new Set(['eth_chainId', 'eth_gasPrice', 'eth_blockNumber', 'sim_getFeeConfig']);
const HASH_READS = new Set(['eth_getTransactionReceipt', 'eth_getTransactionByHash', 'gen_getTransactionReceipt', 'gen_getTransactionStatus']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const sameAddress = (a, b) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
const fail = message => {throw new Error(message);};
const address = value => typeof value === 'string' && ADDRESS.test(value);
const nonzeroAddress = value => address(value) && BigInt(value) !== 0n;
const caseId = value => (typeof value === 'bigint' && value >= 0n && value < 2n ** 63n) || (Number.isSafeInteger(value) && value >= 0);
const boundedInt = value => caseId(value);
const block = value => ['latest', 'pending', 'finalized', 'earliest', 'safe'].includes(value) || typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value);
export async function readRpcBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) fail('Request body is too large');
  if (!request.body) fail('JSON request body is required');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {await reader.cancel(); fail('Request body is too large');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
}
function uint(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) fail('Unsafe integer');
  if (!['string', 'number', 'bigint'].includes(typeof value)) fail('Expected unsigned integer');
  if (typeof value === 'string' && !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) fail('Expected unsigned integer');
  const result = BigInt(value);
  if (result < 0n || result >= 2n ** 256n) fail('Unsigned integer outside bounds');
  return result;
}
function record(value) {
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, child]) => [key, record(child)]));
  if (Array.isArray(value)) return value.map(record);
  return value;
}

export function decodeCourtCall(data, allowed) {
  if (typeof data !== 'string' || !HEX.test(data)) fail('Expected encoded court call');
  let envelope, call;
  try {
    envelope = fromRlp(data);
    if (!Array.isArray(envelope) || envelope.length !== 2 || !['0x00', '0x'].includes(envelope[1])) fail('Normal two-part execution is required');
    call = record(abi.calldata.decode(hexToBytes(envelope[0])));
  } catch {fail('Invalid normal court calldata');}
  if (!plain(call) || Object.keys(call).some(key => !['', 'args'].includes(key)) || !allowed.has(call[''])) fail('Court method is not allowed');
  const name = call[''];
  const args = call.args || [];
  if (!Array.isArray(args)) fail('Court arguments must be positional');
  const count = {'get_stats': 0, 'get_case': 1, 'get_case_for_session': 2, 'get_attempt': 2,
    'open_case': 4, 'accept_case': 2, 'deliver': 2, 'adjudicate': 1, 'claim': 1, 'refund_timeout': 1}[name];
  if (args.length !== count) fail('Wrong court argument count');
  if (name === 'open_case') {
    if (typeof args[0] !== 'string' || !HASH.test(args[0]) || BigInt(args[0]) === 0n ||
        typeof args[1] !== 'string' || args[1].length > 40_000 || !boundedInt(args[2]) || !boundedInt(args[3])) fail('Invalid case opening parameters');
  } else if (name === 'get_case_for_session') {
    if (typeof args[0] !== 'string' || !HASH.test(args[0]) || !nonzeroAddress(args[1])) fail('Invalid session lookup');
  } else if (args.length && !caseId(args[0])) fail('Invalid case ID');
  if (name === 'deliver' && (typeof args[1] !== 'string' || args[1].length > 90_000)) fail('Invalid bounded delivery');
  if (name === 'accept_case' && (typeof args[1] !== 'string' || !/^[a-f0-9]{64}$/.test(args[1]))) fail('Invalid accepted terms hash');
  if (name === 'get_attempt' && !boundedInt(args[1])) fail('Invalid attempt');
  return {name, args};
}

function consensusEnvelope(transaction, expectedSender) {
  if (!plain(transaction) || !sameAddress(transaction.to, CONSENSUS)) fail('Only the configured consensus entry point is allowed');
  let decoded;
  try {decoded = decodeFunctionData({abi: studioDevnet.consensusMainContract.abi, data: transaction.data || transaction.input});}
  catch {fail('Invalid consensus transaction envelope');}
  if (decoded.functionName !== 'addTransaction' || decoded.args?.length !== 1) fail('Only addTransaction is allowed');
  const params = decoded.args[0];
  if (!sameAddress(params.recipient, COURT) || !nonzeroAddress(params.sender)) fail('Transaction must target the fixed Counterclaim court');
  if (expectedSender && !sameAddress(params.sender, expectedSender)) fail('Envelope sender differs from the signer');
  if (uint(params.saltNonce) !== 0n || uint(params.numOfInitialValidators) < 3n || uint(params.numOfInitialValidators) > 16n || uint(params.maxRotations) > 5n) fail('Unsupported execution posture');
  const call = decodeCourtCall(params.txCalldata, WRITES);
  const value = uint(transaction.value ?? 0n);
  const userValue = uint(params.userValue);
  if (userValue !== (call.name === 'open_case' ? DEPOSIT : 0n) || value < userValue || value > TWO_GEN) fail('Only the bounded test escrow value is allowed');
  const allocations = params.messageAllocations || [];
  if (!Array.isArray(allocations) || allocations.length > 1 || allocations.length && call.name !== 'claim') fail('Unexpected external-message allocation');
  for (const allocation of allocations) {
    if (Number(allocation.messageType) !== 0 || allocation.onAcceptance !== false || !sameAddress(allocation.recipient, params.sender) ||
        allocation.callKey !== ZERO_KEY || uint(allocation.budget) <= 0n || uint(allocation.budget) > MAX_MESSAGE_FEE) fail('Claim allocation must pay only its own participant on finalization');
  }
  if (uint(params.feesDistribution.totalMessageFees) > MAX_MESSAGE_FEE) fail('Message fee exceeds the test demo cap');
  return {sender: params.sender, call};
}

function validateCallRequest(request, method) {
  if (!plain(request) || !sameAddress(request.to, COURT) || !address(request.from)) fail('Only fixed-court requests are allowed');
  const writing = method !== 'gen_call';
  if (request.type !== (writing ? 'write' : 'read')) fail('Unexpected simulation or view type');
  const call = decodeCourtCall(request.data, writing ? WRITES : READS);
  const value = uint(request.value ?? 0n);
  if (value !== (call.name === 'open_case' ? DEPOSIT : 0n)) fail('Unexpected test value');
  if (request.transaction_hash_variant !== undefined && !['latest-nonfinal', 'latest-final', 'finalized'].includes(request.transaction_hash_variant)) fail('Unsupported state variant');
  // Reject operation-expanding fields while permitting the SDK fee envelope.
  for (const key of Object.keys(request)) if (!['type', 'to', 'from', 'data', 'transaction_hash_variant', 'value', 'fees', '_allow_low_execution_budget_for_estimate', '_discover_message_allocations_for_estimate'].includes(key)) fail('Unsupported call parameter');
  return call;
}

export async function validateRpcRequest(payload) {
  if (!plain(payload) || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string' ||
      Object.keys(payload).some(key => !['jsonrpc', 'id', 'method', 'params'].includes(key))) fail('A single JSON-RPC 2.0 request is required');
  if (!own(payload, 'id') || payload.id !== null && !(typeof payload.id === 'string' && payload.id.length <= 128) && !Number.isSafeInteger(payload.id)) fail('Invalid request ID');
  const params = payload.params ?? [];
  if (!Array.isArray(params)) fail('Positional RPC parameters are required');
  const method = payload.method;
  if (EMPTY.has(method)) {if (params.length) fail('No parameters expected'); return;}
  if (['eth_getBalance', 'eth_getTransactionCount'].includes(method)) {
    if (params.length !== 2 || !address(params[0]) || !block(params[1])) fail('Invalid account read');
    return;
  }
  if (HASH_READS.has(method)) {
    if (params.length !== 1 || typeof params[0] !== 'string' || !HASH.test(params[0])) fail('Invalid transaction hash');
    return;
  }
  if (method === 'gen_getTransactionLifecycle') {
    if (params.length !== 1 || !plain(params[0]) || Object.keys(params[0]).some(key => key !== 'txId') || !HASH.test(params[0].txId)) fail('Invalid lifecycle identity');
    return;
  }
  if (['gen_getContractCode', 'gen_getContractSchema'].includes(method)) {
    if (params.length !== 1 || !sameAddress(params[0], COURT)) fail('Only the fixed court source can be read');
    return;
  }
  if (['gen_call', 'sim_call', 'sim_estimateTransactionFees'].includes(method)) {
    if (params.length !== 1) fail('One bounded court request is required');
    validateCallRequest(params[0], method);
    return;
  }
  if (method === 'sim_fundAccount') {
    if (params.length !== 2 || !nonzeroAddress(params[0]) || sameAddress(params[0], COURT) || sameAddress(params[0], CONSENSUS) || uint(params[1]) <= 0n || uint(params[1]) > FIVE_GEN) fail('Faucet calls are limited to at most five test GEN for a disposable account');
    return;
  }
  if (method === 'eth_estimateGas') {
    if (params.length !== 1 || !plain(params[0]) || !address(params[0].from)) fail('Invalid transaction gas estimate');
    consensusEnvelope(params[0], params[0].from);
    return;
  }
  if (method === 'eth_sendRawTransaction') {
    if (params.length !== 1 || typeof params[0] !== 'string' || !HEX.test(params[0]) || params[0].length > MAX_BODY_BYTES * 2) fail('One bounded signed transaction is required');
    let transaction, sender;
    try {transaction = parseTransaction(params[0]); sender = await recoverTransactionAddress({serializedTransaction: params[0]});}
    catch {fail('A valid locally signed transaction is required');}
    if (transaction.type !== 'legacy' || Number(transaction.chainId) !== CHAIN_ID) fail('Only Studio chain 61997 legacy transactions are allowed');
    consensusEnvelope(transaction, sender);
    return;
  }
  fail('RPC method is not available in this demo');
}
