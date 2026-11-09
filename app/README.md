# Counterclaim interface

A responsive interface for the reproducible Yellow × Internet Court × GenLayer
demonstration. The default path reads actual coordinator state. It does not
manufacture a room, ruling, signature or successful close when the service is
unavailable.

## Run

From the parent project, start the configured coordinator on port 8787. In this
folder:

```text
npm ci
npm run dev
```

Open the printed local URL (default `http://127.0.0.1:5178/`). Vite proxies `/api`
to `http://127.0.0.1:8787`. Production assets are created by `npm run build`.
The root coordinator may serve `dist/` for a single-process visitor path.

## Visitor path

1. Read the synthetic case and inspect each full artifact against its criterion.
2. Open the signed Yellow demo room. All token allocations are zero.
3. Request a GenLayer ruling and wait for the actual persisted receipt.
4. Inspect the weighted proposed split in nonmonetary demo credits.
5. Both isolated test agents must co-sign the verdict-bound Yellow update and
   close. The court cannot override either required participant signature.
6. Follow the actual room record, GenLayer transaction and receipt fingerprint.

The three milestone weights are 40, 35 and 25. The interface does not pre-approve
the first two milestones, pre-commit a 75/25 outcome or label a missing receipt as
success. Only the coordinator's actual agreed decision enables a proposal.

## API contract

- `GET /api/status`: `{ yellow, genlayer, mode?, repositoryUrl? }`, with each
  service exposing `ready`, optional `network`, `reason` and deployment metadata.
- `GET /api/demo`: current demo state, directly or under `{ demo }`.
- `POST /api/demo/session`: create and freeze the signed sandbox session.
- `POST /api/demo/adjudicate`: submit the actual case and request consensus.
- `POST /api/demo/settle`: require both signatures on the bound proposal and close.
- `POST /api/demo/reset`: start another synthetic case without claiming that an
  earlier immutable network record disappeared.

Phase values are `idle`, `session_open`, `judging`, `verdict_ready`, `settled`.
Network failures preserve the previous visible state and show an actionable error.
Long consensus paths are polled; UI timeouts never invent a ruling. The complete
state is only advanced by successful API results or refreshed persisted state.

## Local verification

```text
npm test
npm run build
```

Six adapter tests cover offline responses, split conservation, state-change
boundaries, inconclusive rulings, numeric zero case IDs and safe external URLs. A desktop and 390-pixel responsive review
verified logos, controls, disclosure and the native evidence dialog. These UI
checks are separate from the root integration's live network evidence.

## Official assets

The exact official marks were sourced by the media project; see
`../media/ASSET-PROVENANCE.json`. Internet Court, GenLayer and Yellow marks remain
their respective owners' marks and are used to identify this integration.
Instrument Serif and DM Sans are distributed with their OFL notices in
`public/brand/`. The Counterclaim wordmark is only this demo's own label.

## Capture selectors

`data-testid` values `case-workspace`, `agreement-panel`, `evidence-panel`,
`outcome-panel`, `proof-panel` and `primary-action` are stable capture hooks for
the film. Capture the actual service state rather than injecting fictional
success fixtures into the product. Keep receipt/recording provenance with footage.
