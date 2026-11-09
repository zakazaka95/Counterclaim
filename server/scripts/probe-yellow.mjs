import { Client, createSigners, AppSessionWalletSignerV1, EthereumMsgSigner, packCreateAppSessionRequestV1,
  packAppStateUpdateV1, AppStateUpdateIntent } from '@yellow-org/sdk';
import { generatePrivateKey } from 'viem/accounts';
import { mkdir, writeFile } from 'node:fs/promises';

const ws = 'wss://nitronode-sandbox.yellow.org/v1/ws';
const keys = [generatePrivateKey(), generatePrivateKey()];
const clients = [];
const json = (value) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
const output = { observedAt: new Date().toISOString(), endpoint: ws, transactionValue: '0', tokenAllocations: [], stages: [] };
try {
  for (const key of keys) {
    const signers = createSigners(key);
    clients.push(await Client.create(ws, signers.stateSigner, signers.txSigner));
  }
  output.participants = clients.map((client) => client.getUserAddress());
  output.node = await clients[0].getConfig();
  output.stages.push({ stage: 'connected', observedAt: new Date().toISOString() });
  const definition = { applicationId: 'yellow-court-demo-v1', participants: output.participants.map((walletAddress) => ({walletAddress, signatureWeight: 1})),
    quorum: 2, nonce: BigInt(Date.now()) * 1000000n };
  const data = JSON.stringify({ schema: 'yellow-court-probe-v1', purpose: 'Zero-value synthetic integration capability check', actualTokenAllocation: '0' });
  const signers = keys.map((key) => new AppSessionWalletSignerV1(new EthereumMsgSigner(key)));
  const packed = packCreateAppSessionRequestV1(definition, data);
  const created = await clients[0].createAppSession(definition, data, await Promise.all(signers.map((s) => s.signMessage(packed))));
  output.created = created;
  output.stages.push({stage: 'created', observedAt: new Date().toISOString()});
  const { sessions } = await clients[0].getAppSessions({appSessionId: created.appSessionId});
  output.afterCreate = sessions[0];
  const update = {appSessionId: created.appSessionId, intent: AppStateUpdateIntent.Operate, version: sessions[0].version + 1n,
    allocations: [], sessionData: JSON.stringify({schema: 'yellow-court-probe-v1', phase: 'metadata-update', actualTokenAllocation: '0'})};
  const signed = packAppStateUpdateV1(update);
  await clients[0].submitAppState(update, await Promise.all(signers.map((s) => s.signMessage(signed))));
  output.afterOperate = (await clients[0].getAppSessions({appSessionId: created.appSessionId})).sessions[0];
  output.stages.push({stage: 'operated', observedAt: new Date().toISOString()});
  const close = {...update, intent: AppStateUpdateIntent.Close, version: output.afterOperate.version + 1n, sessionData: output.afterOperate.sessionData};
  const closeHash = packAppStateUpdateV1(close);
  await clients[0].submitAppState(close, await Promise.all(signers.map((s) => s.signMessage(closeHash))));
  output.afterClose = (await clients[0].getAppSessions({appSessionId: created.appSessionId})).sessions[0];
  output.stages.push({stage: 'closed', observedAt: new Date().toISOString()});
  output.success = true;
} catch (error) {
  output.success = false;
  output.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  await Promise.allSettled(clients.map((client) => client.close()));
  await mkdir(new URL('../proof/', import.meta.url), {recursive: true});
  await writeFile(new URL('../proof/connection-probe.json', import.meta.url), json(output) + '\n');
  console.log(json(output));
}
