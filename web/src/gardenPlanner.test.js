import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
const { addGardenPlant, completeCare, listCareTasks, nextCareDate, readGarden, removeGardenPlant, setCareInterval, writeGarden } = await import('./gardenPlanner.js');

test('planner safely handles malformed local data and ignores invalid plants', () => {
  memory.set('vuon-hoa-my-garden-v1', '{broken');
  assert.deepEqual(readGarden(), { plants: [] });
  assert.deepEqual(writeGarden({ plants: [{ nope: true }] }), { plants: [] });
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

test('removes legacy important-date reminders while preserving saved plants', () => {
  memory.clear();
  const plant = addGardenPlant('roses', new Date('2026-06-01T12:00:00.000Z')).plants[0];
  memory.set('vuon-hoa-my-garden-v1', JSON.stringify({ plants: [plant], reminders: [{ id: 'event-old', title: 'Sinh nhật mẹ', monthDay: '06-10' }] }));
  memory.set('vuon-hoa-reminders-sent-v1', JSON.stringify(['event:event-old:2026-06-10']));
  assert.deepEqual(readGarden(), { plants: [plant] });
  assert.deepEqual(JSON.parse(memory.get('vuon-hoa-my-garden-v1')), { plants: [plant] });
  assert.equal(memory.has('vuon-hoa-reminders-sent-v1'), false);
});
