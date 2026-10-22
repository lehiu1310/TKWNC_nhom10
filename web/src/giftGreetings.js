const recipientNames = {
  'người yêu': 'em',
  mẹ: 'mẹ',
  bố: 'bố',
  bạn: 'bạn',
  'thầy cô': 'thầy/cô',
  'đồng nghiệp': 'anh/chị',
  'đối tác': 'quý anh/chị',
};

const ordinaryOccasions = {
  'sinh nhật': 'dịp sinh nhật',
  '8/3': 'ngày Quốc tế Phụ nữ 8/3',
  '20/10': 'ngày Phụ nữ Việt Nam 20/10',
  '20/11': 'ngày Nhà giáo Việt Nam 20/11',
  Valentine: 'Valentine',
  'kỷ niệm': 'ngày kỷ niệm của chúng ta',
  'chúc mừng': 'dịp đáng nhớ này',
  'khai trương': 'ngày khai trương',
};

export function offlineMessages(bundle, recipient, occasion) {
  const name = recipientNames[recipient] || 'bạn';
  const flower = bundle.main.name_vi;
  const ordinary = ordinaryOccasions[occasion];

  let messages;
  if (occasion === 'xin lỗi') {
    messages = [
      `Mình muốn gửi ${name} bó ${flower} thay lời xin lỗi chân thành. Mong mình có thể cùng lắng nghe và tháo gỡ điều chưa vui.`,
      `Mình xin lỗi ${name} vì chuyện vừa qua. Mong bó ${flower} nhỏ này thể hiện sự trân trọng và thiện chí của mình.`,
      `Cho mình xin lỗi ${name} nhé. Mình gửi ${name} bó ${flower} và mong có dịp nói chuyện để mọi thứ tốt hơn.`,
    ];
  } else if (occasion === 'cảm ơn') {
    messages = [
      `Mình gửi ${name} bó ${flower} cùng lời cảm ơn chân thành. Sự giúp đỡ của ${name} thật đáng quý với mình.`,
      `Xin cảm ơn ${name} vì sự quan tâm và hỗ trợ. Mong bó ${flower} này thay lời trân trọng của mình.`,
      `Cảm ơn ${name} nhiều nhé! Mình gửi ${name} bó ${flower} để niềm vui được nhân đôi.`,
    ];
  } else if (occasion === 'thăm bệnh') {
    messages = [
      `Mong ${name} sớm hồi phục và mỗi ngày khỏe hơn. Mình gửi bó ${flower} với lời hỏi thăm chân thành.`,
      `Chúc ${name} nhiều sức khỏe và mau bình phục. Mong bó ${flower} mang đến một chút niềm vui trong ngày.`,
      `Mau khỏe lại nhé ${name}! Mình gửi ${name} bó ${flower} và mong sớm được gặp ${name} khi đã khỏe hơn.`,
    ];
  } else if (occasion === 'chia buồn') {
    messages = [
      `Mình xin gửi ${name} và gia đình lời chia buồn chân thành. Mong ${name} có thêm sự bình an và nâng đỡ trong thời gian khó khăn này.`,
      `Xin được chia sẻ nỗi mất mát cùng ${name}. Mình luôn sẵn lòng ở bên nếu ${name} cần giúp đỡ.`,
      `Mình thương và nghĩ đến ${name}. Xin gửi lời chia buồn sâu sắc đến ${name} và gia đình.`,
    ];
  } else {
    messages = [
      `Nhân ${ordinary}, mình gửi ${name} bó ${flower} cùng lời chúc chân thành. Mong ngày của ${name} có thật nhiều niềm vui và khoảnh khắc đáng nhớ.`,
      `Chúc ${name} luôn mạnh khỏe, bình an và gặp nhiều điều tốt đẹp. Xin gửi ${name} bó ${flower} thay lời trân trọng.`,
      `Mong bó ${flower} làm ngày hôm nay của ${name} thêm rực rỡ. Chúc ${name} có thật nhiều tiếng cười và điều dễ thương nhé!`,
    ];
  }

  return messages.map((text, index) => ({
    tone: ['Trìu mến', 'Trang trọng', 'Vui vẻ'][index],
    text,
  }));
}

export function offlinePersonalGreeting(bundle, recipient, occasion, situation = '', tone = 'Chân thành, tự nhiên') {
  const person = recipient === 'người yêu' ? 'người thương' : recipient;
  const flower = bundle?.main?.name_vi || 'bó hoa này';
  const context = situation.trim();
  const formality = tone.includes('Trang trọng') ? 'Xin gửi' : tone.includes('Vui vẻ') ? 'Mình gửi' : 'Mình muốn gửi';
  const detail = context ? ` ${context.replace(/[.!?]+$/, '')}.` : '';
  if (occasion === 'xin lỗi') return `Mình xin lỗi ${person} vì chuyện vừa qua.${detail} ${formality} ${person} bó ${flower}, mong mình có thể cùng nói chuyện và làm mọi điều tốt hơn.`;
  if (occasion === 'cảm ơn') return `Cảm ơn ${person} thật nhiều vì sự quan tâm và những điều tốt đẹp đã dành cho mình.${detail} ${formality} ${person} bó ${flower} thay lời trân trọng.`;
  if (occasion === 'thăm bệnh') return `Mong ${person} sớm khỏe lại, mỗi ngày thêm nhiều năng lượng và niềm vui.${detail} ${formality} ${person} bó ${flower} cùng lời hỏi thăm chân thành.`;
  if (occasion === 'chia buồn') return `Mình xin gửi ${person} và gia đình lời chia buồn chân thành. Mong mọi người có thêm bình an và được ở bên nhau trong lúc khó khăn này.${detail}`;
  if (occasion === 'sinh nhật') return `Chúc ${person} sinh nhật thật vui, tuổi mới nhiều sức khỏe và những điều mình mong chờ.${detail} ${formality} ${person} bó ${flower} với thật nhiều thương mến.`;
  return `Chúc ${person} có một dịp ${occasion} thật vui và đáng nhớ.${detail} ${formality} ${person} bó ${flower} như một lời chúc chân thành.`;
}

export function parseGeneratedGreeting(answer) {
  if (typeof answer !== 'string') return null;
  const text = answer
    .replace(/^\s*(?:lời nhắn|lời chúc)\s*:\s*/i, '')
    .replace(/^\s*[“"'`]|[”"'`]\s*$/g, '')
    .trim();
  if (!text || text.length > 700 || /^(?:mình có thể|dưới đây là|lời nhắn:)/i.test(text)) return null;
  return text;
}

const GREETING_TONES = ['Trìu mến', 'Trang trọng', 'Vui vẻ'];

export function isValidGreetingCache(value) {
  return Array.isArray(value)
    && value.length === GREETING_TONES.length
    && value.every((item, index) => item?.tone === GREETING_TONES[index]
      && typeof item.text === 'string'
      && item.text.trim().length > 0
      && item.text.trim().length <= 500);
}

export function parseGeneratedGreetings(answer) {
  if (typeof answer !== 'string') return null;
  const matches = new Map();
  for (const line of answer.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:[-*]\s*)?(?:\d+[.)]\s*)?(Trìu mến|Trang trọng|Vui vẻ)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    const tone = GREETING_TONES.find((item) => item.toLocaleLowerCase('vi') === match[1].toLocaleLowerCase('vi'));
    const text = match[2].trim();
    if (tone && text) matches.set(tone, { tone, text });
  }
  const result = GREETING_TONES.map((tone) => matches.get(tone));
  return isValidGreetingCache(result) ? result : null;
}
