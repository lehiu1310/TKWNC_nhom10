import assert from 'node:assert/strict';
import { test } from 'node:test';
import { offlineMessages } from './giftGreetings.js';

const bundle = { main: { name_vi: 'Hoa hồng' } };

test('offline messages cover every supported occasion with three distinct tones', () => {
  const occasions = ['sinh nhật', '8/3', '20/10', '20/11', 'Valentine', 'kỷ niệm', 'xin lỗi', 'cảm ơn', 'chúc mừng', 'khai trương', 'thăm bệnh', 'chia buồn'];
  for (const occasion of occasions) {
    const messages = offlineMessages(bundle, 'người yêu', occasion);
    assert.deepEqual(messages.map((message) => message.tone), ['Trìu mến', 'Trang trọng', 'Vui vẻ']);
    assert.ok(messages.every((message) => message.text.length > 12));
    assert.ok(messages.map((message) => message.text).join(' ').includes('em'));
    if (occasion !== 'chia buồn') assert.ok(messages.map((message) => message.text).join(' ').includes('Hoa hồng'), occasion);
  }
});

test('sensitive occasions use context-appropriate language instead of festive templates', () => {
  for (const occasion of ['xin lỗi', 'cảm ơn', 'thăm bệnh', 'chia buồn']) {
    const text = offlineMessages(bundle, 'người yêu', occasion).map((message) => message.text).join(' ');
    assert.doesNotMatch(text, /Chúc em (?:xin lỗi|cảm ơn|thăm bệnh|chia buồn)/);
  }
  assert.match(offlineMessages(bundle, 'mẹ', 'chia buồn')[0].text, /chia buồn/);
  assert.match(offlineMessages(bundle, 'thầy cô', '20/11')[0].text, /Nhà giáo Việt Nam/);
});
