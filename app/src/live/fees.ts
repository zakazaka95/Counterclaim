import {MESSAGE_ALLOCATION_ROOT_PARENT_INDEX, deriveExternalMessageCallKey, encodeExternalMessageFeeParams} from 'genlayer-js';
import {parseEther} from 'viem';

export function claimFeeSeed(config: any, recipient: `0x${string}`) {
  function integer(value: any, name: string, zero = false) {
    if ((typeof value !== 'string' && typeof value !== 'bigint') || !/^\d+$/.test(String(value))) throw new Error('Missing live fee policy: ' + name);
    const n = BigInt(value);
    if ((!zero && n === 0n) || n >= (1n << 256n)) throw new Error('Invalid live fee policy: ' + name);
    return n;
  }
  if (config?.enabled !== true || config?.capabilities?.messageFees?.externalFinalization?.genvmExecution !== true) throw new Error('External settlement is unavailable on this test network.');
  const minimum = integer(config.policy?.minExternalGasLimit, 'minExternalGasLimit', true);
  const standard = integer(config.policy?.defaultExternalGasLimit, 'defaultExternalGasLimit');
  const quote = integer(config.policy?.receiptGasPrice, 'receiptGasPrice');
  const maxGasPrice = integer(config.defaultFees?.distribution?.receiptFeeMaxGasPrice, 'receiptFeeMaxGasPrice');
  if (maxGasPrice < quote) throw new Error('The external transfer quote exceeds the current cap.');
  const gasLimit = minimum > standard ? minimum : standard, budget = gasLimit * maxGasPrice;
  if (budget > parseEther('0.01')) throw new Error('The message quote exceeds the 0.01 test-GEN demo limit.');
  return {budget, allocation: {messageType: 0, onAcceptance: false, parentIndex: MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
    recipient, callKey: deriveExternalMessageCallKey('0x'), budget, feeParams: encodeExternalMessageFeeParams({gasLimit, maxGasPrice})}};
}

export function assertClaimFeeEstimate(fees: any, seed: ReturnType<typeof claimFeeSeed>) {
  const row = fees.messageAllocations?.[0];
  if (fees.messageAllocations?.length !== 1 || row.messageType !== 0 || row.onAcceptance !== false ||
      row.recipient?.toLowerCase() !== seed.allocation.recipient.toLowerCase() || row.callKey !== seed.allocation.callKey ||
      row.feeParams !== seed.allocation.feeParams || BigInt(row.budget) < seed.budget || BigInt(row.budget) % seed.budget !== 0n ||
      BigInt(fees.distribution.totalMessageFees) < BigInt(row.budget) || BigInt(fees.distribution.totalMessageFees) > parseEther('0.01')) {
    throw new Error('The quoted message does not preserve the exact recipient and funded transfer.');
  }
}
