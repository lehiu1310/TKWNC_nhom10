import { useEffect, useMemo, useState } from 'react';
import speciesData from '../../data/species.json';
import giftData from '../../data/gift_meanings.json';
import displayData from '../../data/display_images.json';
import { friendlyFailure, postJson } from './api.js';
import { openGardenerWith, readGiftBook, writeGiftBook } from './giftBook.js';

const OCCASIONS = giftData.occasions;
const RECIPIENTS = giftData.recipients;
const SIZES = ['nhỏ', 'vừa', 'lớn'];
const SPECIES = Object.fromEntries(speciesData.map((flower) => [flower.id, flower]));
const GIFT_SPECIES = giftData.species.filter((entry) => entry.gift_ok);
const COLORS = [...new Set(GIFT_SPECIES.flatMap((entry) => entry.colors.map((value) => value.match(/#[0-9a-f]{6}/i)?.[0]).filter(Boolean)))];

function imageFor(flower) {
  const featuredKey = flower.display_image_key || ({ roses: 'rose', sunflowers: 'sunflower', tulips: 'tulip' })[flower.id] || flower.id;
  return displayData.images[featuredKey]?.url || `/images/gift-flowers/${encodeURIComponent(flower.id)}.jpg`;
}

function recommendLocally(occasion, recipient, color, size) {
  const numbers = { nhỏ: 5, vừa: 9, lớn: 15 };
  const eligible = GIFT_SPECIES.filter((entry) => entry.occasions.includes(occasion)
    && !entry.avoid_occasions?.includes(occasion)
    && !(occasion !== 'chia buồn' && entry.avoid_for.some((note) => note.includes('Không tự gợi ý cho dịp vui'))))
    .map((entry) => {
      const flower = SPECIES[entry.species_id];
      const recipientMatch = entry.recipients.includes(recipient);
      const colorMatch = Boolean(color && entry.colors.some((value) => value.includes(color)));
      return { entry, flower, recipientMatch, colorMatch, score: 4 + (recipientMatch ? 3 : 0) + (colorMatch ? 2 : 0) };
    }).filter((item) => item.flower)
    .sort((a, b) => b.score - a.score || (a.flower.featured_order || 999) - (b.flower.featured_order || 999) || a.flower.name_vi.localeCompare(b.flower.name_vi, 'vi'));
  if (!eligible.length) throw new Error('Chưa có gợi ý phù hợp. Hãy chọn dịp khác.');
  const suggestions = eligible.slice(0, 3).map((item, index) => {
    const support = eligible.find((candidate) => candidate.flower.id !== item.flower.id);
    const reason = [`dữ liệu nháp có gắn với dịp ${occasion}`];
    if (item.recipientMatch) reason.push(`phù hợp nhóm người nhận ${recipient} theo dữ liệu nháp`);
    else reason.push('điểm người nhận trung tính vì chưa có ghép cụ thể');
    if (item.colorMatch) reason.push('màu được chọn có trong dữ liệu màu của loài');
    const card = (flower, entry) => flower && ({ id: flower.id, name_vi: flower.name_vi, name_en: flower.name_en, meaning: entry.meanings.chung || flower.meaning, color: flower.color, image: flower.image, display_image_key: flower.display_image_key });
    return {
      id: `${item.flower.id}-${index}`, main: card(item.flower, item.entry),
      support: support ? card(support.flower, support.entry) : null,
      foliage: 'Lá xanh trung tính (phần phối trang trí, không phải dữ liệu loài).',
      meaning: item.entry.meanings.chung || item.flower.meaning, reason,
      caution: item.entry.avoid_for, score: item.score, stem_count: numbers[size],
      palette: [item.flower.color, support?.flower.color].filter(Boolean), verified: false,
    };
  });
  return { occasion, recipient, size, suggestions, label: 'Gợi ý dựa trên dữ liệu ý nghĩa hoa', verified: false };
}

function offlineMessages(bundle, recipient, occasion) {
  const flower = bundle.main.name_vi;
  const name = recipient === 'người yêu' ? 'em' : recipient === 'mẹ' ? 'mẹ' : recipient === 'bố' ? 'bố' : recipient === 'thầy cô' ? 'thầy/cô' : 'bạn';
  return [
    { tone: 'Trìu mến', text: `Chúc ${name} ${occasion} thật nhiều niềm vui. Mong bó ${flower} này gửi đến ${name} chút yêu thương và lời chúc bình an.` },
    { tone: 'Trang trọng', text: `Kính chúc ${name} ${occasion} nhiều sức khỏe, niềm vui và những điều tốt đẹp. Xin gửi ${name} bó ${flower} thay lời trân trọng.` },
    { tone: 'Vui vẻ', text: `Chúc ${name} ${occasion} rực rỡ như bó ${flower} này nhé! Mong ngày hôm nay ngập tiếng cười và điều bất ngờ dễ thương.` },
  ];
}

async function makeMessages(bundle, recipient, occasion) {
  const cacheKey = `gift-greetings-v1:${bundle.main.id}:${recipient}:${occasion}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (Array.isArray(cached) && cached.length === 3) return { messages: cached, cached: true, source: 'Gemini (bản đã lưu)' };
  } catch { /* Ignore malformed local cache. */ }
  const fallback = offlineMessages(bundle, recipient, occasion);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await postJson('/api/chat/sync', {
      message: `Hãy viết đúng 3 lời nhắn ngắn bằng tiếng Việt để tặng ${recipient} dịp ${occasion}, kèm bó ${bundle.main.name_vi}${bundle.support ? ` và ${bundle.support.name_vi}` : ''}. Ý nghĩa dữ liệu hiện có: ${bundle.meaning}. Viết thành ba dòng, lần lượt mở đầu bằng “Trìu mến:”, “Trang trọng:” và “Vui vẻ:”. Mỗi lời tối đa 35 từ. Không bịa ý nghĩa văn hoá hoặc nguồn trích dẫn.`,
      history: [],
    }, { signal: controller.signal });
    const lines = String(response.answer || '').split('\n').map((line) => line.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean);
    const messages = ['Trìu mến', 'Trang trọng', 'Vui vẻ'].map((tone, index) => {
      const matching = lines.find((line) => line.toLocaleLowerCase('vi').startsWith(tone.toLocaleLowerCase('vi')));
      return { tone, text: matching ? matching.replace(new RegExp(`^${tone}:?\\s*`, 'i'), '') : lines[index]?.replace(/^[^:]+:\s*/, '') || fallback[index].text };
    });
    localStorage.setItem(cacheKey, JSON.stringify(messages));
    return { messages, cached: false, source: 'Gemini qua API chatbot' };
  } catch (error) {
    return { messages: fallback, cached: false, source: 'Mẫu offline', note: friendlyFailure(error) };
  } finally {
    window.clearTimeout(timeout);
  }
}

function saveGreetingCard(message, flower, sender, recipientName) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#fff8eb'); gradient.addColorStop(1, '#f7e9e4');
  context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = flower.color || '#e7c7c0'; context.globalAlpha = .12;
  context.beginPath(); context.arc(1040, 130, 300, 0, Math.PI * 2); context.fill(); context.globalAlpha = 1;
  const finish = () => {
    context.fillStyle = '#54704d'; context.textAlign = 'center'; context.font = '600 30px Georgia';
    context.fillText('MỘT BÓ HOA, MỘT LỜI THƯƠNG', 600, 1165);
    context.fillStyle = '#29462f'; context.font = '48px Georgia';
    const words = message.split(/\s+/); let line = ''; let y = 1260;
    for (const word of words) { const next = `${line}${word} `; if (context.measureText(next).width > 920) { context.fillText(line.trim(), 600, y); line = `${word} `; y += 64; } else line = next; }
    if (line) context.fillText(line.trim(), 600, y);
    context.fillStyle = '#72816b'; context.font = '28px Arial'; context.fillText([sender && `Từ ${sender}`, recipientName && `Gửi ${recipientName}`].filter(Boolean).join('  ·  '), 600, 1430);
    canvas.toBlob((blob) => { if (!blob) return; const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `thiep-${flower.id}.png`; link.click(); URL.revokeObjectURL(link.href); }, 'image/png');
  };
  const image = new Image(); image.crossOrigin = 'anonymous';
  image.onload = () => {
    const size = 840; const x = 180; const y = 190;
    context.save(); context.beginPath(); context.roundRect(x, y, size, size, 48); context.clip();
    context.drawImage(image, x, y, size, size); context.restore(); finish();
  };
  image.onerror = finish;
  image.src = imageFor(flower);
}

export default function GiftAdvisor() {
  const [occasion, setOccasion] = useState('sinh nhật');
  const [recipient, setRecipient] = useState('người yêu');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('vừa');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [greetings, setGreetings] = useState(null);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [sender, setSender] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [book, setBook] = useState(readGiftBook);
  const [tab, setTab] = useState('gift');
  const current = result?.suggestions?.[selected];
  const uniqueRecognized = useMemo(() => new Set(book.recognitions.map((item) => item.speciesId)).size, [book]);

  useEffect(() => {
    const update = () => setBook(readGiftBook());
    window.addEventListener('garden:giftbook-updated', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('garden:giftbook-updated', update); window.removeEventListener('storage', update); };
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('flower');
    if (!id) return;
    const entry = GIFT_SPECIES.find((item) => item.species_id === id);
    const flower = SPECIES[id];
    if (!entry || !flower) return;
    const validOccasion = entry.occasions[0];
    if (validOccasion) setOccasion(validOccasion);
    setColor(entry.colors[0]?.match(/#[0-9a-f]{6}/i)?.[0] || '');
  }, []);

  async function getSuggestions(event) {
    event.preventDefault(); setBusy(true); setError(''); setGreetings(null); setSelected(0);
    try { setResult(recommendLocally(occasion, recipient, color, size)); }
    catch (requestError) { setError(requestError.message || friendlyFailure(requestError)); }
    finally { setBusy(false); }
  }

  async function generateGreetings() {
    if (!current || greetingBusy) return;
    setGreetingBusy(true); setGreetings(null);
    try { setGreetings(await makeMessages(current, recipient, occasion)); }
    finally { setGreetingBusy(false); }
  }

  function saveBouquet() {
    if (!current) return;
    const next = readGiftBook();
    next.bouquets.unshift({ id: `${Date.now()}`, occasion, recipient, mainId: current.main.id, supportId: current.support?.id || null, size, savedAt: new Date().toISOString() });
    setBook(writeGiftBook(next));
  }

  function clearBook() {
    const empty = { recognitions: [], favorites: [], bouquets: [] };
    setBook(writeGiftBook(empty));
  }

  const recommendationNames = (entry) => entry?.[0] === 'mainId' ? SPECIES[entry[1]]?.name_vi : SPECIES[entry?.[1]]?.name_vi;

  return <main className="gift-page section-wrap">
    <header className="gift-hero"><a className="back-home" href="/#home">← Về khu vườn</a><span className="eyebrow">CHỌN HOA CÓ Ý NGHĨA</span><h1>Một bó hoa,<br/><em>đúng điều muốn nói.</em></h1><p>Chọn dịp và người nhận để khám phá gợi ý bó hoa, lời nhắn và lưu lại trong Sổ hoa của bạn.</p><span className="gift-disclaimer">Gợi ý dựa trên dữ liệu ý nghĩa hoa · chưa thay thế tư vấn phong tục địa phương</span></header>
    <div className="gift-tabs" role="tablist" aria-label="Tặng hoa và sổ hoa"><button type="button" role="tab" aria-selected={tab === 'gift'} className={tab === 'gift' ? 'active' : ''} onClick={() => setTab('gift')}>Phối bó hoa</button><button type="button" role="tab" aria-selected={tab === 'book'} className={tab === 'book' ? 'active' : ''} onClick={() => setTab('book')}>Sổ hoa của tôi <span>{book.bouquets.length + book.favorites.length}</span></button></div>
    {tab === 'gift' ? <>
      <form className="gift-form" onSubmit={getSuggestions}>
        <label>Dịp<select value={occasion} onChange={(event) => setOccasion(event.target.value)}>{OCCASIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Người nhận<select value={recipient} onChange={(event) => setRecipient(event.target.value)}>{RECIPIENTS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Màu yêu thích <select value={color} onChange={(event) => setColor(event.target.value)}><option value="">Tuỳ ý</option>{COLORS.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <label>Quy mô<select value={size} onChange={(event) => setSize(event.target.value)}>{SIZES.map((item) => <option key={item}>{item}</option>)}</select><small>{size === 'nhỏ' ? '5' : size === 'vừa' ? '9' : '15'} cành · không hiển thị giá</small></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Đang phối gợi ý…' : 'Tìm bó hoa phù hợp'} <span>↗</span></button>
      </form>
      {error && <div className="friendly-error" role="alert"><p>{error}</p><button className="button" type="button" onClick={() => getSuggestions({ preventDefault() {} })}>Thử lại</button></div>}
      {result && <>
        <div className="gift-suggestion-tabs" role="tablist" aria-label="Ba gợi ý bó hoa">{result.suggestions.map((suggestion, index) => <button type="button" key={suggestion.id} className={selected === index ? 'active' : ''} onClick={() => { setSelected(index); setGreetings(null); }}>Gợi ý 0{index + 1}<span>{suggestion.main.name_vi}</span></button>)}</div>
        {current && <article className="bouquet-card">
          <div className="bouquet-photo-composition" aria-label={`Ảnh gợi ý bó ${current.main.name_vi}`}>
            <img className="bouquet-photo-main" src={imageFor(current.main)} alt={current.main.name_vi} loading="lazy"/>
            {current.support && <img className="bouquet-photo-support" src={imageFor(current.support)} alt={current.support.name_vi} loading="lazy"/>}
            <span className="bouquet-ribbon">{current.stem_count} cành · {size}</span>
          </div>
          <div className="bouquet-copy"><span className="eyebrow">{result.label.toLocaleUpperCase('vi')}</span><h2>{current.main.name_vi}<small> + {current.support?.name_vi || 'hoa phụ theo mùa'}</small></h2><p className="bouquet-meaning">{current.meaning}</p><h3>Vì sao gợi ý bó này?</h3><ul>{current.reason.map((reason) => <li key={reason}>{reason}</li>)}<li>Phối thêm {current.foliage.toLocaleLowerCase('vi')}</li></ul><div className="bouquet-palette" aria-label="Bảng màu bó hoa">{current.palette.filter(Boolean).map((value) => <i key={value} style={{ background: value }} title={value}/>)}</div>{current.caution.length > 0 && <p className="bouquet-caution"><b>Lưu ý:</b> {current.caution.join(' ')}</p>}<p className="draft-note">Dữ liệu ý nghĩa và phối dịp hiện là bản nháp chưa xác minh.</p>
            <div className="bouquet-actions"><button type="button" className="primary-button" onClick={saveBouquet}>Lưu bó vào Sổ hoa</button><button type="button" className="button" onClick={() => { const question = `Mình muốn tặng bó ${current.main.name_vi}${current.support ? ` và ${current.support.name_vi}` : ''} cho ${recipient} dịp ${occasion}. Ý nghĩa và lưu ý văn hoá nào cần biết?`; openGardenerWith(question); }}>Hỏi cô làm vườn về bó này</button><button type="button" className="button" onClick={generateGreetings} disabled={greetingBusy}>{greetingBusy ? 'Đang viết lời nhắn…' : 'Viết lời nhắn'}</button></div>
            {greetings && <section className="gift-greetings"><span className="eyebrow">3 LỜI NHẮN · {greetings.source}</span>{greetings.note && <p className="draft-note">Gemini chưa sẵn sàng; đang dùng mẫu offline. {greetings.note}</p>}<label>Tên người gửi<input value={sender} onChange={(event) => setSender(event.target.value)} placeholder="Tuỳ chọn" maxLength={40}/></label><label>Tên người nhận<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Tuỳ chọn" maxLength={40}/></label>{greetings.messages.map((message) => <article className="gift-message" key={message.tone}><div><b>{message.tone}</b><p>{message.text}</p></div><button type="button" className="button" onClick={() => saveGreetingCard(message.text, current.main, sender, recipientName)}>Tải thiệp PNG</button></article>)}</section>}
          </div>
        </article>}
      </>}
      {!result && <div className="gift-empty"><span>✿</span><h2>Chọn điều bạn muốn gửi gắm</h2><p>Kết quả dùng luật và dữ liệu ý nghĩa hoa đã lưu trong dự án, không gọi thêm mô hình AI.</p><button className="primary-button" type="button" onClick={() => getSuggestions({ preventDefault() {} })}>Xem gợi ý mẫu <span>→</span></button></div>}
    </> : <section className="giftbook-panel">
      <header><div><span className="eyebrow">LƯU CỤC BỘ TRÊN THIẾT BỊ</span><h2>Sổ hoa của tôi</h2><p>Không cần đăng nhập. Dữ liệu chỉ nằm trong trình duyệt này.</p></div><button className="button danger-button" type="button" onClick={clearBook} disabled={!book.recognitions.length && !book.favorites.length && !book.bouquets.length}>Xoá dữ liệu</button></header>
      <div className="giftbook-stats"><div><b>{uniqueRecognized}</b><span>loài đã nhận diện</span></div><div><b>{book.favorites.length}</b><span>hoa yêu thích</span></div><div><b>{book.bouquets.length}</b><span>bó đã phối</span></div></div>
      <h3>Bó hoa đã lưu</h3>{book.bouquets.length ? <div className="giftbook-list">{book.bouquets.map((bouquet) => <article key={bouquet.id}><span className="giftbook-icon">✿</span><div><b>{recommendationNames(['mainId', bouquet.mainId])}{bouquet.supportId ? ` + ${SPECIES[bouquet.supportId]?.name_vi || ''}` : ''}</b><small>{bouquet.occasion} · {bouquet.recipient} · {bouquet.size}</small></div><button className="text-link" type="button" onClick={() => { setOccasion(bouquet.occasion); setRecipient(bouquet.recipient); setSize(bouquet.size); setTab('gift'); }}>Phối lại →</button></article>)}</div> : <p className="muted">Chưa có bó hoa nào được lưu.</p>}
      <h3>Hoa yêu thích</h3>{book.favorites.length ? <div className="giftbook-chips">{book.favorites.map((id) => <span key={id}>✿ {SPECIES[id]?.name_vi || id}</span>)}</div> : <p className="muted">Lưu hoa yêu thích từ kết quả nhận diện.</p>}
    </section>}
  </main>;
}
