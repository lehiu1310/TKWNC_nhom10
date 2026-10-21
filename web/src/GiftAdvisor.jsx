import { useEffect, useMemo, useState } from 'react';
import speciesData from '../../data/species.json';
import giftData from '../../data/gift_meanings.json';
import displayData from '../../data/display_images.json';
import { friendlyFailure, postJson } from './api.js';
import { openGardenerWith, readGiftBook, recentUniqueRecognitions, rememberFavorite, writeGiftBook } from './giftBook.js';
import { GIFT_INTENTS, intentForOccasion, isCompatiblePreferredFlower } from './giftFlow.js';
import { offlinePersonalGreeting, parseGeneratedGreeting } from './giftGreetings.js';
import GiftQrPanel from './GiftQrPanel.jsx';

const OCCASIONS = giftData.occasions;
const RECIPIENTS = giftData.recipients;
const SIZES = ['nhỏ', 'vừa', 'lớn'];
const SPECIES = Object.fromEntries(speciesData.map((flower) => [flower.id, flower]));
const GIFT_SPECIES = giftData.species.filter((entry) => entry.gift_ok);

function imageFor(flower) {
  const featuredKey = flower.display_image_key || ({ roses: 'rose', sunflowers: 'sunflower', tulips: 'tulip' })[flower.id] || flower.id;
  return displayData.images[featuredKey]?.url || `/images/gift-flowers/${encodeURIComponent(flower.id)}.jpg`;
}

async function makePersonalGreeting(bundle, recipient, occasion, situation, tone) {
  const fallback = offlinePersonalGreeting(bundle, recipient, occasion, situation, tone);
  const controller = new AbortController();
  // Grounded Gemini latency varies. Give the backend's 60s request window time
  // to finish, while retaining a bounded wait and offline fallback.
  const timeout = window.setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await postJson('/api/gifts/greeting', {
      occasion,
      recipient,
      flowers: [bundle.main.name_vi, bundle.support?.name_vi, bundle.accent?.name_vi].filter(Boolean),
      situation,
      tone,
    }, { signal: controller.signal });
    const message = parseGeneratedGreeting(response.message);
    if (!message) return { text: fallback, source: 'Mẫu dự phòng offline', note: 'AI chưa trả về lời nhắn dùng được; bạn có thể sửa nội dung trước khi tải thiệp.' };
    return { text: message, source: 'AI qua API chatbot' };
  } catch (error) {
    return { text: fallback, source: 'Mẫu dự phòng offline', note: friendlyFailure(error) };
  } finally {
    window.clearTimeout(timeout);
  }
}

function saveGreetingCard(message, flower) {
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
    canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `thiep-${flower.id}.png`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'image/png');
  };
  const image = new Image();
  image.onload = () => {
    const size = 840; const x = 180; const y = 190;
    context.save(); context.beginPath(); context.roundRect(x, y, size, size, 48); context.clip();
    context.drawImage(image, x, y, size, size); context.restore(); finish();
  };
  image.onerror = finish;
  image.src = `/images/gift-flowers/${encodeURIComponent(flower.id)}.jpg`;
}

function loadLocalFlowerImage(flowerId) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Không tải được ảnh ${flowerId}`));
    image.src = `/images/gift-flowers/${encodeURIComponent(flowerId)}.jpg`;
  });
}

async function makeBouquetShareImage(bouquet, context) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1400;
  const context2d = canvas.getContext('2d');
  if (!context2d) throw new Error('Trình duyệt không hỗ trợ tạo ảnh thiệp.');

  const [mainImage, supportImage, accentImage] = await Promise.all([
    loadLocalFlowerImage(bouquet.main.id),
    bouquet.support ? loadLocalFlowerImage(bouquet.support.id) : Promise.resolve(null),
    bouquet.accent ? loadLocalFlowerImage(bouquet.accent.id) : Promise.resolve(null),
  ]);
  const background = context2d.createLinearGradient(0, 0, 1200, 1400);
  background.addColorStop(0, '#fff8ed');
  background.addColorStop(1, '#f5ebe5');
  context2d.fillStyle = background;
  context2d.fillRect(0, 0, 1200, 1400);
  context2d.textAlign = 'center';
  context2d.fillStyle = '#557653';
  context2d.font = '700 25px Arial';
  context2d.fillText('MỘT BÓ HOA, MỘT LỜI THƯƠNG', 600, 95);

  context2d.save();
  context2d.beginPath();
  context2d.roundRect(80, 145, 1040, 930, 48);
  context2d.clip();
  context2d.drawImage(mainImage, 80, 145, 1040, 930);
  context2d.restore();
  if (supportImage) {
    context2d.save();
    context2d.beginPath();
    context2d.arc(890, 900, 170, 0, Math.PI * 2);
    context2d.clip();
    context2d.drawImage(supportImage, 720, 730, 340, 340);
    context2d.restore();
    context2d.beginPath();
    context2d.arc(890, 900, 170, 0, Math.PI * 2);
    context2d.strokeStyle = '#fffdf5';
    context2d.lineWidth = 12;
    context2d.stroke();
  }
  if (accentImage) {
    context2d.save();
    context2d.beginPath();
    context2d.arc(300, 875, 115, 0, Math.PI * 2);
    context2d.clip();
    context2d.drawImage(accentImage, 185, 760, 230, 230);
    context2d.restore();
    context2d.beginPath();
    context2d.arc(300, 875, 115, 0, Math.PI * 2);
    context2d.strokeStyle = '#fffdf6';
    context2d.lineWidth = 10;
    context2d.stroke();
  }

  context2d.fillStyle = '#294735';
  context2d.font = '600 47px Georgia, serif';
  context2d.fillText(`${bouquet.main.name_vi}${bouquet.support ? ` + ${bouquet.support.name_vi}` : ''}`, 600, 1175, 1060);
  context2d.fillStyle = '#637461';
  context2d.font = '28px Arial, sans-serif';
  context2d.fillText(`${context.occasion} · gửi ${context.recipient} · ${bouquet.stem_count} cành`, 600, 1235, 1040);
  context2d.fillStyle = '#9a7753';
  context2d.font = 'italic 23px Georgia, serif';
  context2d.fillText('Gợi ý tham khảo từ Vườn Hoa', 600, 1320);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Chưa tạo được ảnh chia sẻ.')), 'image/png');
  });
}

async function shareBouquetImage(bouquet, context) {
  const blob = await makeBouquetShareImage(bouquet, context);
  const file = new File([blob], `bo-hoa-${bouquet.main.id}.png`, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Gợi ý bó hoa ${bouquet.main.name_vi}`,
        text: `Bó hoa gợi ý cho dịp ${context.occasion}, dành tặng ${context.recipient}.`,
      });
      return 'Đã mở bảng chia sẻ của thiết bị.';
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      // Native sharing can reject after image generation consumes activation; keep download available.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'Ảnh bó hoa đã được tải xuống để bạn gửi cho người khác.';
}

export default function GiftAdvisor() {
  const [occasion, setOccasion] = useState('sinh nhật');
  const [recipient, setRecipient] = useState('người yêu');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('vừa');
  const [result, setResult] = useState(null);
  const [resultContext, setResultContext] = useState(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [greetings, setGreetings] = useState(null);
  const [showGreetingComposer, setShowGreetingComposer] = useState(false);
  const [greetingSituation, setGreetingSituation] = useState('');
  const [greetingTone, setGreetingTone] = useState('Chân thành, tự nhiên');
  const [greetingError, setGreetingError] = useState('');
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [greetingEdit, setGreetingEdit] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [shareError, setShareError] = useState('');
  const [actionsDone, setActionsDone] = useState({});
  const [book, setBook] = useState(readGiftBook);
  const [tab, setTab] = useState('gift');
  const [intent, setIntent] = useState('');
  const [preferredFlowerId, setPreferredFlowerId] = useState(() => {
    const id = new URLSearchParams(window.location.search).get('flower');
    return id && GIFT_SPECIES.some((entry) => entry.species_id === id) ? id : '';
  });
  const current = result?.suggestions?.[selected];
  const uniqueRecognized = useMemo(() => new Set(book.recognitions.map((item) => item.speciesId)).size, [book]);
  const recentRecognized = useMemo(() => recentUniqueRecognitions(book.recognitions, 8), [book]);

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
    if (!entry || !flower) { setPreferredFlowerId(''); return; }
    const validOccasion = entry.occasions.find((item) => !entry.avoid_occasions?.includes(item));
    if (validOccasion) {
      setOccasion(validOccasion);
      setIntent(intentForOccasion(validOccasion)?.id || '');
    }
    setColor(entry.colors[0]?.match(/#[0-9a-f]{6}/i)?.[0] || '');
  }, []);

  async function getSuggestions(event, overrides = {}) {
    event?.preventDefault(); setBusy(true); setError(''); setResult(null); setResultContext(null); setGreetings(null); setShowGreetingComposer(false); setSelected(0); setActionsDone({});
    const requestOccasion = overrides.occasion ?? occasion;
    const requestRecipient = overrides.recipient ?? recipient;
    const requestColor = overrides.color ?? color;
    const requestSize = overrides.size ?? size;
    const requestPreferredFlowerId = overrides.preferredFlowerId ?? preferredFlowerId;
    try {
      const data = await postJson('/api/gifts/recommend', {
        occasion: requestOccasion, recipient: requestRecipient,
        color: requestColor || null, size: requestSize,
        preferred_species_id: requestPreferredFlowerId || null,
      });
      setResult(data);
      setResultContext({ occasion: requestOccasion, recipient: requestRecipient, color: requestColor, size: requestSize });
    }
    catch (requestError) {
      const clientMessage = /^400:\s*(.*)$/.exec(requestError.message || '')?.[1];
      setError(clientMessage || friendlyFailure(requestError));
    }
    finally { setBusy(false); }
  }

  function clearPreferredFlower() {
    setPreferredFlowerId('');
    const url = new URL(window.location.href);
    url.searchParams.delete('flower');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function chooseIntent(option) {
    setIntent(option.id);
    setOccasion(option.occasion);
    setGreetings(null);
    setGreetingEdit('');
    setShareNotice('');
    const preferredEntry = GIFT_SPECIES.find((entry) => entry.species_id === preferredFlowerId);
    if (preferredEntry && !isCompatiblePreferredFlower(preferredEntry, option.occasion)) {
      clearPreferredFlower();
    }
  }

  function chooseOccasion(nextOccasion) {
    setOccasion(nextOccasion);
    setIntent(intentForOccasion(nextOccasion)?.id || '');
    const preferredEntry = GIFT_SPECIES.find((entry) => entry.species_id === preferredFlowerId);
    if (preferredEntry && !isCompatiblePreferredFlower(preferredEntry, nextOccasion)) clearPreferredFlower();
  }

  async function generateGreetings() {
    if (!current || greetingBusy) return;
    setGreetingBusy(true); setGreetings(null); setGreetingError('');
    try {
      const generated = await makePersonalGreeting(current, resultContext?.recipient || recipient, resultContext?.occasion || occasion, greetingSituation.trim(), greetingTone);
      setGreetings(generated); setGreetingEdit(generated.text);
    } catch (failure) { setGreetingError(friendlyFailure(failure)); }
    finally { setGreetingBusy(false); }
  }

  async function shareCurrentBouquet() {
    if (!current || shareBusy) return;
    setShareBusy(true); setShareNotice(''); setShareError('');
    try {
      setShareNotice(await shareBouquetImage(current, {
        occasion: resultContext?.occasion || occasion,
        recipient: resultContext?.recipient || recipient,
      }));
      setActionsDone((previous) => ({ ...previous, share: true }));
    } catch (shareFailure) {
      if (shareFailure?.name !== 'AbortError') setShareError(shareFailure?.message || 'Chưa thể tạo ảnh chia sẻ.');
    } finally {
      setShareBusy(false);
    }
  }

  function saveBouquet() {
    if (!current) return;
    const next = readGiftBook();
    next.bouquets.unshift({ id: `${Date.now()}`, occasion: resultContext?.occasion || occasion, recipient: resultContext?.recipient || recipient, mainId: current.main.id, supportId: current.support?.id || null, color: resultContext?.color || '', size: resultContext?.size || size, savedAt: new Date().toISOString() });
    setBook(writeGiftBook(next));
    setActionsDone((previous) => ({ ...previous, save: true }));
  }

  function clearBook() {
    const empty = { recognitions: [], favorites: [], bouquets: [] };
    setBook(writeGiftBook(empty));
  }

  function recommendWithFlower(speciesId) {
    const entry = GIFT_SPECIES.find((item) => item.species_id === speciesId);
    if (!entry) {
      setTab('gift');
      setError('Loài này đã được lưu, nhưng hiện chưa có dữ liệu để gợi ý bó phù hợp.');
      return;
    }
    const nextOccasion = [occasion, ...entry.occasions].find((candidate) => isCompatiblePreferredFlower(entry, candidate));
    if (!nextOccasion) {
      setTab('gift');
      setError('Dữ liệu hiện tại chưa ghi nhận dịp phù hợp để tặng loài hoa này.');
      return;
    }
    const nextColor = color || entry.colors[0]?.match(/#[0-9a-f]{6}/i)?.[0] || '';
    setTab('gift');
    setError('');
    setPreferredFlowerId(speciesId);
    setActionsDone({});
    setOccasion(nextOccasion);
    setIntent(intentForOccasion(nextOccasion)?.id || '');
    setColor(nextColor);
    void getSuggestions(null, { occasion: nextOccasion, recipient, color: nextColor, size, preferredFlowerId: speciesId });
  }

  function removeFavorite(speciesId) {
    setBook(rememberFavorite(speciesId));
  }

  const recommendationNames = (entry) => entry?.[0] === 'mainId' ? SPECIES[entry[1]]?.name_vi : SPECIES[entry?.[1]]?.name_vi;

  return <main className="gift-page section-wrap">
    <header className="gift-hero"><a className="back-home" href="/#home">← Về khu vườn</a><span className="eyebrow">CHỌN HOA CÓ Ý NGHĨA</span><h1>Một bó hoa,<br/><em>đúng điều muốn nói.</em></h1><p>Chọn dịp và người nhận để khám phá gợi ý bó hoa, lời nhắn và lưu lại trong Sổ hoa của bạn.</p><span className="gift-disclaimer">Gợi ý dựa trên dữ liệu ý nghĩa hoa · chưa thay thế tư vấn phong tục địa phương</span></header>
    <div className="gift-tabs" role="tablist" aria-label="Chọn bó hoa và sổ hoa"><button type="button" role="tab" aria-selected={tab === 'gift'} className={tab === 'gift' ? 'active' : ''} onClick={() => setTab('gift')}>Chọn bó hoa</button><button type="button" role="tab" aria-selected={tab === 'book'} className={tab === 'book' ? 'active' : ''} onClick={() => setTab('book')}>Sổ hoa của tôi <span>{book.bouquets.length + book.favorites.length}</span></button></div>
    {tab === 'gift' ? <>
      <form className="gift-form" onSubmit={getSuggestions}>
        <div className="gift-builder-heading"><span className="gift-builder-step">01</span><div><b>Thiết kế bó hoa</b><small>Bắt đầu từ dịp tặng, rồi chọn sắc màu của riêng bạn.</small></div><span className="gift-builder-count">4 lựa chọn</span></div>
        <fieldset className="gift-intents"><legend>Bạn muốn gửi gắm điều gì?</legend><div>{GIFT_INTENTS.map((option) => <button key={option.id} type="button" className={intent === option.id ? 'active' : ''} aria-pressed={intent === option.id} onClick={() => chooseIntent(option)}><span aria-hidden="true">{option.icon}</span>{option.title}</button>)}</div></fieldset>
        <label className="gift-field"><span className="gift-field-label"><i>01</i><b>Dịp</b></span><select value={occasion} onChange={(event) => chooseOccasion(event.target.value)}>{OCCASIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="gift-field"><span className="gift-field-label"><i>02</i><b>Người nhận</b></span><select value={recipient} onChange={(event) => setRecipient(event.target.value)}>{RECIPIENTS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="gift-field"><span className="gift-field-label"><i>03</i><b>Màu yêu thích</b></span><input className="gift-color-input" type="text" list="gift-color-suggestions" value={color} onChange={(event) => setColor(event.target.value)} placeholder="Ví dụ: hồng pastel, xanh lá, #FF6F91" aria-describedby="gift-color-help"/><datalist id="gift-color-suggestions"><option value="Hồng pastel"/><option value="Đỏ"/><option value="Cam đào"/><option value="Vàng nắng"/><option value="Tím lavender"/><option value="Xanh lá mint"/><option value="Xanh dương"/><option value="Trắng kem"/></datalist><small id="gift-color-help">Gõ tên màu hoặc mã HEX; hệ thống ưu tiên hoa có tông màu gần nhất.</small></label>
        <label className="gift-field"><span className="gift-field-label"><i>04</i><b>Quy mô</b></span><select value={size} onChange={(event) => setSize(event.target.value)}>{SIZES.map((item) => <option key={item}>{item}</option>)}</select><small>{size === 'nhỏ' ? '5' : size === 'vừa' ? '9' : '15'} cành · không hiển thị giá</small></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Đang chọn hoa phù hợp…' : 'Gợi ý bó hoa'} <span>↗</span></button>
      </form>
      {preferredFlowerId && SPECIES[preferredFlowerId] && <p className="gift-preferred-flower">Hoa chính đã chọn: <b>{SPECIES[preferredFlowerId].name_vi}</b><button type="button" onClick={clearPreferredFlower}>Bỏ lựa chọn</button></p>}
      {error && <div className="friendly-error" role="alert"><p>{error}</p><button className="button" type="button" onClick={() => getSuggestions({ preventDefault() {} })}>Thử lại</button></div>}
      {result && <>
        <p className="gift-result-context">Gợi ý này dành cho <b>{resultContext?.recipient || result.recipient}</b> dịp <b>{resultContext?.occasion || result.occasion}</b>{resultContext?.color ? ` · màu ${resultContext.color}` : ''} · bó cỡ <b>{resultContext?.size || result.size}</b>. Đổi lựa chọn phía trên rồi bấm “Gợi ý bó hoa” để cập nhật.</p>{result.color_note && <p className="gift-color-note" role="status">{result.color_note}</p>}
        <div className="gift-suggestion-tabs" role="tablist" aria-label="Ba gợi ý bó hoa">{result.suggestions.map((suggestion, index) => <button type="button" key={suggestion.id} className={selected === index ? 'active' : ''} onClick={() => { setSelected(index); setGreetings(null); setGreetingEdit(''); setShowGreetingComposer(false); setShareNotice(''); setActionsDone({}); }}>Gợi ý 0{index + 1}<span>{suggestion.main.name_vi}</span></button>)}</div>
        {current && <article className="bouquet-card">
          <div className="bouquet-photo-composition" aria-label={`Ảnh gợi ý bó ${current.main.name_vi}`}>
            <img className="bouquet-photo-main" src={imageFor(current.main)} alt={current.main.name_vi} loading="lazy"/>
            {current.support && <img className="bouquet-photo-support" src={imageFor(current.support)} alt={current.support.name_vi} loading="lazy"/>}
            {current.accent && <img className="bouquet-photo-accent" src={imageFor(current.accent)} alt={current.accent.name_vi} loading="lazy"/>}
            <span className="bouquet-ribbon">{current.stem_count} cành · {resultContext?.size || size}</span>
          </div>
          <div className="bouquet-copy"><span className="eyebrow">{result.label.toLocaleUpperCase('vi')}</span><h2>{current.main.name_vi}<small> + {current.support?.name_vi || 'hoa phụ theo mùa'}{current.accent ? ` + ${current.accent.name_vi}` : ''}</small></h2><p className="bouquet-meaning">{current.meaning}</p><section className="bouquet-recipe" aria-label="Chi tiết bó hoa"><h3>Bó này gồm</h3><ul>{(current.mix || [{ role: 'Hoa chính', flower: current.main, stems: current.support ? Math.ceil(current.stem_count * .65) : current.stem_count }, ...(current.support && current.stem_count > 1 ? [{ role: 'Hoa phụ', flower: current.support, stems: current.stem_count - Math.ceil(current.stem_count * .65) }] : [])]).map((part) => <li key={`${part.role}-${part.flower.id}`}><span className="recipe-flower-dot" style={{ background: part.flower.color }}/><span><b>{part.role}</b><small>{part.flower.name_vi}</small></span><strong>{part.stems} cành</strong></li>)}</ul><p>{current.foliage} Tổng cộng {current.stem_count} cành.</p></section><h3>Vì sao gợi ý bó này?</h3><ul>{current.reason.map((reason) => <li key={reason}>{reason}</li>)}</ul><div className="bouquet-palette" aria-label="Bảng màu bó hoa">{current.palette.filter(Boolean).map((value, paletteIndex) => <i key={`${value}-${paletteIndex}`} style={{ background: value }} title={value}/>)}</div>{current.caution.length > 0 && <p className="bouquet-caution"><b>Lưu ý:</b> {current.caution.join(' ')}</p>}<p className="draft-note">Dữ liệu ý nghĩa hoa và dịp tặng hiện là bản nháp chưa xác minh.</p>
            <div className="bouquet-actions"><button type="button" className={`primary-button ${actionsDone.save ? 'is-complete' : ''}`} aria-pressed={Boolean(actionsDone.save)} onClick={saveBouquet}>{actionsDone.save ? '✓ Đã lưu bó hoa' : 'Lưu bó vào Sổ hoa'}</button><button type="button" className={`button ${actionsDone.ask ? 'is-complete' : ''}`} aria-pressed={Boolean(actionsDone.ask)} onClick={() => { const question = `Mình muốn tặng bó ${current.main.name_vi}${current.support ? ` và ${current.support.name_vi}` : ''} cho ${resultContext?.recipient || recipient} dịp ${resultContext?.occasion || occasion}. Ý nghĩa và lưu ý văn hoá nào cần biết?`; openGardenerWith(question); setActionsDone((previous) => ({ ...previous, ask: true })); }}>{actionsDone.ask ? '✓ Đã mở Cô làm vườn' : 'Hỏi cô làm vườn về bó này'}</button><button type="button" className={`button ${actionsDone.greeting ? 'is-complete' : ''}`} aria-pressed={Boolean(actionsDone.greeting)} onClick={() => { setShowGreetingComposer(true); setGreetings(null); setGreetingError(''); setActionsDone((previous) => ({ ...previous, greeting: true })); }} disabled={greetingBusy}>{actionsDone.greeting ? '✓ Lời nhắn riêng' : 'AI viết lời nhắn riêng'}</button><button type="button" className={`button share-bouquet-button ${actionsDone.share ? 'is-complete' : ''}`} aria-pressed={Boolean(actionsDone.share)} onClick={shareCurrentBouquet} disabled={shareBusy}>{shareBusy ? 'Đang tạo ảnh…' : actionsDone.share ? '✓ Đã chia sẻ bó hoa' : 'Chia sẻ bó hoa'}</button></div>
            {shareNotice && <p className="gift-share-status" role="status">{shareNotice}</p>}{shareError && <p className="gift-share-error" role="alert">{shareError}</p>}
            {showGreetingComposer && <section className="gift-greetings"><span className="eyebrow">VIẾT LỜI NHẮN THEO CÂU CHUYỆN CỦA BẠN</span><p>AI sẽ dựa trên bó hoa, dịp tặng và hoàn cảnh bạn kể để viết một lời riêng. Không cần nhập tên người gửi hay người nhận.</p><label>Hoàn cảnh muốn nhắn<textarea className="gift-situation" value={greetingSituation} onChange={(event) => setGreetingSituation(event.target.value)} placeholder="Ví dụ: Mình muốn xin lỗi vì đã lỡ quên ngày kỷ niệm; lời nhắn nên chân thành, không quá sướt mướt." maxLength={500}/></label><label>Giọng điệu<select value={greetingTone} onChange={(event) => setGreetingTone(event.target.value)}><option>Chân thành, tự nhiên</option><option>Ấm áp, trìu mến</option><option>Trang trọng, tinh tế</option><option>Vui vẻ, dí dỏm nhẹ</option></select></label><button className="primary-button" type="button" onClick={generateGreetings} disabled={greetingBusy}>{greetingBusy ? 'AI đang viết riêng cho bạn…' : 'Tạo lời nhắn bằng AI'}</button>{greetingError && <p className="friendly-error" role="alert">{greetingError}</p>}{greetings && <article className="gift-message"><div><b>{greetings.source}</b>{greetings.note && <p className="draft-note">AI chưa kết nối được nên nội dung dưới đây là câu dự phòng, không phải lời AI tạo. {greetings.note}</p>}<textarea aria-label="Lời nhắn cá nhân hoá" value={greetingEdit} maxLength={500} onChange={(event) => setGreetingEdit(event.target.value)}/></div><div className="gift-message-actions"><button type="button" className="button" disabled={!greetingEdit.trim()} onClick={() => saveGreetingCard(greetingEdit.trim(), current.main)}>Tải thiệp PNG</button><GiftQrPanel payload={{ speciesId: current.main.id, message: greetingEdit.trim(), recipient: resultContext?.recipient || recipient, occasion: resultContext?.occasion || occasion }}/></div></article>}</section>}
          </div>
        </article>}
      </>}
      {!result && <div className="gift-empty"><span>✿</span><h2>Chọn điều bạn muốn gửi gắm</h2><p>Kết quả dùng luật và dữ liệu ý nghĩa hoa đã lưu trong dự án, không gọi thêm mô hình AI.</p><button className="primary-button" type="button" disabled={busy} onClick={() => getSuggestions({ preventDefault() {} })}>{busy ? 'Đang phối gợi ý…' : 'Xem gợi ý mẫu'} <span>→</span></button></div>}
    </> : <section className="giftbook-panel">
      <header><div><span className="eyebrow">LƯU CỤC BỘ TRÊN THIẾT BỊ</span><h2>Sổ hoa của tôi</h2><p>Không cần đăng nhập. Dữ liệu chỉ nằm trong trình duyệt này.</p></div><button className="button danger-button" type="button" onClick={clearBook} disabled={!book.recognitions.length && !book.favorites.length && !book.bouquets.length}>Xoá dữ liệu</button></header>
      <div className="giftbook-stats"><div><b>{uniqueRecognized}</b><span>loài đã nhận diện</span></div><div><b>{book.favorites.length}</b><span>hoa yêu thích</span></div><div><b>{book.bouquets.length}</b><span>bó đã phối</span></div></div>
      <h3>Bó hoa đã lưu</h3>{book.bouquets.length ? <div className="giftbook-list">{book.bouquets.map((bouquet) => <article key={bouquet.id}><span className="giftbook-icon">✿</span><div><b>{recommendationNames(['mainId', bouquet.mainId])}{bouquet.supportId ? ` + ${SPECIES[bouquet.supportId]?.name_vi || ''}` : ''}</b><small>{bouquet.occasion} · {bouquet.recipient} · {bouquet.size}</small></div><button className="text-link" type="button" onClick={() => { setTab('gift'); void getSuggestions(null, { occasion: bouquet.occasion, recipient: bouquet.recipient, color: bouquet.color || '', size: bouquet.size, preferredFlowerId: bouquet.mainId }); }}>Phối lại →</button></article>)}</div> : <p className="muted">Chưa có bó hoa nào được lưu.</p>}
      <h3>Hoa nhận diện gần đây</h3>{recentRecognized.length ? <div className="giftbook-list giftbook-flowers">{recentRecognized.map((item) => { const flower = SPECIES[item.speciesId]; if (!flower) return null; const date = item.at && !Number.isNaN(Date.parse(item.at)) ? new Date(item.at).toLocaleDateString('vi-VN') : 'Chưa rõ ngày'; return <article key={item.speciesId}><img src={imageFor(flower)} alt="" loading="lazy"/><div><b>{flower.name_vi}</b><small>Nhận diện ngày {date}</small></div>{GIFT_SPECIES.some((entry) => entry.species_id === item.speciesId) ? <button className="text-link" type="button" onClick={() => recommendWithFlower(item.speciesId)}>Gợi ý bó →</button> : <a className="text-link" href={`/bach-khoa/${encodeURIComponent(item.speciesId)}`}>Khám phá →</a>}</article>; })}</div> : <p className="muted">Hoa bạn nhận diện sẽ xuất hiện ở đây.</p>}
      <h3>Hoa yêu thích</h3>{book.favorites.length ? <div className="giftbook-list giftbook-flowers">{book.favorites.map((id) => { const flower = SPECIES[id]; if (!flower) return null; return <article key={id}><img src={imageFor(flower)} alt="" loading="lazy"/><div><b>{flower.name_vi}</b><small>Đã lưu trong Sổ hoa</small></div>{GIFT_SPECIES.some((entry) => entry.species_id === id) ? <button className="text-link" type="button" onClick={() => recommendWithFlower(id)}>Gợi ý bó →</button> : <a className="text-link" href={`/bach-khoa/${encodeURIComponent(id)}`}>Khám phá →</a>}<button className="giftbook-remove" type="button" aria-label={`Bỏ ${flower.name_vi} khỏi yêu thích`} onClick={() => removeFavorite(id)}>×</button></article>; })}</div> : <p className="muted">Lưu hoa yêu thích từ kết quả nhận diện.</p>}
    </section>}
  </main>;
}
