import { useEffect, useMemo, useState } from 'react';
import speciesData from '../../data/species.json';
import displayImages from '../../data/display_images.json';
import { addGardenPlant, CARE_TYPES, completeCare, listCareTasks, readGarden, removeGardenPlant, setCareInterval } from './gardenPlanner.js';

const FLOWERS = Object.fromEntries(speciesData.map((flower) => [flower.id, flower]));
const imageFor = (flower) => displayImages.images[flower.display_image_key || flower.id]?.url || `/api/species/${encodeURIComponent(flower.id)}/image`;
const dateLabel = (date) => new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' }).format(date);

export default function GardenPlanner() {
  const [garden, setGarden] = useState(readGarden);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [weather, setWeather] = useState({ status: 'idle' });
  const plants = garden.plants.map((plant) => ({ ...plant, flower: FLOWERS[plant.speciesId] })).filter((plant) => plant.flower);
  const tasks = useMemo(() => listCareTasks(garden, clock), [garden, clock]);
  const dueTasks = tasks.filter((task) => task.overdue);
  const matches = speciesData.filter((flower) => !garden.plants.some((plant) => plant.speciesId === flower.id) && `${flower.name_vi} ${flower.name_en} ${flower.id}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).slice(0, 8);

  useEffect(() => {
    const sync = () => setGarden(readGarden());
    window.addEventListener('garden:planner-updated', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('garden:planner-updated', sync); window.removeEventListener('storage', sync); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (permission !== 'granted' || !dueTasks.length) return;
    let sent = [];
    try { sent = JSON.parse(localStorage.getItem('vuon-hoa-care-notifications-v1') || '[]'); } catch { sent = []; }
    const nextSent = [...sent];
    dueTasks.forEach((task) => {
      const key = `${task.plantId}:${task.careType}:${task.dueAt.toISOString().slice(0, 10)}`;
      if (sent.includes(key)) return;
      const flower = FLOWERS[task.speciesId];
      try { new Notification(`Đến lịch chăm ${flower?.name_vi || 'cây hoa'}`, { body: task.label, tag: key }); nextSent.push(key); } catch { /* Keep the in-page due task visible if the browser blocks notifications. */ }
    });
    localStorage.setItem('vuon-hoa-care-notifications-v1', JSON.stringify(nextSent.slice(-300)));
  }, [permission, dueTasks]);

  async function enableNotifications() {
    if (typeof Notification === 'undefined') { setPermission('unsupported'); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    setNotice(result === 'granted' ? 'Đã bật thông báo trên trình duyệt này.' : 'Thông báo chưa được cấp quyền. Lịch chăm sóc vẫn hiển thị ở đây.');
  }

  async function checkWeather() {
    if (!navigator.geolocation) { setWeather({ status: 'error', message: 'Trình duyệt không hỗ trợ xác định vị trí.' }); return; }
    setWeather({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const params = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude), current: 'temperature_2m,precipitation,weather_code', daily: 'precipitation_probability_max,precipitation_sum', forecast_days: '1', timezone: 'auto' });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('weather-unavailable');
        const data = await response.json();
        const probability = data.daily?.precipitation_probability_max?.[0];
        const rainfall = data.daily?.precipitation_sum?.[0];
        const temperature = data.current?.temperature_2m;
        if (![probability, rainfall, temperature].every(Number.isFinite)) throw new Error('weather-incomplete');
        setWeather({ status: 'ready', probability, rainfall, temperature, checkedAt: new Date() });
      } catch (error) {
        setWeather({ status: 'error', message: error.name === 'AbortError' ? 'Yêu cầu thời tiết quá lâu. Thử lại sau nhé.' : 'Chưa lấy được dự báo. Bạn vẫn có thể dùng lịch chăm sóc bình thường.' });
      } finally { window.clearTimeout(timeout); }
    }, (error) => {
      const message = error.code === 1 ? 'Bạn chưa cho phép vị trí. Vị trí chỉ được dùng để hỏi dự báo và không lưu lại.' : 'Không lấy được vị trí. Hãy kiểm tra quyền vị trí của trình duyệt.';
      setWeather({ status: 'error', message });
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30 * 60_000 });
  }

  function addSelected() {
    if (!selected) return;
    setGarden(addGardenPlant(selected));
    setQuery('');
    setSelected('');
    setNotice(`${FLOWERS[selected]?.name_vi} đã được thêm vào vườn của bạn.`);
  }

  function updateInterval(plantId, type, value) {
    setGarden(setCareInterval(plantId, type, value === '' ? 0 : value));
  }

  function markDone(task) {
    setGarden(completeCare(task.plantId, task.careType));
    setNotice('Đã ghi nhận việc chăm cây. Lịch tiếp theo được tính lại từ hôm nay.');
  }

  return <div className="planner-page planner-embedded">
    <header className="planner-hero"><span className="eyebrow">VƯỜN CỦA TÔI · SỔ CHĂM CÂY</span><h1>Theo dõi những<br/><em>chậu hoa của bạn.</em></h1><p>Thêm cây đang trồng, tự đặt chu kỳ nhắc và ghi lại mỗi lần chăm. Dữ liệu chỉ lưu trên trình duyệt này.</p></header>

    <section className="planner-add panel-card" aria-labelledby="planner-add-heading"><div><span className="eyebrow">BẮT ĐẦU TỪ MỘT CHẬU HOA</span><h2 id="planner-add-heading">Thêm hoa vào vườn</h2><p>Chọn trong danh mục hoa để tạo lịch riêng theo chậu, đất và thời tiết nơi bạn trồng.</p></div><div className="planner-add-controls"><label htmlFor="planner-flower-search">Tìm loài hoa</label><input id="planner-flower-search" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(''); }} placeholder="Tên Việt, tên quốc tế…" autoComplete="off"/>{query && matches.length > 0 && <div className="planner-options" role="listbox">{matches.map((flower) => <button type="button" role="option" aria-selected={selected === flower.id} key={flower.id} onClick={() => { setSelected(flower.id); setQuery(flower.name_vi); }}>{flower.name_vi}<small>{flower.name_en}</small></button>)}</div>}<button className="primary-button" type="button" disabled={!selected} onClick={addSelected}>＋ Thêm vào vườn</button></div></section>

    <section className="planner-reminders panel-card" aria-labelledby="planner-reminders-heading"><div className="planner-reminder-copy"><span className="planner-reminder-icon" aria-hidden="true">◷</span><div><span className="eyebrow">NHẮC VIỆC TRÊN THIẾT BỊ NÀY</span><h2 id="planner-reminders-heading">{dueTasks.length ? `${dueTasks.length} việc chăm đang đến lịch` : 'Giữ nhịp chăm cây nhẹ nhàng'}</h2><p>Thông báo trình duyệt chỉ hoạt động khi quyền được cấp và trang web có thể chạy. Không tưới theo lịch nếu đất vẫn còn ẩm.</p></div></div><button type="button" className="planner-notify-button" onClick={enableNotifications}>{permission === 'granted' ? '✓ Đã bật thông báo' : permission === 'unsupported' ? 'Thiết bị không hỗ trợ' : 'Bật thông báo'}</button></section>
    <section className="planner-weather panel-card" aria-label="Dự báo thời tiết cho khu vườn"><div><span className="eyebrow">THỜI TIẾT TẠI VỊ TRÍ CỦA BẠN</span><h2>Trời sắp mưa không?</h2><p>Chỉ lấy vị trí khi bạn bấm nút. Dự báo giúp tham khảo; hãy kiểm tra độ ẩm trong chậu trước khi tưới.</p>{weather.status === 'loading' && <p className="planner-weather-status" role="status">Đang lấy vị trí và dự báo…</p>}{weather.status === 'error' && <p className="planner-weather-error" role="alert">{weather.message}</p>}{weather.status === 'ready' && <div className="planner-weather-result" role="status"><b>{weather.temperature}°C</b><span>Mưa hôm nay: {weather.probability}% · lượng mưa dự báo {weather.rainfall} mm</span><p>{weather.probability >= 50 || weather.rainfall >= 1 ? 'Có khả năng mưa. Hãy kiểm tra đất/chậu và tránh tưới thêm nếu giá thể còn ẩm.' : 'Dự báo ít mưa. Chỉ tưới nếu đất bắt đầu khô; dự báo không thay thế kiểm tra tại chậu.'}</p><small>Cập nhật lúc {dateLabel(weather.checkedAt)} · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Dữ liệu Open-Meteo ↗</a></small></div>}</div><button type="button" className="planner-weather-button" onClick={checkWeather} disabled={weather.status === 'loading'}>{weather.status === 'loading' ? 'Đang tải…' : weather.status === 'ready' ? '↻ Cập nhật thời tiết' : '⌖ Cho phép vị trí & xem dự báo'}</button></section>
    {notice && <p className="planner-notice" role="status">{notice}</p>}

    <section className="planner-list-section"><div className="planner-section-heading"><div><span className="eyebrow">SỔ CHĂM SÓC</span><h2>Những chậu hoa của bạn <span>{plants.length}</span></h2></div><p>Tự chọn chu kỳ nhắc phù hợp; để trống hoặc 0 ngày nếu không cần nhắc.</p></div>
      {plants.length ? <div className="planner-plant-list">{plants.map(({ id, flower, intervals }) => <article className="planner-plant-card" key={id} style={{ '--plant-accent': flower.color }}><div className="planner-plant-image"><img src={imageFor(flower)} alt={`Hoa ${flower.name_vi}`} loading="lazy"/><span style={{ background: flower.color }}/></div><div className="planner-plant-main"><div className="planner-plant-title"><div><h3>{flower.name_vi}</h3><small>{flower.name_en}</small></div><button className="planner-remove" type="button" onClick={() => { setGarden(removeGardenPlant(id)); setNotice(`Đã bỏ ${flower.name_vi} khỏi vườn.`); }} aria-label={`Bỏ ${flower.name_vi} khỏi vườn`}>×</button></div><p>{flower.long_description || flower.description}</p><div className="planner-cadences">{CARE_TYPES.map((care) => { const task = tasks.find((item) => item.plantId === id && item.careType === care.id); return <div className={`planner-cadence${task?.overdue ? ' is-due' : ''}`} key={care.id}><label htmlFor={`${id}-${care.id}`}><span>{care.icon}</span>{care.label}</label><div className="planner-cadence-controls"><input id={`${id}-${care.id}`} type="number" min="0" max="365" inputMode="numeric" value={intervals[care.id] || ''} placeholder="—" onChange={(event) => updateInterval(id, care.id, event.target.value)}/><span>ngày</span>{task && <small>{task.overdue ? `Đến hạn ${dateLabel(task.dueAt)}` : `Tiếp theo ${dateLabel(task.dueAt)}`}</small>}{task?.overdue && <button type="button" onClick={() => markDone(task)}>Đã chăm ✓</button>}</div></div>; })}</div></div></article>)}</div> : <div className="planner-empty"><span aria-hidden="true">✿</span><h3>Vườn của bạn đang chờ những chậu hoa đầu tiên</h3><p>Thêm một loài ở phía trên rồi tự đặt nhịp nhắc chăm phù hợp với điều kiện trồng thực tế.</p></div>}
    </section>
    <aside className="planner-care-note"><b>Một lưu ý nhỏ</b><p>Các khoảng ngày là do bạn tự đặt, không phải lịch khuyến nghị cố định cho mọi giống. Hãy kiểm tra độ ẩm đất trước khi tưới, làm theo nhãn phân bón, và điều chỉnh theo chậu cùng khí hậu địa phương.</p></aside>
  </div>;
}
