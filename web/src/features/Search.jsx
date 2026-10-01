import { useState } from 'react';
import { API_BASE, friendlyFailure, postImage, postJson } from '../api.js';
import ImagePicker from './ImagePicker.jsx';

export default function Search() {
  const [query, setQuery] = useState('một vườn hoa hướng dương rực nắng');
  const [label, setLabel] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const [loadedImages, setLoadedImages] = useState(() => new Set());
  async function run(promise) {
    setLoadedImages(new Set());
    setState({ status: 'loading' });
    try { const data = await promise; setState({ status: 'ok', results: data.results }); }
    catch (err) { setState({ status: 'error', error: friendlyFailure(err) }); }
  }
  const filters = label.trim() ? { label: label.trim() } : {};
  function submit(e) { e.preventDefault(); if (query.trim()) run(postJson('/api/search/text', { query: query.trim(), k: 12, ...filters })); }
  return <section>
    <h2>Tìm một bức ảnh bạn hình dung</h2><p className="muted">Mô tả bằng lời hoặc gửi một ảnh mẫu để tìm những khung hình gần nhất trong album. Điểm tương đồng giúp so sánh ảnh, không phải xác suất nhận diện chính xác.</p>
    <form className="row" onSubmit={submit}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ví dụ: cúc trắng trong nắng sớm" aria-label="Mô tả ảnh cần tìm"/><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lọc nhãn (vd. roses)" aria-label="Lọc kết quả theo nhãn"/><button className="button" type="submit" disabled={state.status === 'loading'}>Tìm ảnh <span>→</span></button><ImagePicker label="Tìm bằng ảnh" onChange={(file) => run(postImage('/api/search/image', file, { k: 12, ...filters }))}/></form>
    {state.status === 'idle' && <div className="empty-state empty-search"><span>▦</span><p>Kết quả ảnh thật trong kho hoa sẽ xếp ở đây.</p></div>}
    {state.status === 'loading' && <div className="search-skeletons">{Array.from({ length: 6 }, (_, i) => <div className="search-skeleton" key={i}/>)}</div>}
    {state.status === 'error' && <p className="error">Album chưa tìm được ảnh. {state.error}</p>}
    {state.status === 'ok' && (state.results.length ? <><p className="result-meta">CLIP + FAISS · {state.results.length} ảnh phù hợp · điểm tương đồng</p><div className="gallery gallery-masonry">{state.results.map((r, i) => <figure data-tilt key={r.id} className={`tilt-card ${loadedImages.has(r.id) ? 'photo-loaded' : ''}`} style={{ '--photo-i': i }}><div className="gallery-photo"><img src={`${API_BASE}${r.url}`} alt={r.label} loading="lazy" onLoad={() => setLoadedImages((current) => new Set(current).add(r.id))} onError={() => setLoadedImages((current) => new Set(current).add(r.id))}/><span className="similarity-badge" aria-label={`Độ tương đồng ${(r.score * 100).toFixed(0)} phần trăm`}>{(r.score * 100).toFixed(0)}<small>%</small></span></div><figcaption><span>{r.label}</span></figcaption></figure>)}</div></> : <p className="empty-state">Chưa có ảnh phù hợp trong album. Hãy thử mô tả khác.</p>)}
  </section>;
}
