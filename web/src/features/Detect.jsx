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
  const [webcamActive, setWebcamActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraFps, setCameraFps] = useState(0);
  const [crossingCount, setCrossingCount] = useState(0);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const tracksRef = useRef([]);
  const lastFrameUrlRef = useRef('');

  async function startWebcam() {
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Trình duyệt không hỗ trợ webcam hoặc trang không dùng HTTPS.');
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      tracksRef.current = [];
      setCrossingCount(0);
      setWebcamActive(true);
    } catch (error) {
      setCameraError(error.name === 'NotAllowedError' ? 'Bạn chưa cấp quyền dùng camera.' : error.message || 'Không mở được camera.');
    }
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setWebcamActive(false);
    setCameraFps(0);
  }

  useEffect(() => {
    if (!webcamActive) return undefined;
    let cancelled = false;
    let timer;
    let previousCompletedAt = 0;
    const video = videoRef.current;
    if (video && streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
    const canvas = document.createElement('canvas');

    async function processNextFrame() {
      if (cancelled || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
        timer = window.setTimeout(processNextFrame, 200);
        return;
      }
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob || cancelled) return;
      const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const data = await postImage('/api/detect', file, { conf: 0.25 });
        if (cancelled) return;
        const now = performance.now();
        if (previousCompletedAt) setCameraFps(1000 / (now - previousCompletedAt));
        previousCompletedAt = now;
        setImageSize({ width: canvas.width, height: canvas.height });
        setState({ status: 'ok', data });

        const currentTracks = tracksRef.current;
        const used = new Set();
        const nextTracks = [];
        let crossings = 0;
        for (const detection of data.detections) {
          const centerX = (detection.box_xyxy[0] + detection.box_xyxy[2]) / (2 * canvas.width);
          const options = currentTracks.map((track, index) => ({ track, index }))
            .filter(({ track, index }) => !used.has(index) && track.label === detection.label && now - track.updatedAt < 5000)
            .sort((a, b) => Math.abs(a.track.x - centerX) - Math.abs(b.track.x - centerX));
          const match = options[0] && Math.abs(options[0].track.x - centerX) < 0.22 ? options[0] : null;
          if (match) {
            used.add(match.index);
            if (match.track.x < 0.5 && centerX >= 0.5) crossings += 1;
          }
          nextTracks.push({ label: detection.label, x: centerX, updatedAt: now });
        }
        tracksRef.current = [...nextTracks, ...currentTracks.filter((track, index) => !used.has(index) && now - track.updatedAt < 5000)];
        if (crossings) setCrossingCount((count) => count + crossings);
        if (lastFrameUrlRef.current) URL.revokeObjectURL(lastFrameUrlRef.current);
        lastFrameUrlRef.current = URL.createObjectURL(file);
        setImagePreview(lastFrameUrlRef.current);
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error: friendlyFailure(error) });
      }
      // One in-flight frame at a time: slow backends reduce the measured FPS but
      // never accumulate a queue of stale image requests.
      timer = window.setTimeout(processNextFrame, 250);
    }
    void processNextFrame();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [webcamActive]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (lastFrameUrlRef.current) URL.revokeObjectURL(lastFrameUrlRef.current);
  }, []);

  async function run(file, previewUrl) {
    if (webcamActive) stopWebcam();
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
    <div><h2>Tìm vật thể trong ảnh</h2><p className="muted">Tải ảnh lên hoặc dùng camera để xem các vật thể được khoanh vùng.</p><div className="webcam-controls"><button type="button" className="button" onClick={webcamActive ? stopWebcam : startWebcam}>{webcamActive ? 'Tắt webcam' : 'Bật webcam'}</button>{webcamActive && <span>{cameraFps.toFixed(2)} FPS · Đếm qua vạch: {crossingCount}</span>}</div>{webcamActive && <video className="webcam-live-preview" ref={videoRef} autoPlay muted playsInline aria-label="Luồng webcam trực tiếp"/>}{cameraError && <p className="error">{cameraError}</p>}<ImagePicker label="Chọn ảnh để tìm vật thể" onChange={run}/><p className="search-hint">Model hiện được fine-tune cho bốn nhóm hoa: cúc, bồ công anh, hoa hồng và hướng dương. Tulip chưa có trong detector; ảnh ngoài các lớp này vẫn có thể bị bỏ sót hoặc nhận nhầm.</p></div>
    <div className="result-panel"><span className="feature-subtitle">BẢN ĐỒ KHU VƯỜN</span>
      {state.status === 'idle' && <div className="empty-state"><span>◎</span><p>Khung ảnh và các vùng phát hiện sẽ hiện ở đây.</p></div>}
      {state.status === 'loading' && <><p className="loading-skeleton"/><p className="loading-skeleton"/><p className="muted">AI đang tìm các đối tượng…</p></>}
      {state.status === 'error' && <p className="error">Chưa phân tích được ảnh. {state.error}</p>}
      {state.status === 'ok' && <>
        {(imagePreview || webcamActive) && <div className="detect-stage" style={imageSize ? { aspectRatio: `${imageSize.width}/${imageSize.height}` } : undefined}>
          <img src={imagePreview} alt="Khung hình webcam hoặc ảnh với các vùng phát hiện" onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}/>
          {webcamActive && <div className="webcam-count-line" aria-label="Vạch đếm đối tượng"/>}
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
