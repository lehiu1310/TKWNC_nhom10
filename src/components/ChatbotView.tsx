import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Flower2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChatMessage, RAGSource } from '../types';

interface ChatbotViewProps {
  initialQuestion?: string | null;
}

export const ChatbotView: React.FC<ChatbotViewProps> = ({ initialQuestion }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Xin chào bạn! Mình là Cô làm vườn — trợ lý hỏi đáp thực vật học và cẩm nang hoa. Bạn có thể hỏi mình về kỹ thuật tưới nước, bón phân, đặc điểm các loài hoa hoặc tra cứu mùa hoa ở Việt Nam nhé!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [activeSources, setActiveSources] = useState<RAGSource[] | null>(null);
  const [expandedSourceIndex, setExpandedSourceIndex] = useState<number | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Web Speech API Voice Typing
  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói Web Speech.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  // Web Speech Synthesis (Text-to-Speech)
  const speakMessage = (msgId: string, text: string) => {
    if (!window.speechSynthesis) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\[.+?\]/g, '').replace(/\*/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const samplePrompts = [
    'Hoa hồng nên tưới nước và tỉa cành như thế nào?',
    'Cúc họa mi thường nở vào tháng mấy ở miền Bắc?',
    'Hoa tulip có trồng được ở khí hậu mát mẻ không?',
    'Bồ công anh có những công dụng gì trong đông y?',
    'Lịch các mùa hoa đặc trưng bốn mùa ở Việt Nam?',
    'Đất trồng hoa cần những thành phần dinh dưỡng gì?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const sendMessage = async (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : input;
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, assistantMsg]);

    try {
      // Use SSE streaming via /api/chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Streaming failed, fallback to sync');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.type === 'sources') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, sources: payload.items } : m
                  )
                );
                setActiveSources(payload.items);
              } else if (payload.type === 'token') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + payload.text }
                      : m
                  )
                );
              } else if (payload.type === 'done') {
                setIsStreaming(false);
              }
            } catch (err) {
              // ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (err) {
      console.warn('SSE stream failed, falling back to sync chat endpoint:', err);
      try {
        const syncRes = await fetch('/api/chat/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        const syncData = await syncRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: syncData.answer || 'Mình chưa có thông tin này.',
                  sources: syncData.sources || [],
                }
              : m
          )
        );
        setActiveSources(syncData.sources || []);
      } catch (syncErr) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: 'Rất tiếc, hiện tại kết nối đến trợ lý đang gặp gián đoạn.',
                }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (initialQuestion) {
      sendMessage(initialQuestion);
    }
  }, [initialQuestion]);

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Title Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">
          <Bot className="w-3.5 h-3.5" />
          <span>Ứng Dụng 4 &bull; RAG Tiếng Việt (BM25 + Gemini 3.8 Flash)</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-stone-900">
          Cô Làm Vườn — Trợ Lý Hỏi Đáp Thực Vật Học
        </h1>
        <p className="text-sm text-stone-600">
          Trợ lý RAG thông minh trả lời dựa trên cẩm nang kiến thức hoa tiếng Việt. Mọi câu trả lời đều được 
          đối chiếu và trích dẫn trực tiếp từ các tài liệu chuẩn (<code>[hoa_hong.md]</code>, <code>[cham_soc_hoa.md]</code>...).
        </p>
      </div>

      {/* Main Chat Container */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden flex flex-col h-[600px]">
        {/* Chat Header Bar */}
        <div className="p-4 bg-stone-50/90 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Flower2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-stone-900">Cô làm vườn</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold">
                  RAG Online
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Sẵn sàng tư vấn chăm sóc, mùa nở và ý nghĩa hoa
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              setMessages([
                {
                  id: 'reset',
                  role: 'assistant',
                  content: 'Cuộc trò chuyện đã được làm mới. Bạn muốn hỏi về loài hoa nào?',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ])
            }
            title="Làm mới cuộc trò chuyện"
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Message History List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[88%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold ${
                    isUser
                      ? 'bg-emerald-700 text-white'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className="space-y-1.5">
                  <div
                    className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-emerald-700 text-white rounded-tr-xs'
                        : 'bg-stone-100 text-stone-800 rounded-tl-xs'
                    }`}
                  >
                    {msg.content || (
                      <span className="inline-flex items-center gap-1.5 text-stone-400 italic">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        Đang tra cứu tài liệu &amp; soạn câu trả lời...
                      </span>
                    )}
                  </div>

                  {/* Sources Citations */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 pl-1">
                      <span className="text-[11px] text-stone-400 font-medium">Nguồn:</span>
                      {msg.sources.map((src, idx) => (
                        <button
                          key={idx}
                          onClick={() =>
                            setExpandedSourceIndex(
                              expandedSourceIndex === idx ? null : idx
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-mono cursor-pointer transition-colors"
                        >
                          <FileText className="w-3 h-3 text-purple-600" />
                          <span>{src.source}</span>
                          {expandedSourceIndex === idx ? (
                            <ChevronUp className="w-2.5 h-2.5" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Expanded Source Excerpt Drawer */}
                  {!isUser &&
                    msg.sources &&
                    expandedSourceIndex !== null &&
                    msg.sources[expandedSourceIndex] && (
                      <div className="mt-2 p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-[11px] text-purple-950 space-y-1">
                        <div className="font-bold flex items-center justify-between">
                          <span>
                            Trích xuất từ: {msg.sources[expandedSourceIndex].source}
                          </span>
                          <span className="text-[10px] text-purple-700 font-mono">
                            BM25 score: {msg.sources[expandedSourceIndex].score || 'cao'}
                          </span>
                        </div>
                        <p className="text-stone-700 italic">
                          "{msg.sources[expandedSourceIndex].text}"
                        </p>
                      </div>
                    )}

                  <div className="flex items-center gap-2 text-[10px] text-stone-400 px-1">
                    <span>{msg.timestamp}</span>
                    {!isUser && msg.content && (
                      <button
                        onClick={() => speakMessage(msg.id, msg.content)}
                        title={speakingMsgId === msg.id ? 'Dừng đọc' : 'Đọc câu trả lời (tiếng Việt)'}
                        className={`p-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                          speakingMsgId === msg.id
                            ? 'text-purple-700 bg-purple-100 font-bold'
                            : 'hover:text-purple-700 hover:bg-stone-100'
                        }`}
                      >
                        {speakingMsgId === msg.id ? (
                          <VolumeX className="w-3 h-3" />
                        ) : (
                          <Volume2 className="w-3 h-3" />
                        )}
                        <span>{speakingMsgId === msg.id ? 'Dừng đọc' : 'Đọc'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-stone-50/50 border-t border-stone-100 overflow-x-auto scrollbar-none flex items-center gap-2">
          <span className="text-[11px] text-stone-400 font-medium shrink-0">Gợi ý:</span>
          {samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => sendMessage(prompt)}
              disabled={isStreaming}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-purple-300 hover:bg-purple-50/50 text-[11px] text-stone-700 transition-colors cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-stone-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? 'Đang lắng nghe bạn nói tiếng Việt...' : 'Hỏi Cô làm vườn về cách chăm sóc, mùa hoa hoặc ý nghĩa...'}
              disabled={isStreaming}
              className={`flex-1 px-4 py-2.5 rounded-xl border outline-none text-xs sm:text-sm text-stone-900 transition-colors ${
                isListening
                  ? 'border-red-400 bg-red-50/50 ring-2 ring-red-200 animate-pulse'
                  : 'border-stone-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100'
              }`}
            />
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Dừng ghi âm' : 'Nói tiếng Việt (Mic)'}
              className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-md'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gửi</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
