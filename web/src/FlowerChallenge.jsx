import { useEffect, useMemo, useState } from 'react';
import speciesData from '../../data/species.json';
import giftData from '../../data/gift_meanings.json';
import { challengeBadges, getDailyChallenge, localDateKey, readChallengeProgress, recordDailyAttempt } from './flowerChallenge.js';

const SPECIES = Object.fromEntries(speciesData.map((flower) => [flower.id, flower]));
const FLOWERS = giftData.species.filter((item) => item.gift_ok).map((item) => SPECIES[item.species_id]).filter(Boolean);
const imageFor = (flower) => `/images/gift-flowers/${encodeURIComponent(flower.id)}.jpg`;

export default function FlowerChallenge() {
  const [today, setToday] = useState(() => localDateKey());
  const [progress, setProgress] = useState(readChallengeProgress);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = localDateKey();
      setToday((current) => current === next ? current : next);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const challenge = useMemo(() => getDailyChallenge(FLOWERS, new Date(`${today}T12:00:00`)), [today]);
  const badges = challengeBadges(progress);
  const answered = progress.lastPlayed === challenge?.date;
  const correct = answered && progress.lastAnswer?.correct;

  return <main className="challenge-page section-wrap">
    <header className="challenge-hero"><a className="back-home" href="/#the-gioi-hoa">← Về khu vườn</a><span className="eyebrow">THỬ THÁCH HOA · MỖI NGÀY MỘT ẢNH</span><h1>Đoán tên hoa,<br/><em>thêm vui mỗi ngày.</em></h1><p>Mỗi ngày một ảnh thật. Chọn tên loài phù hợp, tích luỹ điểm và huy hiệu ngay trên thiết bị này.</p><span className="challenge-date">{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${today}T12:00:00`))}</span></header>
    {challenge ? <section className="challenge-card" aria-labelledby="challenge-question"><div className="challenge-score"><div><b>{progress.streak}</b><span>ngày liên tiếp</span></div><div><b>{progress.correct}</b><span>câu đúng</span></div><div><b>{progress.completed}</b><span>ngày đã chơi</span></div></div><div className="challenge-main"><div className="challenge-photo"><img src={imageFor(challenge.target)} alt="Ảnh hoa trong thử thách hôm nay"/><span>ẢNH THẬT · HÔM NAY</span></div><div className="challenge-prompt"><span className="eyebrow">CÂU HỎI HÔM NAY</span><h2 id="challenge-question">Hoa trong ảnh là loài nào?</h2><p>Chọn một đáp án. Mỗi ngày chỉ ghi nhận một lượt để giữ thử thách công bằng.</p><div className="challenge-options">{challenge.options.map((flower) => <button type="button" key={flower.id} disabled={answered} aria-pressed={progress.lastAnswer?.selectedId === flower.id} className={answered ? flower.id === challenge.target.id ? 'is-correct' : progress.lastAnswer?.selectedId === flower.id ? 'is-wrong' : '' : ''} onClick={() => setProgress(recordDailyAttempt({ date: challenge.date, targetId: challenge.target.id, selectedId: flower.id }))}>{flower.name_vi}<small>{flower.name_en}</small></button>)}</div>{answered && <div className={`challenge-answer${correct ? ' is-correct' : ' is-wrong'}`} role="status"><b>{correct ? 'Chính xác, bạn nhận ra rồi!' : `Đáp án hôm nay là ${challenge.target.name_vi}.`}</b><p>{challenge.target.description}</p><a href={`/bach-khoa/${encodeURIComponent(challenge.target.id)}`}>Khám phá loài hoa ↗</a></div>}</div></div></section> : <p>Chưa đủ ảnh cho thử thách hôm nay.</p>}
    <section className="challenge-achievements"><div><span className="eyebrow">HUY HIỆU CỦA BẠN</span><h2>Mỗi lượt chơi là một hạt giống</h2><p>Điểm và huy hiệu chỉ lưu trong trình duyệt này, không cần tài khoản.</p></div>{badges.length ? <div className="challenge-badges">{badges.map((badge) => <div key={badge.id}><span>{badge.icon}</span><b>{badge.name}</b></div>)}</div> : <p className="challenge-no-badge">Chơi thử thách đầu tiên để nhận huy hiệu “Nụ đầu mùa”.</p>}</section>
    <p className="challenge-disclaimer">Đây là trò chơi nhận diện từ {FLOWERS.length} ảnh hoa có sẵn trong dự án, không gọi mô hình AI và không đánh giá kỹ năng làm vườn.</p>
  </main>;
}
