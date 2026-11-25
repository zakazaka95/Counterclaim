# Hosted Counterclaim runtime

The public app uses the same court as the recorded v2 case. Disposable demo
accounts sign in the browser. This Worker holds no signing keys, user balances
or uploaded case records; it serves the app and a bounded Studio RPC gateway.

```sh
npm ci
npm --prefix app ci
npm run test:hosting
npm run build:hosted
node hosting/preview.mjs
```

The preview listens on `http://127.0.0.1:5178`, applies the checked-in schema
to an ephemeral SQLite database, and forwards RPC only when a visitor acts.
Stop it after QA. It is separate from the legacy localhost coordinator.

Production uses a Cloudflare Worker and the Sites-provisioned D1 binding `DB`.
The Site manifest must contain `d1: "DB"` and omit `static`. The build embeds
all `app/dist` assets into `dist/server/index.js`; no filesystem, Node server,
asset binding, private environment variable or public signing credential is used
by the hosted runtime. Generated Drizzle SQL and metadata are packaged with
the Site; no request handler creates or changes schema.

## Gateway boundary

- Fixed upstream: `https://studio-dev.genlayer.com/api`, chain `61997`.
- Fixed court: `0xC68b67797C630cBBf2bb80D290d68A787c855E14`.
- Signed writes must use the chain's `addTransaction` consensus entry point,
  embed that court, recover the declared participant signer and use normal
  multi-validator execution. Deployment, other contracts and raw value transfers
  cannot pass through this gateway.
- Court methods are limited to opening, accepting, delivering, adjudicating,
  claiming and timeout refunding. Views are limited to case, session, attempt
  and stats reads. The court still enforces participant authorization.
- The only escrow value accepted by the demo gateway is `0.001` test GEN at
  `open_case`; other calls carry zero user value. Faucet calls are capped at
  five test GEN and cannot fund the court or consensus contract.
- A D1 atomic upsert spaces forwarded requests globally by at least 3.5 seconds
  across visitors and Worker isolates. A full bounded queue returns `429` with
  `Retry-After`. Upstream failures are reported; the gateway never signs or
  automatically creates a replacement transaction.

`/api/proof` is the fixed recorded November 24 proof, `/api/contract` is the
matching published source, and `/health` checks the scheduler binding/schema
without calling Studio. Fresh proof downloads are assembled by the browser
controller and must never include its disposable private keys.
