import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createGenLayerRuntime, ROOT, saveProof} from './genlayer.mjs';
import {restoreYellowRoom} from '../server/lib/yellow-room.mjs';
import {hashJson, jsonValue} from './canonical.mjs';

const runtime = await createGenLayerRuntime();
const proof = JSON.parse(await readFile(path.join(ROOT, 'proof/demo-proof.json'), 'utf8'));
const room = await restoreYellowRoom({appSessionId: proof.yellow.appSessionId, verifyGenLayer: runtime.verifyGenLayer});
try {
  const stored = await runtime.read('get_case', [proof.demo.caseId]);
  const input = {receipt: stored.receipt, txHash: proof.demo.adjudication.transactionHash,
    contractAddress: runtime.deployment.address, chainId: runtime.chainId};
  const verified = await runtime.verifyGenLayer(input);
  const transaction = jsonValue(await runtime.client.getTransaction({hash: input.txHash}));
  const live = await room.readSession();
  const metadata = JSON.parse(live.sessionData);
  if (!live.isClosed || metadata.phase !== 'CLOSED' || live.allocations.length !== 0 ||
      metadata.agreementHash !== stored.snapshot.agreement_hash || metadata.evidenceHash !== stored.snapshot.evidence_hash ||
      metadata.verdictReference.receiptHash !== stored.receipt_hash || metadata.verdictReference.txHash !== input.txHash ||
      metadata.proposedAllocation.worker !== stored.receipt.allocation.seller ||
      metadata.proposedAllocation.client !== stored.receipt.allocation.buyer) throw new Error('Live Yellow closure does not match the exact persisted finalized ruling');
  const stages = room.proof().stages.map(stage => ({phase: stage.phase, version: stage.snapshot.version,
    isClosed: stage.snapshot.isClosed, participantSignatures: stage.signatures.length,
    wireUtf8Bytes: Buffer.byteLength(stage.snapshot.sessionData)}));
  if (stages.some(stage => stage.participantSignatures !== 2 || stage.wireUtf8Bytes > 1024)) throw new Error('Signed wire coverage differs from the expected bounded session');
  const source = await readFile(path.join(ROOT, 'contracts/CounterclaimCourt.py'), 'utf8');
  const deployed = await runtime.client.getContractCode(runtime.deployment.address);
  const normalize = value => value.replace(/\r\n/g, '\n').trim();
  if (normalize(source) !== normalize(deployed)) throw new Error('Current deployed contract source differs');
  const result = {observedAt: new Date().toISOString(), status: 'VERIFIED_LIVE_READ_ONLY',
    contractAddress: runtime.deployment.address, sourceSha256: runtime.deployment.sourceSha256,
    sourceMatchesDeployed: true, chainId: runtime.chainId, caseId: stored.snapshot.case_id,
    adjudicationTx: input.txHash, consensusStatus: transaction.statusName, executionResult: transaction.txExecutionResultName,
    initialValidators: transaction.num_of_initial_validators, leaderOnly: transaction.leader_only,
    exactTransactionAndPersistedReceiptVerified: verified.verified, receiptHash: stored.receipt_hash,
    agreementHash: stored.snapshot.agreement_hash, evidenceHash: stored.snapshot.evidence_hash,
    milestones: stored.receipt.milestones, allocation: stored.receipt.allocation,
    yellowSessionId: room.appSessionId, yellowVersion: live.version, yellowClosed: live.isClosed,
    actualTokenAllocations: live.allocations, stages, fundsMoved: false};
  await saveProof('final-verification', result);
  console.log(JSON.stringify(result, null, 2));
} finally {await room.disconnect();}
