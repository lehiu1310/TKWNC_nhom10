import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { getHealth } from './api.js';
import ScrollGarden from './ScrollGarden.jsx';
import DoctorCare from './DoctorCare.jsx';
const InteractiveGarden = lazy(() => import('./InteractiveGarden.jsx'));
const Classify = lazy(() => import('./features/Classify.jsx'));
const Detect = lazy(() => import('./features/Detect.jsx'));
const Search = lazy(() => import('./features/Search.jsx'));
const Chat = lazy(() => import('./features/Chat.jsx'));
const GiftAdvisor = lazy(() => import('./GiftAdvisor.jsx'));
import speciesData from '../../data/species.json';
import displayImageData from '../../data/display_images.json';
import { addGardenPlant, readGarden } from './gardenPlanner.js';
import { readGiftCardFromHash } from './giftShare.js';


const FLOWERS = speciesData.map((item) => ({ ...item, vi: item.name_vi, en: item.name_en, color: item.color, bloom: item.bloom_season, icon: item.icon || '✿' }));
const FEATURED_FLOWERS = FLOWERS.filter((item) => item.featured).sort((a, b) => a.featured_order - b.featured_order);
const flowerDisplayRecord = (flower) => displayImageData.images[flower.display_image_key || flower.id];
const flowerDisplayImage = (flower) => flowerDisplayRecord(flower)?.url || `/api/species/${flower.id}/image`;
const resolvePathname = (pathname) => {
  const knownRoute = pathname === '/' || pathname === '/bach-khoa' || pathname === '/tang-hoa' || speciesData.some((flower) => pathname === `/bach-khoa/${flower.id}`);
  if (knownRoute) return pathname;
  window.history.replaceState({}, '', '/');
  return '/';
};

function FlowerOfMonth({ navigate }) {
  const now = new Date();
  const monthNumber = now.getMonth() + 1;
  const monthName = new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(now);
  const eligible = FLOWERS.filter((flower) => {
    const season = flower.bloom_season.toLocaleLowerCase('vi');
    if (season.includes('quanh năm')) return true;
    const months = [...season.matchAll(/\d{1,2}/g)].map(([month]) => Number(month));
    if (months.length === 1) return months[0] === monthNumber;
    if (months.length >= 2) return months.some((month, index) => index % 2 === 0 && month <= monthNumber && months[index + 1] >= monthNumber);
    return false;
  });
  const flower = eligible[0];
  if (!flower) return null;
  const photo = flowerDisplayRecord(flower);
  return <section className="monthly-flower section-wrap" aria-label={`Hoa của ${monthName}`}>
    <div className="monthly-flower-card" style={{ '--flower-color': flower.color }}>
      <div className="monthly-flower-copy"><span className="eyebrow">GỢI Ý THEO MÙA · {monthName.toLocaleUpperCase('vi')}</span><h2>Hoa của tháng này</h2><p>{flower.name_vi} đang hợp mùa theo dữ liệu khu vườn: {flower.bloom_season}.</p><button className="text-link" onClick={() => navigate(`/bach-khoa/${flower.id}`)}>Đọc chuyện về {flower.name_vi} <span>→</span></button></div>
      <img className={photo ? 'display-flower-photo' : undefined} style={photo ? { '--display-photo-grade': displayImageData.colorGrading.cssFilter } : undefined} src={flowerDisplayImage(flower)} alt={photo?.alt || `Ảnh ${flower.name_vi}`} loading="lazy"/>
    </div>
  </section>;
}

function NoiseOverlay({ id }) {
  return <svg className="noise-overlay" aria-hidden="true" focusable="false"><filter id={id}><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .14"/></feComponentTransfer></filter><rect width="100%" height="100%" filter={`url(#${id})`}/></svg>;
}

const SEASONS = [
  { id: 'spring', label: 'Mùa xuân', months: [3, 4, 5] },
  { id: 'summer', label: 'Mùa hè', months: [6, 7, 8] },
  { id: 'autumn', label: 'Mùa thu', months: [9, 10, 11] },
  { id: 'winter', label: 'Mùa đông', months: [12, 1, 2] },
];

function bloomsInSeason(flower, seasonId) {
  if (!seasonId) return true;
  if (flower.bloom_season === 'Quanh năm') return true;
  const months = [...flower.bloom_season.matchAll(/\d{1,2}/g)].map(([month]) => Number(month));
  if (!months.length) return true;
  return months.some((month) => SEASONS.find((season) => season.id === seasonId)?.months.includes(month));
}

function EncyclopediaPage({ navigate }) {
  const [color, setColor] = useState('');
  const [season, setSeason] = useState('');
  const [query, setQuery] = useState('');
  const colors = [...new Map(FLOWERS.map((flower) => [flower.color, flower.color])).keys()];
  const filtered = FLOWERS.filter((flower) => (!color || flower.color === color) && bloomsInSeason(flower, season) && `${flower.name_vi} ${flower.name_en} ${flower.id}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  return <main className="ency-page">
    <section className="ency-page-hero section-wrap"><a className="back-home" href="/#home">← Về khu vườn</a><span className="eyebrow">BÁCH KHOA CÁC LOÀI HOA · {FLOWERS.length} LOÀI</span><h1>Mỗi loài hoa<br/>một <em>câu chuyện.</em></h1><p>Khám phá {FLOWERS.length} loài trong bộ dữ liệu AI, với ảnh chụp thật, bộ lọc màu, mùa nở và tìm kiếm theo tên.</p></section>
    <section className="ency-catalog section-wrap" aria-label="Danh sách loài hoa">
      <div className="ency-filters"><label className="ency-search"><span>Tìm loài hoa</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên Việt hoặc tên quốc tế…" aria-label="Tìm loài hoa"/></label><label><span>Màu chủ đạo</span><select value={color} onChange={(event) => setColor(event.target.value)}><option value="">Tất cả màu</option>{colors.map((value) => <option value={value} key={value}>{({ '#FFC93C': 'Vàng', '#FF6F91': 'Hồng', '#9B7EDE': 'Tím', '#FF8A5B': 'Cam', '#5BAE6B': 'Xanh lá', '#6B9DD4': 'Xanh dương', '#EEE8DF': 'Trắng / kem' })[value] || value}</option>)}</select></label><label><span>Mùa nở</span><select value={season} onChange={(event) => setSeason(event.target.value)}><option value="">Tất cả mùa</option>{SEASONS.map((value) => <option value={value.id} key={value.id}>{value.label}</option>)}</select></label><span className="filter-count">{filtered.length} / {FLOWERS.length} loài</span></div>
      {filtered.length ? <div className="ency-grid">{filtered.map((flower) => { const displayPhoto = flowerDisplayRecord(flower); return <a data-tilt className="ency-card tilt-card" href={`/bach-khoa/${flower.id}`} key={flower.id} onClick={(event) => { event.preventDefault(); navigate(`/bach-khoa/${flower.id}`); }}><div className="ency-card-art" style={{ '--flower-color': flower.color }}><img className={displayPhoto ? 'display-flower-photo' : undefined} style={displayPhoto ? { '--display-photo-grade': displayImageData.colorGrading.cssFilter } : undefined} src={flowerDisplayImage(flower)} alt={displayPhoto?.alt || `Ảnh chụp ${flower.name_vi}`} loading="lazy"/><span className="ency-card-color" style={{ backgroundColor: flower.color }} title={`Màu chủ đạo ${flower.color}`}/></div><div className="ency-card-copy"><span className="ency-card-season">{flower.bloom_season}</span><h2>{flower.name_vi}</h2><p>{flower.description}</p><span className="ency-card-link">Khám phá loài hoa <b>↗</b></span></div></a>; })}</div> : <p className="ency-empty">Chưa có loài hoa phù hợp với bộ lọc này.</p>}
    </section>
  </main>;
}

function FlowerDetailPage({ flower, navigate, openGardenCare }) {
  if (!flower) return <main className="flower-detail section-wrap"><span className="eyebrow">KHÔNG TÌM THẤY LOÀI HOA</span><h1>Loài hoa này chưa có trong bách khoa.</h1><button className="primary-button" onClick={() => navigate('/bach-khoa')}>Quay lại bách khoa</button></main>;
  const displayPhoto = flowerDisplayRecord(flower);
  return <main className="flower-detail section-wrap" style={{ '--flower-color': flower.color, '--flower-scene': flower.scene_background }}><NoiseOverlay id="detail-grain"/><a className="back-home" href="/bach-khoa" onClick={(event) => { event.preventDefault(); navigate('/bach-khoa'); }}>← Bách khoa các loài hoa</a><div className="flower-detail-layout"><div className="flower-detail-art"><img data-parallax className={`flower-detail-main-photo${displayPhoto ? ' display-flower-photo' : ''}`} style={displayPhoto ? { '--display-photo-grade': displayImageData.colorGrading.cssFilter } : undefined} src={flowerDisplayImage(flower)} alt={displayPhoto?.alt || `Ảnh minh hoạ ${flower.name_vi}`}/>{displayPhoto ? displayPhoto.sourcePage ? <a className="flower-detail-photo-credit" href={displayPhoto.sourcePage} target="_blank" rel="noreferrer">ẢNH · {displayPhoto.photographer} / UNSPLASH ↗</a> : <span className="flower-detail-photo-credit">ẢNH · {displayPhoto.photographer}</span> : <span className="flower-detail-photo-credit">MINH HOẠ · {flower.name_en}</span>}</div><article className="flower-detail-copy"><span className="eyebrow">NHẬT KÝ THỰC VẬT · {flower.name_en.toUpperCase()}</span><h1>{flower.name_vi}</h1><p className="flower-detail-lede">{flower.description}</p><div className="flower-detail-facts"><div data-tilt className="tilt-card"><span>MÙA HOA</span><b>{flower.bloom_season}</b></div><div data-tilt className="tilt-card"><span>Ý NGHĨA</span><b>{flower.meaning}</b></div></div><h2>Đôi nét về loài hoa</h2><p>{flower.long_description}</p><h2>Đặc điểm nhận biết</h2><ul>{flower.facts.map((fact) => <li key={fact}>{fact.replace(/^Đặc điểm nhận biết:\s*/i, '')}</li>)}</ul><div className="flower-detail-actions"><button className="primary-button" onClick={() => navigate('/bach-khoa')}>Khám phá loài hoa khác <span>↗</span></button><button className="planner-detail-cta" onClick={() => openGardenCare(flower)}>＋ Thêm {flower.name_vi} vào sổ chăm sóc</button></div></article></div></main>;
}

function SharedGiftCardPage({ card }) {
  const flower = speciesData.find((item) => item.id === card.speciesId);
  const photo = flower && (displayImageData.images[flower.display_image_key || flower.id] || null);
  if (!flower) return <section className="shared-gift-card section-wrap"><span className="eyebrow">THIỆP HOA · VƯỜN HOA</span><h1>Thiệp này không còn khả dụng.</h1><a className="primary-button" href="/">Về khu vườn</a></section>;
  return <section className="shared-gift-card section-wrap" style={{ '--gift-flower-color': flower.color }}><span className="eyebrow">MỘT LỜI NHẮN GỬI BẠN</span><h1>{card.recipient ? `Gửi ${card.recipient}` : 'Một bó hoa, một lời thương.'}</h1><div className="shared-gift-card-art"><img src={photo?.url || `/images/gift-flowers/${encodeURIComponent(flower.id)}.jpg`} alt={photo?.alt || `Hoa ${flower.name_vi}`} style={photo ? { filter: displayImageData.colorGrading.cssFilter } : undefined}/><span>{flower.name_vi}{card.occasion ? ` · ${card.occasion}` : ''}</span></div><blockquote>{card.message}</blockquote>{card.sender && <p className="shared-gift-sender">Thân mến, <b>{card.sender}</b></p>}<a className="shared-gift-link" href={`/bach-khoa/${encodeURIComponent(flower.id)}`}>Đọc câu chuyện về {flower.name_vi} ↗</a><a className="shared-gift-back" href={`/?flower=${encodeURIComponent(flower.id)}#vuon-3d`}>Ngắm {flower.name_vi} trong vườn 3D ↗</a><small>Thiệp được tạo bằng Vườn Hoa. Nội dung lời nhắn nằm trong liên kết/mã QR mà người gửi chia sẻ.</small></section>;
}

const FEATURES = [
  { id: 'classify', title: 'Nhận diện loài hoa', subtitle: 'NHÌN ẢNH · GỌI TÊN HOA', desc: 'Gửi một tấm ảnh để xem năm khả năng phù hợp nhất và mức độ tự tin của AI.', prompt: 'Chọn ảnh để bắt đầu', icon: '⌕', model: 'classifier', modelLabel: 'ResNet-18', color: 'pink', Component: Classify },
  { id: 'detect', title: 'Phát hiện đối tượng', subtitle: 'TÌM VẬT THỂ · KHOANH VÙNG', desc: 'Xem AI đánh dấu vị trí các vật thể trong ảnh, kèm nhãn và điểm tin cậy.', prompt: 'Thử với một bức ảnh', icon: '◎', model: 'detector', modelLabel: 'YOLO', color: 'yellow', Component: Detect },
  { id: 'search', title: 'Tìm ảnh trong album', subtitle: 'MÔ TẢ · KHÁM PHÁ ẢNH', desc: 'Viết điều bạn muốn tìm hoặc gửi ảnh mẫu để khám phá những bức hình gần giống.', prompt: 'Tìm một khung hình', icon: '▦', model: 'retrieval', modelLabel: 'CLIP + FAISS', color: 'green', Component: Search },
  { id: 'chat', title: 'Trò chuyện về hoa', subtitle: 'HỎI CHUYỆN · TÌM HIỂU HOA', desc: 'Hỏi về đặc điểm, mùa nở hay ý nghĩa; mỗi câu trả lời đều dựa trên cẩm nang hoa.', prompt: 'Gửi câu hỏi của bạn', icon: '☻', model: 'llm', modelLabel: 'RAG', color: 'purple', Component: Chat },
];

const FEATURE_INTROS = {
  classify: ['ẢNH VÀO', 'MÔ HÌNH PHÂN LOẠI', 'TOP 5 DỰ ĐOÁN'],
  detect: ['ẢNH ĐẦU VÀO', 'TÌM VÀ KHOANH VÙNG', 'NHÃN VẬT THỂ'],
  search: ['MÔ TẢ HOẶC ẢNH MẪU', 'SO KHỚP ĐẶC TRƯNG', 'ẢNH GẦN NHẤT'],
  chat: ['CÂU HỎI', 'TRUY XUẤT TÀI LIỆU', 'CÂU TRẢ LỜI CÓ NGUỒN'],
};

function FeatureBotanicalIcon({ id }) {
  if (id === 'detect') return <svg viewBox="0 0 64 64" aria-hidden="true"><path className="botanical-stem" d="M32 55 C31 42 33 29 38 14"/><path className="botanical-leaf" d="M31 45 C14 42 12 31 16 27 C27 27 33 34 31 45Z"/><path className="botanical-leaf leaf-alt" d="M34 36 C36 20 49 18 53 22 C52 33 44 39 34 36Z"/><path className="botanical-vein" d="M18 29 C23 33 27 37 30 42 M50 24 C44 28 40 31 36 35"/><path className="botanical-orbit" d="M13 16 C24 4 43 5 52 15"/></svg>;
  if (id === 'search') return <svg viewBox="0 0 64 64" aria-hidden="true"><path className="botanical-stem" d="M32 56 C32 42 31 32 32 23"/><path className="botanical-leaf" d="M31 47 C15 45 13 36 17 32 C26 31 32 37 31 47Z"/><path className="botanical-leaf leaf-alt" d="M33 43 C48 42 51 34 47 30 C39 29 33 35 33 43Z"/><g className="botanical-bloom"><ellipse cx="32" cy="17" rx="5" ry="11"/><ellipse cx="32" cy="17" rx="5" ry="11" transform="rotate(60 32 23)"/><ellipse cx="32" cy="17" rx="5" ry="11" transform="rotate(120 32 23)"/><circle cx="32" cy="23" r="5"/></g><path className="botanical-orbit" d="M9 27 C12 13 20 7 29 7"/></svg>;
  if (id === 'chat') return <svg viewBox="0 0 64 64" aria-hidden="true"><path className="botanical-stem" d="M32 56 C32 43 32 35 32 27"/><path className="botanical-leaf" d="M31 48 C17 47 14 39 18 35 C26 34 32 39 31 48Z"/><path className="botanical-leaf leaf-alt" d="M33 41 C46 40 49 32 45 29 C38 28 33 33 33 41Z"/><g className="botanical-bloom"><ellipse cx="32" cy="18" rx="6" ry="12"/><ellipse cx="32" cy="18" rx="6" ry="12" transform="rotate(72 32 24)"/><ellipse cx="32" cy="18" rx="6" ry="12" transform="rotate(144 32 24)"/><ellipse cx="32" cy="18" rx="6" ry="12" transform="rotate(216 32 24)"/><ellipse cx="32" cy="18" rx="6" ry="12" transform="rotate(288 32 24)"/><circle cx="32" cy="24" r="5"/></g><path className="botanical-orbit" d="M15 18 C20 8 28 5 39 8"/></svg>;
  return <svg viewBox="0 0 64 64" aria-hidden="true"><path className="botanical-stem" d="M32 57 C33 43 31 34 32 24"/><path className="botanical-leaf" d="M32 47 C17 46 14 37 18 33 C27 32 33 39 32 47Z"/><path className="botanical-leaf leaf-alt" d="M32 40 C47 39 51 31 47 27 C39 27 33 32 32 40Z"/><g className="botanical-bloom"><ellipse cx="32" cy="17" rx="6" ry="12"/><ellipse cx="32" cy="17" rx="6" ry="12" transform="rotate(60 32 23)"/><ellipse cx="32" cy="17" rx="6" ry="12" transform="rotate(120 32 23)"/><circle cx="32" cy="23" r="5"/></g><path className="botanical-orbit" d="M12 25 C15 13 21 8 30 7"/></svg>;
}

class FeatureErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Lỗi khi hiển thị chức năng AI:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <div className="error feature-render-error" role="alert"><b>Chức năng này gặp lỗi khi hiển thị.</b><p>{this.state.error.message}</p><span>Đóng panel rồi mở lại để thử lần nữa.</span></div>;
    }
    return this.props.children;
  }
}

function Flowerfield() {
  const photos = FEATURED_FLOWERS.filter((flower) => flower.hero_order).sort((a, b) => a.hero_order - b.hero_order);
  return <div className="hero-blooms" aria-hidden="true"><span className="paper-cloud cloud-a"/><span className="paper-cloud cloud-b"/>{photos.map((flower, index) => <img data-parallax key={flower.id} className={`flower-mark flower-photo flower-photo-${index + 1} display-flower-photo`} style={{ '--display-photo-grade': displayImageData.colorGrading.cssFilter }} src={flowerDisplayImage(flower)} alt=""/>)}<span className="floating-petal petal-a"/><span className="floating-petal petal-b"/><span className="floating-petal petal-c"/></div>;
}

export default function App() {
  const [route, setRoute] = useState(() => resolvePathname(window.location.pathname));
  const [sharedGift, setSharedGift] = useState(() => readGiftCardFromHash(window.location.hash));
  const [health, setHealth] = useState(null);
  const [active, setActive] = useState(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctorInitialView, setDoctorInitialView] = useState('ask');
  const [scrolled, setScrolled] = useState(false);
  const [healthError, setHealthError] = useState(false);
  const healthCheckRef = useRef(null);
  useEffect(() => {
    readGarden();
    try { localStorage.removeItem('vuon-hoa-daily-challenge-v1'); } catch { /* Storage may be unavailable in a restricted browser context. */ }
  }, []);
  const navigate = (path) => {
    const nextPath = resolvePathname(path);
    window.history.pushState({}, '', nextPath);
    setRoute(nextPath);
    setSharedGift(readGiftCardFromHash(window.location.hash));
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const openGardenCare = (flower) => {
    addGardenPlant(flower.id);
    setDoctorInitialView('garden');
    navigate('/');
    setDoctorOpen(true);
  };
  useEffect(() => {
    const onPopState = () => { setRoute(resolvePathname(window.location.pathname)); setSharedGift(readGiftCardFromHash(window.location.hash)); };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    const onHashChange = () => setSharedGift(readGiftCardFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer;
    let controller;
    let requestId = 0;
    const check = async () => {
      window.clearTimeout(timer);
      const currentRequest = ++requestId;
      let nextDelay = 4500;
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 6500);
      try {
        const value = await getHealth({ signal: controller.signal, cache: 'no-store' });
        if (stopped || currentRequest !== requestId) return;
        setHealth(value);
        setHealthError(false);
        nextDelay = value.ready === true ? 30000 : 4500;
      } catch {
        if (stopped || currentRequest !== requestId) return;
        setHealth({ status: 'down', models: {} });
        setHealthError(true);
      } finally {
        window.clearTimeout(timeout);
        if (!stopped && currentRequest === requestId) timer = window.setTimeout(check, nextDelay);
      }
    };
    healthCheckRef.current = check;
    void check();
    return () => { stopped = true; window.clearTimeout(timer); controller?.abort(); healthCheckRef.current = null; };
  }, []);
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 24); window.addEventListener('scroll', fn, { passive: true }); return () => window.removeEventListener('scroll', fn); }, []);
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const canTilt = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (reduceMotion.matches || !canTilt.matches) return undefined;
    const onPointerMove = (event) => {
      const card = event.target.closest?.('[data-tilt]');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      card.style.setProperty('--tilt-x', `${Math.max(-8, Math.min(8, -y * 16))}deg`);
      card.style.setProperty('--tilt-y', `${Math.max(-8, Math.min(8, x * 16))}deg`);
    };
    const onPointerOut = (event) => {
      const card = event.target.closest?.('[data-tilt]');
      if (card && !card.contains(event.relatedTarget)) {
        card.style.removeProperty('--tilt-x');
        card.style.removeProperty('--tilt-y');
      }
    };
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerout', onPointerOut, { passive: true });
    return () => { document.removeEventListener('pointermove', onPointerMove); document.removeEventListener('pointerout', onPointerOut); };
  }, []);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const items = () => [...document.querySelectorAll('[data-parallax]')];
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => items().forEach((item) => {
        const rect = item.getBoundingClientRect();
        const offset = Math.max(-18, Math.min(18, (window.innerHeight / 2 - (rect.top + rect.height / 2)) * .025));
        item.style.setProperty('--parallax-y', `${offset.toFixed(1)}px`);
      }));
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); cancelAnimationFrame(frame); };
  }, [route]);
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (reduceMotion || touch) return undefined;
    let cancelled = false;
    let cleanup;
    Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('lenis')]).then(([gsapModule, triggerModule, lenisModule]) => {
      if (cancelled) return;
      const gsap = gsapModule.default;
      const { ScrollTrigger } = triggerModule;
      const Lenis = lenisModule.default;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: .9 });
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      cleanup = () => { gsap.ticker.remove(tick); lenis.destroy(); };
    }).catch((error) => console.error('Không tải được hiệu ứng cuộn:', error));
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  useEffect(() => { if (!active && !doctorOpen) return; const onKey = (e) => e.key === 'Escape' && (setActive(null), setDoctorOpen(false)); window.addEventListener('keydown', onKey); document.body.classList.add('modal-open'); return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); }; }, [active, doctorOpen]);
  useEffect(() => {
    const openChat = () => { setActive('chat'); setDoctorOpen(false); };
    window.addEventListener('garden:open-chat', openChat);
    return () => window.removeEventListener('garden:open-chat', openChat);
  }, []);
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (reduceMotion.matches || !finePointer.matches) return undefined;
    const petals = new Set();
    let last = null;
    let glyphIndex = 0;
    const glyphs = ['✿', '❀', '✳', '✦'];
    const spawn = (event) => {
      if (event.pointerType !== 'mouse') return;
      if (last && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 44) return;
      last = { x: event.clientX, y: event.clientY };
      const petal = document.createElement('span');
      petal.className = 'cursor-petal';
      petal.setAttribute('aria-hidden', 'true');
      petal.textContent = glyphs[glyphIndex++ % glyphs.length];
      petal.style.left = `${event.clientX}px`;
      petal.style.top = `${event.clientY}px`;
      document.body.append(petal);
      petals.add(petal);
      while (petals.size > 25) {
        const oldest = petals.values().next().value;
        oldest.remove();
        petals.delete(oldest);
      }
      petal.addEventListener('animationend', () => { petals.delete(petal); petal.remove(); }, { once: true });
    };
    document.addEventListener('pointermove', spawn, { passive: true });
    return () => { document.removeEventListener('pointermove', spawn); petals.forEach((petal) => petal.remove()); };
  }, []);
  const CurrentFeature = FEATURES.find((item) => item.id === active);
  const backendReady = health?.status === 'ok' && health?.ready === true;
  const checkBackend = () => healthCheckRef.current?.();
  return <div className="site-shell">
    <header className={`topbar ${scrolled ? 'topbar-scrolled' : ''}`}>
      <a className="brand" href="/" aria-label="Vườn Hoa, về đầu trang"><span className="brand-flower">✿</span><span>Vườn Hoa<span className="brand-dot">.</span></span></a>
      <nav className="main-nav" aria-label="Điều hướng chính"><a href="/#the-gioi-hoa">Thế giới hoa</a><a href="/#khu-vuon-ai">Khu vườn AI</a><a href="/#vuon-3d">Vườn 3D</a><a href="/bach-khoa" onClick={(event) => { event.preventDefault(); navigate('/bach-khoa'); }}>Bách khoa</a><a href="/tang-hoa" onClick={(event) => { event.preventDefault(); navigate('/tang-hoa'); }}>Tặng hoa</a><button type="button" className="nav-doctor-button" onClick={() => { setDoctorInitialView('ask'); setDoctorOpen(true); }}>Bác sĩ hoa</button></nav>
      <div className={`service-state ${backendReady ? 'service-ready' : 'service-waking'}`} aria-live="polite"><i className={backendReady ? 'state-dot online' : 'state-dot waking-dot'} />{backendReady ? 'Khu vườn đang mở' : <><span>Khu vườn đang thức dậy, đợi chút nhé…</span><button type="button" onClick={checkBackend} aria-label="Thử kết nối lại với khu vườn AI">↻</button></>}</div>
    </header>

    <main key={route} className="page-transition">{sharedGift ? <SharedGiftCardPage card={sharedGift}/> : route === '/tang-hoa' ? <Suspense fallback={<div className="garden3d-fallback section-wrap">Đang mở sổ quà tặng…</div>}><GiftAdvisor/></Suspense> : route === '/bach-khoa' ? <EncyclopediaPage navigate={navigate}/> : route.startsWith('/bach-khoa/') ? <FlowerDetailPage flower={speciesData.find((item) => `/bach-khoa/${item.id}` === route)} navigate={navigate} openGardenCare={openGardenCare}/> : <>

      <section className="hero section-wrap" id="home"><NoiseOverlay id="hero-grain"/>
        <div className="hero-copy"><span className="eyebrow"><span>✳</span> MỘT KHU VƯỜN CÓ TRÍ TUỆ</span><h1>Mỗi bông hoa<br/>kể một <em>câu chuyện.</em></h1><p className="hero-lede">Cùng AI khám phá sắc màu, tên gọi và những điều kỳ diệu đang nở trong khu vườn nhỏ này.</p><div className="hero-actions"><a className="primary-button" href="#khu-vuon-ai">Bước vào khu vườn <span>↗</span></a><button className="hero-doctor-shortcut" type="button" onClick={() => { setDoctorInitialView('ask'); setDoctorOpen(true); }}><span aria-hidden="true">✿</span>Bác sĩ hoa <i>↗</i></button></div><div className="hero-note"><span className="note-spark">✦</span><span>{FLOWERS.length} loài AI · {FEATURES.length} trải nghiệm</span></div></div>
        <Flowerfield/>
        <div className="hero-bottom"><span>MỘT CHÚT NẮNG, MỘT CHÚT HOA</span><a href="#the-gioi-hoa" aria-label="Cuộn xuống">↓</a></div>
      </section>


      <section className="ai-section" id="khu-vuon-ai"><div className="ai-glass-inner section-wrap"><div className="section-heading ai-heading"><div><span className="eyebrow">NĂM CÁCH KHÁM PHÁ KHU VƯỜN</span><h2>Khám phá <em>khu vườn.</em></h2></div><p>Bốn công cụ AI để nhận diện, khoanh vùng, tìm ảnh và hỏi đáp; thêm Bác sĩ hoa để tra cứu cách chăm sóc từ cẩm nang.</p></div>
        {!backendReady && <div className="garden-waking" role="status"><span className="waking-flower" aria-hidden="true">✿</span><div><b>Khu vườn đang thức dậy</b><p>{healthError ? 'Máy chủ đang khởi động lại. Trang sẽ tự kết nối lại trong giây lát.' : 'Đang kiểm tra kết nối để chuẩn bị các công cụ AI.'}</p></div><span className="waking-dots" aria-hidden="true"><i/><i/><i/></span></div>}
        <div className={`feature-grid${backendReady ? '' : ' feature-grid-waking'}`}>{FEATURES.map((item, i) => <button data-tilt className={`feature-card tilt-card feature-${item.color}`} key={item.id} disabled={!backendReady} onClick={() => setActive(item.id)}><div className="feature-top"><span className="feature-icon"><FeatureBotanicalIcon id={item.id}/></span><div className="feature-top-meta"><span className="feature-index">0{i + 1}</span><span className="model-chip">{item.modelLabel}</span></div></div><div className="feature-text"><span className="feature-subtitle">{item.subtitle}</span><h3>{item.title}</h3><p>{item.desc}</p></div><div className="feature-bottom"><span className="feature-prompt">{backendReady ? item.prompt : 'Sẵn sàng sau khi kết nối'}</span><span className="feature-arrow">↗</span></div></button>)}
          <button data-tilt className="feature-card tilt-card feature-green feature-doctor" type="button" onClick={() => { setDoctorInitialView('ask'); setDoctorOpen(true); }}><div className="feature-top"><span className="feature-icon"><FeatureBotanicalIcon id="doctor"/></span><div className="feature-top-meta"><span className="feature-index">05</span><span className="model-chip">RAG · CẨM NANG</span></div></div><div className="feature-text"><span className="feature-subtitle">TƯ VẤN CÓ NGUỒN · SỔ CHĂM CÂY</span><h3>Bác sĩ hoa</h3><p>Hỏi về dấu hiệu của cây, xem lịch chăm và theo dõi những chậu hoa đang trồng.</p></div><div className="feature-bottom"><span className="feature-prompt">Mở tư vấn & sổ chăm cây</span><span className="feature-arrow">↗</span></div></button>
        </div>
      </div></section>

      <FlowerOfMonth navigate={navigate}/>
      <section className="story-intro section-wrap"><div><span className="eyebrow">NHẬT KÝ THỰC VẬT · {FEATURED_FLOWERS.length} LOÀI NỔI BẬT</span><h2>Sắc hoa,<br/><em>nét duyên riêng.</em></h2></div><p>Cả {FEATURED_FLOWERS.length} loài nổi bật đều có ảnh chụp thật.</p></section>
      <ScrollGarden/>
      <Suspense fallback={<div className="garden3d-fallback section-wrap">Đang chuẩn bị khu vườn tương tác…</div>}><InteractiveGarden/></Suspense>

    <section className="encyclopedia section-wrap" id="bach-khoa"><div className="ency-copy"><span className="eyebrow">BÁCH KHOA · {FLOWERS.length} LOÀI</span><h2>Gặp hoa qua<br/>ảnh chụp <em>thật.</em></h2><p>Tra cứu {FLOWERS.length} loài hoa có trong bộ dữ liệu nhận diện AI, lọc theo màu, mùa hoặc tìm bằng tên.</p><a className="text-link" href="/bach-khoa" onClick={(event) => { event.preventDefault(); navigate('/bach-khoa'); }}>Khám phá {FLOWERS.length} loài hoa <span>→</span></a></div><div className="ency-art"><div className="ency-sun"/>{FEATURED_FLOWERS.filter((flower) => flower.encyclopedia_photo).map((flower, index) => <img key={flower.id} className={`ency-photo-art ency-photo-art-${index + 1} display-flower-photo`} style={{ '--display-photo-grade': displayImageData.colorGrading.cssFilter }} src={flowerDisplayImage(flower)} alt="" loading="lazy"/>)}<span className="ency-note note-two">✳</span></div></section>
    </> }</main>

    <footer className="footer"><div className="footer-leaves" aria-hidden="true">❧ ✿ ❧</div><a className="brand footer-brand" href="/"><span className="brand-flower">✿</span><span>Vườn Hoa<span className="brand-dot">.</span></span></a><p>Một khu vườn nhỏ để học, ngắm và khám phá bằng AI.</p><a className="gift-footer-link" href="/tang-hoa" onClick={(event) => { event.preventDefault(); navigate('/tang-hoa'); }}>Chọn hoa để tặng · Sổ hoa của tôi ↗</a><button className="gift-footer-link footer-doctor-button" type="button" onClick={() => { setDoctorInitialView('garden'); setDoctorOpen(true); }}>Mở Bác sĩ hoa · sổ chăm cây ↗</button><span className="footer-copy">ĐỒ ÁN LẬP TRÌNH WEB NÂNG CAO · NHÓM 10</span></footer>

    {CurrentFeature && <div className="feature-modal" role="dialog" aria-modal="true" aria-label={CurrentFeature.title} onMouseDown={(e) => e.target === e.currentTarget && setActive(null)}><div className={`modal-panel feature-${CurrentFeature.color}`}><div className="modal-header"><div className="modal-title"><span className="feature-icon">{CurrentFeature.icon}</span><div><span className="feature-subtitle">{CurrentFeature.subtitle}</span><h2>{CurrentFeature.title}</h2></div></div><button className="close-button" onClick={() => setActive(null)} aria-label="Đóng">×</button></div><div className="modal-body">{!backendReady && active !== 'chat' ? <div className="garden-waking" role="status"><span className="waking-flower" aria-hidden="true">✿</span><div><b>Khu vườn đang thức dậy</b><p>Đang chờ máy chủ AI sẵn sàng. Trang sẽ tự kết nối lại.</p></div><button type="button" className="button" onClick={checkBackend}>Thử lại</button></div> : <>{!backendReady && active === 'chat' && <div className="garden-waking" role="status"><span className="waking-flower" aria-hidden="true">✿</span><div><b>Chatbot đang thử kết nối</b><p>Bạn vẫn có thể xem câu hỏi và thử gửi; nếu backend chưa sẵn sàng, hệ thống sẽ báo để thử lại.</p></div><button type="button" className="button" onClick={checkBackend}>Thử lại</button></div>}<div className="feature-flow" aria-label="Quy trình xử lý">{FEATURE_INTROS[active].map((step, index) => <div className="feature-flow-step" key={step}><span>0{index + 1}</span><b>{step}</b>{index < 2 && <i aria-hidden="true">→</i>}</div>)}</div><FeatureErrorBoundary key={active}><Suspense fallback={<div className="feature-module-loading" role="status"><p className="loading-skeleton"/><span>Đang chuẩn bị công cụ AI…</span></div>}><CurrentFeature.Component/></Suspense></FeatureErrorBoundary></>}</div></div></div>}
    {doctorOpen && <div className="feature-modal doctor-modal" role="dialog" aria-modal="true" aria-label="Bác sĩ hoa" onMouseDown={(event) => event.target === event.currentTarget && setDoctorOpen(false)}><div className="modal-panel feature-green"><div className="modal-header"><div className="modal-title"><span className="doctor-invite-flower" aria-hidden="true">✿</span><div><span className="feature-subtitle">CẨM NANG · TƯ VẤN CÓ NGUỒN</span><h2>Bác sĩ hoa & chăm cây</h2></div></div><button className="close-button" onClick={() => setDoctorOpen(false)} aria-label="Đóng">×</button></div><div className="modal-body"><FeatureErrorBoundary><DoctorCare initialView={doctorInitialView}/></FeatureErrorBoundary></div></div></div>}
  </div>;
}
