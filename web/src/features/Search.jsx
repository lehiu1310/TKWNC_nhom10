import { useState } from 'react';
import { API_BASE, friendlyFailure, postImage, postJson } from '../api.js';
import ImagePicker from './ImagePicker.jsx';
import speciesData from '../../../data/species.json';

const SAMPLES = speciesData.filter((flower) => flower.sample_order).sort((a, b) => a.sample_order - b.sample_order);

export default function Search() {
  const [query, setQuery] = useState('một vườn hoa hướng dương rực nắng');
  const [label, setLabel] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const [loadedImages, setLoadedImages] = useState(() => new Set());
  async function run(action) {
    setLoadedImages(new Set());
    setState({ status: 'loading' });
    try { const data = await action(); setState({ status: 'ok', results: data.results, queryUsed: data.query_used || null }); }
    catch (err) { setState({ status: 'error', error: friendlyFailure(err), retry: action }); }
  }
  const filters = label.trim() ? { label: label.trim() } : {};
  const moodHint = (() => {
    const value = query.toLocaleLowerCase('vi');
    if (/xin lỗi|làm hoà|giận/.test(value)) return 'Nếu tìm hoa để làm hoà, bạn có thể cân nhắc một bó nhỏ và lời nhắn chân thành; ý nghĩa hoa chỉ là gợi ý văn hoá.';
    if (/cảm ơn|biết ơn|thầy|cô/.test(value)) return 'Đang tìm hoa để cảm ơn? Hướng dương, cẩm chướng hoặc hoa đồng tiền có trong danh sách gợi ý; hãy kiểm tra phong tục và sở thích người nhận.';
    if (/tặng|sinh nhật|valentine|kỷ niệm|người yêu/.test(value)) return 'Bạn có thể chọn dịp, người nhận và màu yêu thích để nhận gợi ý bó hoa phù hợp.';
    if (/chia buồn|viếng|tang/.test(value)) return 'Với dịp chia buồn, nên hỏi gia đình về phong tục và màu sắc phù hợp trước khi đặt hoa.';
    return '';
  })();
  function submit(e) { e.preventDefault(); if (query.trim()) run(() => postJson('/api/search/text', { query: query.trim(), k: 12, ...filters })); }
  return <section>
    <h2>Tìm một bức ảnh bạn hình dung</h2><p className="muted">Mô tả bằng lời hoặc gửi một ảnh mẫu để tìm những khung hình gần nhất trong album. Điểm tương đồng giúp so sánh ảnh, không phải xác suất nhận diện chính xác.</p>
    <form className="row" onSubmit={submit}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ví dụ: cúc trắng trong nắng sớm" aria-label="Mô tả ảnh cần tìm"/><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lọc nhãn (vd. roses)" aria-label="Lọc kết quả theo nhãn"/><button className="button" type="submit" disabled={state.status === 'loading'}>Tìm ảnh <span>→</span></button><ImagePicker label="Tìm bằng ảnh" samples={SAMPLES} onChange={(file) => run(() => postImage('/api/search/image', file, { k: 12, ...filters }))}/></form>
    {moodHint && <p className="gift-search-hint">✿ {moodHint} <a href="/tang-hoa">Khám phá bó hoa gửi thương ↗</a></p>}
    {state.status === 'idle' && <div className="empty-state empty-search"><span>▦</span><p>Kết quả ảnh thật trong kho hoa sẽ xếp ở đây.</p></div>}
    {state.status === 'loading' && <div className="search-skeletons">{Array.from({ length: 6 }, (_, i) => <div className="search-skeleton" key={i}/>)}</div>}
    {state.status === 'error' && <div className="friendly-error" role="alert"><p>Album chưa tìm được ảnh. {state.error}</p><button type="button" className="button" onClick={() => state.retry?.()}>Thử lại</button></div>}
    {state.status === 'ok' && (state.results.length ? <>{state.queryUsed && <p className="result-meta">Đang tìm: <strong>{state.queryUsed}</strong></p>}<p className="result-meta">ResNet + FAISS · {state.results.length} ảnh phù hợp · điểm tương đồng</p><div className="gallery gallery-masonry">{state.results.map((r, i) => <figure data-tilt key={r.id} className={`tilt-card ${loadedImages.has(r.id) ? 'photo-loaded' : ''}`} style={{ '--photo-i': i }}><div className="gallery-photo"><img src={`${API_BASE}${r.url}`} alt={r.label} loading="lazy" onLoad={() => setLoadedImages((current) => new Set(current).add(r.id))} onError={() => setLoadedImages((current) => new Set(current).add(r.id))}/><span className="similarity-badge" aria-label={`Độ tương đồng ${(r.score * 100).toFixed(0)} phần trăm`}>{(r.score * 100).toFixed(0)}<small>%</small></span></div><figcaption><span>{r.label}</span></figcaption></figure>)}</div></> : <p className="empty-state">Chưa có ảnh phù hợp trong album. Hãy thử mô tả khác.</p>)}
  </section>;
}
