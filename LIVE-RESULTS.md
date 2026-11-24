# Counterclaim observed results

## Version 2 correction — November 24, 2026

**VERIFIED_UNILATERAL_NATIVE_TEST_GEN_SETTLEMENT**, recorded at `2026-11-24T18:00:28.085Z`.
The seller received its native test-GEN award without a later buyer court call
or Yellow update. This is one synthetic Studio case, not mainnet settlement or
a general jury-accuracy benchmark.

| Field | Observed record |
| --- | --- |
| Network | Studio Devnet, chain 61997 |
| Court / schema | `2.0.0` / `counterclaim-ruling-v2` |
| Matching court | https://explorer-studio-dev.genlayer.com/address/0xC68b67797C630cBBf2bb80D290d68A787c855E14 |
| Deployment | https://explorer-studio-dev.genlayer.com/tx/0xc1bb1f701a3c6e0445d941616aa5b7cbe5f82f450a1a30d3e6ef2caacced583d |
| Immutable court source | https://github.com/zakazaka95/Counterclaim/blob/3602e22e30933c41b116b09f7e535cada06578f6/contracts/CounterclaimCourt.py |
| Exact source SHA-256 | `e034dbbf10ccdaaf80125d3e13630837590df2d97da79c212ccce7ca88f44860` |
| Source comparison | Complete match after CRLF/LF and outer-whitespace normalization only |
| Buyer funding | https://explorer-studio-dev.genlayer.com/tx/0x6d353ee2fa04f5b01f73b7d4fb2419f05437c81a7f6bee05623c4540d86ca379 |
| Seller acceptance | https://explorer-studio-dev.genlayer.com/tx/0x49871244343ea62713cbace4e0c6faba6d66d236029d9273fe8cebc05bd8a708 |
| Seller delivery | https://explorer-studio-dev.genlayer.com/tx/0xb135d8971868a02d335491fbff8f6ef73f7ffac030edaa0fbe594c48a798d3f0 |
| Finalized ruling | https://explorer-studio-dev.genlayer.com/tx/0x8680534d17e4df175d22015c69a6d02ccdcb7c65a457d13ac98c4226d7602995 |
| Ruling execution | FINALIZED / FINISHED_WITH_RETURN; normal mode, leader-only false |
| Case / milestone outcomes | 0 / SATISFIED, SATISFIED, NOT_SATISFIED |
| Deposit | 1000000000000000 wei = 0.001 faucet GEN |
| Fixed entitlements | Seller 750000000000000 / buyer 250000000000000 wei |
| Finalized seller claim | https://explorer-studio-dev.genlayer.com/tx/0x89ddff840170de7316739a4f492a7b7115ff5728efde51524d01526053ed4998 |
| Seller native award | 750000000000000 wei = 0.00075 test GEN |
| Court balance | 1000000000000000 -> 250000000000000 wei; exact award debit |
| Seller balance | 99999758147749997531 -> 100000381771749996708 wei |
| Seller net credit | 623623999999177 wei, positive after the claimant network fees |
| Buyer claim | Not invoked; 250000000000000 wei reserved |
| Local checks | 33 Python + 20 root JS + 17 Yellow + 7 UI = 77 passed |
| Build checks | App build and media typecheck passed |

The external message names seller `0x2e0a4FDaCfB400aC9720b1CB3acAE72E1754e45C`, value
`750000000000000`, empty call data and `onAcceptance=false`. The finalized claim,
exact court debit and positive recipient credit jointly verify payout. The net
account change is smaller than the award because the claimant pays network fees.

Buyer: `0x03A903767a58d6ebf1E9833264d42e1a3AC4af91`. Seller: `0x2e0a4FDaCfB400aC9720b1CB3acAE72E1754e45C`.
The seller separately accepted and delivered. Frozen terms hash:
`056482279e690b9e6e92aa58e7a0f17152ecc3a60edd06e133b45747bfe19bdd`. Exact delivery hash:
`0497e1b8cce20058406063bb31b5f24fc86e70211a3cb92bcbf8a240b9db22aa`. Complete receipt SHA-256:
`98c01906311135393b7bcb5efc121efa7e9dcc8c8fc9bca4e09493a1111abf33`.
The review is complete and untruncated. Five initial validators were configured;
this is not a claim that all five voted agree.

## Non-cooperation observation

Yellow session `0xb3d87586f692d8374316f931f63eefa29bb4dab6148808be3491d907c3a5618d` stayed open at **version 2**, with
empty token allocations and unchanged session data. Both Yellow signing processes
stopped before review. The recorded run made zero buyer court calls after funding
and zero Yellow writes after evidence freeze. The seller requested adjudication
and claimed independently. The buyer's 0.00025 GEN remains reserved; no buyer
withdrawal is claimed for this run.

## Reproduction and coverage

Run `node scripts/reviewer-demo.mjs` after installing the README dependencies.
The complete public record is [proof/reviewer-verification-v2.json](proof/reviewer-verification-v2.json).
[proof/case-open-readback.json](proof/case-open-readback.json) and
[proof/adjudication-readback.json](proof/adjudication-readback.json) preserve the
full inputs and ruling. Fresh runs create their own identities and outcomes.

The 77 local tests separately cover authorization, tampering, duplicate claims,
timeout refunds and message-fee allocation. No live rejected transaction or live
timeout refund is claimed for those guards. The delivery channel authenticates
account and bytes, not authorship, external hosting or code execution. The demo
uses disposable harness-controlled EOA signers and recipients.

## Evidence history

The old 42-second film and the following November 9 observations are **version 1**.
Use the [immutable v1 snapshot](https://github.com/zakazaka95/Counterclaim/tree/8aba84e43359a791ded97a2d58fe6c4cba409994)
for old proof. Current `proof/deployment.json` and `proof/final-verification.json`
contain v2 records and are not the old v1 files.

<details>
<summary>Historical version 1 observations — November 9, 2026</summary>

# Version 1 observed integration result — November 9, 2026

These are actual network observations for one synthetic case. They are not
controlled-output unit fixtures, production claims or general jury accuracy data.

## Matching GenLayer source and execution

| Field | Observed record |
| --- | --- |
| Network | Studio Devnet, chain 61997 |
| Contract | [0x34b0a821B1AF34A9ac6c71E6e98d1A1f1a0A5303](https://explorer-studio-dev.genlayer.com/address/0x34b0a821B1AF34A9ac6c71E6e98d1A1f1a0A5303) |
| Deployment | [0xcf467d30…2adf448](https://explorer-studio-dev.genlayer.com/tx/0xcf467d309a93bd4016a422afa49118be4fcd17298f3ecc4ca03fbd65c2adf448) |
| Exact source | `contracts/CounterclaimCourt.py`, version 1.0.0 |
| Raw source SHA-256 | `ff5bb2171ed16dc1b173260e0b335fec8aa695d35f211624db0547272741bd2f` |
| Full deployed-source comparison | Match after CRLF→LF and outer-whitespace normalization; internal whitespace preserved |
| Case | 0, exact Yellow session and complete agreement/evidence hashes persisted |
| Open-case transaction | [0x5921149b…b7cd343](https://explorer-studio-dev.genlayer.com/tx/0x5921149bfdd2ac536d8a61076c8a0868e89bfd18bf8bae26f55e53a2eb7cd343) |
| Adjudication | [0x8824d0ce…4c82dd6](https://explorer-studio-dev.genlayer.com/tx/0x8824d0cec2e245b7064813fd7eefd685c1146a64a66db09e9f1fbb9c24c82dd6) |
| Re-read consensus status | FINALIZED; FINISHED_WITH_RETURN |
| Execution mode | NORMAL, leader-only false, five initial validators configured |
| Persisted milestone outcomes | SATISFIED, SATISFIED, NOT_SATISFIED |
| Derived proposal | Seller 75, buyer 25, total 100 nonmonetary demo credits |
| Complete receipt SHA-256 | `364cf868478d0684b30d409eb3cda09ff6391567924a109c1b21353e3e08fb7b` |

The configured validator count is not a claim that every initial validator voted
agree or that this case benchmarks semantic accuracy. The authoritative recorded
outcome is the finalized successful transaction and matching persisted receipt.

## Actual Yellow session

Session:
`0x46482dc28f8615809bdf53d9f5e9aae6a65aac13f208776c7db653682749fabf`

| Version | Observed phase | Required participant signatures | Actual token allocations | Signed wire bytes |
| ---: | --- | ---: | --- | ---: |
| 1 | AGREED | 2 | `[]` | 214 |
| 2 | EVIDENCE_FROZEN | 2 | `[]` | 305 |
| 3 | VERDICT_APPLIED | 2 | `[]` | 656 |
| 4 | CLOSED, live `isClosed=true` | 2 | `[]` | 647 |

The session's compact signed metadata commits the full agreement/evidence and
exact court receipt. Complete public sources and receipts are retained separately.
This is a genuine sandbox session lifecycle, **not a funded token settlement**.

## Observed adverse checks

- Yellow rejected a one-signature update with `quorum not met: achieved 1,
  required 2`, leaving its version unchanged.
- Yellow rejected content modified after signing. The negative checks used a
  separate zero-token exploratory session, recorded in `server/proof/live-guard-check.json`.
- Against the real persisted court case, the relay rejected an altered allocation
  and an unrelated successful deployment transaction. The active Yellow version
  stayed unchanged. Pre-sign and closed-state verification records are separate.
- The full fixture initially exceeded Yellow's actual 1024-byte session-data
  limit. The final adapter uses hash commitments, verifies their complete retained
  sources and refuses over-budget wire bytes instead of truncating them.

## Inspect or reproduce

The immutable version 1 verification record is https://github.com/zakazaka95/Counterclaim/blob/8aba84e43359a791ded97a2d58fe6c4cba409994/proof/final-verification.json.
The immutable version 1 `proof/demo-proof.json` at commit `8aba84e43359a791ded97a2d58fe6c4cba409994` includes full sources, the stored ruling, signed versions
and closure read-back. The film's immutable copy is
`media/public/recorded-demo-proof.json`; chronological capture metadata binds its
screens to this same case and session.

The [version 1 README](https://github.com/zakazaka95/Counterclaim/blob/8aba84e43359a791ded97a2d58fe6c4cba409994/README.md) records its original reproduction path.
`node scripts/verify-live-demo.mjs` re-reads the current local run without writing
to either network. Raw provider/model configuration is excluded from the public
repository; it is not needed to verify the scoped result.

The release verifier requires a finalized decision before a new proposal can be
signed. Historical network observations are recorded as observations; the demo
does not claim a trustless cross-chain finality proof or unilateral enforcement.

</details>
