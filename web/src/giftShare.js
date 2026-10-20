const MAX_MESSAGE_LENGTH = 500;
const MAX_TOKEN_LENGTH = 2_800;

export function createGiftCardPayload({ speciesId, message, sender = '', recipient = '', occasion = '' }) {
  if (typeof speciesId !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(speciesId)) return null;
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage || cleanMessage.length > MAX_MESSAGE_LENGTH) return null;
  return {
    version: 1,
    speciesId,
    message: cleanMessage,
    sender: String(sender || '').trim().slice(0, 40),
    recipient: String(recipient || '').trim().slice(0, 40),
    occasion: String(occasion || '').trim().slice(0, 60),
  };
}

export function encodeGiftCard(payload) {
  const clean = createGiftCardPayload(payload || {});
  if (!clean) throw new Error('Thiệp cần có loài hoa và lời nhắn hợp lệ.');
  const bytes = new TextEncoder().encode(JSON.stringify(clean));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const token = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  if (token.length > MAX_TOKEN_LENGTH) throw new Error('Lời nhắn quá dài để tạo mã QR.');
  return token;
}

export function decodeGiftCardToken(token) {
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH || !/^[a-z0-9_-]+$/i.test(token)) return null;
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - token.length % 4) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed?.version === 1 ? createGiftCardPayload(parsed) : null;
  } catch {
    return null;
  }
}

export function readGiftCardFromHash(hash) {
  const match = /^#thiep=([a-z0-9_-]+)$/i.exec(String(hash || ''));
  return match ? decodeGiftCardToken(match[1]) : null;
}

export function giftCardShareUrl(payload, origin = globalThis.location?.origin || 'http://localhost') {
  const url = new URL('/', origin);
  url.hash = `thiep=${encodeGiftCard(payload)}`;
  return url.toString();
}
