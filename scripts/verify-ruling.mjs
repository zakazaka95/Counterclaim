import {abi, isSuccessful} from 'genlayer-js';
import {canonicalJson, hashJson, jsonValue} from './canonical.mjs';

const sameAddress = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const decodeRaw = value => {
  if (!Array.isArray(value) || value.some(x => !Number.isInteger(x) || x < 0 || x > 255)) throw new Error('Exact raw GenLayer calldata is unavailable');
  return jsonValue(abi.calldata.decode(Uint8Array.from(value)));
};

export function assertRulingTransaction({transaction, receipt, txHash, contractAddress, owner}) {
  if (!isSuccessful(transaction) || transaction.hash !== txHash) throw new Error('The exact adjudication transaction has not executed successfully');
  if (transaction.statusName !== 'FINALIZED' || transaction.lifecycle?.outcome && transaction.lifecycle.outcome !== 'accepted') {
    throw new Error('The exact adjudication must be finalized before a Yellow proposal is signed');
  }
  if (!sameAddress(transaction.from_address || transaction.sender, owner) ||
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
  if (stored.status !== 'RESOLVED' || receipt.decision !== 'RESOLVED' || receipt.settlement_allowed !== true ||
      receipt.inspection?.prompt_truncated !== false || receipt.inspection?.semantic_complete !== true) {
    throw new Error('The persisted ruling does not permit a demo-credit proposal');
  }
  return true;
}
