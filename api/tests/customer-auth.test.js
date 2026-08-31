import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers.js';
import { hashPassword } from '../src/services/password.js';

describe('Customer account lookup', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-AUTH01 positive: check-account never reveals whether email exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/check-account',
      payload: { email: 'nobody@example.com' },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  });

  it('TC-AUTH02 positive: check-account is opaque for known Google emails too', async () => {
    const now = Date.now();
    app.db.prepare(`
      INSERT INTO users (email, name, phone, google_id, avatar, verified, created_at, updated_at)
      VALUES (?, ?, '', ?, '', 1, ?, ?)
    `).run('google.user@example.com', 'Google User', 'gid-123', now, now);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/check-account',
      payload: { email: 'google.user@example.com' },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  });
});

describe('Email OTP signup', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-AUTH03 positive: send and verify email signup OTP', async () => {
    const email = `otp-${Date.now()}@test.com`;
    const send = await app.inject({
      method: 'POST',
      url: '/api/auth/send-otp',
      payload: { email, name: 'OTP Tester', purpose: 'signup' },
    });
    assert.equal(send.statusCode, 200);
    const { testCode } = send.json();
    assert.match(testCode, /^\d{4}$/);

    const verify = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-signup',
      payload: { email, code: testCode, name: 'OTP Tester', password: 'Test@1234' },
    });
    assert.equal(verify.statusCode, 200);
    assert.equal(verify.json().user.email, email);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'Test@1234' },
    });
    assert.equal(login.statusCode, 200);
  });
});

describe('Email OTP password reset', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-AUTH04 positive: send reset OTP and update password', async () => {
    const email = `reset-${Date.now()}@test.com`;
    const oldPassword = 'OldPass@1234';
    const newPassword = 'NewPass@5678';
    const pwHash = await hashPassword(oldPassword);
    const now = Date.now();
    app.db.prepare(`
      INSERT INTO users (email, name, phone, google_id, avatar, password_hash, verified, created_at, updated_at)
      VALUES (?, ?, '', NULL, '', ?, 1, ?, ?)
    `).run(email, 'Reset User', pwHash, now, now);

    const send = await app.inject({
      method: 'POST',
      url: '/api/auth/send-otp',
      payload: { email, purpose: 'reset' },
    });
    assert.equal(send.statusCode, 200);
    const { testCode } = send.json();
    assert.match(testCode, /^\d{4}$/);

    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { email, code: testCode, password: newPassword },
    });
    assert.equal(reset.statusCode, 200);

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: oldPassword },
    });
    assert.equal(oldLogin.statusCode, 401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: newPassword },
    });
    assert.equal(newLogin.statusCode, 200);
  });

  it('TC-AUTH04b positive: unknown email reset looks the same (no enumeration)', async () => {
    const send = await app.inject({
      method: 'POST',
      url: '/api/auth/send-otp',
      payload: { email: 'missing-user@example.com', purpose: 'reset' },
    });
    assert.equal(send.statusCode, 200);
    const body = send.json();
    assert.equal(body.ok, true);
    assert.equal(body.testCode, undefined);
  });

  it('TC-AUTH05 negative: Google account cannot use email password login', async () => {
    const email = 'google-only@example.com';
    const now = Date.now();
    app.db.prepare(`
      INSERT INTO users (email, name, phone, google_id, avatar, verified, created_at, updated_at)
      VALUES (?, ?, '', ?, '', 1, ?, ?)
    `).run(email, 'Google Only', 'gid-only', now, now);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'AnyPass@1234' },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error, 'google_account');
  });

  it('TC-AUTH06 positive: password reset invalidates existing session cookie', async () => {
    const email = `session-${Date.now()}@test.com`;
    const oldPassword = 'OldPass@1234';
    const newPassword = 'NewPass@5678';
    const pwHash = await hashPassword(oldPassword);
    const now = Date.now();
    app.db.prepare(`
      INSERT INTO users (email, name, phone, google_id, avatar, password_hash, session_version, verified, created_at, updated_at)
      VALUES (?, ?, '', NULL, '', ?, 0, 1, ?, ?)
    `).run(email, 'Session User', pwHash, now, now);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: oldPassword, rememberMe: true },
    });
    assert.equal(login.statusCode, 200);
    const cookie = login.headers['set-cookie'];
    assert.ok(cookie);

    const meBefore = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    assert.equal(meBefore.json().loggedIn, true);

    const send = await app.inject({
      method: 'POST',
      url: '/api/auth/send-otp',
      payload: { email, purpose: 'reset' },
    });
    const { testCode } = send.json();

    await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { email, code: testCode, password: newPassword },
    });

    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    assert.equal(meAfter.json().loggedIn, false);
  });
});
