import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readdir, unlink, rmdir, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {trackedWrite} from '../scripts/tracked-write.mjs';
import {hashJson} from '../scripts/canonical.mjs';

const identity = {chainId: 61997, contractAddress: '0x' + 'a'.repeat(40), functionName: 'adjudicate', args: [0]};
async function temporary(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'counterclaim-tracking-'));
  try {await run(directory);}
  finally {for (const name of await readdir(directory)) await unlink(path.join(directory, name)); await rmdir(directory);}
}

test('a wait timeout resumes the same transaction without a second signature', () => temporary(async directory => {
  let submits = 0, waits = 0;
  const operation = {directory, identity, submit: async () => {submits++; return '0x' + '1'.repeat(64);},
    wait: async hash => {waits++; if (waits === 1) throw new Error('transport timeout'); return {hash};}};
  await assert.rejects(trackedWrite(operation), /transport timeout/);
  const recovered = await trackedWrite(operation);
  assert.equal(submits, 1); assert.equal(waits, 2); assert.equal(recovered.hash, '0x' + '1'.repeat(64));
}));
test('different case identity never reuses another case broadcast', () => temporary(async directory => {
  let submits = 0;
  const base = {directory, submit: async () => '0x' + String(++submits).repeat(64), wait: async hash => ({hash})};
  const a = await trackedWrite({...base, identity});
  const b = await trackedWrite({...base, identity: {...identity, args: [1]}});
  assert.notEqual(a.hash, b.hash); assert.equal(submits, 2);
}));
test('corrupt saved authority refuses instead of broadcasting again', () => temporary(async directory => {
  const filename = path.join(directory, hashJson(identity) + '.json');
  await writeFile(filename, JSON.stringify({identityHash: hashJson(identity), chainId: 1, contractAddress: identity.contractAddress, hash: '0x' + '1'.repeat(64)}));
  await assert.rejects(trackedWrite({directory, identity, submit: async () => {throw new Error('must not submit');}, wait: async () => {}}), /does not match/);
}));
