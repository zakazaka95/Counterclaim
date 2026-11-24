/** Fresh, resumable v2 demonstration: buyer refuses all post-offer actions. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createGenLayerRuntime, ROOT, RPC, EXPLORER, rpc, saveProof} from './genlayer.mjs';
import {createYellowRoom, restoreYellowRoom} from '../server/lib/yellow-room.mjs';
import {hashJson, jsonValue} from './canonical.mjs';

const fixture = JSON.parse(await readFile(path.join(ROOT, 'fixtures/case.json'), 'utf8'));
const journalFile = path.join(ROOT, '.local', 'reviewer-demo-v2.json');
const runtime = await createGenLayerRuntime();
let journal, room, disconnected = false;
try {journal = JSON.parse(await readFile(journalFile, 'utf8'));}
catch (error) {if (error.code !== 'ENOENT') throw error; journal = {schema: 'counterclaim-reviewer-run-v2'};}
async function persist() {
  await mkdir(path.dirname(journalFile), {recursive: true});
  await writeFile(journalFile, JSON.stringify(journal, null, 2) + '\n', {mode: 0o600});
}
function agreementFactory(participants) {
  return {...Object.fromEntries(['title', 'pool', 'unit', 'milestones', 'claims', 'scope']
    .map(key => [key, structuredClone(fixture[key])])),
    parties: {buyer: participants[0].toLowerCase(), seller: participants[1].toLowerCase()}};
}

try {
  const deployment = await runtime.deploy();
  if (journal.contractAddress && journal.contractAddress !== deployment.address) throw new Error('Reviewer journal belongs to another v2 deployment');
  journal.contractAddress = deployment.address;
  await persist();
  room = journal.appSessionId
    ? await restoreYellowRoom({appSessionId: journal.appSessionId, verifyGenLayer: runtime.verifyGenLayer})
    : await createYellowRoom({agreementFactory, verifyGenLayer: runtime.verifyGenLayer});
  journal.appSessionId = room.appSessionId;
  journal.participants = room.participants;
  await persist();
  runtime.attachParticipants(room.record.privateKeys, room.participants);
  if (room.proof().phase === 'AGREED') await room.freezeEvidence({evidence: fixture.evidence, evidenceHash: hashJson(fixture.evidence)});
  if (room.proof().phase !== 'EVIDENCE_FROZEN') throw new Error('Reviewer run requires the unchanged evidence-frozen Yellow room');
  journal.yellowBefore = await room.readSession();
  await persist();

  if (journal.caseId === undefined) {
    const opened = await runtime.openCase({sessionId: room.appSessionId, agreement: room.agreement, evidence: fixture.evidence});
    journal.caseId = opened.caseId;
    journal.authorizationTransactions = Object.fromEntries(Object.entries(opened.authorizationTransactions).map(([role, tx]) => [role, tx.hash]));
    await persist();
  }
  // Both unanimous-session signing processes are stopped BEFORE the ruling.
  // Only the seller's separate GenLayer account remains active below.
  await room.disconnect();
  disconnected = true;
  journal.yellowSigningProcessesStoppedBeforeRuling = true;
  await persist();
  const ruling = await runtime.adjudicate(journal.caseId, 'seller');
  journal.rulingHash = ruling.hash;
  await persist();
  await runtime.verifyGenLayer({receipt: ruling.stored.receipt, txHash: ruling.hash,
    contractAddress: deployment.address, chainId: runtime.chainId});
  if (ruling.stored.receipt.decision !== 'RESOLVED' || ruling.stored.receipt.settlement_allowed !== true) {
    throw new Error('Independent consensus was inconclusive; no withdrawal attempted');
  }
  const sellerClaim = await runtime.claim(journal.caseId, 'seller');
  journal.sellerClaimHash = sellerClaim.hash;
  await persist();
  const stored = await runtime.read('get_case', [journal.caseId]);
  const remainingBalanceWei = BigInt(await rpc('eth_getBalance', [deployment.address, 'latest'])).toString();
  if (stored.claims.buyer.emitted || !stored.claims.seller.emitted ||
      sellerClaim.balanceProof.debitWei !== stored.receipt.settlement.seller_wei ||
      remainingBalanceWei !== stored.receipt.settlement.buyer_wei) {
    throw new Error('Unilateral seller transfer or untouched buyer award did not match the persisted ruling');
  }
  // Reconnect only to read; no signUpdate, submit, close, or other Yellow write.
  const readOnlyRoom = await restoreYellowRoom({appSessionId: journal.appSessionId, verifyGenLayer: runtime.verifyGenLayer});
  let yellowAfter;
  try {yellowAfter = await readOnlyRoom.readSession();} finally {await readOnlyRoom.disconnect();}
  if (yellowAfter.version !== journal.yellowBefore.version || yellowAfter.sessionData !== journal.yellowBefore.sessionData || yellowAfter.isClosed) {
    throw new Error('Yellow changed while the counterparty was withholding cooperation');
  }
  const result = {schema: 'counterclaim-reviewer-verification-v2', observedAt: new Date().toISOString(),
    status: 'VERIFIED_UNILATERAL_NATIVE_TEST_GEN_SETTLEMENT', chainId: runtime.chainId, rpc: RPC,
    contractAddress: deployment.address, contractUrl: deployment.explorerUrl,
    sourceSha256: deployment.sourceSha256, sourceMatchesDeployed: deployment.executionVerified,
    caseId: journal.caseId, authorizationTransactions: journal.authorizationTransactions,
    participants: {buyer: journal.participants[0], seller: journal.participants[1]},
    authenticatedDelivery: stored.snapshot.authorization, termsHash: stored.snapshot.terms_hash,
    agreementHash: stored.snapshot.agreement_hash, evidenceHash: stored.snapshot.evidence_hash,
    fullStoredCase: stored, ruling: {hash: ruling.hash, url: ruling.explorerUrl,
      status: ruling.transaction.statusName, executionResult: ruling.transaction.txExecutionResultName,
      initialValidators: ruling.transaction.num_of_initial_validators, leaderOnly: ruling.transaction.leader_only},
    sellerClaim: {hash: sellerClaim.hash, url: sellerClaim.explorerUrl, recipient: sellerClaim.recipient,
      amountWei: sellerClaim.amountWei, finalized: true, balanceProof: sellerClaim.balanceProof,
      transferMessages: sellerClaim.transferMessages},
    buyerClaimed: false, buyerAwardStillReservedWei: stored.claims.buyer.amount_wei, contractBalanceAfterWei: remainingBalanceWei,
    nonCooperation: {buyerTransactionsAfterOffer: 0, yellowSigningProcessesStoppedBeforeRuling: true,
      yellowWritesAfterEvidenceFreeze: 0, noCounterpartySignatureForClaim: true},
    yellow: {appSessionId: journal.appSessionId, before: journal.yellowBefore, after: yellowAfter,
      unchangedVersion: true, remainsOpen: true, actualTokenAllocations: yellowAfter.allocations},
    scope: 'Synthetic direct-account participants; faucet-funded Studio test GEN only. Yellow metadata is not a token escrow. Buyer refund remains independently claimable.',
    explorerLinks: [deployment.explorerUrl, ...Object.values(journal.authorizationTransactions).map(hash => `${EXPLORER}/tx/${hash}`), ruling.explorerUrl, sellerClaim.explorerUrl]};
  await saveProof('reviewer-verification-v2', result);
  await saveProof('final-verification', result);
  journal.complete = true;
  await persist();
  console.log(JSON.stringify(jsonValue({status: result.status, contract: result.contractUrl, caseId: result.caseId,
    ruling: result.ruling.url, sellerClaim: result.sellerClaim.url, sellerTransferWei: sellerClaim.amountWei,
    contractRemainingWei: remainingBalanceWei, yellowUnchangedAndOpen: true}), null, 2));
} finally {if (room && !disconnected) await room.disconnect();}
