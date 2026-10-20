import test from 'node:test';
import assert from 'node:assert/strict';

const { createGiftCardPayload, decodeGiftCardToken, encodeGiftCard, giftCardShareUrl, readGiftCardFromHash } = await import('./giftShare.js');

test('encodes a Vietnamese gift card in a share URL fragment without losing accents', () => {
  const payload = { speciesId: 'roses', message: 'Chúc mẹ luôn rạng rỡ 🌷', sender: 'Lan', recipient: 'Mẹ', occasion: 'sinh nhật' };
  const url = giftCardShareUrl(payload, 'https://garden.example');
  assert.match(url, /^https:\/\/garden\.example\/#thiep=/);
  assert.deepEqual(readGiftCardFromHash(new URL(url).hash), { version: 1, ...payload });
});

test('rejects malformed hashes, versions, species ids, and empty or oversized messages', () => {
  assert.equal(readGiftCardFromHash('#not-a-card'), null);
  assert.equal(decodeGiftCardToken('%%%'), null);
  assert.equal(createGiftCardPayload({ speciesId: '../oops', message: 'Hi' }), null);
  assert.equal(createGiftCardPayload({ speciesId: 'rose', message: '  ' }), null);
  assert.equal(createGiftCardPayload({ speciesId: 'rose', message: 'x'.repeat(501) }), null);
  const encoded = new TextEncoder().encode(JSON.stringify({ version: 2, speciesId: 'rose', message: 'Lời nhắn' }));
  const future = btoa(String.fromCharCode(...encoded)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  assert.equal(decodeGiftCardToken(future), null);
});

test('keeps optional card fields bounded before sharing', () => {
  const payload = createGiftCardPayload({ speciesId: 'daisy', message: 'Lời nhắn', sender: 'S'.repeat(80), recipient: 'R'.repeat(50), occasion: 'O'.repeat(90) });
  assert.equal(payload.sender.length, 40);
  assert.equal(payload.recipient.length, 40);
  assert.equal(payload.occasion.length, 60);
  assert.ok(encodeGiftCard(payload).length < 2_800);
});
