# Observed integration result — November 9, 2026

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

The compact read-only verification record is `proof/final-verification.json`.
`proof/demo-proof.json` includes full sources, the stored ruling, signed versions
and closure read-back. The film's immutable copy is
`media/public/recorded-demo-proof.json`; chronological capture metadata binds its
screens to this same case and session.

Follow the [README](README.md) to run a fresh demo with new isolated test accounts.
`node scripts/verify-live-demo.mjs` re-reads the current local run without writing
to either network. Raw provider/model configuration is excluded from the public
repository; it is not needed to verify the scoped result.

The release verifier requires a finalized decision before a new proposal can be
signed. Historical network observations are recorded as observations; the demo
does not claim a trustless cross-chain finality proof or unilateral enforcement.
