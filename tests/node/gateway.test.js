import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('Express account API supports registration, sessions, and PostgreSQL data', { skip: !databaseUrl && 'TEST_DATABASE_URL is not configured' }, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const [{ default: app, closePool }, pgModule] = await Promise.all([
    import('../../api/gateway.js'),
    import('pg'),
  ]);
  const { Pool } = pgModule.default;
  const cleanupPool = new Pool({ connectionString: databaseUrl, max: 1 });
  let postgresReady = false;
  for (let attempt = 0; attempt < 30 && !postgresReady; attempt += 1) {
    try {
      await cleanupPool.query('SELECT 1');
      postgresReady = true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert.equal(postgresReady, true, 'PostgreSQL test service did not become ready');
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const routeUrl = (route) => `${baseUrl}/api/gateway?route=${encodeURIComponent(route)}`;
  const email = `api-test-${randomUUID()}@example.test`;
  let userId;
  let cookie;

  try {
    const blocked = await fetch(routeUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://untrusted.example' },
      body: JSON.stringify({ email, display_name: 'API test', password: 'test-password-123' }),
    });
    assert.equal(blocked.status, 403);

    const unauthenticated = await fetch(routeUrl('/api/account/data/garden'));
    assert.equal(unauthenticated.status, 401, await unauthenticated.text());

    const registered = await fetch(routeUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ email, display_name: 'API test', password: 'test-password-123' }),
    });
    assert.equal(registered.status, 201);
    const registeredBody = await registered.json();
    assert.equal(registeredBody.user.email, email);
    userId = registeredBody.user.id;
    const setCookie = registered.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    cookie = setCookie.split(';', 1)[0];

    const current = await fetch(routeUrl('/api/auth/me'), { headers: { cookie } });
    assert.equal(current.status, 200);
    assert.equal((await current.json()).user.id, userId);

    const login = await fetch(routeUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ email: email.toUpperCase(), password: 'test-password-123' }),
    });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).user.id, userId);

    const written = await fetch(routeUrl('/api/account/data/garden'), {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie, origin: baseUrl },
      body: JSON.stringify({ payload: { plants: [{ id: 'daisy' }] } }),
    });
    assert.equal(written.status, 200);

    const read = await fetch(routeUrl('/api/account/data/garden'), { headers: { cookie } });
    assert.deepEqual((await read.json()).payload, { plants: [{ id: 'daisy' }] });

    const duplicate = await fetch(routeUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ email, display_name: 'API test', password: 'test-password-123' }),
    });
    assert.equal(duplicate.status, 409);

    const badLogin = await fetch(routeUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseUrl },
      body: JSON.stringify({ email, password: 'wrong-password' }),
    });
    assert.equal(badLogin.status, 401);

    const logout = await fetch(routeUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { cookie, origin: baseUrl },
    });
    assert.equal(logout.status, 200);
    const afterLogout = await fetch(routeUrl('/api/auth/me'), { headers: { cookie } });
    assert.equal((await afterLogout.json()).user, null);
  } finally {
    if (userId) await cleanupPool.query('DELETE FROM users WHERE id=$1', [userId]);
    await cleanupPool.end();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await closePool();
  }
});
