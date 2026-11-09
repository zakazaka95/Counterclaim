import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createGenLayerRuntime, ROOT, saveProof} from './genlayer.mjs';
import {restoreYellowRoom} from '../server/lib/yellow-room.mjs';
import {hashJson} from './canonical.mjs';

const runtime = await createGenLayerRuntime();
const current = JSON.parse(await readFile(path.join(ROOT, 'proof/demo-proof.json'), 'utf8'));
const room = await restoreYellowRoom({appSessionId: current.yellow.appSessionId, verifyGenLayer: runtime.verifyGenLayer});
try {
  const before = await room.readSession();
  const input = {receipt: current.demo.receipt, txHash: current.demo.adjudication.transactionHash,
    contractAddress: runtime.deployment.address, chainId: runtime.chainId};
  const valid = await runtime.verifyGenLayer(input);
  if (!valid.verified) throw new Error('The actual persisted ruling failed independent verification');
  const checks = [];
  for (const name of ['altered complete receipt', 'unrelated successful deployment transaction']) {
    const altered = structuredClone(input);
    if (name.startsWith('altered')) {altered.receipt.allocation.seller = 100; altered.receipt.allocation.buyer = 0;}
    else altered.txHash = runtime.deployment.txHash;
    try {await runtime.verifyGenLayer(altered); throw new Error('FORGED_VERDICT_WAS_ACCEPTED');}
    catch (error) {
      if (error.message === 'FORGED_VERDICT_WAS_ACCEPTED') throw error;
      checks.push({case: name, rejected: true, observedError: error.message});
    }
  }
  const after = await room.readSession();
  if (before.version !== after.version || before.sessionData !== after.sessionData || before.isClosed !== after.isClosed) {
    throw new Error('Read-only verification checks changed the active Yellow session');
  }
  const proof = {observedAt: new Date().toISOString(), actualPersistedReceiptVerified: true,
    chainId: runtime.chainId, contractAddress: runtime.deployment.address, caseId: current.demo.caseId,
    adjudicationTx: input.txHash, receiptHash: hashJson(input.receipt), yellowSessionId: room.appSessionId,
    yellowVersionBefore: before.version, yellowVersionAfter: after.version,
    yellowClosedBefore: before.isClosed, yellowClosedAfter: after.isClosed,
    noYellowWritesPerformed: true, checks};
  await saveProof('live-verifier-guards-' + (before.isClosed ? 'closed' : 'presign'), proof);
  console.log(JSON.stringify(proof, null, 2));
} finally {await room.disconnect();}
