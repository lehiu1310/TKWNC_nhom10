import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) };
const { challengeBadges, getDailyChallenge, localDateKey, readChallengeProgress, recordDailyAttempt } = await import('./flowerChallenge.js');

const flowers = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));

test('daily challenge is repeatable for a date with four distinct options', () => {
  const date = new Date(2026, 2, 14, 12);
  const first = getDailyChallenge(flowers, date);
  const second = getDailyChallenge(flowers, date);
  assert.equal(first.target.id, second.target.id);
  assert.deepEqual(first.options.map((flower) => flower.id), second.options.map((flower) => flower.id));
  assert.equal(first.options.length, 4);
  assert.equal(new Set(first.options.map((flower) => flower.id)).size, 4);
  assert.ok(first.options.some((flower) => flower.id === first.target.id));
  assert.notEqual(localDateKey(date), getDailyChallenge(flowers, new Date(2026, 2, 15, 12)).date);
});

test('records one answer per day and increments the streak on consecutive days', () => {
  memory.clear();
  const day1 = recordDailyAttempt({ date: '2026-03-14', targetId: 'a', selectedId: 'a' });
  const duplicate = recordDailyAttempt({ date: '2026-03-14', targetId: 'a', selectedId: 'b' });
  const day2 = recordDailyAttempt({ date: '2026-03-15', targetId: 'b', selectedId: 'c' });
  assert.equal(day1.correct, 1);
  assert.equal(duplicate.completed, 1);
  assert.equal(day2.completed, 2);
  assert.equal(day2.correct, 1);
  assert.equal(day2.streak, 2);
  assert.equal(day2.lastAnswer.correct, false);
});

test('resets a broken streak and awards progress-based badges', () => {
  memory.clear();
  recordDailyAttempt({ date: '2026-03-14', targetId: 'a', selectedId: 'a' });
  const afterGap = recordDailyAttempt({ date: '2026-03-16', targetId: 'b', selectedId: 'b' });
  assert.equal(afterGap.streak, 1);
  const badges = challengeBadges({ completed: 1, correct: 10, streak: 7 });
  assert.deepEqual(badges.map((badge) => badge.id), ['first', 'three-days', 'seven-days', 'ten-correct']);
  assert.equal(readChallengeProgress().completed, 2);
});
