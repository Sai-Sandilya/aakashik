import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestApp,
  teardownTestApp,
  loginAdmin,
  authHeaders,
} from './helpers.js';
import { resetRateLimitsForTests } from '../src/lib/rate-limit.js';

describe('Admin customer users', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    resetRateLimitsForTests();
    await teardownTestApp();
  });

  it('TC-ADM01 negative: GET /api/admin/users without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/users' });
    assert.equal(res.statusCode, 401);
  });

  it('TC-ADM02 positive: GET /api/admin/users with admin token', async () => {
    const db = app.db;
    const now = Date.now();
    db.prepare(`
      INSERT INTO users (email, name, phone, google_id, avatar, verified, created_at, updated_at)
      VALUES (?, ?, '', ?, ?, 1, ?, ?)
    `).run('demo@example.com', 'Demo User', 'google-demo-id', 'https://example.com/a.png', now, now);

    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.total >= 1);
    assert.ok(Array.isArray(body.users));
    const demo = body.users.find((u) => u.email === 'demo@example.com');
    assert.ok(demo);
    assert.equal(demo.provider, 'google');
    assert.equal(demo.name, 'Demo User');
    assert.equal(demo.password_hash, undefined);
    assert.equal(demo.password, undefined);
    assert.equal(demo.google_id, undefined);
  });
});
