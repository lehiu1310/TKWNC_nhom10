import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAccountCollection } from './accountData.js';

test('account collection merge keeps remote data, deduplicates plants, and prefers local edits', () => {
  const remote = { plants: [
    { id: 'rose-1', speciesId: 'roses', intervals: { water: 3 } },
    { id: 'tulip-1', speciesId: 'tulip', intervals: { water: 5 } },
  ] };
  const local = { plants: [
    { id: 'rose-1', speciesId: 'roses', intervals: { water: 7 } },
    { speciesId: 'invalid-without-intervals' },
  ] };
  assert.deepEqual(mergeAccountCollection('garden', local, remote), { plants: [
    { id: 'rose-1', speciesId: 'roses', intervals: { water: 7 } },
    { id: 'tulip-1', speciesId: 'tulip', intervals: { water: 5 } },
  ] });
});

test('giftbook merge keeps unique saved entries and limits each collection', () => {
  const merged = mergeAccountCollection('giftbook', {
    recognitions: [{ speciesId: 'roses', at: 'new' }],
    favorites: ['roses', 'tulip'],
    bouquets: [{ id: 'local', speciesId: 'roses' }],
  }, {
    recognitions: [{ speciesId: 'roses', at: 'old' }, { speciesId: 'roses', at: 'new' }],
    favorites: ['roses'],
    bouquets: [{ id: 'remote', speciesId: 'tulip' }],
  });
  assert.deepEqual(merged.recognitions, [
    { speciesId: 'roses', at: 'old' },
    { speciesId: 'roses', at: 'new' },
  ]);
  assert.deepEqual(merged.favorites, ['roses', 'tulip']);
  assert.equal(merged.bouquets.length, 2);
  assert.equal(mergeAccountCollection('giftbook', { favorites: Array.from({ length: 105 }, (_, index) => `flower-${index}`) }, {}).favorites.length, 100);
});

test('unknown account collection names fail closed', () => {
  assert.throws(() => mergeAccountCollection('admin', {}, {}), TypeError);
});
