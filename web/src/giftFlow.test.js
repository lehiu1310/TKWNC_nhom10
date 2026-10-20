import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GIFT_INTENTS, intentForOccasion, isCompatiblePreferredFlower } from './giftFlow.js';

test('quick gifting intents map to valid supported occasions without duplicates', () => {
  const occasions = GIFT_INTENTS.map((intent) => intent.occasion);
  assert.equal(new Set(occasions).size, occasions.length);
  assert.ok(GIFT_INTENTS.every((intent) => intent.id && intent.title && intent.icon));
  assert.equal(intentForOccasion('cảm ơn')?.id, 'thanks');
  assert.equal(intentForOccasion('Valentine')?.id, 'love');
  assert.equal(intentForOccasion('khai trương'), null);
});

test('a selected flower is retained only for occasions allowed by its gift data', () => {
  const rose = { occasions: ['Valentine', 'kỷ niệm'], avoid_occasions: ['chia buồn'] };
  assert.equal(isCompatiblePreferredFlower(rose, 'Valentine'), true);
  assert.equal(isCompatiblePreferredFlower(rose, 'chia buồn'), false);
  assert.equal(isCompatiblePreferredFlower(rose, 'khai trương'), false);
  assert.equal(isCompatiblePreferredFlower(null, 'Valentine'), false);
});
