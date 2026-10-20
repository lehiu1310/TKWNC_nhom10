import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
};
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
const { addGardenPlant, addGardenReminder, completeCare, listCareTasks, nextCareDate, nextReminderDate, readGarden, removeGardenPlant, removeGardenReminder, setCareInterval, writeGarden } = await import('./gardenPlanner.js');

test('planner safely handles malformed local data and ignores invalid plants', () => {
  memory.set('vuon-hoa-my-garden-v1', '{broken');
  assert.deepEqual(readGarden(), { plants: [], reminders: [] });
  assert.deepEqual(writeGarden({ plants: [{ nope: true }] }), { plants: [], reminders: [] });
});

test('adds a flower once and allows the user to set only sensible reminder intervals', () => {
  memory.clear();
  const now = new Date('2026-01-01T00:00:00.000Z');
  const first = addGardenPlant('roses', now);
  assert.equal(first.plants.length, 1);
  assert.equal(addGardenPlant('roses', now).plants.length, 1);
  const plant = first.plants[0];
  assert.equal(setCareInterval(plant.id, 'water', 3, now).plants[0].intervals.water, 3);
  assert.equal(nextCareDate(readGarden().plants[0], 'water').toISOString(), '2026-01-04T00:00:00.000Z');
  assert.equal(setCareInterval(plant.id, 'water', 400, now).plants[0].intervals.water, 3);
  assert.equal(setCareInterval(plant.id, 'unknown', 4, now).plants[0].intervals.water, 3);
});

test('computes due tasks from the last completion and marks care as done', () => {
  memory.clear();
  const start = new Date('2026-01-01T00:00:00.000Z');
  const plant = addGardenPlant('tulips', start).plants[0];
  setCareInterval(plant.id, 'water', 2, start);
  const due = new Date('2026-01-03T00:00:00.000Z');
  assert.equal(nextCareDate(readGarden().plants[0], 'water').toISOString(), due.toISOString());
  assert.equal(listCareTasks(readGarden(), due)[0].overdue, true);
  completeCare(plant.id, 'water', due);
  assert.equal(listCareTasks(readGarden(), due)[0].overdue, false);
});

test('removes plants without affecting the rest of the garden', () => {
  memory.clear();
  const now = new Date('2026-01-01T00:00:00.000Z');
  const first = addGardenPlant('roses', now).plants[0];
  addGardenPlant('tulips', new Date(now.getTime() + 1));
  const garden = removeGardenPlant(first.id);
  assert.equal(garden.plants.length, 1);
  assert.equal(garden.plants[0].speciesId, 'tulips');
});

test('saves annual reminders, rolls them to the next year, and removes them', () => {
  memory.clear();
  const now = new Date('2026-06-01T12:00:00.000Z');
  const garden = addGardenReminder('Sinh nhật mẹ', '2026-06-10', now);
  assert.equal(garden.reminders.length, 1);
  assert.equal(garden.reminders[0].monthDay, '06-10');
  assert.equal(nextReminderDate(garden.reminders[0], now).getDate(), 10);
  const nextYear = nextReminderDate(garden.reminders[0], new Date('2026-06-11T12:00:00.000Z'));
  assert.equal(nextYear.getFullYear(), 2027);
  assert.equal(addGardenReminder('Ngày không hợp lệ', '2026-02-30', now).reminders.length, 1);
  assert.equal(removeGardenReminder(garden.reminders[0].id).reminders.length, 0);
});

test('handles annual February 29 reminders by selecting a leap year', () => {
  const next = nextReminderDate({ monthDay: '02-29' }, new Date('2027-03-01T00:00:00'));
  assert.equal(next.getFullYear(), 2028);
  assert.equal(next.getMonth(), 1);
  assert.equal(next.getDate(), 29);
});
