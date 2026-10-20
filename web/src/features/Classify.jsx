import { useEffect, useState } from 'react';
import speciesData from '../../../data/species.json';
import classifierDemoSamples from '../../../data/classifier_demo_samples.json';
import { friendlyFailure, postImage } from '../api.js';
import ImagePicker from './ImagePicker.jsx';
import giftMeanings from '../../../data/gift_meanings.json';
import { readGiftBook, rememberFavorite, rememberRecognition } from '../giftBook.js';

const SPECIES = Object.fromEntries(speciesData.map((flower) => [flower.id, flower]));
const SAMPLES = classifierDemoSamples.map((sample) => ({ ...SPECIES[sample.id], assetUrl: sample.assetUrl }));

export default function Classify() {
  const [state, setState] = useState({ status: 'idle' });
  const [scores, setScores] = useState([]);
  const [barsReady, setBarsReady] = useState(false);
  const [showGradCam, setShowGradCam] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => readGiftBook().favorites);

  async function run(file, _previewUrl, explain = showGradCam) {
    setScores([]);
    setBarsReady(false);
    setState({ status: 'loading' });
    try {
      const data = await postImage('/api/classify', file, { top_k: 5, explain });
      setState({ status: 'ok', data, file, resultKey: `${Date.now()}-${Math.random()}` });
    } catch (err) {
      setState({ status: 'error', error: friendlyFailure(err), file });
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
  useEffect(() => {
    if (state.status === 'ok' && state.data.confident && topSpecies?.id) rememberRecognition(topSpecies);
  }, [state.status, state.data?.predictions, state.data?.confident, topSpecies?.id]);
  const secondPrediction = predictions[1];
  const isAmbiguous = topPrediction && secondPrediction && topPrediction.score - secondPrediction.score < 0.15;
  const imageResult = topPrediction && topSpecies ? {
    species: topSpecies,
    score: topPrediction.score,
    key: `${state.resultKey}-${topPrediction.label}`,
  } : null;

  return <section className="grid">
    <div>
      <h2>Đoán tên loài hoa</h2>
      <p className="muted">ResNet-18 đối chiếu ảnh với {speciesData.length} nhãn hoa trong bộ dữ liệu và hiển thị 5 kết quả phù hợp nhất. Điểm tin cậy thấp có thể báo ảnh ngoài bộ dữ liệu; hãy xem dự đoán như gợi ý.</p>
      <label className="gradcam-toggle"><input type="checkbox" checked={showGradCam} onChange={(event) => { const enabled = event.target.checked; setShowGradCam(enabled); if (state.status === 'ok' && state.file) void run(state.file, undefined, enabled); }}/> Xem AI đang nhìn vào đâu (Grad-CAM)</label>
      <ImagePicker label="Chọn ảnh để nhận diện" onChange={run} result={imageResult} samples={SAMPLES} />
    </div>
    <div className="result-panel"><span className="feature-subtitle">KẾT QUẢ NHẬN DIỆN</span>
      {state.status === 'idle' && <div className="empty-state"><span>✿</span><p>Kết quả và độ tin cậy sẽ hiện ở đây.</p></div>}
      {state.status === 'loading' && <><p className="loading-skeleton"/><p className="loading-skeleton"/><p className="loading-skeleton"/><p className="muted">AI đang quan sát cánh hoa…</p></>}
      {state.status === 'error' && <div className="friendly-error" role="alert"><p>Chưa nhận diện được ảnh. {state.error}</p><button type="button" className="button" onClick={() => run(state.file)}>Thử lại</button></div>}
      {state.status === 'ok' && <>
        {!state.data.confident && <p className="warn" role="status">Ảnh này có thể không phải loài hoa trong bộ dữ liệu, hoặc AI chưa đủ chắc chắn để nhận diện.</p>}
        {isAmbiguous && <p className="warn ambiguity-notice" role="status">AI đang phân vân giữa {SPECIES[topPrediction.label]?.name_vi || topPrediction.label} và {SPECIES[secondPrediction.label]?.name_vi || secondPrediction.label}.</p>}
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
        {state.data.grad_cam && showGradCam && <figure className="gradcam-result"><img src={state.data.grad_cam} alt="Ảnh gốc phủ heatmap Grad-CAM, vùng màu thể hiện nơi ảnh tác động tới dự đoán"/><figcaption>Grad-CAM · vùng màu là tín hiệu giải thích xấp xỉ cho nhãn top-1, không chứng minh dự đoán đúng.</figcaption></figure>}
        {topSpecies && state.data.confident && (() => {
          const gift = giftMeanings.species.find((item) => item.species_id === topSpecies.id);
          if (!gift?.gift_ok) return null;
          const favorite = favoriteIds.includes(topSpecies.id);
          return <section className="classify-gift-hint"><span className="feature-subtitle">GỢI Ý TẶNG HOA · BẢN NHÁP CHƯA XÁC MINH</span><p>{gift.occasions.length ? `Dữ liệu gợi ý các dịp: ${gift.occasions.slice(0, 4).join(', ')}.` : 'Chưa có dịp tặng phù hợp được ghi nhận.'} {gift.avoid_for.length ? `Lưu ý: ${gift.avoid_for.join(' ')}` : ''}</p><div className="row"><a className="button" href={`/tang-hoa?flower=${topSpecies.id}`}>Phối bó với hoa này</a><button type="button" className="button" onClick={() => setFavoriteIds(rememberFavorite(topSpecies.id).favorites)}>{favorite ? 'Bỏ khỏi Sổ hoa' : 'Lưu vào Sổ hoa'}</button></div></section>;
        })()}
      </>}
    </div>
  </section>;
}
