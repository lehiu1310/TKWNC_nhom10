import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import express from 'express';
import cookieParser from 'cookie-parser';
import pg from 'pg';

const { Pool } = pg;
const SESSION_DAYS = 14;
const ACCOUNT_PATHS = ['/api/auth/', '/api/account/data/'];
const app = express();
const databaseUrl = process.env.DATABASE_URL?.trim();
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 2, idleTimeoutMillis: 5000, connectionTimeoutMillis: 8000 }) : null;
let schemaPromise;

function jsonError(res, status, detail) {
  return res.status(status).json({ detail });
}

async function ensureSchema() {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash BYTEA NOT NULL,
          password_salt BYTEA NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
        CREATE TABLE IF NOT EXISTS user_data (
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          data_key TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, data_key)
        );
      `);
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

function hashPassword(password, salt) {
  // Match Python hashlib.scrypt settings used by the existing account API.
  return crypto.scryptSync(password, salt, 32, { N: 2 ** 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeUser(row) {
  return { id: Number(row.id), email: row.email, display_name: row.display_name, created_at: row.created_at };
}

function digestToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(req, res, token) {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const secure = req.secure || forwardedProto === 'https';
  res.cookie('vh_session', token, {
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
}

function checkSameOrigin(req, res) {
  const origin = req.get('origin');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = (req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host') || '').toLowerCase();
    if (originHost === requestHost) return true;
  } catch { /* invalid Origin is rejected */ }
  jsonError(res, 403, 'Yêu cầu đến từ website không được phép.');
  return false;
}

async function proxyToFastApi(req, res, route) {
  const target = new URL(route, 'https://tkw-nhom10-api.onrender.com');
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (['host', 'connection', 'content-length', 'transfer-encoding'].includes(name.toLowerCase()) || value == null) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const options = { method: req.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(req.method)) {
    options.body = req;
    options.duplex = 'half';
  }
  const upstream = await fetch(target, options);
  res.status(upstream.status);
  for (const [name, value] of upstream.headers) {
    if (['connection', 'content-length', 'content-encoding', 'transfer-encoding'].includes(name.toLowerCase())) continue;
    res.setHeader(name, value);
  }
  const cookies = upstream.headers.getSetCookie?.();
  if (cookies?.length) res.setHeader('set-cookie', cookies);
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).pipe(res);
}

// Vercel rewrites account URLs to this function and carries the original path
// in `route`; this lets the rest of the AI API continue to go directly to Render.
app.use((req, res, next) => {
  const route = req.query.route;
  if (typeof route !== 'string' || !route.startsWith('/api/')) return jsonError(res, 404, 'Không tìm thấy API.');
  req.gatewayRoute = route;
  req.url = route;
  next();
});

// Keep the production site working before its Neon secret is configured. Once
// DATABASE_URL is present, account reads/writes are handled by this Express API.
app.use((req, res, next) => {
  if (pool || !ACCOUNT_PATHS.some((prefix) => req.gatewayRoute.startsWith(prefix))) return next();
  proxyToFastApi(req, res, req.gatewayRoute).catch(() => jsonError(res, 502, 'Dịch vụ tài khoản tạm thời chưa kết nối.'));
});

app.use(express.json({ limit: '300kb' }));
app.use(cookieParser());

app.post('/api/auth/register', async (req, res) => {
  if (!checkSameOrigin(req, res)) return;
  const email = normalizeEmail(req.body?.email);
  const displayName = typeof req.body?.display_name === 'string' ? req.body.display_name.trim() : '';
  const password = req.body?.password;
  if (email.length < 5 || email.length > 254 || !isValidEmail(email)) return jsonError(res, 422, 'Email chưa đúng định dạng.');
  if (!displayName || displayName.length > 80) return jsonError(res, 422, 'Tên hiển thị không được để trống hoặc dài quá 80 ký tự.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return jsonError(res, 422, 'Mật khẩu cần dài từ 8 đến 128 ký tự.');
  try {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const createdAt = new Date().toISOString();
      const salt = crypto.randomBytes(16);
      const inserted = await client.query(
        'INSERT INTO users(email, display_name, password_hash, password_salt, created_at) VALUES($1,$2,$3,$4,$5) RETURNING id,email,display_name,created_at',
        [email, displayName, hashPassword(password, salt), salt, createdAt],
      );
      const user = safeUser(inserted.rows[0]);
      const token = crypto.randomBytes(32).toString('base64url');
      const now = new Date();
      await client.query('DELETE FROM sessions WHERE expires_at <= $1', [now.toISOString()]);
      await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [digestToken(token), user.id, new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString()]);
      await client.query('COMMIT');
      setSessionCookie(req, res, token);
      return res.status(201).json({ user });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') return jsonError(res, 409, 'Email này đã có tài khoản.');
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return jsonError(res, 500, 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.');
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!checkSameOrigin(req, res)) return;
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || email.length > 254 || typeof password !== 'string' || !password || password.length > 128) return jsonError(res, 422, 'Thông tin đăng nhập chưa hợp lệ.');
  try {
    await ensureSchema();
    const result = await pool.query('SELECT id,email,display_name,created_at,password_hash,password_salt FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
    const row = result.rows[0];
    const salt = row ? row.password_salt : Buffer.alloc(16);
    const actual = hashPassword(password, salt);
    const matches = row && row.password_hash.length === actual.length && crypto.timingSafeEqual(actual, row.password_hash);
    if (!matches) return jsonError(res, 401, 'Email hoặc mật khẩu chưa chính xác.');
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    await pool.query('DELETE FROM sessions WHERE expires_at <= $1', [now.toISOString()]);
    await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [digestToken(token), row.id, new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString()]);
    setSessionCookie(req, res, token);
    return res.json({ user: safeUser(row) });
  } catch {
    return jsonError(res, 500, 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.');
  }
});

app.post('/api/auth/logout', async (req, res) => {
  if (!checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    const token = req.cookies?.vh_session;
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [digestToken(token)]);
    res.clearCookie('vh_session', { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.json({ status: 'ok' });
  } catch {
    return jsonError(res, 500, 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.');
  }
});

async function getSessionUser(req) {
  const token = req.cookies?.vh_session;
  if (!token) return null;
  const result = await pool.query(`SELECT u.id,u.email,u.display_name,u.created_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>$2 LIMIT 1`, [digestToken(token), new Date().toISOString()]);
  return result.rows[0] ? safeUser(result.rows[0]) : null;
}

app.get('/api/auth/me', async (req, res) => {
  try {
    await ensureSchema();
    return res.json({ user: await getSessionUser(req) });
  } catch {
    return jsonError(res, 500, 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.');
  }
});

app.get('/api/account/data/:dataKey', async (req, res) => {
  if (!['garden', 'giftbook'].includes(req.params.dataKey)) return jsonError(res, 404, 'Không có loại dữ liệu này.');
  try {
    await ensureSchema();
    const user = await getSessionUser(req);
    if (!user) return jsonError(res, 401, 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    const result = await pool.query('SELECT payload FROM user_data WHERE user_id=$1 AND data_key=$2', [user.id, req.params.dataKey]);
    return res.json({ payload: result.rows[0] ? JSON.parse(result.rows[0].payload) : null });
  } catch (error) {
    console.error('account_data_read_failed', error?.name, error?.code);
    return jsonError(res, 500, 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.');
  }
});

app.put('/api/account/data/:dataKey', async (req, res) => {
  if (!checkSameOrigin(req, res)) return;
  if (!['garden', 'giftbook'].includes(req.params.dataKey)) return jsonError(res, 404, 'Không có loại dữ liệu này.');
  const payload = req.body?.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return jsonError(res, 422, 'Dữ liệu lưu chưa hợp lệ.');
  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded, 'utf8') > 256_000) return jsonError(res, 413, 'Dữ liệu lưu vượt quá giới hạn 256 KB.');
  try {
    await ensureSchema();
    const user = await getSessionUser(req);
    if (!user) return jsonError(res, 401, 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    await pool.query(`INSERT INTO user_data(user_id,data_key,payload,updated_at) VALUES($1,$2,$3,$4)
      ON CONFLICT(user_id,data_key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`,
    [user.id, req.params.dataKey, encoded, new Date().toISOString()]);
    return res.json({ status: 'ok' });
  } catch {
    return jsonError(res, 500, 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.');
  }
});

app.use((req, res) => jsonError(res, 404, 'Không tìm thấy API.'));

export async function closePool() {
  if (pool) await pool.end();
}

export default app;
