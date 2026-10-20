import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
const sessionValues = new Map();
const events = [];
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.sessionStorage = {
  getItem: (key) => sessionValues.get(key) ?? null,
  setItem: (key, value) => sessionValues.set(key, String(value)),
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type) { this.type = type; }
};
globalThis.window = { dispatchEvent: (event) => events.push(event.type) };

const { openGardenerWith, readGiftBook, rememberFavorite, rememberRecognition, writeGiftBook } = await import('./giftBook.js');

beforeEach(() => {
  values.clear();
  sessionValues.clear();
  events.length = 0;
});

test('reads a safe empty book when local storage contains invalid JSON', () => {
  values.set('vuon-hoa-giftbook-v1', '{bad json');
  assert.deepEqual(readGiftBook(), { recognitions: [], favorites: [], bouquets: [] });
});

test('writes bounded lists and notifies the page', () => {
  const entries = Array.from({ length: 105 }, (_, index) => index);
  const result = writeGiftBook({ recognitions: entries, favorites: entries, bouquets: entries });
  assert.deepEqual(result.recognitions, entries.slice(-100));
  assert.deepEqual(readGiftBook(), result);
  assert.deepEqual(events, ['garden:giftbook-updated']);
});

test('toggles favorites and records recognized species', () => {
  assert.deepEqual(rememberFavorite('roses').favorites, ['roses']);
  assert.deepEqual(rememberFavorite('roses').favorites, []);
  rememberRecognition({ id: 'tulips' });
  assert.equal(readGiftBook().recognitions[0].speciesId, 'tulips');
  assert.ok(readGiftBook().recognitions[0].at);
  assert.equal(rememberRecognition(null), undefined);
});

test('prefills the gardener chat for this session', () => {
  openGardenerWith('Hoa này hợp tặng dịp nào?');
  assert.equal(sessionValues.get('garden-chat-prefill'), 'Hoa này hợp tặng dịp nào?');
  assert.deepEqual(events, ['garden:open-chat']);
});
