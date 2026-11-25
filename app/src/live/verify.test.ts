import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertStoredRuling, hashJson, canonicalJson, assertClaimDelivery} from './verify.ts';
import {claimFeeSeed, assertClaimFeeEstimate} from './fees.ts';
import {resumeStoredRecord} from './resume.ts';
import {actionFor} from '../model.ts';

const proof = JSON.parse(await readFile(new URL('../../../proof/reviewer-verification-v2.json', import.meta.url), 'utf8'));
const court = proof.contractAddress;

test('the recorded real v2 case satisfies the same browser receipt verification', () => {
  assert.equal(assertStoredRuling(proof.fullStoredCase, 61997, court).allocation.seller, 75);
  assert.throws(() => assertStoredRuling(proof.fullStoredCase, 61999, court), /complete case/);
});

test('rehashing cannot hide substituted delivery authorization or a wrong monetary award', () => {
  const changed = structuredClone(proof.fullStoredCase);
  changed.snapshot.authorization.seller_delivered_by = changed.snapshot.agreement.parties.buyer;
  changed.receipt.authorization = structuredClone(changed.snapshot.authorization);
  changed.case_hash = hashJson(changed.snapshot); changed.receipt.case_hash = changed.case_hash;
  changed.receipt_hash = hashJson(changed.receipt);
  assert.throws(() => assertStoredRuling(changed, 61997, court), /not authenticated/);
  const wrongAward = structuredClone(proof.fullStoredCase);
  wrongAward.receipt.settlement.seller_wei = '1000000000000000';
  wrongAward.receipt.settlement.buyer_wei = '0';
  wrongAward.receipt_hash = hashJson(wrongAward.receipt);
  assert.throws(() => assertStoredRuling(wrongAward, 61997, court), /conserve/);
});

test('a finalized emitted message is insufficient without its exact delivered effect', () => {
  const message = structuredClone(proof.sellerClaim.transferMessages.messages[0]);
  const occurrence = '0x' + 'a'.repeat(64);
  const transaction = {messages: [message], data: {fee_accounting: {
    active_message_generation: {messages: [message], occurrences: [occurrence]},
    message_effect_delivered: {[occurrence]: true},
  }}};
  assert.deepEqual(assertClaimDelivery(transaction, message.recipient, String(message.value)), {occurrence, delivered: true});
  transaction.data.fee_accounting.message_effect_delivered[occurrence] = false;
  assert.throws(() => assertClaimDelivery(transaction, message.recipient, String(message.value)), /not been marked delivered/);
  assert.throws(() => assertClaimDelivery(transaction, court, String(message.value)), /participant and award/);
});

test('browser claim allocation accepts the observed zero-minimum policy and stays recipient-specific', () => {
  const config = {enabled: true, capabilities: {messageFees: {externalFinalization: {genvmExecution: true}}},
    policy: {minExternalGasLimit: '0', defaultExternalGasLimit: '500000', receiptGasPrice: '250000000'},
    defaultFees: {distribution: {receiptFeeMaxGasPrice: '300000000'}}};
  const seed = claimFeeSeed(config, court);
  assert.equal(seed.budget, 150000000000000n);
  assert.equal(seed.allocation.callKey, '0x' + '0'.repeat(64));
  const estimate = {distribution: {totalMessageFees: seed.budget}, messageAllocations: [seed.allocation]};
  assert.doesNotThrow(() => assertClaimFeeEstimate(estimate, seed));
  const tampered = {...estimate, messageAllocations: [{...seed.allocation, recipient: proof.participants.buyer}]};
  assert.throws(() => assertClaimFeeEstimate(tampered, seed), /exact recipient/);
  assert.throws(() => claimFeeSeed({...config, policy: {...config.policy, receiptGasPrice: '0'}}, court), /Invalid live fee/);
});

test('canonical evidence hashing preserves complete unicode rather than slicing content', () => {
  const a = {z: '🚀'.repeat(4000), a: 'Complete\ntext'};
  assert.equal(canonicalJson(a), canonicalJson({a: a.a, z: a.z}));
  assert.notEqual(hashJson(a), hashJson({...a, z: a.z.slice(0, -2)}));
});

test('reload during adjudication enables resume while preserving the exact signed journals and accounts', () => {
  const signedHash = '0x' + '9'.repeat(64);
  const saved = {demo: {phase: 'judging', caseId: '17'},
    actors: {buyer: {address: 'buyer'}, seller: {address: 'seller'}},
    journals: {'seller-adjudicate': {identity: 'immutable-call', hash: signedHash}}};
  const resumed = resumeStoredRecord(saved);
  assert.equal(actionFor(resumed.demo.phase as 'session_open').path, 'adjudicate');
  assert.equal(resumed.demo.caseId, '17');
  assert.equal(resumed.journals, saved.journals);
  assert.equal(resumed.journals['seller-adjudicate'].hash, signedHash);
  assert.equal(resumed.actors, saved.actors);
  assert.equal(resumeStoredRecord({...saved, demo: {phase: 'verdict_ready', caseId: '17'}}).demo.phase, 'verdict_ready');
});
