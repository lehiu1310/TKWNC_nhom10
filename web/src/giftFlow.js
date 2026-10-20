export const GIFT_INTENTS = [
  { id: 'love', title: 'Bày tỏ yêu thương', occasion: 'Valentine', icon: '♡' },
  { id: 'thanks', title: 'Nói lời cảm ơn', occasion: 'cảm ơn', icon: '✿' },
  { id: 'encourage', title: 'Thăm hỏi, động viên', occasion: 'thăm bệnh', icon: '☀' },
  { id: 'sorry', title: 'Nói lời xin lỗi', occasion: 'xin lỗi', icon: '✦' },
  { id: 'celebrate', title: 'Chúc mừng', occasion: 'chúc mừng', icon: '↗' },
];

export function intentForOccasion(occasion) {
  return GIFT_INTENTS.find((intent) => intent.occasion === occasion) || null;
}

export function isCompatiblePreferredFlower(entry, occasion) {
  return Boolean(entry?.occasions?.includes(occasion) && !entry.avoid_occasions?.includes(occasion));
}
