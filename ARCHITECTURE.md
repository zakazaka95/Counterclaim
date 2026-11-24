# Counterclaim v2: authorized text delivery and native GEN escrow

Version 2 is the November 24 correction for the steward's authorization,
delivery-provenance and non-cooperation concerns. Its v2.0.0 deployment matches the
tracked source. Its live authorization, finalized ruling and unilateral seller
payout are recorded in [LIVE-RESULTS.md](LIVE-RESULTS.md).
The former cooperative-only protocol is preserved below
as a version 1 record.

## Roles and the agreed object

The buyer and named seller approve a bounded agreement for **onchain UTF-8 text
delivery**. The exact submitted bytes are the delivered work; a pasted claim about
an unseen external product is not substituted for that work. Static source-code
review may inspect supplied test source but does not certify execution or passing
tests. The court does not authenticate authorship, GitHub identity or external
hosting.

`gl.message.sender_address` supplies the transaction authority. The buyer funds
and opens its own case; the named seller separately accepts the exact terms hash
and later submits the complete delivery. The coordinator transports these signed
actions and displays state. Its HTTP request bodies are not participant consent.
The disposable demo signers remain controlled by the test harness; they are not
presented as independent production users or a wallet-custody design.

The demonstrated participants and payout recipients are fresh EOAs. The contract's
sender/origin equality check rejects intermediated calls; it is not a general
classification of account bytecode. Arbitrary contract-receiver payments and
their failure/recovery behavior are outside the validated recipient scope.

## Native case path

```text
buyer: open + GEN deposit
          |
seller: accept exact terms hash
          |
seller: deliver exact immutable artifact bytes
          |
buyer or seller: adjudicate complete stored inputs
          |
contract: fixed GEN entitlements
          |
buyer: claim own amount     seller: claim own amount
          |                         |
         finalized EOA value transfers

unresolved after the fixed refund deadline:
buyer: refund_timeout -> buyer: claim refund

optional Yellow mirror: two signatures, no authority over native claims
```

| Method | Authority and consequence |
| --- | --- |
| `open_case(session_id, agreement_json, delivery_deadline, refund_after)` payable | Buyer fixes the agreement, named seller, amount and deadlines and deposits native GEN. |
| `accept_case(case_id, expected_terms_hash)` | Only the named seller may accept the exact stored terms hash. |
| `deliver(case_id, evidence_json)` | Only the accepted seller may freeze the full agreed text bundle before the deadline. |
| `adjudicate(case_id)` | Either participant may request semantic review of persisted inputs. No replacement evidence is accepted in this call. |
| `claim(case_id)` | A participant claims only its own fixed native entitlement; the other party does not approve it. |
| `refund_timeout(case_id)` | The buyer invokes the agreed unresolved-case refund path after its deadline, then claims it. |
| `get_case(case_id)` | Read authoritative agreement, authorization, delivery, receipt, settlement and per-role claim state. |
| `get_case_for_session(session_id, buyer_address)` | Locate the buyer-bound case for the declared session. |

The complete receipt must bind the chain, court, case, participants, accepted
terms, exact delivery, deposit, deadlines, semantic decisions and deterministic
settlement. Validators independently reconstruct the full consequential payload.
An agreement hash alone does not authorize substituted participants, delivery or
payouts. Wei amounts are represented exactly rather than rounded through
JavaScript floating-point numbers.

## Settlement boundary

The GEN deposit is native contract-held value, not an unbacked points balance.
Deterministic code assigns entitlements; the model does not invent payment amounts.
Per-role claim state prevents an entitlement being scheduled twice. Transfer
scheduling must be distinguished from finalized payout evidence. Native EOA
transfers execute at finalization; an Accepted receipt alone is not proof that a
recipient received value. Network fees are separate from the deposited price.

Inconclusive or technical failure is not silently relabeled success. The fixed
refund deadline provides the consented unresolved-case exit. A participant must
submit the timeout transaction; neither a local timer nor a stopped coordinator
creates an automatic transaction. Chain/RPC liveness and the agreed timeout policy
remain explicit assumptions.

## Optional Yellow record

Yellow can mirror the agreement, delivery and final ruling through its existing
two-signature metadata updates. The injected v2 verifier must check the actual
persisted authorization, terms, delivery and escrow bindings before that projection
is signed. The wire-format version is a metadata format, not the court's receipt
version. Empty Yellow token allocations remain empty.

A party refusing this optional signature may leave the Yellow record open. It
cannot veto the separate GEN claim. No GenLayer ruling bypasses Yellow's quorum,
settles Yellow-held tokens or constitutes a trustless cross-chain finality proof.
The relay and RPC remain trust boundaries for displaying and mirroring state;
they are not the authority that chooses the native entitlement.

## Observed reviewer evidence

The correction runner `node scripts/reviewer-demo.mjs` recorded case 0 with a
0.001 faucet-GEN deposit, distinct buyer/seller authorization, exact seller text
delivery and a finalized 75/25 ruling. The seller's 0.00075-GEN claim finalized
without a later buyer transaction or any Yellow update. Its external message,
exact court debit and positive net recipient credit were observed. The remaining
0.00025 GEN is reserved for the buyer, whose claim was deliberately not invoked.
Yellow stayed open at version 2 with both signing processes stopped before review.

The 77 local tests, app build and media typecheck passed. Local authorization,
tamper, duplicate-claim and timeout checks are distinct from that positive live
run; no live rejected transaction for those guards is claimed. See
[LIVE-RESULTS.md](LIVE-RESULTS.md) and the [review response](docs/REVIEWER-RESPONSE-2026-11-24.md).

<details>
<summary>Historical version 1 architecture — cooperative nonmonetary proposal</summary>

The following describes the November 9 version 1 demonstration. Its local relay
selected the supplied artifacts, and both Yellow participants were still required
to apply the proposal. It is not the v2 native escrow protocol.

## Version 1: Internet Court × Yellow × GenLayer

This reproducible partner demo uses the Internet Court agreement/rubric/evidence
pattern. It adds a genuine GenLayer adjudication path to a genuine Yellow sandbox
session. It is a small working integration, not an official partner product.

1. Two isolated synthetic participants co-sign a real unanimous Yellow app session.
2. The complete agreement and artifact bundle are committed by their full-content
   SHA-256 hashes in signed session metadata. Yellow limits this field to 1 KB;
   the full supplied payloads are retained separately, never truncated.
3. A GenLayer Intelligent Contract persists the same session, agreement and evidence
   bindings. Independent validators review every artifact against the agreed rubric.
4. Deterministic contract code derives an exact weighted demo-credit proposal from
   the independently agreed milestone outcomes. An uncertain result cannot settle.
5. The release path waits for successful GenLayer finalization. The coordinator
   independently reads the persisted contract receipt, checks all
   bindings and its digest, then permits both test agents to co-sign that exact
   proposal into the next Yellow session version and close it.

The verifier also binds the exact finalized `adjudicate(case_id)` transaction,
its caller, target and returned receipt. Another successful transaction cannot be
used as a receipt reference. The RPC and cooperative relay remain trust boundaries;
this is not a cryptographic cross-chain light client.

All Yellow token allocations are empty. The 100 credits are explicitly nonmonetary
metadata. No real funds, token deposit or funded payment is demonstrated. The jury
does not bypass Yellow participant signatures. A participant refusing to sign
leaves the room open; node liveness remains a Yellow trust assumption. This demo
does not claim a unilateral court-controlled escrow or trustless bridge.

GenLayer owns the consequential semantic milestone decisions and immutable scoped
receipt. The coordinator owns transport, UI and the cooperative relay. Yellow owns
the signed session lifecycle and observed versions. Claims are supplied synthetic
artifacts; the jury does not execute code or authenticate external work.

The film must use the observed application states and network proofs. Waiting can
be edited down, but no fabricated verdict, transfer or session closure is allowed.
The public repository excludes generated private keys and local wallet state.

</details>
