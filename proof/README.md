# Current correction evidence

The authoritative November 24 **v2** record is
[reviewer-verification-v2.json](reviewer-verification-v2.json).
It contains the complete authenticated case, finalized ruling, native claim,
balance snapshots and unchanged open Yellow session.

- [deployment.json](deployment.json): matching v2.0.0 source and deployment.
- [case-open-readback.json](case-open-readback.json): separate buyer funding,
  seller acceptance and seller delivery transaction references.
- [adjudication-readback.json](adjudication-readback.json): complete stored
  agreement, authenticated artifact bytes and 75/25 ruling.
- [seller-claim-readback.json](seller-claim-readback.json): finalized external
  transfer of 750,000,000,000,000 wei to the seller, exact court debit and
  recipient balance snapshots including the seller's own network fees.
- [seller-claim-fee-policy.json](seller-claim-fee-policy.json) and
  [seller-claim-fee-estimate.json](seller-claim-fee-estimate.json): the active
  Studio policy and exact funded external-transfer envelope.

The buyer's 250,000,000,000,000 wei award remains reserved and unclaimed.
Yellow remains open at version 2; no outcome update or closing signature was
required for the native claim. These are synthetic accounts and faucet test GEN.

The original cooperative, nonmonetary **v1** proof is preserved in
[demo/historical-v1-proof](../demo/historical-v1-proof/). Older root guard/probe
files and `demo-proof.json` describe that historical run, not the v2 correction.
The original film is also v1. Local rejection and timeout tests are distinct
from the positive live transactions recorded above.
