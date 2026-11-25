# Counterclaim browser walkthrough

**Live URL:** https://counterclaim.goodlygnat16.chatgpt.site

Verified through the public browser app on **25 November 2026**: fresh case **1**
created a genuine Yellow session, finalized the 75/25 ruling and delivered the
seller's **0.00075 test GEN** without another buyer signature or Yellow update.
The buyer's **0.00025 test GEN** remains reserved. The complete, key-free
[browser proof](../proof/browser-live-2026-11-25.json) contains the actual calls,
finalized receipt and delivered transfer effect. The
[ruling](https://explorer-studio-dev.genlayer.com/tx/0x1ac74fd7bf68d4379a294d5a9b5adc6c2105242884572be1d848f3698a810e4a)
and [seller claim](https://explorer-studio-dev.genlayer.com/tx/0x6061a2c79d3a27a12d7b53d46ee74439fe82450b084876332bd77efb6254ef53)
are independently inspectable. All 97 local checks and the
[published CI run](https://github.com/zakazaka95/Counterclaim/actions/runs/45592481528)
passed for the hosted implementation.

Open the site in a modern browser. There is no installation, wallet connection
or personal funding step. This is a Studio development-network demonstration
with disposable accounts and faucet GEN.

## 1. Inspect the recorded result

The initial **Recorded result · 24 Nov 2026** view is read-only. Open the three
evidence cards to read the complete delivered text. The recorded court accepted
the first two milestones and rejected the tests promise, producing:

| Native escrow | Seller | Buyer |
| --- | --- | --- |
| 0.001 test GEN | 0.00075 paid | 0.00025 reserved, unclaimed |

The separate 40/35/25 numbers are milestone weights, not additional token
balances. Explorer links and **Download proof** expose the actual recorded
transactions and receipt. The site never signs with these historical accounts.

## 2. Prepare your own live case

Select **Start live demo**. The browser creates separate buyer and seller accounts
and obtains faucet tokens for their test-network fees. It checks chain 61997,
the court version and the complete deployed source before a write.

The page attempts a real two-signature, zero-token Yellow session and reads back
its frozen evidence commitments. If Yellow is unavailable, the page says
**GenLayer-only reference (no Yellow session)**. That fallback reference is not
presented as a Yellow session or signature. Native GenLayer escrow remains usable.

Keep this tab open. Disposable keys and exact signed-transaction journals are in
this tab's `sessionStorage`, not on the hosting server. Reloading can resume the
same saved operation; closing the tab or clearing its data can lose access.
Do not put personal wallet keys or confidential material into the demo.

## 3. Authenticate and judge the delivery

Select **Fund & request a ruling**. This performs separate real court calls:

1. The buyer opens the agreed case and deposits exactly **0.001 test GEN**.
2. The seller accepts its exact domain-bound terms hash.
3. Only that seller account submits the complete artifact bytes.
4. GenLayer's multi-validator consensus judges the stored delivery against the
   accepted milestone criteria.

The timeline exposes progress and submitted transaction links. Consensus and
the shared test-network queue can take several minutes. A failed request remains
an error; retrying a saved operation resumes its known hash rather than inventing
a successful result or signing a replacement transaction.

The native award is taken from the finalized receipt. A fresh review can differ
from the recorded 75/25 result. An inconclusive result does not enable guessed
payouts; the buyer's preaccepted timeout-refund path remains in the court.

## 4. Claim independently

For a resolved result with a positive seller entitlement, select **Claim seller
award**. Only the seller signs. The browser verifies the exact finalized native
transfer and delivered effect before marking a positive award **Paid**. It does
not request a new buyer signature or a Yellow close.

If a positive buyer entitlement remains, the page says **Seller paid; buyer
reserved**. **Claim buyer award (optional)** is a second, independent withdrawal.
The current browser case is retained until its positive entitlements are claimed;
starting another case cannot silently discard its signing accounts.

## 5. Inspect or download proof

Use **View the complete case timeline**, the court and transaction Explorer links,
and **Download proof**. Fresh exports are assembled in this browser from public
identities, full terms and evidence, transaction journals, the actual receipt and
claim verification. They exclude disposable private keys. Downloading does not
upload the case to a separate evidence server.

The public `/api/proof` endpoint always serves the fixed November 24 recording.
It is distinct from the current browser's live proof export.

## Scope and trust boundaries

- Fixed court:
  [`0xC68b67797C630cBBf2bb80D290d68A787c855E14`](https://explorer-studio-dev.genlayer.com/address/0xC68b67797C630cBBf2bb80D290d68A787c855E14),
  Studio chain **61997**. The complete source is also served at `/api/contract`.
- The agreed work is the seller's exact onchain UTF-8 text delivery. The court
  authenticates the delivering wallet and the accepted bytes; it does not certify
  external authorship, remote hosting or execution of supplied code. Code receives
  static source assessment.
- The Worker forwards only bounded, court-specific Studio requests and globally
  spaces them by at least 3.5 seconds. It signs no transactions. Studio RPC,
  network availability, browser integrity and optional Yellow liveness remain
  explicit dependencies. See [gateway policy](../hosting/README.md).
- The UI verifies real transactions; it is not a general jury-accuracy benchmark
  or a production payment service. All demonstrated value is faucet test GEN.

For local development and CI commands, see [README](../README.md).
