// Genuine sandbox negative checks. All participants are disposable and all token allocations are empty.
import { Client, createSigners, AppSessionWalletSignerV1, EthereumMsgSigner, packCreateAppSessionRequestV1,
  packAppStateUpdateV1, AppStateUpdateIntent } from '@yellow-org/sdk';
import { generatePrivateKey } from 'viem/accounts';
import { mkdir, writeFile } from 'node:fs/promises';
import { canonicalJson, jsonSafe } from '../lib/canonical.mjs';

const endpoint = 'wss://nitronode-sandbox.yellow.org/v1/ws';
const privateKeys = [generatePrivateKey(), generatePrivateKey()];
const clients = [], checks = [];
const record = {observedAt: new Date().toISOString(), endpoint, actualTokenAllocations: [],
  purpose: 'Live missing-signature and signed-payload tampering rejection, not a financial transaction', checks};
try {
  for (const key of privateKeys) {
    const signers = createSigners(key);
    clients.push(await Client.create(endpoint, signers.stateSigner, signers.txSigner));
  }
  const addresses = clients.map((c) => c.getUserAddress());
  const signers = privateKeys.map((key) => new AppSessionWalletSignerV1(new EthereumMsgSigner(key)));
  const definition = {applicationId: 'yellow-court-demo-v1', participants: addresses.map((walletAddress) => ({walletAddress, signatureWeight: 1})),
    quorum: 2, nonce: BigInt(Date.now()) * 1000000n};
  const sessionData = canonicalJson({purpose: 'synthetic zero-value protocol guard check', phase: 'AGREED'});
  const packedCreate = packCreateAppSessionRequestV1(definition, sessionData);
  const created = await clients[0].createAppSession(definition, sessionData, await Promise.all(signers.map((s) => s.signMessage(packedCreate))));
  record.appSessionId = created.appSessionId;
  const read = async () => (await clients[0].getAppSessions({appSessionId: created.appSessionId})).sessions[0];
  const original = await read(); record.original = jsonSafe(original);
  const update = {appSessionId: created.appSessionId, intent: AppStateUpdateIntent.Operate,
    version: original.version + 1n, allocations: [], sessionData: canonicalJson({phase: 'GUARD_PROPOSAL', credits: 100})};
  const updateHash = packAppStateUpdateV1(update);
  const signatures = await Promise.all(signers.map((s) => s.signMessage(updateHash)));
  for (const [name, proposal, sigs] of [
    ['missing-second-participant', update, [signatures[0]]],
    ['metadata-altered-after-signing', {...update, sessionData: canonicalJson({phase: 'GUARD_PROPOSAL', credits: 999})}, signatures]
  ]) {
    let rejected = false, errorMessage;
    try { await clients[0].submitAppState(proposal, sigs); }
    catch (error) { rejected = true; errorMessage = error.message; }
    const after = await read();
    const unchanged = canonicalJson(jsonSafe(after)) === canonicalJson(jsonSafe(original));
    checks.push({name, rejected, errorMessage, stateUnchanged: unchanged, versionAfter: after.version.toString(),
      observedAt: new Date().toISOString()});
    if (!rejected || !unchanged) throw new Error('A sandbox signature guard did not reject atomically: ' + name);
  }
  const close = {appSessionId: created.appSessionId, intent: AppStateUpdateIntent.Close,
    version: original.version + 1n, allocations: [], sessionData};
  const closeHash = packAppStateUpdateV1(close);
  await clients[0].submitAppState(close, await Promise.all(signers.map((s) => s.signMessage(closeHash))));
  record.closed = jsonSafe(await read());
  record.success = record.closed.isClosed === true;
} catch (error) { record.success = false; record.error = error.message; process.exitCode = 1; }
finally {
  await Promise.allSettled(clients.map((c) => c.close()));
  await mkdir(new URL('../proof/', import.meta.url), {recursive: true});
  await writeFile(new URL('../proof/live-guard-check.json', import.meta.url), JSON.stringify(jsonSafe(record), null, 2) + '\n');
  console.log(JSON.stringify(jsonSafe(record), null, 2));
}
