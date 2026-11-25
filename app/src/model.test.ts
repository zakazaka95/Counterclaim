import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDemo, normalizeStatus, safeLink, actionFor, actionForDemo, claimHeadline, formatWei, hasRuling, isRecordedDemo } from './model.ts';

test('a failed or empty backend cannot produce a ruling, a session or a split', () => {
  const demo = normalizeDemo({ error: 'offline' });
  assert.equal(demo.phase, 'idle');
  assert.equal(demo.session, undefined);
  assert.equal(demo.allocation, undefined);
  assert.equal(hasRuling(demo), false);
  assert.deepEqual(normalizeStatus({}).yellow, { ready: false, connected: false, network: undefined, reason: undefined, contractAddress: undefined, chainId: undefined });
});
test('allocation values must preserve the complete positive total', () => {
  for (const allocation of [{ buyer: 25, seller: 75, total: 99 }, { buyer: -1, seller: 101, total: 100 }, { buyer: 0, seller: 0, total: 0 }, { buyer: Infinity, seller: 0, total: 100 }, { buyer: null, seller: 100, total: 100 }, { buyer: true, seller: 99, total: 100 }]) {
    assert.equal(normalizeDemo({ allocation }).allocation, undefined);
  }
  assert.deepEqual(normalizeDemo({ allocation: { buyer: '25', seller: '75', total: '100', unit: 'USDC' } }).allocation, { buyer: 25, seller: 75, total: 100, unit: 'demo credits' });
});
test('state-changing actions never advance locally or imply a missing ruling', () => {
  assert.equal(actionFor('judging').path, '');
  assert.equal(actionFor('settled').path, '');
  assert.equal(hasRuling(normalizeDemo({ phase: 'verdict_ready' })), false);
});
test('links reject javascript, data and malformed inputs', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', '/relative', null]) assert.equal(safeLink(value), undefined);
  assert.equal(safeLink('https://example.org/proof'), 'https://example.org/proof');
  assert.equal(safeLink('/api/proof'), '/api/proof');
});
test('an inconclusive stored receipt keeps the co-signing permission false', () => {
  const demo = normalizeDemo({ phase: 'verdict_ready', adjudication: { decision: 'INCONCLUSIVE' }, receipt: { settlement_allowed: false } });
  assert.equal(hasRuling(demo), true);
  assert.equal(demo.settlementAllowed, false);
  assert.equal(demo.allocation, undefined);
});
test('the actual numeric zero case ID remains visible and unknown IDs stay unassigned', () => {
  assert.equal(normalizeDemo({ caseId: 0 }).caseId, '0');
  assert.equal(normalizeDemo({ case_id: 12 }).caseId, '12');
  for (const value of [undefined, null, -1, Infinity, 0.5]) assert.equal(normalizeDemo({ caseId: value }).caseId, undefined);
});

test('escrow amounts stay exact decimal strings and do not depend on peer signatures', () => {
  const demo = normalizeDemo({phase: 'verdict_ready', signatures: {buyer: false, seller: false},
    escrow: {totalWei: '90071992547409931', sellerWei: '67553994410557448', buyerWei: '22517998136852483', independent: true},
    authorization: {buyer: true, seller: true, deliveredBy: '0x123'}});
  assert.equal(demo.escrow?.totalWei, '90071992547409931');
  assert.equal(demo.escrow?.independent, true);
  assert.equal(demo.authorization?.seller, true);
  assert.equal(actionFor(demo.phase).path, 'settle');
  for (const value of [1, '-1', '1.5', 'NaN']) assert.equal(normalizeDemo({escrow: {totalWei: value}}).escrow, undefined);
});

test('recorded historical awards cannot be used as a signing action', () => {
  const demo = normalizeDemo({mode: 'recorded', readOnly: false, phase: 'verdict_ready', settlementAllowed: true,
    adjudication: {decision: 'RESOLVED'}, escrow: {totalWei: '1000000000000000', sellerWei: '750000000000000', buyerWei: '250000000000000', claims: {seller: true, buyer: false}}});
  assert.equal(isRecordedDemo(demo), true);
  assert.equal(actionForDemo(demo).path, 'session');
  assert.equal(actionForDemo(demo).label, 'Start live demo');
  assert.match(claimHeadline(demo), /Recorded/);
});

test('native claims advance seller then optional buyer without needing peer signatures', () => {
  const input = {mode: 'live', phase: 'verdict_ready', settlementAllowed: true, signatures: {buyer: false, seller: false},
    adjudication: {decision: 'RESOLVED'}, escrow: {totalWei: '1000000000000000', sellerWei: '750000000000000', buyerWei: '250000000000000', claims: {seller: false, buyer: false}}};
  assert.equal(actionForDemo(normalizeDemo(input)).label, 'Claim seller award');
  input.escrow.claims.seller = true;
  const paidSeller = normalizeDemo(input);
  assert.equal(actionForDemo(paidSeller).label, 'Claim buyer award (optional)');
  assert.equal(claimHeadline(paidSeller), 'Seller paid; buyer reserved');
  input.escrow.claims.buyer = true;
  assert.equal(actionForDemo(normalizeDemo(input)).path, '');
});

test('an inconclusive result and a zero award do not enable a fabricated claim', () => {
  const input = {mode: 'live', phase: 'verdict_ready', settlementAllowed: false, adjudication: {decision: 'INCONCLUSIVE'},
    escrow: {totalWei: '1000000000000000', sellerWei: '0', buyerWei: '1000000000000000', claims: {seller: false, buyer: false}}};
  assert.equal(actionForDemo(normalizeDemo(input)).path, '');
  input.settlementAllowed = true; input.adjudication.decision = 'RESOLVED';
  assert.equal(actionForDemo(normalizeDemo(input)).label, 'Claim buyer award');
});

test('test GEN formatting preserves every wei without floating point rounding', () => {
  assert.equal(formatWei('1000000000000000'), '0.001');
  assert.equal(formatWei('750000000000000'), '0.00075');
  assert.equal(formatWei('90071992547409931'), '0.090071992547409931');
  assert.equal(formatWei('1000000000000000001'), '1.000000000000000001');
  assert.equal(formatWei('0'), '0');
  for (const value of [undefined, '-1', '1.5', '1e18']) assert.equal(formatWei(value), '—');
});

test('bundled proof links remain local while traversal and active content are rejected', () => {
  assert.equal(safeLink('/proof/reviewer-verification-v2.json'), '/proof/reviewer-verification-v2.json');
  assert.equal(safeLink('/recorded/case.json'), '/recorded/case.json');
  for (const value of ['/proof/../private', '/proof/%2e%2e/private', '//example.org/proof', 'javascript:alert(1)']) assert.equal(safeLink(value), undefined);
});
