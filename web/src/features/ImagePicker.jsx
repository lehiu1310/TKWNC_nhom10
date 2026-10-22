import { useEffect, useRef, useState } from 'react';
import { fetchSampleImage } from '../api.js';

// Chọn ảnh + xem trước. Giải phóng object URL khi đổi ảnh để tránh rò bộ nhớ.
const FLOWER_ICONS = { daisy: '✿', dandelion: '❋', roses: '❀', sunflowers: '✺', tulips: '❁' };

export default function ImagePicker({ onChange, label = 'Chọn ảnh', result = null, samples = [] }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const [showPetals, setShowPetals] = useState(false);
  const [sampleLoading, setSampleLoading] = useState('');
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  useEffect(() => {
    setShowPetals(false);
    if (!result || result.score <= 0.8 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    setShowPetals(true);
    const timeout = window.setTimeout(() => setShowPetals(false), 1250);
    return () => window.clearTimeout(timeout);
  }, [result?.key, result?.score]);

  function choose(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Hãy chọn tệp ảnh JPG, PNG hoặc WEBP nhé.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Ảnh cần nhỏ hơn 8 MB.'); return; }
    setError('');
    const previewUrl = URL.createObjectURL(file);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return previewUrl; });
    onChange(file, previewUrl);
  }

  async function chooseSample(sample) {
    if (sampleLoading) return;
    setSampleLoading(sample.id);
    setError('');
    try {
      if (sample.assetUrl) {
        const response = await fetch(sample.assetUrl);
        if (!response.ok) throw new Error('sample unavailable');
        const blob = await response.blob();
        choose(new File([blob], `${sample.id}-mau.jpg`, { type: blob.type || 'image/jpeg' }));
      } else choose(await fetchSampleImage(sample));
    }
    catch { setError('Chưa tải được ảnh mẫu. Bạn thử lại sau một chút nhé.'); }
    finally { setSampleLoading(''); }
  }

  return (
    <div className="picker">
      <button type="button" className="drop-zone" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files?.[0]); }}>
        <span><b>{label}</b>Kéo thả ảnh vào đây hoặc chạm để chọn · JPG, PNG, WEBP · tối đa 8 MB</span>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      </button>
      {samples.length > 0 && <div className="sample-images" aria-label="Ảnh mẫu chạy thử">
        <span className="sample-images-title">Thử nhanh với ảnh hoa</span>
        <div className="sample-images-list">{samples.map((sample) => <button type="button" className="sample-image-button" key={sample.id} onClick={() => chooseSample(sample)} disabled={Boolean(sampleLoading)} aria-label={`Chạy thử ${sample.name_vi}`}>
          <img src={sample.assetUrl || `/images/species/${encodeURIComponent(sample.id)}.webp`} alt="" loading="lazy"/>
          <span>{sampleLoading === sample.id ? 'Đang tải…' : sample.name_vi}</span>
        </button>)}</div>
      </div>}
      {error && <p className="error">{error}</p>}
      {preview && <div className={`preview-wrap${result ? ' has-result' : ''}`} style={result ? { '--top-color': result.species.color } : undefined}>
        <img src={preview} alt="Ảnh đầu vào" className="preview" />
        {result && <span className="preview-result-badge" aria-label={`${result.species.name_vi}, ${(result.score * 100).toFixed(1)} phần trăm`}><i aria-hidden="true">{FLOWER_ICONS[result.species.id] || '✿'}</i>{(result.score * 100).toFixed(1)}%</span>}
        {showPetals && <span className="preview-petal-burst" aria-hidden="true">{[1, 2, 3, 4, 5].map((petal) => <i key={petal} className={`petal-flight petal-flight-${petal}`} style={{ '--petal-color': result.species.color }}/>)}</span>}
      </div>}
    </div>
  );
}
