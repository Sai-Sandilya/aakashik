import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers.js';

describe('Newsletter subscribe', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-NL01 positive: valid email is stored', async () => {
    const email = 'subscriber@example.com';
    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.email, email);
    assert.equal(body.duplicate, false);
    assert.ok(body.subscribedAt > 0);

    const row = app.db.prepare('SELECT email FROM newsletter_subscribers WHERE email = ?').get(email);
    assert.equal(row.email, email);
  });

  it('TC-NL02 positive: duplicate email returns success without new row', async () => {
    const email = 'dup@example.com';
    const first = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email },
    });
    assert.equal(first.statusCode, 201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'DUP@example.com' },
    });
    assert.equal(second.statusCode, 201);
    assert.equal(second.json().duplicate, true);

    const count = app.db.prepare('SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE lower(email) = lower(?)').get(email).n;
    assert.equal(count, 1);
  });

  it('TC-NL03 negative: invalid email is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'not-an-email' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'validation_error');
  });

  it('TC-NL04 negative: missing email is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: {},
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'validation_error');
  });
});
