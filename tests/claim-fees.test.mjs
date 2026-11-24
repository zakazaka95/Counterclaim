import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeAbiParameters} from 'viem';
import {MESSAGE_ALLOCATION_ROOT_PARENT_INDEX} from 'genlayer-js';
import {claimFeeSeed} from '../scripts/genlayer.mjs';

const recipient = '0x' + '1'.repeat(40);
const fixture = {
  enabled: true,
  capabilities: {messageFees: {externalFinalization: {genvmExecution: true}}},
  policy: {minExternalGasLimit: '0', defaultExternalGasLimit: '500000', receiptGasPrice: '250000000'},
  defaultFees: {distribution: {receiptFeeMaxGasPrice: '300000000'}},
};

test('zero external minimum is valid while the live default funds the transfer', () => {
  const seed = claimFeeSeed(fixture, recipient);
  assert.equal(seed.gasLimit, 500000n);
  assert.equal(seed.maxGasPrice, 300000000n);
  assert.equal(seed.budget, 150000000000000n);
  assert.equal(seed.allocation.budget, seed.budget);
  const higherMinimum = structuredClone(fixture);
  higherMinimum.policy.minExternalGasLimit = '600000';
  assert.equal(claimFeeSeed(higherMinimum, recipient).gasLimit, 600000n);
});

test('unavailable, zero-price, underpriced, missing and excessive policies fail closed', () => {
  const cases = [
    {...fixture, enabled: false},
    {...fixture, capabilities: {}},
    {...fixture, policy: {...fixture.policy, defaultExternalGasLimit: '0'}},
    {...fixture, policy: {...fixture.policy, receiptGasPrice: '0'}},
    {...fixture, policy: {...fixture.policy, receiptGasPrice: '400000000'}},
    {...fixture, policy: {...fixture.policy, minExternalGasLimit: undefined}},
    {...fixture, defaultFees: {distribution: {receiptFeeMaxGasPrice: '0'}}},
    {...fixture, defaultFees: {distribution: {receiptFeeMaxGasPrice: '999999999999999999999999'}}},
  ];
  for (const config of cases) assert.throws(() => claimFeeSeed(config, recipient), /no claim broadcast|not advertised|demo cap/);
});

test('the allocation targets only the known recipient, empty calldata and finalization', () => {
  const {allocation} = claimFeeSeed(fixture, recipient);
  assert.equal(allocation.messageType, 0);
  assert.equal(allocation.recipient, recipient);
  assert.equal(allocation.callKey, '0x' + '0'.repeat(64));
  assert.equal(allocation.parentIndex, MESSAGE_ALLOCATION_ROOT_PARENT_INDEX);
  assert.equal(allocation.onAcceptance, false);
  const [params] = decodeAbiParameters([{type: 'tuple', components: [
    {name: 'gasLimit', type: 'uint256'}, {name: 'maxGasPrice', type: 'uint256'},
  ]}], allocation.feeParams);
  assert.deepEqual(params, {gasLimit: 500000n, maxGasPrice: 300000000n});
  assert.throws(() => claimFeeSeed(fixture, 'not-an-address'), /recipient/);
});
