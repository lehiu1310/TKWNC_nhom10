import { useEffect, useRef, useState } from 'react';
import { friendlyFailure, postImage } from '../api.js';
import ImagePicker from './ImagePicker.jsx';

const LABEL_COLORS = {
  person: '#FF6F91', 'potted plant': '#5BAE6B', vase: '#9B7EDE', bird: '#FFC93C',
  cat: '#FF8A5B', dog: '#FF8A5B', bench: '#9B7EDE', umbrella: '#FF6F91',
};
const PALETTE = ['#FF6F91', '#FF8A5B', '#9B7EDE', '#5BAE6B', '#FFC93C'];
function labelColor(label) {
  const key = label.toLowerCase();
  if (LABEL_COLORS[key]) return LABEL_COLORS[key];
  return PALETTE[[...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTE.length];
}

export default function Detect() {
  const [state, setState] = useState({ status: 'idle' });
  const [imagePreview, setImagePreview] = useState('');
  const [imageSize, setImageSize] = useState(null);
  const [selected, setSelected] = useState(null);
  const canvasRef = useRef(null);

  async function run(file, previewUrl) {
    setImagePreview(previewUrl);
    setImageSize(null);
    setSelected(null);
    setState({ status: 'loading' });
    try { setState({ status: 'ok', data: await postImage('/api/detect', file, { conf: 0.25 }) }); }
    catch (err) { setState({ status: 'error', error: friendlyFailure(err) }); }
  }

  useEffect(() => {
    if (!selected || !imagePreview || !canvasRef.current) return;
    const image = new Image();
    image.onload = () => {
      const [rawX1, rawY1, rawX2, rawY2] = selected.box_xyxy;
      const padX = (rawX2 - rawX1) * 0.18;
      const padY = (rawY2 - rawY1) * 0.18;
      const x1 = Math.max(0, rawX1 - padX); const y1 = Math.max(0, rawY1 - padY);
      const x2 = Math.min(image.naturalWidth, rawX2 + padX); const y2 = Math.min(image.naturalHeight, rawY2 + padY);
      const width = Math.max(1, x2 - x1); const height = Math.max(1, y2 - y1);
      const scale = Math.min(1, 1200 / width, 850 / height);
      const canvas = canvasRef.current;
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      canvas.getContext('2d')?.drawImage(image, x1, y1, width, height, 0, 0, canvas.width, canvas.height);
    };
    image.src = imagePreview;
  }, [selected, imagePreview]);

  return <section className="grid">
    <div><h2>Tìm vật thể trong ảnh</h2><p className="muted">Tải ảnh lên để xem các vật thể được khoanh vùng, kèm tên gọi và độ tin cậy.</p><ImagePicker label="Chọn ảnh để tìm vật thể" onChange={run}/><p className="search-hint">Bộ nhận diện tìm các nhóm vật thể phổ thông, chưa được huấn luyện riêng cho từng loài hoa. Vì vậy, hoa có thể hiện thành “cây trồng trong chậu” hoặc chưa được phát hiện.</p></div>
    <div className="result-panel"><span className="feature-subtitle">BẢN ĐỒ KHU VƯỜN</span>
      {state.status === 'idle' && <div className="empty-state"><span>◎</span><p>Khung ảnh và các vùng phát hiện sẽ hiện ở đây.</p></div>}
      {state.status === 'loading' && <><p className="loading-skeleton"/><p className="loading-skeleton"/><p className="muted">AI đang tìm các đối tượng…</p></>}
      {state.status === 'error' && <p className="error">Chưa phân tích được ảnh. {state.error}</p>}
      {state.status === 'ok' && <>
        {imagePreview && <div className="detect-stage" style={imageSize ? { aspectRatio: `${imageSize.width}/${imageSize.height}` } : undefined}>
          <img src={imagePreview} alt="Ảnh gốc với các vùng phát hiện" onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}/>
          {imageSize && state.data.detections.map((detection, index) => {
            const [x1, y1, x2, y2] = detection.box_xyxy;
            const color = labelColor(detection.label);
            return <button key={`${detection.label}-${index}`} type="button" className="detect-box" style={{ left: `${x1 / imageSize.width * 100}%`, top: `${y1 / imageSize.height * 100}%`, width: `${(x2 - x1) / imageSize.width * 100}%`, height: `${(y2 - y1) / imageSize.height * 100}%`, '--box-color': color, '--stagger': `${index * 85}ms` }} onClick={() => setSelected(detection)} aria-label={`Phóng to ${detection.label}, ${(detection.score * 100).toFixed(0)} phần trăm`}><span>{detection.label} · {(detection.score * 100).toFixed(0)}%</span></button>;
          })}
        </div>}
        <p className="muted result-meta">{state.data.detections.length} vùng tìm thấy · YOLO11n · {state.data.latency_ms} ms</p>
        {state.data.detections.length ? <div className="detection-list">{state.data.detections.map((detection, index) => <span className="detection-tag" key={`${detection.label}-${index}`} style={{ '--label-color': labelColor(detection.label), '--label-tint': `${labelColor(detection.label)}20` }}>{detection.label}<b>{(detection.score * 100).toFixed(0)}%</b></span>)}</div> : <p className="search-hint">Chưa tìm thấy đối tượng nào. Thử ảnh sáng, rõ và có chủ thể lớn hơn nhé.</p>}
      </>}
    </div>
    {selected && <div className="detect-zoom-backdrop" role="presentation" onClick={() => setSelected(null)}><section data-tilt className="detect-zoom-card tilt-card" role="dialog" aria-modal="true" aria-label={`Vùng ảnh: ${selected.label}`} onClick={(event) => event.stopPropagation()}><button type="button" className="close-button" onClick={() => setSelected(null)} aria-label="Đóng phóng to">×</button><span className="feature-subtitle">VÙNG ĐƯỢC PHÁT HIỆN</span><h3>{selected.label}<small style={{ color: labelColor(selected.label) }}>{(selected.score * 100).toFixed(1)}%</small></h3><canvas ref={canvasRef} aria-label={`Ảnh phóng to vùng ${selected.label}`}/></section></div>}
  </section>;
}
