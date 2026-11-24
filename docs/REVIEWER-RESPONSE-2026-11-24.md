# Counterclaim — response to the November 24 review

The v2 correction has a matching deployment, a finalized ruling and a verified
unilateral native payout. The updated Portal response is prepared, not yet sent.
Original entry: `c5a6123f-1355-47ce-8547-a9cdc4b3ce83`.

The steward note was:

> We cannot accept this submission because the contract adjudicates relay-selected pasted artifacts without authenticating the delivered work or participant authorization, and the result cannot settle the dispute unless both parties still cooperate.

Both concerns were valid for version 1. This correction changes the protocol.

## Participant authorization and delivered work

The buyer [opened and funded the case](https://explorer-studio-dev.genlayer.com/tx/0x6d353ee2fa04f5b01f73b7d4fb2419f05437c81a7f6bee05623c4540d86ca379). The named seller
separately [accepted the exact terms hash](https://explorer-studio-dev.genlayer.com/tx/0x49871244343ea62713cbace4e0c6faba6d66d236029d9273fe8cebc05bd8a708) and
[submitted the full artifact bundle](https://explorer-studio-dev.genlayer.com/tx/0xb135d8971868a02d335491fbff8f6ef73f7ffac030edaa0fbe594c48a798d3f0) through its own
contract call. The relay cannot replace the evidence at adjudication.

Both parties expressly agree that these exact onchain UTF-8 text artifacts ARE
the digital delivery. This authenticates the submitting account and bytes under
accepted terms. It does not prove authorship, GitHub control, external hosting,
physical work or execution of submitted code. Test source is assessed statically.

## Settlement without continued cooperation

The [finalized v2 ruling](https://explorer-studio-dev.genlayer.com/tx/0x8680534d17e4df175d22015c69a6d02ccdcb7c65a457d13ac98c4226d7602995) recorded SATISFIED, SATISFIED and
NOT_SATISFIED, fixing seller/buyer entitlements of 750000000000000 /
250000000000000 wei from the buyer's 0.001 faucet-GEN deposit.

The seller then [claimed independently](https://explorer-studio-dev.genlayer.com/tx/0x89ddff840170de7316739a4f492a7b7115ff5728efde51524d01526053ed4998). That claim finalized with an
external message to the seller for 750000000000000 wei, empty calldata and
`onAcceptance=false`. The court balance fell from 1000000000000000 to
250000000000000 wei. The recipient balance rose from 99999758147749997531
to 100000381771749996708: a positive net credit of 623623999999177 wei after its own
claim fees. This is verified value movement, not just an allocation or emitted flag.

The recorded run made no buyer court transaction after funding. Both Yellow
signing processes stopped before review. Yellow remained unchanged and open at
version 2; no later co-sign or close enabled the claim. The buyer's 0.00025 GEN is
still reserved and independently claimable. No buyer withdrawal is claimed.

## Validation and scope

The matching [v2 court](https://explorer-studio-dev.genlayer.com/address/0xC68b67797C630cBBf2bb80D290d68A787c855E14) is version 2.0.0, schema
`counterclaim-ruling-v2`. Its exact source SHA-256 is
`e034dbbf10ccdaaf80125d3e13630837590df2d97da79c212ccce7ca88f44860`. The [immutable source](https://github.com/zakazaka95/Counterclaim/blob/3602e22e30933c41b116b09f7e535cada06578f6/contracts/CounterclaimCourt.py) matches the complete
deployed text after CRLF/LF and outer-whitespace normalization only.

The current suites passed **77 tests**: 33 Python contract, 20 root JavaScript,
17 Yellow adapter and 7 UI model tests. The app build and media typecheck passed.
Authorization, changed terms/receipts, duplicate claims, timeout refunds and fee
allocation are covered locally; no live rejected transaction or live timeout is
claimed for those guards. Full network proof is
[proof/reviewer-verification-v2.json](../proof/reviewer-verification-v2.json) and
[the result record](../LIVE-RESULTS.md).

Yellow remains an optional cooperative metadata mirror with empty token balances.
The native court does not settle Yellow-held tokens or bypass its quorum. The
demo controls disposable EOA signers; it is not a production custody system or
proof of independent human users. Account-type classification, arbitrary contract
recipients, external authorship and code execution are outside this validated
scope. Chain/RPC liveness and finality remain assumptions. A pre-agreed buyer
refund path exists for unresolved cases and is covered by local tests.

The v1 film and old network proof are preserved as historical evidence. They are
not presented as proof of this correction. No steward acceptance or points are
claimed; the existing Action needed entry still awaits its updated submission.
