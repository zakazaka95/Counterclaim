// A disposable demonstration agent owns exactly one key and SDK connection.
// It cannot deposit, approve, transfer, or make blockchain transactions.
import { Client, createSigners, AppSessionWalletSignerV1, EthereumMsgSigner,
  packCreateAppSessionRequestV1, packAppStateUpdateV1 } from '@yellow-org/sdk';
import { jsonSafe } from './canonical.mjs';

let client, signer, address;
const ALLOWED_ENDPOINT = 'wss://nitronode-sandbox.yellow.org/v1/ws';
function assertDefinition(definition) {
  if (definition.participants.length !== 2 || definition.quorum !== 2 ||
      definition.participants.some((p) => p.signatureWeight !== 1) ||
      !definition.participants.some((p) => p.walletAddress.toLowerCase() === address.toLowerCase())) {
    throw new Error('The demo requires both distinct agents in an equal-weight unanimous session.');
  }
  if (new Set(definition.participants.map((p) => p.walletAddress.toLowerCase())).size !== 2) throw new Error('Duplicate participants.');
}
function definitionFromWire(value) { return {...value, nonce: BigInt(value.nonce)}; }
function updateFromWire(value) {
  if (!Array.isArray(value.allocations) || value.allocations.length) throw new Error('This demo signs zero-token allocations only.');
  if (![0, 3].includes(value.intent)) throw new Error('Only metadata OPERATE and CLOSE are allowed.');
  return {...value, version: BigInt(value.version), allocations: []};
}
process.on('message', async ({ id, method, args }) => {
  try {
    let result;
    if (method === 'init') {
      if (client || args.endpoint !== ALLOWED_ENDPOINT) throw new Error('Only a fresh Yellow sandbox client is allowed.');
      const signers = createSigners(args.privateKey);
      signer = new AppSessionWalletSignerV1(new EthereumMsgSigner(args.privateKey));
      client = await Client.create(ALLOWED_ENDPOINT, signers.stateSigner, signers.txSigner);
      address = client.getUserAddress();
      result = {address};
    } else if (!client) throw new Error('Agent has not connected.');
    else if (method === 'signCreate') {
      const definition = definitionFromWire(args.definition);
      assertDefinition(definition);
      result = await signer.signMessage(packCreateAppSessionRequestV1(definition, args.sessionData));
    } else if (method === 'signUpdate') {
      const update = updateFromWire(args.update);
      const { sessions } = await client.getAppSessions({appSessionId: update.appSessionId});
      const live = sessions.find((session) => session.appSessionId === update.appSessionId);
      if (!live || live.isClosed || live.version + 1n !== update.version) throw new Error('Live version or open-session guard failed.');
      assertDefinition(live.appDefinition);
      if (live.allocations.length) throw new Error('Refusing a funded session in the zero-token demo.');
      result = await signer.signMessage(packAppStateUpdateV1(update));
    } else if (method === 'create') {
      const definition = definitionFromWire(args.definition);
      assertDefinition(definition);
      result = await client.createAppSession(definition, args.sessionData, args.signatures);
    } else if (method === 'submit') {
      result = await client.submitAppState(updateFromWire(args.update), args.signatures);
    } else if (method === 'read') result = await client.getAppSessions({appSessionId: args.appSessionId});
    else if (method === 'config') result = await client.getConfig();
    else if (method === 'disconnect') { await client.close(); client = null; result = true; }
    else throw new Error('Unsupported participant command.');
    process.send?.({id, result: jsonSafe(result ?? null)});
  } catch (error) { process.send?.({id, error: {name: error.name, message: error.message}}); }
});
process.on('disconnect', async () => { try { await client?.close(); } finally { process.exit(0); } });
