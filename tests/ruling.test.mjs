import test from 'node:test';
import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
import {assertRulingTransaction, assertStoredRuling, assertClaimTransferMessage} from '../scripts/verify-ruling.mjs';
import {hashJson} from '../scripts/canonical.mjs';

const owner = '0x' + '1'.repeat(40), contractAddress = '0x' + 'a'.repeat(40), txHash = '0x' + 'b'.repeat(64);

test('native claim evidence must send the exact award to its recipient on finalization', () => {
  const message = {messageType: '0', recipient: owner, value: '750000000000000', data: '', onAcceptance: false};
  const expected = {recipient: owner, amountWei: message.value};
  assert.equal(assertClaimTransferMessage([message], expected), true);
  for (const change of [{recipient: contractAddress}, {value: '750000000000001'}, {onAcceptance: true}, {messageType: '1'}, {data: '0xabcd'}, {value: Number.MAX_SAFE_INTEGER + 1}]) {
    assert.throws(() => assertClaimTransferMessage([{...message, ...change}], expected));
  }
  assert.throws(() => assertClaimTransferMessage([message, message], expected));
  assert.throws(() => assertClaimTransferMessage([], expected));
});
function example() {
  const agreement = {title: 'A complete synthetic agreement', pool: 100, parties: {buyer: owner, seller: '0x' + '2'.repeat(40)}}, evidence = [{content: 'Complete supplied text'}];
  const authorization = {buyer_opened_by: owner, buyer_opened_at: 10, seller_accepted_by: agreement.parties.seller, seller_accepted_at: 11, seller_delivered_by: agreement.parties.seller, seller_delivered_at: 12};
  const snapshot = {schema: 'counterclaim-ruling-v2', case_id: 7, chain_id: 61997, contract_address: contractAddress, session_id: '0x' + 'c'.repeat(64),
    authorization, escrow: {total_wei: '1000', unit: 'GEN_WEI'}, delivery_deadline: 100, refund_after: 200,
    evidence_scope: 'CONTRACT_STORED_SELLER_DELIVERY_ONLY', refund_policy: 'BUYER_REFUND_IF_NO_DELIVERY_OR_NO_RESOLVED_RULING_BY_DEADLINE',
    agreement, evidence, agreement_hash: hashJson(agreement), evidence_hash: hashJson(evidence)};
  snapshot.terms_hash = hashJson({schema: snapshot.schema, case_id: snapshot.case_id, chain_id: snapshot.chain_id,
    contract_address: snapshot.contract_address, session_id: snapshot.session_id, agreement_hash: snapshot.agreement_hash,
    escrow_wei: snapshot.escrow.total_wei, delivery_deadline: snapshot.delivery_deadline, refund_after: snapshot.refund_after,
    evidence_scope: snapshot.evidence_scope, refund_policy: snapshot.refund_policy});
  const receipt = {schema: snapshot.schema, authorization, terms_hash: snapshot.terms_hash, settlement: {buyer_wei: '250', seller_wei: '750', total_wei: '1000', unit: 'GEN_WEI'}, case_id: 7, case_hash: hashJson(snapshot), chain_id: 61997, contract_address: contractAddress,
    session_id: snapshot.session_id, agreement_hash: snapshot.agreement_hash, evidence_hash: snapshot.evidence_hash,
    decision: 'RESOLVED', settlement_allowed: true, inspection: {prompt_truncated: false, semantic_complete: true},
    allocation: {buyer: 25, seller: 75, total: 100, unit: 'demo credits'}};
  const stored = {snapshot, receipt, case_hash: hashJson(snapshot), receipt_hash: hashJson(receipt), status: 'RESOLVED'};
  const transaction = {hash: txHash, from_address: owner, to_address: contractAddress,
    statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_RETURN', leader_only: false,
    execution_mode: 'NORMAL', num_of_initial_validators: 5,
    data: {calldata: {raw: [...abi.calldata.encode(abi.calldata.makeCalldataObject('adjudicate', [7]))]}},
    consensus_data: {leader_receipt: [{result: {status: 'return', payload: {raw: [...abi.calldata.encode(receipt)]}}}]}};
  return {stored, receipt, transaction, txHash, contractAddress, owner, chainId: 61997};
}

test('full normal-consensus transaction and persisted case bind exactly', () => {
  const x = example();
  assert.equal(assertRulingTransaction(x), true);
  assert.equal(assertStoredRuling(x.stored, x), true);
});
test('another successful method or case cannot stand in for adjudication', () => {
  for (const [method, args] of [['open_case', [7]], ['get_stats', []], ['adjudicate', [8]]]) {
    const x = example();
    x.transaction.data.calldata.raw = [...abi.calldata.encode(abi.calldata.makeCalldataObject(method, args))];
    assert.throws(() => assertRulingTransaction(x), /exact adjudicate/);
  }
});
test('caller, target and transaction identity must match', () => {
  for (const key of ['hash', 'from_address', 'to_address']) {
    const x = example();
    x.transaction[key] = '0x' + 'd'.repeat(key === 'hash' ? 64 : 40);
    assert.throws(() => assertRulingTransaction(x));
  }
});
test('leader-only or simulation cannot be used as multi-validator evidence', () => {
  for (const [key, value] of [['leader_only', true], ['execution_mode', 'SIMULATION'], ['num_of_initial_validators', 1]]) {
    const x = example(); x.transaction[key] = value;
    assert.throws(() => assertRulingTransaction(x), /multi-validator/);
  }
});
test('changed transaction return cannot match the stored receipt', () => {
  const x = example(), altered = structuredClone(x.receipt);
  altered.allocation.seller = 100;
  x.transaction.consensus_data.leader_receipt[0].result.payload.raw = [...abi.calldata.encode(altered)];
  assert.throws(() => assertRulingTransaction(x), /complete persisted/);
});
test('snapshot, case and source digest mismatches are rejected', () => {
  for (const mutate of [x => x.stored.snapshot.case_id++, x => x.stored.snapshot.agreement.title += ' altered',
    x => x.receipt.case_hash = '0'.repeat(64), x => x.receipt.session_id = '0x' + 'e'.repeat(64)]) {
    const x = example(); mutate(x);
    assert.throws(() => assertStoredRuling(x.stored, x));
  }
});
test('persisted uncertainty and incomplete inspection cannot settle', () => {
  for (const mutate of [x => x.stored.status = 'INCONCLUSIVE', x => x.receipt.settlement_allowed = false,
    x => x.receipt.inspection.prompt_truncated = true, x => x.receipt.inspection.semantic_complete = false]) {
    const x = example(); mutate(x); x.stored.receipt_hash = hashJson(x.receipt);
    assert.throws(() => assertStoredRuling(x.stored, x), /does not permit/);
  }
});
test('missing or malformed raw calldata fails closed', () => {
  const x = example(); delete x.transaction.data.calldata.raw;
  assert.throws(() => assertRulingTransaction(x), /raw GenLayer calldata/);
});
test('accepted but still appealable decision cannot be signed into Yellow', () => {
  const x = example(); x.transaction.statusName = 'ACCEPTED';
  assert.throws(() => assertRulingTransaction(x), /must be finalized/);
});

test('either authenticated participant may adjudicate, but a relay cannot', () => {
  const x = example();
  x.transaction.from_address = x.stored.snapshot.agreement.parties.seller;
  assert.equal(assertRulingTransaction(x), true);
  x.transaction.from_address = '0x' + '9'.repeat(40);
  assert.throws(() => assertRulingTransaction(x), /caller or target/);
});

test('a self-consistent digest cannot hide missing seller delivery authorization', () => {
  const x = example();
  x.stored.snapshot.authorization.seller_delivered_by = owner;
  x.stored.case_hash = hashJson(x.stored.snapshot);
  x.receipt.case_hash = x.stored.case_hash;
  x.stored.receipt_hash = hashJson(x.receipt);
  assert.throws(() => assertStoredRuling(x.stored, x), /participant consent/);
});

test('escrow deadline substitution breaks the seller accepted terms', () => {
  const x = example();
  x.stored.snapshot.refund_after++;
  x.stored.case_hash = hashJson(x.stored.snapshot);
  x.receipt.case_hash = x.stored.case_hash;
  x.stored.receipt_hash = hashJson(x.receipt);
  assert.throws(() => assertStoredRuling(x.stored, x), /accepted terms hash/);
});

test('a conserved weight allocation cannot stand in for the wrong monetary award', () => {
  const x = example();
  x.receipt.settlement.seller_wei = '751';
  x.receipt.settlement.buyer_wei = '249';
  x.stored.receipt_hash = hashJson(x.receipt);
  assert.throws(() => assertStoredRuling(x.stored, x), /wei do not conserve/);
});
