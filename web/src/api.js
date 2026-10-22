// Vercel's /api rewrite keeps auth cookies on the site origin. A direct URL to
// Render turns the cookie into a cross-site cookie and browsers reject it with
// SameSite=Lax, even though the login request itself succeeds.
const apiEnvironment = import.meta.env ?? {};
const configuredApiBase = apiEnvironment.VITE_API_BASE_URL ?? apiEnvironment.VITE_API_URL ?? '';
const useSameOriginApi = apiEnvironment.VITE_API_SAME_ORIGIN === 'true'
  || (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app'));
export const API_BASE = useSameOriginApi ? '' : configuredApiBase;
const API_TIMEOUT_MS = 70_000;
const AI_IMAGE_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 15_000;

function createDeadline(parentSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parentSignal.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      window.clearTimeout(timer);
      parentSignal?.removeEventListener('abort', abortFromParent);
    },
  };
}

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

async function requestJson(path, options, timeoutMs = API_TIMEOUT_MS) {
  const deadline = createDeadline(options.signal, timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include', signal: deadline.signal });
    return await handle(res);
  } catch (error) {
    if (deadline.timedOut()) {
      const timeoutError = new Error('Máy chủ AI phản hồi quá lâu. Bạn có thể thử lại sau ít phút nhé.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    deadline.dispose();
  }
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
  // Render Free can cold-start the service and reload the detector after
  // switching models; allow that first image request to finish before failing.
  return requestJson(path, { method: 'POST', body: form }, AI_IMAGE_TIMEOUT_MS);
}

export function postJson(path, body, options = {}) {
  return requestJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  }, options.timeoutMs ?? API_TIMEOUT_MS);
}

export const getAccount = () => requestJson('/api/auth/me', {});
export const registerAccount = (body) => postJson('/api/auth/register', body);
export const loginAccount = (body) => postJson('/api/auth/login', body);
export const logoutAccount = () => postJson('/api/auth/logout', {});
export const getAccountData = (key) => requestJson(`/api/account/data/${encodeURIComponent(key)}`, {});
export function putAccountData(key, payload) {
  return requestJson(`/api/account/data/${encodeURIComponent(key)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload }),
  });
}

export const getHealth = (options = {}) => requestJson('/api/health', options, HEALTH_TIMEOUT_MS);

export async function fetchSampleImage(species) {
  const deadline = createDeadline(undefined, 20_000);
  try {
    const response = await fetch(`${API_BASE}/api/species/${encodeURIComponent(species.id)}/image`, { signal: deadline.signal });
    if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
    const blob = await response.blob();
    const extension = blob.type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `${species.id}-mau.${extension}`, { type: blob.type || 'image/jpeg' });
  } catch (error) {
    if (deadline.timedOut()) {
      const timeoutError = new Error('Không tải được ảnh mẫu trong thời gian chờ. Bạn thử lại nhé.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    deadline.dispose();
  }
}

export function friendlyFailure(error) {
  console.error('AI request failed:', error);
  if (error?.name === 'TimeoutError') {
    return error.message || 'Máy chủ AI mất quá nhiều thời gian. Bạn thử lại sau ít phút nhé.';
  }
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
  const deadline = createDeadline(signal, API_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
      credentials: 'include',
      signal: deadline.signal,
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
  } catch (error) {
    if (deadline.timedOut()) {
      const timeoutError = new Error('Máy chủ AI phản hồi quá lâu. Bạn có thể thử lại sau ít phút nhé.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    deadline.dispose();
  }
}
