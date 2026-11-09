import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, hashJson, assertHash } from '../lib/canonical.mjs';
import { validateAllocation, validateVerifiedVerdict, validateAgreementParties, toWire, assertMetadataBytes } from '../lib/yellow-room.mjs';

function fixture() {
  const frozen = {appSessionId: '0x' + 'a'.repeat(64), agreementHash: 'b'.repeat(64), evidenceHash: 'c'.repeat(64)};
  const receipt = {case_id: 7, decision: 'RESOLVED', settlement_allowed: true, session_id: frozen.appSessionId,
    agreement_hash: frozen.agreementHash, evidence_hash: frozen.evidenceHash, chain_id: 61997,
    contract_address: '0x' + 'e'.repeat(40),
    milestones: [{id: 'landing', status: 'SATISFIED'}], allocation: {buyer: 25, seller: 75, total: 100, unit: 'demo credits'}};
  const input = {receipt, txHash: '0x' + 'd'.repeat(64), contractAddress: '0x' + 'e'.repeat(40), chainId: 61997};
  const verified = {...structuredClone(input), verified: true,
    binding: {...frozen, caseId: 7, allocation: {worker: 75, client: 25, total: 100, unit: 'DEMO_CREDITS'}}};
  return {frozen, input, verified};
}

test('canonical agreement hashes ignore object key order but bind every nested artifact byte', () => {
  const first = {b: ['🍋', {y: 'line\nnext', x: 7}], a: 1};
  const second = {a: 1, b: ['🍋', {x: 7, y: 'line\nnext'}]};
  assert.equal(hashJson(first), hashJson(second));
  second.b[1].y += ' ';
  assert.notEqual(hashJson(first), hashJson(second));
});
test('canonical transport rejects unsafe or non-JSON numbers and values', () => {
  for (const value of [NaN, Infinity, 0.1, Number.MAX_SAFE_INTEGER + 1, undefined, 1n, new Date()]) {
    assert.throws(() => canonicalJson({value}));
  }
});
test('SHA-256 binding uses an exact lowercase fixed-width digest', () => {
  assert.equal(assertHash('a'.repeat(64)), 'a'.repeat(64));
  for (const value of ['0x' + 'a'.repeat(64), 'A'.repeat(64), 'a'.repeat(63), 'z'.repeat(64)]) assert.throws(() => assertHash(value));
});
test('a verified exact persisted ruling yields a receipt-bound proposal only', () => {
  const {input, verified, frozen} = fixture();
  const result = validateVerifiedVerdict(input, verified, frozen);
  assert.equal(result.receiptHash, hashJson(input.receipt));
  assert.deepEqual(result.allocation, {worker: 75, client: 25, total: 100, unit: 'DEMO_CREDITS'});
  assert.equal(result.caseId, 7);
});
test('no persisted read or negative independent verification cannot authorize signing', () => {
  const {input, verified, frozen} = fixture();
  for (const v of [undefined, {}, {...verified, verified: false}, {...verified, receipt: null}]) {
    assert.throws(() => validateVerifiedVerdict(input, v, frozen));
  }
});
test('altering even one persisted milestone, allocation or narrative field is rejected', () => {
  for (const mutate of [r => r.milestones[0].status = 'NOT_SATISFIED', r => r.allocation.seller = 100,
    r => r.summary = 'invented', r => r.case_id = 8, r => r.settlement_allowed = false]) {
    const {input, verified, frozen} = fixture();
    mutate(input.receipt);
    assert.throws(() => validateVerifiedVerdict(input, verified, frozen), /persisted GenLayer receipt/);
  }
});
test('transaction, contract and chain cannot be swapped independently of the persisted ruling', () => {
  for (const [key, value] of [['txHash', '0x' + 'f'.repeat(64)], ['contractAddress', '0x' + 'f'.repeat(40)], ['chainId', 1]]) {
    const {input, verified, frozen} = fixture();
    input[key] = value;
    assert.throws(() => validateVerifiedVerdict(input, verified, frozen), /authority mismatch/);
  }
});
test('a ruling for another Yellow session, agreement or evidence snapshot cannot be applied', () => {
  for (const key of ['appSessionId', 'agreementHash', 'evidenceHash']) {
    const {input, verified, frozen} = fixture();
    verified.binding[key] = key === 'appSessionId' ? '0x' + 'f'.repeat(64) : 'f'.repeat(64);
    assert.throws(() => validateVerifiedVerdict(input, verified, frozen), /frozen/);
  }
});
test('boolean, missing and negative case identities fail', () => {
  for (const caseId of [undefined, true, -1, 0.1, '7']) {
    const {input, verified, frozen} = fixture(); verified.binding.caseId = caseId;
    assert.throws(() => validateVerifiedVerdict(input, verified, frozen), /case identity/);
  }
});
test('nonmonetary allocation conserves exactly the agreed total and cannot introduce a token', () => {
  for (const allocation of [{worker: 100, client: 25, total: 100, unit: 'DEMO_CREDITS'},
    {worker: -1, client: 101, total: 100, unit: 'DEMO_CREDITS'},
    {worker: 75, client: 25, total: 100, unit: 'USDC'},
    {worker: 75, client: 25, total: 100, unit: 'DEMO_CREDITS', token: 'USDC'},
    {worker: 75.5, client: 24.5, total: 100, unit: 'DEMO_CREDITS'}]) assert.throws(() => validateAllocation(allocation));
});
test('returned receipt is copied and does not share mutable input state', () => {
  const {input, verified, frozen} = fixture();
  const result = validateVerifiedVerdict(input, verified, frozen);
  verified.receipt.milestones[0].status = 'UNCERTAIN';
  assert.equal(result.receipt.milestones[0].status, 'SATISFIED');
});
test('an incorrectly normalized credit proposal cannot differ from the persisted allocation', () => {
  const {input, verified, frozen} = fixture();
  verified.binding.allocation = {worker: 100, client: 0, total: 100, unit: 'DEMO_CREDITS'};
  assert.throws(() => validateVerifiedVerdict(input, verified, frozen), /exact persisted/);
});
test('even an internally consistent input and read cannot authorize an inconclusive receipt', () => {
  const {input, verified, frozen} = fixture();
  input.receipt.decision = verified.receipt.decision = 'INCONCLUSIVE';
  input.receipt.settlement_allowed = verified.receipt.settlement_allowed = false;
  assert.throws(() => validateVerifiedVerdict(input, verified, frozen), /resolved case/);
});
test('the frozen buyer and seller match actual Yellow identities in the exact participant order', () => {
  const participants = ['0x' + 'a'.repeat(40), '0x' + 'b'.repeat(40)];
  validateAgreementParties({parties: {buyer: participants[0], seller: participants[1]}}, participants);
  for (const parties of [{buyer: participants[1], seller: participants[0]},
    {buyer: participants[0], seller: '0x' + 'c'.repeat(40)}, {buyer: participants[0]},
    {buyer: participants[0], seller: participants[1], third: participants[0]}]) {
    assert.throws(() => validateAgreementParties({parties}, participants), /actual Yellow participant/);
  }
});
test('Yellow wire metadata commits complete large artifacts without embedding or slicing them', () => {
  const agreement = {title: 'Complete agreement', criteria: 'full '.repeat(2000)};
  const evidence = [{milestone_id: 'a', content: '🍋'.repeat(10000)}];
  const full = {phase: 'EVIDENCE_FROZEN', agreement, agreementHash: hashJson(agreement), evidence, evidenceHash: hashJson(evidence)};
  const wire = toWire(full);
  assert.equal(wire.agreementHash, hashJson(agreement));
  assert.equal(wire.evidenceHash, hashJson(evidence));
  assert.equal('agreement' in wire, false);
  assert.equal('evidence' in wire, false);
  assert.ok(Buffer.byteLength(canonicalJson(wire), 'utf8') <= 1024);
  assert.equal(full.evidence[0].content.length, '🍋'.repeat(10000).length);
  full.evidence[0].content += 'changed';
  assert.throws(() => toWire(full), /complete evidence/);
});
test('maximum compact ruling reference and allocation fit within 1024 actual UTF-8 bytes', () => {
  const {input, verified, frozen} = fixture();
  const agreement = {title: 'Full agreement'};
  const evidence = [{content: 'Complete artifact'}];
  verified.binding.agreementHash = frozen.agreementHash = input.receipt.agreement_hash = verified.receipt.agreement_hash = hashJson(agreement);
  verified.binding.evidenceHash = frozen.evidenceHash = input.receipt.evidence_hash = verified.receipt.evidence_hash = hashJson(evidence);
  const verdict = validateVerifiedVerdict(input, verified, frozen);
  const wire = toWire({phase: 'CLOSED', agreement, agreementHash: frozen.agreementHash, evidence, evidenceHash: frozen.evidenceHash,
    verdict, proposedAllocation: verdict.allocation});
  assert.equal(wire.verdictReference.receiptHash, hashJson(input.receipt));
  assert.deepEqual(wire.proposedAllocation, verified.binding.allocation);
  assert.ok(Buffer.byteLength(canonicalJson(wire), 'utf8') <= 1024);
});
test('session metadata byte boundary is exact and counts multibyte UTF-8 rather than characters', () => {
  assert.equal(assertMetadataBytes('x'.repeat(1024)).length, 1024);
  assert.throws(() => assertMetadataBytes('x'.repeat(1025)), /1024 UTF-8/);
  assertMetadataBytes('🍋'.repeat(256));
  assert.throws(() => assertMetadataBytes('🍋'.repeat(257)), /1024 UTF-8/);
});
