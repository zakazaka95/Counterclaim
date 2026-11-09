import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDemo, normalizeStatus, safeLink, actionFor, hasRuling } from './model.ts';

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
