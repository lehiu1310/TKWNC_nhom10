import { useEffect, useRef, useState } from 'react';
import { friendlyFailure, streamChat } from '../api.js';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitingForToken, setWaitingForToken] = useState(false);
  const abortRef = useRef(null);
  const typingQueue = useRef([]);
  const typingTimer = useRef(null);
  useEffect(() => () => {
    abortRef.current?.abort();
    window.clearInterval(typingTimer.current);
    typingQueue.current = [];
  }, []);

  function patchLastAssistant(update) {
    setMessages((current) => {
      const last = current[current.length - 1];
      if (!last || last.role !== 'assistant') return current;
      return [...current.slice(0, -1), update(last)];
    });
  }

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: text }, { role: 'assistant', content: '', sources: [] }]);
    setInput('');
    setBusy(true);
    setWaitingForToken(true);
    typingQueue.current = [];
    abortRef.current = new AbortController();
    typingTimer.current = window.setInterval(() => {
      const character = typingQueue.current.shift();
      if (character !== undefined) patchLastAssistant((last) => ({ ...last, content: last.content + character }));
      else setWaitingForToken(true);
    }, 14);
    try {
      await streamChat({
        message: text,
        history,
        signal: abortRef.current.signal,
        onSources: (items) => patchLastAssistant((last) => ({ ...last, sources: items })),
        onToken: (token) => {
          setWaitingForToken(false);
          typingQueue.current.push(...Array.from(token));
        },
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        setWaitingForToken(false);
        const message = `Cô làm vườn đang nghỉ một chút. ${friendlyFailure(error)}`;
        typingQueue.current.push(...Array.from(message));
      }
    } finally {
      while (typingQueue.current.length) await new Promise((resolve) => window.setTimeout(resolve, 16));
      window.clearInterval(typingTimer.current);
      typingTimer.current = null;
      setWaitingForToken(false);
      setBusy(false);
    }
  }

  return <section className="chat">
    <h2>Cùng trò chuyện về những bông hoa</h2><p className="muted">Hãy hỏi về đặc điểm, cách chăm sóc hay ý nghĩa của một loài. Câu trả lời được tạo từ những đoạn cẩm nang liên quan, và nguồn tham khảo sẽ hiện bên dưới.</p>
    <div className="messages" aria-live="polite">{messages.length === 0 && <div className="chat-welcome"><span className="chat-gardener">✿</span><p>“Hoa hạnh phúc là hoa bạn tự tay chăm sóc.”<br/><small>Thử hỏi: Hoa tulip có ý nghĩa gì?</small></p></div>}{messages.map((message, index) => <div key={index} className={`msg ${message.role}`}><p>{message.content}{busy && index === messages.length - 1 && message.role === 'assistant' && waitingForToken && <span className="chat-typing" aria-label="Đang chờ câu trả lời"><i/><i/><i/></span>}</p>{message.sources?.length > 0 && <div className="chat-sources"><span className="sources-label">CẨM NANG THAM KHẢO · {message.sources.length}</span>{message.sources.map((source, sourceIndex) => <details data-tilt className="source-card tilt-card" key={`${source.source}-${sourceIndex}`}><summary><span>{source.source}</span>{Number.isFinite(source.score) && <b>{(source.score * 100).toFixed(0)}%</b>}</summary><p>{source.text}</p></details>)}</div>}</div>)}</div>
    <form className="row" onSubmit={send}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Hỏi cô làm vườn về một loài hoa…" aria-label="Tin nhắn" disabled={busy}/>{busy ? <button type="button" className="button" onClick={() => abortRef.current?.abort()}>Dừng</button> : <button type="submit" className="button" disabled={!input.trim()}>Gửi <span>→</span></button>}</form>
  </section>;
}
