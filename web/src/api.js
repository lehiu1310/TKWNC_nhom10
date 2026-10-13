// Mọi lời gọi backend nằm ở đây. API_BASE rỗng = cùng origin (FastAPI phục vụ bản build).
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '';

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : body.detail ? JSON.stringify(body.detail) : detail;
    } catch { /* không phải JSON */ }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

async function prepareImage(file) {
  if (!file || !file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d', { alpha: false })?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'flower'}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function postImage(path, file, fields = {}) {
  const preparedFile = await prepareImage(file);
  const form = new FormData();
  form.append('file', preparedFile);
  Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
  return fetch(`${API_BASE}${path}`, { method: 'POST', body: form }).then(handle);
}

export function postJson(path, body) {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle);
}

export const getHealth = (options = {}) => fetch(`${API_BASE}/api/health`, options).then(handle);

export async function fetchSampleImage(species) {
  const response = await fetch(`${API_BASE}/api/species/${encodeURIComponent(species.id)}/image`);
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  const blob = await response.blob();
  const extension = blob.type === 'image/png' ? 'png' : 'jpg';
  return new File([blob], `${species.id}-mau.${extension}`, { type: blob.type || 'image/jpeg' });
}

export function friendlyFailure(error) {
  console.error('AI request failed:', error);
  const networkError = error instanceof TypeError;
  if (networkError) {
    return 'Khu vườn AI đang khởi động hoặc mất kết nối. Đợi một chút rồi thử lại nhé.';
  }

  const responseError = /^(\d{3}):\s*(.*)$/.exec(error?.message ?? '');
  if (!responseError) return error?.message || 'Đã xảy ra lỗi khi xử lý yêu cầu.';
  const [, status, detail] = responseError;
  if (status === '400' || status === '413' || status === '422') {
    return status === '413' ? 'Ảnh quá lớn để xử lý. Hãy chọn ảnh nhẹ hơn nhé.' : 'Ảnh hoặc thông tin gửi lên chưa hợp lệ. Bạn kiểm tra lại rồi thử lần nữa nhé.';
  }
  if (status === '502' || status === '504') {
    return `Máy chủ AI chưa phản hồi (HTTP ${status}). Bạn đợi một chút rồi thử lại nhé.`;
  }
  if (status === '503') {
    return `Khu vườn AI đang chuẩn bị dữ liệu (HTTP 503). Bạn thử lại sau ít phút nhé.`;
  }
  return `Backend trả lỗi HTTP ${status}${detail ? `: ${detail}` : '.'}`;
}

// Đọc Server-Sent Events từ POST /api/chat. EventSource không hỗ trợ POST nên đọc stream thủ công.
export async function streamChat({ message, history, onSources, onToken, signal }) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal,
  });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop(); // phần chưa trọn vẹn giữ lại cho lần đọc sau
    for (const ev of events) {
      if (!ev.startsWith('data: ')) continue;
      const data = JSON.parse(ev.slice(6));
      if (data.type === 'sources') onSources?.(data.items);
      if (data.type === 'token') onToken?.(data.text);
    }
  }
}
