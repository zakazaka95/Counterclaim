import {Client, createSigners, AppSessionWalletSignerV1, EthereumMsgSigner,
  packCreateAppSessionRequestV1, packAppStateUpdateV1} from '@yellow-org/sdk';
import {canonicalJson, hashJson, jsonSafe} from './verify';

export const YELLOW_ENDPOINT = 'wss://nitronode-sandbox.yellow.org/v1/ws';
const wireSchema = 'counterclaim-yellow-wire-v1';
function compact(value: any) {
  const text = canonicalJson(value);
  if (new TextEncoder().encode(text).length > 1024) throw new Error('The complete Yellow commitment exceeds its 1024-byte limit.');
  return text;
}
function assertSession(session: any, participants: string[], data: string) {
  if (!session || session.isClosed || session.allocations.length !== 0 || session.appDefinition.quorum !== 2 ||
      session.appDefinition.participants.length !== 2 ||
      session.appDefinition.participants.some((party: any, index: number) =>
        party.signatureWeight !== 1 || party.walletAddress.toLowerCase() !== participants[index].toLowerCase()) || session.sessionData !== data) {
    throw new Error('The actual Yellow session does not match both participants and the exact evidence commitments.');
  }
}

/** Two browser-local signers, zero Yellow allocations; no backend keys or workers. */
export async function freezeYellow(privateKeys: [`0x${string}`, `0x${string}`], participants: string[], agreement: any, evidence: any) {
  const clients: Client[] = [];
  try {
    for (const key of privateKeys) {
      const signers = createSigners(key);
      clients.push(await Client.create(YELLOW_ENDPOINT, signers.stateSigner, signers.txSigner));
    }
    if (clients.some((client, index) => client.getUserAddress().toLowerCase() !== participants[index].toLowerCase())) throw new Error('Yellow and GenLayer account identities differ.');
    const signers = privateKeys.map(key => new AppSessionWalletSignerV1(new EthereumMsgSigner(key)));
    const entropy = new Uint32Array(1); crypto.getRandomValues(entropy);
    const definition = {applicationId: 'yellow-court-demo-v1', participants: participants.map(walletAddress => ({walletAddress: walletAddress as `0x${string}`, signatureWeight: 1})),
      quorum: 2, nonce: BigInt(Date.now()) * 1000000n + BigInt(entropy[0] % 1000000)};
    const common = {schema: wireSchema, agreementHash: hashJson(agreement), creditUnit: 'DEMO_CREDITS', creditTotal: 100, actualTokenAllocations: []};
    const agreedData = compact({...common, phase: 'AGREED'});
    const signatures = await Promise.all(signers.map(signer => signer.signMessage(packCreateAppSessionRequestV1(definition, agreedData))));
    const created = await clients[0].createAppSession(definition, agreedData, signatures);
    const first = (await clients[0].getAppSessions({appSessionId: created.appSessionId})).sessions.find(row => row.appSessionId === created.appSessionId);
    assertSession(first, participants, agreedData);
    const frozenData = compact({...common, phase: 'EVIDENCE_FROZEN', evidenceHash: hashJson(evidence)});
    const update = {appSessionId: created.appSessionId, intent: 0, version: first!.version + 1n, allocations: [], sessionData: frozenData};
    const updateSignatures = await Promise.all(signers.map(signer => signer.signMessage(packAppStateUpdateV1(update))));
    await clients[0].submitAppState(update, updateSignatures);
    const after = (await clients[0].getAppSessions({appSessionId: created.appSessionId})).sessions.find(row => row.appSessionId === created.appSessionId);
    assertSession(after, participants, frozenData);
    if (after!.version !== update.version) throw new Error('Yellow did not persist the expected frozen version.');
    return jsonSafe({endpoint: YELLOW_ENDPOINT, appSessionId: created.appSessionId, participants,
      agreementHash: common.agreementHash, evidenceHash: hashJson(evidence), phase: 'EVIDENCE_FROZEN',
      version: after!.version.toString(), isClosed: false, actualTokenAllocations: [],
      stages: [{phase: 'AGREED', definition, signatures, snapshot: first},
        {phase: 'EVIDENCE_FROZEN', update, signatures: updateSignatures, snapshot: after}],
      signingConnectionsClosedBeforeAdjudication: true});
  } finally {await Promise.allSettled(clients.map(client => client.close()));}
}
