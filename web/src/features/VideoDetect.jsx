import { useEffect, useRef, useState } from 'react';
import { friendlyFailure, postImage } from '../api.js';

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;

export default function VideoDetect() {
  const [videoUrl, setVideoUrl] = useState('');
  const [mode, setMode] = useState('file');
  const [running, setRunning] = useState(false);
  const [detections, setDetections] = useState([]);
  const [dimensions, setDimensions] = useState(null);
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);
  const [counts, setCounts] = useState({ up: 0, down: 0 });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previousRef = useRef([]);
  const nextIdRef = useRef(1);
  const lastFrameRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => () => {
    activeRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    const currentUrl = videoUrl;
    return () => { if (currentUrl.startsWith('blob:')) URL.revokeObjectURL(currentUrl); };
  }, [videoUrl]);

  function reset() {
    previousRef.current = [];
    lastFrameRef.current = 0;
    setCounts({ up: 0, down: 0 });
    setFps(0);
    setDetections([]);
    setError('');
  }

  function chooseVideo(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) { setError('Chọn tệp video MP4, WebM hoặc định dạng được trình duyệt hỗ trợ nhé.'); return; }
    if (file.size > MAX_VIDEO_BYTES) { setError('Video cần nhỏ hơn 100 MB.'); return; }
    setRunning(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMode('file');
    setVideoUrl((old) => { if (old.startsWith('blob:')) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    reset();
  }

  async function startWebcam() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setMode('webcam');
      setVideoUrl('');
      setRunning(false);
      reset();
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (cause) {
      setError(cause.name === 'NotAllowedError' ? 'Bạn cần cho phép trình duyệt dùng camera để bắt đầu.' : 'Không mở được camera trên thiết bị này.');
    }
  }

  async function startAnalysis() {
    const video = videoRef.current;
    if (!video) return;
    if (mode === 'file' && video.duration > MAX_VIDEO_SECONDS) {
      setError('Bản demo giới hạn video 60 giây để tránh gửi quá nhiều khung hình lên API.');
      return;
    }
    reset();
    try { await video.play(); } catch { /* webcam thường đã phát */ }
    activeRef.current = true;
    setRunning(true);
  }

  function stopAnalysis() {
    activeRef.current = false;
    setRunning(false);
  }

  useEffect(() => {
    if (!running) return undefined;
    let cancelled = false;
    let timer;
    const analyzeFrame = async () => {
      const video = videoRef.current;
      if (cancelled || !activeRef.current || !video?.videoWidth || video.readyState < 2) {
        if (!cancelled && activeRef.current) timer = window.setTimeout(analyzeFrame, 300);
        return;
      }
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob || cancelled) return;
      try {
        // Send one frame at a time; never queue requests faster than the backend can process.
        const result = await postImage('/api/detect', new File([blob], 'video-frame.jpg', { type: 'image/jpeg' }), { conf: 0.25 });
        if (cancelled) return;
        const now = performance.now();
        if (lastFrameRef.current) setFps(1000 / (now - lastFrameRef.current));
        lastFrameRef.current = now;
        const width = canvas.width;
        const height = canvas.height;
        const current = result.detections.map((item) => {
          const [x1, y1, x2, y2] = item.box_xyxy;
          return { ...item, center: [(x1 + x2) / (2 * width), (y1 + y2) / (2 * height)] };
        });
        const used = new Set();
        const nextTracks = current.map((item) => {
          let best = null;
          let bestDistance = 0.18;
          previousRef.current.forEach((track) => {
            if (used.has(track.id) || track.label !== item.label) return;
            const distance = Math.hypot(track.center[0] - item.center[0], track.center[1] - item.center[1]);
            if (distance < bestDistance) { best = track; bestDistance = distance; }
          });
          if (!best) return { id: nextIdRef.current++, label: item.label, center: item.center };
          used.add(best.id);
          if (best.center[1] < 0.5 && item.center[1] >= 0.5) setCounts((value) => ({ ...value, down: value.down + 1 }));
          if (best.center[1] >= 0.5 && item.center[1] < 0.5) setCounts((value) => ({ ...value, up: value.up + 1 }));
          return { id: best.id, label: item.label, center: item.center };
        });
        previousRef.current = nextTracks;
        setDimensions({ width, height });
        setDetections(result.detections);
        setError('');
      } catch (cause) {
        if (!cancelled) {
          activeRef.current = false;
          setRunning(false);
          setError(friendlyFailure(cause));
        }
      }
      if (!cancelled && activeRef.current) timer = window.setTimeout(analyzeFrame, 250);
    };
    analyzeFrame();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [running]);

  return <section className="video-detect">
    <div className="video-detect-tools">
      <label className="button video-file-button">Chọn video<input type="file" accept="video/*" onChange={(event) => { chooseVideo(event.target.files?.[0]); event.target.value = ''; }}/></label>
      <button type="button" className="button secondary" onClick={startWebcam}>Dùng webcam</button>
      {!running ? <button type="button" className="button" disabled={mode === 'file' && !videoUrl} onClick={startAnalysis}>Bắt đầu phân tích</button> : <button type="button" className="button secondary" onClick={stopAnalysis}>Tạm dừng</button>}
      <button type="button" className="button secondary" onClick={reset}>Đặt lại bộ đếm</button>
    </div>
    <p className="muted">Video tối đa 60 giây, 100 MB. Hệ thống gửi tuần tự từng khung hình lên API; tốc độ hiển thị phụ thuộc backend và mạng. Webcam cần quyền camera.</p>
    {error && <p className="friendly-error" role="alert">{error}</p>}
    {(videoUrl || mode === 'webcam') && <div className="video-detect-layout">
      <div className="video-detect-stage" style={dimensions ? { aspectRatio: `${dimensions.width}/${dimensions.height}` } : undefined}>
        <video ref={videoRef} src={videoUrl || undefined} muted playsInline controls={mode === 'file'} autoPlay={mode === 'webcam'} onEnded={stopAnalysis} onLoadedMetadata={(event) => setDimensions({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight })}/>
        <div className="video-count-line" aria-hidden="true"/>
        {dimensions && detections.map((detection, index) => {
          const [x1, y1, x2, y2] = detection.box_xyxy;
          return <span className="video-detect-box" key={`${detection.label}-${index}`} style={{ left: `${x1 / dimensions.width * 100}%`, top: `${y1 / dimensions.height * 100}%`, width: `${(x2 - x1) / dimensions.width * 100}%`, height: `${(y2 - y1) / dimensions.height * 100}%` }}>{detection.label} · {(detection.score * 100).toFixed(0)}%</span>;
        })}
      </div>
      <aside className="video-detect-stats"><span><b>{fps.toFixed(2)}</b> khung/giây xử lý</span><span><b>{counts.up + counts.down}</b> lượt qua vạch</span><span><b>{counts.up}</b> lên · <b>{counts.down}</b> xuống</span><span>{detections.length} vùng ở khung gần nhất</span></aside>
    </div>}
  </section>;
}
