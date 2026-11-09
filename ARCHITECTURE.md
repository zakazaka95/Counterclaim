# Counterclaim: Internet Court × Yellow × GenLayer

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
