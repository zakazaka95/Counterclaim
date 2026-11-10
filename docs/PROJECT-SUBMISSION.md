# Counterclaim — ordinary Projects submission

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

- [Compact public verification record](https://github.com/zakazaka95/Counterclaim/blob/main/proof/final-verification.json)
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
