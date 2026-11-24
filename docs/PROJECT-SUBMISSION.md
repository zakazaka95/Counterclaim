# Counterclaim — Projects correction, November 24, 2026

The steward requested substantive changes to the original version 1 submission.
The current Portal state observed on November 24 is **Action needed**. The v2
correction below has a matching v2.0.0 deployment and passed 77 local tests plus
the app build and media typecheck. Its authenticated delivery, finalized ruling
and unilateral seller payout are verified. The existing Portal entry is prepared
for updating but has not yet been resubmitted.

| Current field | Record |
| --- | --- |
| Project / category | Counterclaim / Builder → Projects |
| Original submission ID | `c5a6123f-1355-47ce-8547-a9cdc4b3ce83` |
| Original submitted / contribution date | November 10, 2026 |
| Review note observed | November 24, 2026 |
| Current review state | Action needed; correction not yet resubmitted |
| Portal record | https://portal.genlayer.foundation/my-submissions?q=Counterclaim |
| Website / repository entry point | https://github.com/zakazaka95/Counterclaim |
| Delivery model | Locally runnable app; no hosted frontend is claimed |
| v2 court source commit | `3602e22e30933c41b116b09f7e535cada06578f6` |
| v2 matching contract | https://explorer-studio-dev.genlayer.com/address/0xC68b67797C630cBBf2bb80D290d68A787c855E14 |
| v2 finalized ruling | https://explorer-studio-dev.genlayer.com/tx/0x8680534d17e4df175d22015c69a6d02ccdcb7c65a457d13ac98c4226d7602995; case 0, fixed 75/25 native entitlements |
| v2 native seller claim | https://explorer-studio-dev.genlayer.com/tx/0x89ddff840170de7316739a4f492a7b7115ff5728efde51524d01526053ed4998; finalized 0.00075 test GEN, positive recipient net credit after fees |
| Buyer award / Yellow state | 0.00025 GEN remains reserved; no buyer withdrawal; Yellow version 2 unchanged and open |
| Current demo-video field | No v2 YouTube or X upload claimed; the existing GitHub film is historical v1 |

Joaquin Bressan's earlier guidance concerned the ordinary Projects route while
Builders Working Group had no open spots. It was not acceptance or endorsement.
The [reviewer response](REVIEWER-RESPONSE-2026-11-24.md) maps the correction to the
actual technical concerns.

## One-liner

A delivery escrow where both parties approve the terms, the seller submits the work onchain, and GenLayer determines native GEN payouts.

Character count: **136 / 180**.

## Description

Counterclaim is a locally runnable delivery escrow for digital work submitted as exact onchain text. The buyer locks native GEN and fixed acceptance criteria; the named seller separately accepts the exact terms hash, then alone can deliver the immutable artifact bytes. GenLayer validators assess that authenticated delivery against the complete agreed criteria, while contract code fixes each party's GEN entitlement. Each party can claim its own payout without the other's approval; a pre-agreed timeout refunds an unresolved case. Yellow is an optional co-signed record, never the authority that releases the escrow. This authenticates the submitting wallet and exact delivery, not authorship, external hosting or code execution. The reviewer demo uses disposable Studio accounts and 0.001 faucet GEN. Joaquin Bressan recommended the Projects route while Builders Working Group had no open spots.

Character count: **899 / 1000**.

## How-to

### 1. Install the corrected local app

Use Node.js 24 and Python 3.12+. Clone `https://github.com/zakazaka95/Counterclaim.git`, enter `Counterclaim`, then run `npm ci`, `npm --prefix server ci` and `npm --prefix app ci`. Use only disposable Studio accounts and faucet test GEN. Do not provide a personal funded wallet key.

### 2. Run the authenticated escrow demonstration

From the repository root run `node scripts/reviewer-demo.mjs`. The correction runner retains the exact deployment and transaction identities for buyer funding, separate seller acceptance, seller-only delivery, ruling and native claim. A failed or inconclusive operation does not create a successful verification record. Inspect the actual output and public proof paths.

### 3. Inspect the participants and exact work

Read the persisted case and each transaction sender. Confirm the buyer funded the native deposit, the named seller accepted the exact stored terms hash, and that same seller submitted the artifact bytes. Confirm the agreed scope is onchain text delivery and static source assessment, not external authorship, hosting or executed tests.

### 4. Verify the ruling and independent claims

Inspect the finalized ruling and fixed GEN entitlements, then the seller's own `claim(case_id)` and native transfer while the buyer and Yellow signers remain inactive. The buyer's award stays reserved for its own claim. The fixture is intended to produce a 75/25 split if the jury agrees; retain the actual result. The passing local suites separately cover unauthorized calls, tampering, duplicate claims and timeout refunds.

For the local interface, run `npm run setup:genlayer` and `npm start` in the
repository root, then `npm --prefix app run dev` in a second terminal and open
`http://127.0.0.1:5178`. Use **Open demo room**, **Request a ruling**, then
**Claim the escrow awards**. This coordinated UI path differs from the recorded
seller-only reviewer run. The old film is historical v1.

## Expected verification outcome

Recorded v2 case 0: a buyer-funded 0.001 faucet GEN escrow, separate seller acceptance and seller-only delivery. The finalized ruling awards 75% seller / 25% buyer. The seller claimed 0.00075 test GEN without another buyer transaction or Yellow co-sign; 0.00025 remains reserved. Yellow stays open at version 2. Exact source, transactions, receipt and balance snapshots are linked. Local tests cover unauthorized calls, tampering, duplicate claims and timeouts.

Character count: **461 / 500**.

## Verified version 2 evidence

| Evidence | Record |
| --- | --- |
| Public repository | https://github.com/zakazaka95/Counterclaim |
| Immutable v2 contract source | [3602e22e30933c41b116b09f7e535cada06578f6](https://github.com/zakazaka95/Counterclaim/blob/3602e22e30933c41b116b09f7e535cada06578f6/contracts/CounterclaimCourt.py) |
| Matching v2 Explorer contract | https://explorer-studio-dev.genlayer.com/address/0xC68b67797C630cBBf2bb80D290d68A787c855E14 |
| Finalized v2 ruling | https://explorer-studio-dev.genlayer.com/tx/0x8680534d17e4df175d22015c69a6d02ccdcb7c65a457d13ac98c4226d7602995 |
| Native seller claim | https://explorer-studio-dev.genlayer.com/tx/0x89ddff840170de7316739a4f492a7b7115ff5728efde51524d01526053ed4998 |
| Full authorization, ruling and payout proof | https://github.com/zakazaka95/Counterclaim/blob/main/proof/reviewer-verification-v2.json |
| Updated reviewer response | [REVIEWER-RESPONSE-2026-11-24.md](REVIEWER-RESPONSE-2026-11-24.md) |

The earlier v1 contract, ruling, Yellow session and film are preserved below for
audit history. They must not be attached as evidence that v2 fixed the concerns.

<details>
<summary>Historical version 1 submission — saved November 10, 2026</summary>

The following is the original saved copy and then-observed Pending review status.
It describes the cooperative nonmonetary version, not the November 24 correction.

## Version 1 ordinary Projects submission

Submitted November 10, 2026. **Portal status verified: Pending review.**
This is the regular **Builder → Projects** route. The user supplied Joaquin
Bressan's reply recommending a project submission while Builders Working Group
has no open spots. That routing advice is not project acceptance or endorsement.

## Submission metadata

| Field | Observed submission value |
| --- | --- |
| Project name | Counterclaim |
| Category | Builder → Projects |
| Tag | Dispute Resolution |
| Focus | Evidence Assessment |
| Contribution date | November 10, 2026 |
| Submitted / last updated | November 10, 2026 |
| Website / project entry point | https://github.com/zakazaka95/Counterclaim |
| Repository | https://github.com/zakazaka95/Counterclaim |
| Dedicated contract link | https://explorer-studio-dev.genlayer.com/address/0x34b0a821B1AF34A9ac6c71E6e98d1A1f1a0A5303 |
| Formal Portal evidence | Five items listed below; the contract link is a separate field |
| Delivery model | Locally runnable app; the public repository is the entry point, not a hosted frontend |
| Demo video field | Blank; the public GitHub MP4 is attached as supporting evidence |
| Public film | https://github.com/zakazaka95/Counterclaim/blob/main/demo/counterclaim.mp4 |
| Portal submission ID | `c5a6123f-1355-47ce-8547-a9cdc4b3ce83` |
| Portal review status | Pending review; five evidence items verified |
| Portal record | https://portal.genlayer.foundation/my-submissions?q=Counterclaim |
| CAPTCHA / submission | Completed after the user's fresh action-time confirmation; submitted once |

The existing 42-second film is public in the repository. A GitHub MP4 URL must not
be entered into a field that accepts only YouTube or X. No YouTube upload or X
publication is represented here.

## One-liner

When AI agents disagree about a delivery, GenLayer reviews the evidence and both agents co-sign the outcome in Yellow.

Character count: **118 / 180**.

## Description

Counterclaim is a locally runnable app for disputed agent-to-agent deliveries. Two synthetic agents freeze a three-milestone agreement and its evidence in a real Yellow sandbox session. Independent GenLayer validators judge each complete artifact against its agreed criteria; contract code derives the weighted outcome. In the recorded demo, a landing page and guide passed while a TODO note offered as automated tests failed: 75 seller / 25 buyer demo credits. The relay verifies the exact finalized ruling and persisted receipt before both agents co-sign the matching Yellow update and close the room. This connects semantic judgment to an auditable state transition. The credits are nonmonetary; no tokens move. Public source includes UI/CLI reproduction steps, 53 automated tests and signed session proofs. Joaquin Bressan advised using Projects while Builders Working Group has no open spots.

Character count: **897 / 1000**.

## How-to

### 1. Inspect the recorded case

Open the project repository and its README. Watch the 42-second film at `demo/counterclaim.mp4`, then open `LIVE-RESULTS.md` and `proof/final-verification.json`. These show the exact recorded agreement, ruling, signed Yellow versions and closed session before installing anything.

### 2. Install and start a fresh local instance

Use Node.js 24 and Python 3.12+. Run `git clone https://github.com/zakazaka95/Counterclaim.git`, then `cd Counterclaim`, `npm ci`, `npm --prefix server ci`, `npm --prefix app ci` and `npm run setup:genlayer`. The setup creates an isolated test account and a matching GenLayer court; do not provide a personal wallet key.

From the repository root, run `npm start` and keep it running. In a second terminal, from the same repository root, run `npm --prefix app run dev`. Open `http://127.0.0.1:5178`.

### 3. Freeze the agreement and evidence

Select **Open demo room**. Inspect all three milestone criteria and their complete supplied artifacts. Both synthetic agents co-sign a real zero-token Yellow sandbox session. The first two artifacts contain the work; the third is a promise to add tests later.

### 4. Request the ruling, then close the room

Select **Request a ruling** and wait for actual GenLayer execution and finalization. Inspect the persisted milestone decisions, derived proposal, receipt and Explorer link. If a resolved ruling permits it, select **Co-sign & close room**, then **View the complete case timeline** to inspect both signatures and the closed Yellow session. An inconclusive ruling cannot enable co-signing.

## Expected verification outcome

The recorded case shows SATISFIED, SATISFIED and NOT_SATISFIED, producing 75 seller / 25 buyer nonmonetary demo credits. Its GenLayer ruling is finalized with successful execution. The matching Yellow session is closed at version 4 with both signatures and zero token allocations. A fresh local run creates its own court, case and session; inspect the persisted receipt, Explorer link and closed-room timeline. An inconclusive ruling cannot enable co-signing.

Character count: **459 / 500**.

## Five formal Portal evidence items

- [Public repository and reproducible instructions](https://github.com/zakazaka95/Counterclaim)
- [Immutable court source](https://github.com/zakazaka95/Counterclaim/blob/8aba84e43359a791ded97a2d58fe6c4cba409994/contracts/CounterclaimCourt.py)
- [Finalized successful adjudication](https://explorer-studio-dev.genlayer.com/tx/0x8824d0cec2e245b7064813fd7eefd685c1146a64a66db09e9f1fbb9c24c82dd6)
- [42-second product film](https://github.com/zakazaka95/Counterclaim/blob/main/demo/counterclaim.mp4)
- [Recorded network results](https://github.com/zakazaka95/Counterclaim/blob/main/LIVE-RESULTS.md)

The matching deployed GenLayer contract is entered in the form's dedicated
contract-link field rather than counted as a sixth evidence item:
https://explorer-studio-dev.genlayer.com/address/0x34b0a821B1AF34A9ac6c71E6e98d1A1f1a0A5303.

Additional repository verification references, not separate Portal evidence cards:

- [Compact version 1 verification record](https://github.com/zakazaka95/Counterclaim/blob/8aba84e43359a791ded97a2d58fe6c4cba409994/proof/final-verification.json)
- [Passing published CI for the recorded release](https://github.com/zakazaka95/Counterclaim/actions/runs/42715503620)

## Scope of the submitted demonstration

The app uses Internet Court's agreement/rubric/evidence pattern, its own deployed
GenLayer court and genuine Yellow sandbox sessions. It is an independent demo,
not an official Internet Court API integration or partner product. Yellow token
allocations are empty, the credits are nonmonetary metadata, and both participants
must still sign. The cooperative relay and RPC are explicit trust boundaries.
The recorded result is one synthetic case, not a semantic-accuracy benchmark.

The saved Portal record was visibly verified with the description, Joaquin routing
note, five evidence links and dedicated contract link. Pending review records
successful submission; no steward acceptance or awarded points are claimed.

</details>
