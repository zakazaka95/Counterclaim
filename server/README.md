# Yellow sandbox adapter

This is a genuine `@yellow-org/sdk` **1.4.0** integration with Yellow's public
Nitronode sandbox. It creates a real unanimous two-participant app session, commits
hashes of the frozen agreement and complete evidence in co-signed session metadata, and
applies a persisted GenLayer ruling only after an independent read verifies it.

Yellow limits `sessionData` to **1024 UTF-8 bytes**. The adapter therefore sends a
compact, explicitly versioned commitment record. Complete agreement, evidence and
ruling payloads stay in the local recovery record and public proof; the real
GenLayer case also persists the complete review inputs. Nothing is sliced to fit.

**All Yellow token allocations are empty.** The displayed split is exactly 100
nonmonetary **demo credits**, recorded as an agreed proposal in `sessionData`.
No token deposit, approval, transfer, checkpoint or payout is implemented here.
The sandbox session versions and signatures are real; a money settlement is not
claimed. Do not point this adapter at production or connect a funded wallet.

## Design and trust

- Only `wss://nitronode-sandbox.yellow.org/v1/ws` is allowed.
- Two disposable participants have weight 1 each and quorum 2. Both are needed.
- Each participant runs in a separate Node child process with its own key, SDK
  client and session signer. The local demo coordinator generates and can recover
  both disposable keys; this remains a **coordinated demo**, not independent
  economic actors or a production key-custody design.
- Agreement and complete evidence hashes use sorted-key UTF-8 canonical JSON and
  SHA-256. Accepted inputs use JSON primitives and safe integer numbers.
- Wire metadata uses `schema: counterclaim-yellow-wire-v1`, phase, agreement hash,
  optional evidence hash, the nonmonetary unit/total, empty token allocations,
  and—after a ruling—a GenLayer reference with chain, contract, transaction, case
  and complete receipt hash, plus the proposed credit allocation. The entire
  serialized record must be at most 1024 actual UTF-8 bytes. Current live metadata
  must match the exact projection of the retained full sources before an update.
- Every state update reads the node's current version first, signs precisely the
  next version, and reads back the exact metadata, version and closure flag.
- Evidence freezes once. A resolved verdict cannot be applied twice. An
  inconclusive verdict, changed receipt, wrong case/session/hash/authority,
  changed credit allocation or missing participant must not authorize a close.
- GenLayer **informs cooperative settlement**. It cannot override Yellow's
  signature quorum. Yellow's node is trusted for liveness/relay; the app session
  has no unilateral onchain exit, built-in dispute adjudicator or timeout.
- The injected `verifyGenLayer` callback is a server-side authority boundary. It
  must read the pinned contract and exact case from the configured RPC, verify
  accepted successful execution and the complete persisted receipt, and return
  the normalized binding below. Never populate it from a browser request or
  simply return `verified: true` without the actual read.

## API

Install from this folder with `npm ci`, then import:

```js
import {createYellowRoom, restoreYellowRoom} from './lib/yellow-room.mjs';
import {hashJson} from './lib/canonical.mjs';

const room = await createYellowRoom({
  agreement,
  agreementHash: hashJson(agreement),
  verifyGenLayer: async (input, frozenRoom) => {
    // Fetch actual persisted state from the pinned GenLayer contract here.
    // Root coordinator supplies the complete implementation.
    return verifiedPersistedResult;
  },
});
await room.freezeEvidence({evidence, evidenceHash: hashJson(evidence)});
await room.applyVerdict({receipt, txHash, contractAddress, chainId});
await room.close();
await room.disconnect();
```

When the agreement must name the real participant addresses, use
`createYellowRoom({agreementFactory: (participants) => agreement, verifyGenLayer})`
instead. The factory runs after both disposable agents connect but **before**
the creation signatures. If `agreement.parties` is present, its exact buyer/seller
addresses must match participants 0/1. `room.agreement` returns a copy of the
frozen full object; `room.proof().agreementHash` is its computed digest. Factory
and direct agreement/hash forms cannot be combined.

`createYellowRoom` returns `appSessionId`, `participants` and these methods:

| Method | Result |
| --- | --- |
| `readSession()` | Current genuine Yellow session snapshot; invariant-checked. |
| `freezeEvidence({evidence, evidenceHash})` | Complete evidence retained in proof; its exact hash is co-signed into Yellow. |
| `applyVerdict({receipt, txHash, contractAddress, chainId})` | Verified receipt-bound proposal update. |
| `close()` | Co-signed close, only after a verified verdict was applied. |
| `cancel()` | Explicit abort of an unjudged empty-token room; records `CANCELLED`, never a successful ruling. |
| `proof()` | Public sanitized snapshots, signatures and stages; no private keys. |
| `disconnect()` | Disconnect SDK clients and terminate both signer processes. |

`restoreYellowRoom({appSessionId, verifyGenLayer})` restores disposable participants
from the local recovery file and requires an exact live-state match before
continuing. A timeout may mean a write succeeded despite a lost response. Do not
blindly re-sign or assume rollback; read and reconcile the live node first.

The verifier returns:

```js
{
  verified: true,                 // only after an independent actual persisted read
  receipt,                       // exact original Counterclaim receipt
  txHash, contractAddress, chainId,
  binding: {
    appSessionId, agreementHash, evidenceHash, caseId,
    allocation: {worker: 75, client: 25, total: 100, unit: 'DEMO_CREDITS'}
  }
}
```

The numbers above illustrate the synthetic fixture's possible result. They are
not a forced jury output. `validateVerifiedVerdict` also requires the raw persisted
receipt to say `RESOLVED`, `settlement_allowed: true`, the exact case/session/source
and authority identities, and an allocation matching that normalized proposal.

## Verification evidence

`npm test` runs **17 local validation tests**. They cover complete hash binding,
tampered receipts/allocations, wrong authority, stale source identity, inconclusive
results, exact buyer/seller participant identity, safe canonical input bounds and
immutable returned payloads, compact source commitments and the exact 1024-byte
boundary including multibyte Unicode.

The following public proof records are actual observed sandbox calls, not mocks:

- `proof/connection-probe.json`: signed create → metadata operate → close, persisted
  at versions 1, 2 and 3 with empty token allocations.
- `proof/live-guard-check.json`: omitting one participant was rejected with
  `quorum not met: achieved 1, required 2`; changing signed metadata also failed.
  Both rejections left version 1 and its complete state unchanged. A legitimate
  co-signed close then succeeded.
- `proof/live-adapter-preflight.json`: separate signer processes used the entire
  root `fixtures/case.json`, created and froze evidence, rejected a verdict without
  a persisted-read verifier, restored the exact session after disconnect, and
  explicitly cancelled it. The full retained agreement was 1,993 bytes and full
  evidence 2,707 bytes; actual Yellow wire data measured 214/305/299 bytes at the
  three observed stages. This is a transport preflight, not a completed GenLayer
  adjudication. The earlier small connection/guard probes use their own historical
  minimal metadata format and are not proof that arbitrary full blobs fit Yellow.

Run `npm run probe`, `node scripts/live-guard-check.mjs` or
`node scripts/live-adapter-preflight.mjs` to reproduce those zero-token checks.
Each creates new disposable identities and session IDs. The root application
provides the complete live GenLayer path and its separate persisted evidence.
Recovery of the compact encoding is supported; old exploratory probe records with
a different encoding are explicitly refused for continued writes.

## Files that must stay private

`server/.local/` stores recovery keys for **disposable zero-value sandbox accounts
only**. It is ignored by Git. `.env` files and `node_modules/` are ignored as well.
Public `proof/` records contain no private keys. Never include `.local/` when
publishing, sharing a bundle or recording a terminal.

## Primary references

- [Yellow's official settlement-room skill](https://github.com/layer-3/nitrolite/blob/main/agent-skills/yellow-settlement-room/SKILL.md)
- [Yellow v1 quickstart](https://docs.yellow.org/nitrolite/build/getting-started/quickstart/)
- [Internet Court's vendored Yellow integration](https://github.com/internet-court/internet-court-skill/tree/main/vendored/yellow/yellow-settlement-room)
- [`@yellow-org/sdk` official package](https://www.npmjs.com/package/@yellow-org/sdk)

This adapter uses the current native v1 API. It does not mix old ClearNode auth
handshakes or legacy `@erc7824/nitrolite` app-session messages with the v1 API.
