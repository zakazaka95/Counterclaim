import test from 'node:test';
import assert from 'node:assert/strict';
import {abi} from 'genlayer-js';
import {assertRulingTransaction, assertStoredRuling} from '../scripts/verify-ruling.mjs';
import {hashJson} from '../scripts/canonical.mjs';

const owner = '0x' + '1'.repeat(40), contractAddress = '0x' + 'a'.repeat(40), txHash = '0x' + 'b'.repeat(64);
function example() {
  const agreement = {title: 'A complete synthetic agreement'}, evidence = [{content: 'Complete supplied text'}];
  const snapshot = {case_id: 7, chain_id: 61997, contract_address: contractAddress, session_id: '0x' + 'c'.repeat(64),
    agreement, evidence, agreement_hash: hashJson(agreement), evidence_hash: hashJson(evidence)};
  const receipt = {case_id: 7, case_hash: hashJson(snapshot), chain_id: 61997, contract_address: contractAddress,
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
