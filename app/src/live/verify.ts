import {abi, isSuccessful} from 'genlayer-js';
import {sha256, stringToHex} from 'viem';

export function canonicalJson(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
}
export const hashJson = (value: any) => sha256(stringToHex(canonicalJson(value))).slice(2);
export const hashText = (value: string) => sha256(stringToHex(value)).slice(2);
export const sameAddress = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
export const jsonSafe = (value: any): any => {
  if (typeof value === 'bigint') return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, row]) => [key, jsonSafe(row)]));
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, row]) => [key, jsonSafe(row)]));
  return value;
};
function decodeRaw(value: unknown) {
  if (!Array.isArray(value) || value.some(row => !Number.isInteger(row) || row < 0 || row > 255)) throw new Error('Exact raw GenLayer calldata is unavailable.');
  return jsonSafe(abi.calldata.decode(Uint8Array.from(value))) as any;
}

export function assertFinalTransaction(transaction: any, hash: string) {
  if (!isSuccessful(transaction) || transaction.hash?.toLowerCase() !== hash.toLowerCase() || transaction.statusName !== 'FINALIZED') {
    throw new Error('The exact transaction has not finalized with successful execution.');
  }
}

export function assertStoredRuling(stored: any, chainId: number, court: string) {
  const s = stored?.snapshot, r = stored?.receipt;
  if (!s || !r || r.schema !== 'counterclaim-ruling-v2' || s.schema !== r.schema ||
      stored.receipt_hash !== hashJson(r) || stored.case_hash !== hashJson(s) || r.case_hash !== stored.case_hash ||
      r.case_id !== s.case_id || r.session_id !== s.session_id || r.chain_id !== chainId || s.chain_id !== chainId ||
      !sameAddress(r.contract_address, court) || !sameAddress(s.contract_address, court) ||
      r.agreement_hash !== hashJson(s.agreement) || r.agreement_hash !== s.agreement_hash ||
      r.evidence_hash !== hashJson(s.evidence) || r.evidence_hash !== s.evidence_hash) throw new Error('The stored ruling does not bind the complete case and delivered evidence.');
  const a = s.authorization, p = s.agreement.parties;
  if (!p || !a || !sameAddress(a.buyer_opened_by, p.buyer) || !sameAddress(a.seller_accepted_by, p.seller) ||
      !sameAddress(a.seller_delivered_by, p.seller) || canonicalJson(a) !== canonicalJson(r.authorization) ||
      ![a.buyer_opened_at, a.seller_accepted_at, a.seller_delivered_at].every(Number.isSafeInteger) ||
      a.seller_accepted_at < a.buyer_opened_at || a.seller_delivered_at < a.seller_accepted_at ||
      a.seller_delivered_at > s.delivery_deadline || s.evidence_scope !== 'CONTRACT_STORED_SELLER_DELIVERY_ONLY') throw new Error('Participant consent and seller delivery are not authenticated.');
  const terms = {schema: s.schema, case_id: s.case_id, chain_id: s.chain_id, contract_address: s.contract_address,
    session_id: s.session_id, agreement_hash: s.agreement_hash, escrow_wei: s.escrow?.total_wei,
    delivery_deadline: s.delivery_deadline, refund_after: s.refund_after, evidence_scope: s.evidence_scope, refund_policy: s.refund_policy};
  if (hashJson(terms) !== s.terms_hash || r.terms_hash !== s.terms_hash) throw new Error('The seller did not accept these complete terms.');
  if (stored.status !== 'RESOLVED' || r.decision !== 'RESOLVED' || r.settlement_allowed !== true ||
      r.inspection?.prompt_truncated !== false || r.inspection?.semantic_complete !== true) throw new Error('The review is inconclusive; no award may be claimed.');
  const allocation = r.allocation, settlement = r.settlement;
  if (!allocation || !settlement || allocation.unit !== 'demo credits' || settlement.unit !== 'GEN_WEI' ||
      !Number.isSafeInteger(allocation.total) || allocation.total <= 0 || allocation.total !== s.agreement.pool ||
      !Number.isSafeInteger(allocation.seller) || allocation.seller < 0 || allocation.seller > allocation.total ||
      allocation.buyer !== allocation.total - allocation.seller ||
      !['total_wei', 'seller_wei', 'buyer_wei'].every(key => typeof settlement[key] === 'string' && /^\d+$/.test(settlement[key])) ||
      settlement.total_wei !== s.escrow.total_wei) throw new Error('The complete monetary award is invalid.');
  const total = BigInt(settlement.total_wei), seller = total * BigInt(allocation.seller) / BigInt(allocation.total);
  if (total <= 0n || BigInt(settlement.seller_wei) !== seller || BigInt(settlement.buyer_wei) !== total - seller) throw new Error('Escrow allocation does not conserve the deposit.');
  return r;
}

export function assertRulingTransaction(transaction: any, stored: any, hash: string, court: string) {
  assertFinalTransaction(transaction, hash);
  const receipt = stored.receipt;
  if (![receipt.authorization.buyer_opened_by, receipt.authorization.seller_accepted_by]
    .some(address => sameAddress(transaction.from_address || transaction.sender, address)) ||
      !sameAddress(transaction.to_address || transaction.recipient, court) || transaction.leader_only !== false ||
      transaction.execution_mode !== 'NORMAL' || Number(transaction.num_of_initial_validators) < 3) throw new Error('Normal independent validator consensus is required.');
  const call = decodeRaw(transaction.data?.calldata?.raw);
  if (call[''] !== 'adjudicate' || canonicalJson(call.args) !== canonicalJson([receipt.case_id]) ||
      Object.keys(call).some(key => !['', 'args'].includes(key))) throw new Error('This is not the exact adjudication transaction.');
  const leaders = transaction.consensus_data?.leader_receipt || transaction.data?.consensus_data?.leader_receipt;
  const leader = Array.isArray(leaders) ? leaders.at(-1) : leaders;
  if (leader?.result?.status !== 'return' || canonicalJson(decodeRaw(leader.result.payload?.raw)) !== canonicalJson(receipt)) {
    throw new Error('Finalized transaction output differs from the stored complete ruling.');
  }
}

export function assertClaimTransfer(messages: any, recipient: string, amountWei: string) {
  const message = messages?.[0];
  if (!Array.isArray(messages) || messages.length !== 1 || String(message.messageType) !== '0' ||
      !sameAddress(message.recipient, recipient) || message.onAcceptance !== false || !['', '0x'].includes(message.data) ||
      (typeof message.value === 'number' && !Number.isSafeInteger(message.value)) ||
      !['string', 'number', 'bigint'].includes(typeof message.value) || BigInt(message.value) !== BigInt(amountWei) || BigInt(amountWei) <= 0n) {
    throw new Error('The finalized transfer message does not match this participant and award.');
  }
}

/** Current Studio records the delivered effect for the exact emitted occurrence. */
export function assertClaimDelivery(transaction: any, recipient: string, amountWei: string) {
  assertClaimTransfer(transaction.messages, recipient, amountWei);
  const accounting = transaction.data?.fee_accounting;
  const active = accounting?.active_message_generation;
  if (!active || active.occurrences?.length !== 1) throw new Error('The exact finalized native delivery effect is not visible yet. Retry this same claim.');
  assertClaimTransfer(active.messages, recipient, amountWei);
  const occurrence = active.occurrences[0];
  if (typeof occurrence !== 'string' || accounting.message_effect_delivered?.[occurrence] !== true) {
    throw new Error('The finalized transfer has not been marked delivered. Retry this same transaction.');
  }
  return {occurrence, delivered: true};
}
