import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestApp,
  teardownTestApp,
  loginAdmin,
  authHeaders,
  adminLoginPayload,
} from './helpers.js';

describe('API health + admin auth', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-API01 positive: GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'aakashik-api');
  });

  it('TC-API02 positive: admin login with demo credentials', async () => {
    const { res, token, admin } = await loginAdmin();
    assert.equal(res.statusCode, 200);
    assert.ok(token);
    assert.equal(admin.email, 'owner@aakashik.local');
  });

  it('TC-API03 negative: wrong admin password rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { email: 'owner@aakashik.local', password: 'wrong' },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error, 'invalid_credentials');
  });

  it('TC-API04 negative: missing login fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { email: 'owner@aakashik.local' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-API05 positive: GET /api/admin/me with valid token', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().admin.email, adminLoginPayload().email);
  });

  it('TC-API06 negative: protected route without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/me' });
    assert.equal(res.statusCode, 401);
  });

  it('TC-API07 negative: protected route with garbage token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/me',
      headers: authHeaders('not.a.valid.jwt'),
    });
    assert.equal(res.statusCode, 401);
  });
});
