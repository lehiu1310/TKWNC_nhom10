import { useEffect, useState } from 'react';
import speciesData from '../../../data/species.json';
import { friendlyFailure, postImage } from '../api.js';
import ImagePicker from './ImagePicker.jsx';

const SPECIES = Object.fromEntries(speciesData.map((flower) => [flower.id, flower]));
const FLOWER_ICONS = { daisy: '✿', dandelion: '❋', roses: '❀', sunflowers: '✺', tulips: '❁' };

export default function Classify() {
  const [state, setState] = useState({ status: 'idle' });
  const [scores, setScores] = useState([]);
  const [barsReady, setBarsReady] = useState(false);

  async function run(file) {
    setScores([]);
    setBarsReady(false);
    setState({ status: 'loading' });
    try {
      const data = await postImage('/api/classify', file, { top_k: 5 });
      setState({ status: 'ok', data, resultKey: `${Date.now()}-${Math.random()}` });
    } catch (err) {
      setState({ status: 'error', error: friendlyFailure(err) });
    }
  }

  useEffect(() => {
    if (state.status !== 'ok') return undefined;
    const predictions = state.data.predictions;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScores(predictions.map((prediction) => prediction.score));
      setBarsReady(true);
      return undefined;
    }

    setScores(predictions.map(() => 0));
    setBarsReady(false);
    let start;
    let frame;
    const beginFrame = requestAnimationFrame(() => {
      setBarsReady(true);
      const animate = (now) => {
        if (start === undefined) start = now;
        const progress = Math.min((now - start) / 700, 1);
        const eased = 1 - (1 - progress) ** 3;
        setScores(predictions.map((prediction) => prediction.score * eased));
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    });
    return () => {
      cancelAnimationFrame(beginFrame);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [state]);

  const predictions = state.status === 'ok' ? state.data.predictions : [];
  const topPrediction = predictions[0];
  const topSpecies = topPrediction ? SPECIES[topPrediction.label] : null;
  const imageResult = topPrediction && topSpecies ? {
    species: topSpecies,
    score: topPrediction.score,
    key: `${state.resultKey}-${topPrediction.label}`,
  } : null;

  return <section className="grid">
    <div>
      <h2>Đoán tên loài hoa</h2>
      <p className="muted">Tải ảnh lên để nhận năm dự đoán phù hợp nhất. Nếu ảnh không thuộc các loài trong bộ dữ liệu, AI vẫn có thể chọn một nhãn gần giống — hãy xem điểm số như gợi ý.</p>
      <ImagePicker label="Chọn ảnh để nhận diện" onChange={run} result={imageResult} />
    </div>
    <div className="result-panel"><span className="feature-subtitle">KẾT QUẢ NHẬN DIỆN</span>
      {state.status === 'idle' && <div className="empty-state"><span>✿</span><p>Kết quả và độ tin cậy sẽ hiện ở đây.</p></div>}
      {state.status === 'loading' && <><p className="loading-skeleton"/><p className="loading-skeleton"/><p className="loading-skeleton"/><p className="muted">AI đang quan sát cánh hoa…</p></>}
      {state.status === 'error' && <p className="error">Chưa nhận diện được ảnh. {state.error}</p>}
      {state.status === 'ok' && <>
        {!state.data.confident && <p className="warn">AI chưa đủ chắc chắn — hãy thử ảnh rõ hơn, chỉ có một bông hoa.</p>}
        {predictions.map((prediction, index) => {
          const flower = SPECIES[prediction.label];
          const name = flower?.name_vi || prediction.label;
          const color = flower?.color || '#7BC67B';
          return <div key={prediction.label}>
            <div className={`bar stem-bar stem-${index} ${barsReady ? 'bars-ready' : ''}`} style={{ '--prediction-color': color }}>
              <span>{name}</span>
              <div className="track"><div className="fill" style={{ width: `${prediction.score * 100}%` }}/></div>
              <b aria-label={`${name}: ${((scores[index] ?? 0) * 100).toFixed(1)} phần trăm`}>{((scores[index] ?? 0) * 100).toFixed(1)}%</b>
            </div>
            {index === 0 && flower && <a className="classify-detail-link" href={`/bach-khoa/${flower.id}`}>Xem thêm về {flower.name_vi}<span aria-hidden="true">↗</span></a>}
          </div>;
        })}
        <p className="muted result-meta">ResNet-18 · {state.data.latency_ms} ms</p>
      </>}
    </div>
  </section>;
}
