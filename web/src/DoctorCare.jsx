import { useState } from 'react';
import { friendlyFailure, streamChat } from './api.js';

const QUESTIONS = [
  'Lá có đốm vàng hoặc nâu',
  'Nụ bị teo hoặc không nở',
  'Cây héo dù đất còn ẩm',
  'Lá non bị xoăn',
];

export default function DoctorCare() {
  const [speciesName, setSpeciesName] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async (event) => {
    event?.preventDefault();
    if (!symptoms.trim() || busy) return;
    setBusy(true);
    setAnswer('');
    setSources([]);
    setError('');
    const message = `Tôi đang chăm ${speciesName.trim() || 'một cây hoa chưa rõ loài'}. Dấu hiệu quan sát được: ${symptoms.trim()}. Hãy chỉ tổng hợp hướng dẫn có trong tài liệu, nêu những khả năng cần kiểm tra chứ không khẳng định chẩn đoán bệnh. Gợi ý các bước chăm sóc an toàn, dấu hiệu nào cần hỏi chuyên gia, và dẫn nguồn.`;
    try {
      await streamChat({
        message,
        history: [],
        onSources: setSources,
        onToken: (token) => setAnswer((current) => current + token),
      });
    } catch (requestError) {
      setError(friendlyFailure(requestError));
    } finally {
      setBusy(false);
    }
  };

  return <div className="doctor-care">
    <div className="doctor-care-heading"><span className="doctor-care-icon" aria-hidden="true">✿</span><div><span className="eyebrow">CÔ LÀM VƯỜN · RAG CÓ NGUỒN</span><h2>Hoa đang cần được chăm?</h2><p>Mô tả điều m thấy; trợ lý sẽ tra cẩm nang và gợi ý bước kiểm tra tiếp theo.</p></div></div>
    <form className="doctor-care-form" onSubmit={ask}>
      <label>Tên hoa (nếu biết)<input value={speciesName} onChange={(event) => setSpeciesName(event.target.value)} placeholder="Ví dụ: hoa hồng" maxLength={100}/></label>
      <label>Dấu hiệu đang quan sát<textarea required rows="3" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="Ví dụ: mặt dưới lá có đốm đen, vài lá đã vàng và rụng…" maxLength={1200}/></label>
      <div className="doctor-symptoms" aria-label="Gợi ý dấu hiệu">{QUESTIONS.map((question) => <button type="button" key={question} onClick={() => setSymptoms((value) => value ? `${value}; ${question.toLocaleLowerCase('vi')}` : question)}>{question} +</button>)}</div>
      <button className="primary-button" type="submit" disabled={busy || !symptoms.trim()}>{busy ? 'Đang tra cẩm nang…' : 'Hỏi cô làm vườn'} <span>↗</span></button>
    </form>
    {busy && !answer && <p className="doctor-typing" role="status"><i/><i/><i/> Đang đọc tài liệu chăm sóc hoa…</p>}
    {error && <div className="doctor-error" role="alert"><p>{error}</p><button type="button" onClick={ask} disabled={busy}>Thử lại</button></div>}
    {answer && <div className="doctor-answer" aria-live="polite"><span className="eyebrow">GỢI Ý TỪ CẨM NANG</span><p>{answer}</p>{sources.length > 0 && <details className="doctor-sources"><summary>{sources.length} nguồn tham khảo</summary><ul>{sources.map((source, index) => <li key={`${source.source || 'nguon'}-${index}`}><b>{source.source}{source.page ? ` · trang ${source.page}` : ''}</b><span>{source.text}</span></li>)}</ul></details>}</div>}
    <p className="doctor-care-disclaimer">Đây là trợ lý tra cứu cẩm nang, không phải mô hình chẩn đoán bệnh qua ảnh. Nếu dấu hiệu lan nhanh hoặc cây suy nặng, hãy hỏi chuyên gia/đơn vị khuyến nông địa phương.</p>
  </div>;
}
