import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import species from '../../data/species.json';
import displayImageData from '../../data/display_images.json';
import { API_BASE } from './api.js';
import { createSpeciesConfig } from './garden/species/index.js';

const FlowerViewer = lazy(() => import('./garden/RoseViewer.jsx'));
const normalizeText = (value) => typeof value === 'string' ? value.normalize('NFC') : value;
const normalizeRecord = (value) => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeText(item)]));
const pickerItems = species.map((sourceRecord) => {
  const record = normalizeRecord(sourceRecord);
  const config = normalizeRecord(createSpeciesConfig(record));
  return {
    ...config,
    nameVi: normalizeText(config.nameVi),
    meaning: normalizeText(config.meaning),
    care: normalizeText(config.care),
    bloomSeason: normalizeText(config.bloomSeason),
    record,
    icon: record?.icon || '✿',
    fallbackPhoto: Boolean(config.flowerTemplateFallback),
    templateConfidence: config.flowerTemplateConfidence ?? 0,
    image: displayImageData.images[record.display_image_key || record.id]?.url || `${API_BASE}/api/species/${encodeURIComponent(record.id)}/image`,
  };
});

export default function InteractiveGarden() {
  const [selectedId, setSelectedId] = useState(pickerItems[0]?.id || '');
  const selected = pickerItems.find((item) => item.id === selectedId) || pickerItems[0];
  const [open, setOpen] = useState(selected?.open ?? 0.8);
  const [windEnabled, setWindEnabled] = useState(false);
  const [resetRequested, setResetRequested] = useState(0);
  const [viewerReady, setViewerReady] = useState(false);
  const [query, setQuery] = useState('');
  const viewerWrapRef = useRef(null);

  useEffect(() => {
    const node = viewerWrapRef.current;
    if (!node || viewerReady) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setViewerReady(true); observer.disconnect(); }
    }, { rootMargin: '180px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [viewerReady]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    if (!normalized) return pickerItems;
    return pickerItems.filter((flower) => `${flower.record.name_vi} ${flower.record.name_en || ''} ${flower.scientificName}`.toLocaleLowerCase('vi').includes(normalized));
  }, [query]);

  if (!selected) return null;
  return <section className="garden3d-section section-wrap rose-studio" id="vuon-3d">
    <div className="garden3d-heading rose-studio-heading">
      <div><span className="eyebrow">MỘT CHẬU HOA · NHIỀU DÁNG NỞ</span><h2>Chậu hoa<br/><em>của riêng bạn.</em></h2></div>
      <p>Chọn loài để xem mô hình 3D được dựng hoàn toàn bằng hình học. Kéo để xoay · cuộn để phóng to.</p>
    </div>

    <div className="rose-picker" aria-label="Chọn loài hoa">
      <div className="rose-picker-heading"><span>CHỌN LOÀI HOA</span><small>{visibleItems.length} / {pickerItems.length} loài trong dữ liệu</small></div>
      <label className="rose-picker-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên Việt hoặc quốc tế…" aria-label="Tìm loài hoa"/><button type="button" onClick={() => setQuery('')} aria-label="Xóa tìm kiếm" disabled={!query}>×</button></label>
      <div className="rose-picker-row">
        {visibleItems.map((flower) => <button key={flower.id} type="button" className={`rose-picker-card${flower.id === selectedId ? ' is-selected' : ''}`} aria-pressed={flower.id === selectedId} onClick={() => { setSelectedId(flower.id); setOpen(flower.open ?? 0.8); }}>
          <span className="rose-picker-art" style={{ '--flower-accent': flower.record.color || flower.color }}>
            <img src={flower.image} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.hidden = true; }}/>
          </span>
          <span><small>{flower.scientificName}</small><b>{flower.nameVi}</b></span>
          <span className="rose-picker-check" aria-hidden="true">✓</span>
        </button>)}
      </div>
    </div>

    <div className="garden3d-shell rose-studio-shell">
      <div className="garden3d-canvas-wrap rose-viewer-wrap" ref={viewerWrapRef} style={{ '--flower-wash': selected.record.color || selected.color }}>
        <div className="rose-viewer-backdrop" aria-hidden="true"/>
        {selected.fallbackPhoto ? <div className="rose-photo-fallback"><img src={selected.image} alt={`${selected.nameVi} · ảnh thật`} loading="lazy" decoding="async"/><span>ẢNH THẬT · MẪU 3D CHƯA ĐƯỢC DUYỆT</span></div> : viewerReady ? <Suspense fallback={<div className="garden3d-fallback">Đang dựng {selected.nameVi.toLowerCase()}…</div>}>
          <FlowerViewer speciesId={selected.id} speciesRecord={selected.record} open={open} windEnabled={windEnabled} resetKey={resetRequested} speciesName={selected.nameVi} scientificName={selected.scientificName} onWindPerformanceFallback={() => setWindEnabled(false)}/>
        </Suspense> : <div className="garden3d-fallback">Mô hình sẽ được dựng khi bạn đến gần…</div>}
      </div>
      <aside className="garden3d-controls rose-studio-controls">
        <span className="eyebrow">{selected.scientificName}</span>
        <h3>{selected.nameVi}</h3>
        <p className="rose-scientific">{selected.record.name_en}</p>
        <div className="rose-info-line"><small>Ý NGHĨA</small><p>{selected.meaning || selected.record.meaning}</p></div>
        <div className="rose-info-line"><small>MÙA NỞ</small><p>{selected.bloomSeason || selected.record.bloom_season}</p></div>
        <div className="rose-info-line rose-care"><small>CHĂM SÓC</small><p>{selected.care}</p></div>

        <label className="rose-open-control" htmlFor="flower-open">
          <span><b>Độ nở</b><strong>{open < 0.2 ? 'Nụ' : open > 0.82 ? 'Nở rộ' : 'Đang hé'}</strong></span>
          <input id="flower-open" type="range" min="0" max="1" step="0.01" value={open} onChange={(event) => setOpen(Number(event.target.value))} aria-label={`Độ nở của ${selected.nameVi}`}/>
          <span className="rose-open-ends"><small>Nụ</small><small>Nở rộ</small></span>
        </label>

        <button type="button" className={`rose-wind-toggle${windEnabled ? ' is-on' : ''}`} aria-pressed={windEnabled} onClick={() => setWindEnabled((value) => !value)}><span className="rose-wind-icon">≈</span><span>Gió nhẹ</span><b>{windEnabled ? 'Bật' : 'Tắt'}</b></button>
        <button type="button" className="garden3d-reset rose-reset" onClick={() => setResetRequested((value) => value + 1)}><span>↺</span> Đưa góc nhìn về ban đầu</button>
      </aside>
    </div>
  </section>;
}
