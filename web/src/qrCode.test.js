import test from 'node:test';
import assert from 'node:assert/strict';
import { createQrSvg } from './qrCode.js';

test('renders valid scalable SVG QR for a Vietnamese shared-card URL', () => {
  const svg = createQrSvg('https://garden.example/#thiep=VGhpcyBpcyBhIHRlc3Q');
  assert.match(svg, /^<svg[\s>]/);
  assert.match(svg, /viewBox=/);
  assert.match(svg, /<path/);
  assert.match(svg, /<\/svg>$/);
});

test('rejects empty or oversized QR content', () => {
  assert.throws(() => createQrSvg(''), /không hợp lệ/);
  assert.throws(() => createQrSvg('x'.repeat(2801)), /quá dài/);
});
