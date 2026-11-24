import {abi, isSuccessful} from 'genlayer-js';
import {canonicalJson, hashJson, jsonValue} from './canonical.mjs';

const sameAddress = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const decodeRaw = value => {
  if (!Array.isArray(value) || value.some(x => !Number.isInteger(x) || x < 0 || x > 255)) throw new Error('Exact raw GenLayer calldata is unavailable');
  return jsonValue(abi.calldata.decode(Uint8Array.from(value)));
};

export function assertRulingTransaction({transaction, receipt, txHash, contractAddress}) {
  if (!isSuccessful(transaction) || transaction.hash !== txHash) throw new Error('The exact adjudication transaction has not executed successfully');
  if (transaction.statusName !== 'FINALIZED' || transaction.lifecycle?.outcome && transaction.lifecycle.outcome !== 'accepted') {
    throw new Error('The exact adjudication must be finalized before a Yellow proposal is signed');
  }
  const caller = transaction.from_address || transaction.sender;
  if (![receipt.authorization?.buyer_opened_by, receipt.authorization?.seller_accepted_by].some(address => sameAddress(caller, address)) ||
      !sameAddress(transaction.to_address || transaction.recipient, contractAddress)) throw new Error('Adjudication caller or target does not match the configured court');
  if (transaction.leader_only !== false || transaction.execution_mode !== 'NORMAL' ||
      Number(transaction.num_of_initial_validators) < 3) throw new Error('A normal multi-validator consensus execution is required');
  const call = decodeRaw(transaction.data?.calldata?.raw);
  if (call[''] !== 'adjudicate' || canonicalJson(call.args) !== canonicalJson([receipt.case_id]) ||
      Object.keys(call).some(key => !['', 'args'].includes(key))) throw new Error('Transaction is not the exact adjudicate(case_id) call');
  const leaders = transaction.consensus_data?.leader_receipt || transaction.data?.consensus_data?.leader_receipt;
  const leader = Array.isArray(leaders) ? leaders.at(-1) : leaders;
  if (leader?.result?.status !== 'return') throw new Error('Successful adjudication return payload is absent');
  const returned = decodeRaw(leader.result.payload?.raw);
  if (canonicalJson(returned) !== canonicalJson(receipt)) throw new Error('Transaction return does not match the complete persisted ruling');
  return true;
}

export function assertStoredRuling(stored, {receipt, chainId, contractAddress}) {
  const snapshot = stored?.snapshot;
  if (!snapshot || !receipt || canonicalJson(stored.receipt) !== canonicalJson(receipt) ||
      stored.receipt_hash !== hashJson(receipt) || stored.case_hash !== hashJson(snapshot) ||
      receipt.case_hash !== stored.case_hash || receipt.case_id !== snapshot.case_id ||
      receipt.session_id !== snapshot.session_id || receipt.chain_id !== chainId || snapshot.chain_id !== chainId ||
      !sameAddress(receipt.contract_address, contractAddress) || !sameAddress(snapshot.contract_address, contractAddress)) {
    throw new Error('The full persisted ruling and immutable case context do not match');
  }
  if (receipt.agreement_hash !== hashJson(snapshot.agreement) || receipt.agreement_hash !== snapshot.agreement_hash ||
      receipt.evidence_hash !== hashJson(snapshot.evidence) || receipt.evidence_hash !== snapshot.evidence_hash) {
    throw new Error('Persisted source hashes do not bind the complete agreement and evidence');
  }
  if (receipt.schema !== 'counterclaim-ruling-v2' || snapshot.schema !== receipt.schema) throw new Error('An authenticated v2 ruling is required');
  const parties = snapshot.agreement.parties, auth = snapshot.authorization;
  if (!parties || !auth || !sameAddress(auth.buyer_opened_by, parties.buyer) ||
      !sameAddress(auth.seller_accepted_by, parties.seller) || !sameAddress(auth.seller_delivered_by, parties.seller) ||
      canonicalJson(auth) !== canonicalJson(receipt.authorization) ||
      ![auth.buyer_opened_at, auth.seller_accepted_at, auth.seller_delivered_at].every(Number.isSafeInteger) ||
      auth.seller_accepted_at < auth.buyer_opened_at || auth.seller_delivered_at < auth.seller_accepted_at ||
      auth.seller_delivered_at > snapshot.delivery_deadline || snapshot.evidence_scope !== 'CONTRACT_STORED_SELLER_DELIVERY_ONLY') {
    throw new Error('Authenticated participant consent and delivery do not bind this ruling');
  }
  const terms = {schema: snapshot.schema, case_id: snapshot.case_id, chain_id: snapshot.chain_id,
    contract_address: snapshot.contract_address, session_id: snapshot.session_id, agreement_hash: snapshot.agreement_hash,
    escrow_wei: snapshot.escrow?.total_wei, delivery_deadline: snapshot.delivery_deadline, refund_after: snapshot.refund_after,
    evidence_scope: snapshot.evidence_scope, refund_policy: snapshot.refund_policy};
  if (hashJson(terms) !== snapshot.terms_hash || receipt.terms_hash !== snapshot.terms_hash) throw new Error('Complete accepted terms hash mismatch');
  if (stored.status !== 'RESOLVED' || receipt.decision !== 'RESOLVED' || receipt.settlement_allowed !== true ||
      receipt.inspection?.prompt_truncated !== false || receipt.inspection?.semantic_complete !== true) {
    throw new Error('The persisted ruling does not permit an escrow award');
  }
  const settlement = receipt.settlement, allocation = receipt.allocation;
  if (!settlement || settlement.unit !== 'GEN_WEI' || !allocation || allocation.unit !== 'demo credits' ||
      !['buyer_wei', 'seller_wei', 'total_wei'].every(key => typeof settlement[key] === 'string' && /^\d+$/.test(settlement[key])) ||
      settlement.total_wei !== snapshot.escrow.total_wei || !Number.isSafeInteger(allocation.total) || allocation.total <= 0 ||
      !Number.isSafeInteger(allocation.seller) || allocation.seller < 0 || allocation.seller > allocation.total ||
      allocation.buyer !== allocation.total - allocation.seller || allocation.total !== snapshot.agreement.pool) throw new Error('Invalid complete escrow allocation');
  const total = BigInt(settlement.total_wei), seller = total * BigInt(allocation.seller) / BigInt(allocation.total);
  if (total <= 0n || BigInt(settlement.seller_wei) !== seller || BigInt(settlement.buyer_wei) !== total - seller) throw new Error('Escrow wei do not conserve the accepted deposit');
  return true;
}
