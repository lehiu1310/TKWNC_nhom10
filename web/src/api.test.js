import test from 'node:test';
import assert from 'node:assert/strict';
import { postImage } from './api.js';

test('image inference waits long enough for a free-tier cold start', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  let timeoutMs;
  globalThis.window = {
    setTimeout(callback, delay) {
      timeoutMs = delay;
      queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
  };
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
  });

  try {
    await assert.rejects(
      postImage('/api/detect', new Blob(['image'], { type: 'application/octet-stream' })),
      (error) => error.name === 'TimeoutError',
    );
    assert.equal(timeoutMs, 120_000);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});
