import { useEffect, useMemo, useState } from 'react';
import speciesData from '../../data/species.json';
import displayImages from '../../data/display_images.json';
import { addGardenPlant, addGardenReminder, CARE_TYPES, completeCare, listCareTasks, listUpcomingReminders, readGarden, removeGardenPlant, removeGardenReminder, setCareInterval } from './gardenPlanner.js';

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
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const plants = garden.plants.map((plant) => ({ ...plant, flower: FLOWERS[plant.speciesId] })).filter((plant) => plant.flower);
  const tasks = useMemo(() => listCareTasks(garden, clock), [garden, clock]);
  const dueTasks = tasks.filter((task) => task.overdue);
  const upcomingEvents = useMemo(() => listUpcomingReminders(garden, clock, 30), [garden, clock]);
  const remindersToNotify = useMemo(() => listUpcomingReminders(garden, clock, 3), [garden, clock]);
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
    if (permission !== 'granted' || (!dueTasks.length && !remindersToNotify.length)) return;
    let sent = [];
    try { sent = JSON.parse(localStorage.getItem('vuon-hoa-reminders-sent-v1') || '[]'); } catch { sent = []; }
    const nextSent = [...sent];
    dueTasks.forEach((task) => {
      const key = `${task.plantId}:${task.careType}:${task.dueAt.toISOString().slice(0, 10)}`;
      if (sent.includes(key)) return;
      const flower = FLOWERS[task.speciesId];
      try { new Notification(`Đến lịch chăm ${flower?.name_vi || 'cây hoa'}`, { body: task.label, tag: key }); nextSent.push(key); } catch { /* Keep the in-page due task visible if the browser blocks notifications. */ }
    });
    remindersToNotify.forEach((reminder) => {
      const dateKey = reminder.dueAt.toISOString().slice(0, 10);
      const key = `event:${reminder.id}:${dateKey}`;
      if (sent.includes(key)) return;
      try { new Notification(`Sắp đến ${reminder.title}`, { body: `Còn không quá 3 ngày · ${dateLabel(reminder.dueAt)}`, tag: key }); nextSent.push(key); } catch { /* Keep the reminder in the page if OS notifications are unavailable. */ }
    });
    localStorage.setItem('vuon-hoa-reminders-sent-v1', JSON.stringify(nextSent.slice(-300)));
  }, [permission, dueTasks, remindersToNotify]);

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

  function saveEvent(event) {
    event.preventDefault();
    const next = addGardenReminder(eventTitle, eventDate);
    if (next.reminders.length === garden.reminders.length) { setNotice('Hãy nhập tên và ngày hợp lệ cho dịp nhắc.'); return; }
    setGarden(next);
    setEventTitle('');
    setEventDate('');
    setNotice('Đã lưu dịp nhắc hằng năm. Nếu bật thông báo, web sẽ nhắc trước 3 ngày khi bạn mở trang.');
  }

  function updateInterval(plantId, type, value) {
    setGarden(setCareInterval(plantId, type, value === '' ? 0 : value));
  }

  function markDone(task) {
    setGarden(completeCare(task.plantId, task.careType));
    setNotice('Đã ghi nhận việc chăm cây. Lịch tiếp theo được tính lại từ hôm nay.');
  }

  return <main className="planner-page section-wrap">
    <header className="planner-hero"><a className="back-home" href="/#the-gioi-hoa">← Về khu vườn</a><span className="eyebrow">VƯỜN CỦA TÔI · LỊCH CHĂM CÁ NHÂN</span><h1>Chăm cây theo<br/><em>nhịp của bạn.</em></h1><p>Thêm những loài bạn đang trồng, tự đặt nhắc lịch và ghi lại mỗi lần chăm. Dữ liệu chỉ lưu trên trình duyệt này.</p></header>

    <section className="planner-add panel-card" aria-labelledby="planner-add-heading"><div><span className="eyebrow">BẮT ĐẦU TỪ MỘT CHẬU HOA</span><h2 id="planner-add-heading">Thêm hoa vào vườn</h2><p>Chọn trong danh mục hoa để tạo lịch riêng theo chậu, đất và thời tiết nơi bạn trồng.</p></div><div className="planner-add-controls"><label htmlFor="planner-flower-search">Tìm loài hoa</label><input id="planner-flower-search" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(''); }} placeholder="Tên Việt, tên quốc tế…" autoComplete="off"/>{query && matches.length > 0 && <div className="planner-options" role="listbox">{matches.map((flower) => <button type="button" role="option" aria-selected={selected === flower.id} key={flower.id} onClick={() => { setSelected(flower.id); setQuery(flower.name_vi); }}>{flower.name_vi}<small>{flower.name_en}</small></button>)}</div>}<button className="primary-button" type="button" disabled={!selected} onClick={addSelected}>＋ Thêm vào vườn</button></div></section>

    <section className="planner-reminders panel-card" aria-labelledby="planner-reminders-heading"><div className="planner-reminder-copy"><span className="planner-reminder-icon" aria-hidden="true">◷</span><div><span className="eyebrow">NHẮC VIỆC TRÊN THIẾT BỊ NÀY</span><h2 id="planner-reminders-heading">{dueTasks.length ? `${dueTasks.length} việc chăm đang đến lịch` : 'Giữ nhịp chăm cây nhẹ nhàng'}</h2><p>Thông báo trình duyệt chỉ hoạt động khi quyền được cấp và trang web có thể chạy. Không tưới theo lịch nếu đất vẫn còn ẩm.</p></div></div><button type="button" className="planner-notify-button" onClick={enableNotifications}>{permission === 'granted' ? '✓ Đã bật thông báo' : permission === 'unsupported' ? 'Thiết bị không hỗ trợ' : 'Bật thông báo'}</button></section>
    <section className="planner-weather panel-card" aria-label="Dự báo thời tiết cho khu vườn"><div><span className="eyebrow">THỜI TIẾT TẠI VỊ TRÍ CỦA BẠN</span><h2>Trời sắp mưa không?</h2><p>Chỉ lấy vị trí khi bạn bấm nút. Dự báo giúp tham khảo; hãy kiểm tra độ ẩm trong chậu trước khi tưới.</p>{weather.status === 'loading' && <p className="planner-weather-status" role="status">Đang lấy vị trí và dự báo…</p>}{weather.status === 'error' && <p className="planner-weather-error" role="alert">{weather.message}</p>}{weather.status === 'ready' && <div className="planner-weather-result" role="status"><b>{weather.temperature}°C</b><span>Mưa hôm nay: {weather.probability}% · lượng mưa dự báo {weather.rainfall} mm</span><p>{weather.probability >= 50 || weather.rainfall >= 1 ? 'Có khả năng mưa. Hãy kiểm tra đất/chậu và tránh tưới thêm nếu giá thể còn ẩm.' : 'Dự báo ít mưa. Chỉ tưới nếu đất bắt đầu khô; dự báo không thay thế kiểm tra tại chậu.'}</p><small>Cập nhật lúc {dateLabel(weather.checkedAt)} · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Dữ liệu Open-Meteo ↗</a></small></div>}</div><button type="button" className="planner-weather-button" onClick={checkWeather} disabled={weather.status === 'loading'}>{weather.status === 'loading' ? 'Đang tải…' : weather.status === 'ready' ? '↻ Cập nhật thời tiết' : '⌖ Cho phép vị trí & xem dự báo'}</button></section>
    <section className="planner-events panel-card" aria-labelledby="planner-events-heading"><div className="planner-events-heading"><div><span className="eyebrow">SINH NHẬT · KỶ NIỆM · NGÀY ĐẶC BIỆT</span><h2 id="planner-events-heading">Nhớ những ngày quan trọng</h2><p>Lưu lịch hằng năm và nhận nhắc trước 3 ngày khi trang đang mở, thông báo đã được cấp quyền.</p></div><span aria-hidden="true">♡</span></div><form className="planner-event-form" onSubmit={saveEvent}><label>Tên dịp<input required maxLength="80" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Ví dụ: Sinh nhật mẹ"/></label><label>Ngày<input required type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)}/></label><button className="planner-notify-button" type="submit">＋ Lưu ngày</button></form>{upcomingEvents.length ? <ul className="planner-event-list">{upcomingEvents.map((reminder) => <li key={reminder.id}><span className="planner-event-date">{dateLabel(reminder.dueAt)}</span><b>{reminder.title}</b><small>Còn {Math.max(0, Math.ceil((reminder.dueAt - clock) / 86_400_000))} ngày</small><button type="button" aria-label={`Xoá lịch ${reminder.title}`} onClick={() => setGarden(removeGardenReminder(reminder.id))}>×</button></li>)}</ul> : <p className="planner-event-empty">Chưa có ngày đặc biệt sắp tới trong 30 ngày.</p>}</section>
    {notice && <p className="planner-notice" role="status">{notice}</p>}

    <section className="planner-list-section"><div className="planner-section-heading"><div><span className="eyebrow">SỔ CHĂM SÓC</span><h2>Những chậu hoa của bạn <span>{plants.length}</span></h2></div><p>Tự chọn chu kỳ nhắc phù hợp; để trống hoặc 0 ngày nếu không cần nhắc.</p></div>
      {plants.length ? <div className="planner-plant-list">{plants.map(({ id, flower, intervals }) => <article className="planner-plant-card" key={id} style={{ '--plant-accent': flower.color }}><div className="planner-plant-image"><img src={imageFor(flower)} alt={`Hoa ${flower.name_vi}`} loading="lazy"/><span style={{ background: flower.color }}/></div><div className="planner-plant-main"><div className="planner-plant-title"><div><h3>{flower.name_vi}</h3><small>{flower.name_en}</small></div><button className="planner-remove" type="button" onClick={() => { setGarden(removeGardenPlant(id)); setNotice(`Đã bỏ ${flower.name_vi} khỏi vườn.`); }} aria-label={`Bỏ ${flower.name_vi} khỏi vườn`}>×</button></div><p>{flower.long_description || flower.description}</p><div className="planner-cadences">{CARE_TYPES.map((care) => { const task = tasks.find((item) => item.plantId === id && item.careType === care.id); return <div className={`planner-cadence${task?.overdue ? ' is-due' : ''}`} key={care.id}><label htmlFor={`${id}-${care.id}`}><span>{care.icon}</span>{care.label}</label><div className="planner-cadence-controls"><input id={`${id}-${care.id}`} type="number" min="0" max="365" inputMode="numeric" value={intervals[care.id] || ''} placeholder="—" onChange={(event) => updateInterval(id, care.id, event.target.value)}/><span>ngày</span>{task && <small>{task.overdue ? `Đến hạn ${dateLabel(task.dueAt)}` : `Tiếp theo ${dateLabel(task.dueAt)}`}</small>}{task?.overdue && <button type="button" onClick={() => markDone(task)}>Đã chăm ✓</button>}</div></div>; })}</div></div></article>)}</div> : <div className="planner-empty"><span aria-hidden="true">✿</span><h3>Vườn của bạn đang chờ những chậu hoa đầu tiên</h3><p>Thêm một loài ở phía trên rồi tự đặt nhịp nhắc chăm phù hợp với điều kiện trồng thực tế.</p></div>}
    </section>
    <aside className="planner-care-note"><b>Một lưu ý nhỏ</b><p>Các khoảng ngày là do bạn tự đặt, không phải lịch khuyến nghị cố định cho mọi giống. Hãy kiểm tra độ ẩm đất trước khi tưới, làm theo nhãn phân bón, và điều chỉnh theo chậu cùng khí hậu địa phương.</p></aside>
  </main>;
}
