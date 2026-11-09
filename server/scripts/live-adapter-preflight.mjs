import {createYellowRoom, restoreYellowRoom} from '../lib/yellow-room.mjs';
import {hashJson} from '../lib/canonical.mjs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('../../fixtures/case.json', import.meta.url), 'utf8'));
const evidence = fixture.evidence;
const record = {observedAt: new Date().toISOString(), liveSandbox: true, actualTokenAllocations: [],
  fixture: 'Complete root fixtures/case.json, no shortened criteria or artifact content', stages: []};
let room;
try {
  room = await createYellowRoom({agreementFactory: (participants) => ({title: fixture.title, pool: fixture.pool, unit: fixture.unit,
    parties: {buyer: participants[0].toLowerCase(), seller: participants[1].toLowerCase()}, milestones: fixture.milestones,
    claims: fixture.claims, scope: fixture.scope})});
  record.appSessionId = room.appSessionId;
  record.stages.push({phase: 'AGREED', snapshot: await room.readSession()});
  await room.freezeEvidence({evidence, evidenceHash: hashJson(evidence)});
  record.stages.push({phase: 'EVIDENCE_FROZEN', snapshot: await room.readSession()});
  record.completeAgreementBytes = Buffer.byteLength(JSON.stringify(room.agreement), 'utf8');
  record.completeEvidenceBytes = Buffer.byteLength(JSON.stringify(room.proof().evidence), 'utf8');
  record.wireBytes = record.stages.map((stage) => Buffer.byteLength(stage.snapshot.sessionData, 'utf8'));
  if (hashJson(room.proof().evidence) !== hashJson(evidence)) throw new Error('Retained complete evidence was altered.');
  let unverifiedRejected = false;
  try {await room.applyVerdict({receipt: {}, txHash: '0x' + 'f'.repeat(64), contractAddress: '0x' + 'e'.repeat(40), chainId: 61997});}
  catch {unverifiedRejected = true;}
  if (!unverifiedRejected) throw new Error('Unverified receipt was accepted.');
  record.unverifiedVerdictRejected = true;
  if ((await room.readSession()).version !== '2') throw new Error('Rejected verdict changed the live version.');
  await room.disconnect();
  room = await restoreYellowRoom({appSessionId: record.appSessionId});
  record.restoredExactSession = true;
  await room.cancel();
  record.proof = room.proof();
  record.stages.push({phase: 'CANCELLED', snapshot: await room.readSession()});
  record.success = record.proof.isClosed && record.proof.phase === 'CANCELLED';
} catch (error) {record.success = false; record.error = error.message; process.exitCode = 1;}
finally {
  await room?.disconnect();
  await mkdir(new URL('../proof/', import.meta.url), {recursive: true});
  await writeFile(new URL('../proof/live-adapter-preflight.json', import.meta.url), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({success: record.success, appSessionId: record.appSessionId, stages: record.stages.map((s) => ({phase: s.phase, version: s.snapshot.version,
    wireBytes: Buffer.byteLength(s.snapshot.sessionData, 'utf8')})), completeAgreementBytes: record.completeAgreementBytes, completeEvidenceBytes: record.completeEvidenceBytes,
    unverifiedVerdictRejected: record.unverifiedVerdictRejected, restoredExactSession: record.restoredExactSession, error: record.error}, null, 2));
}
