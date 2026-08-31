import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers.js';

describe('Ritual reminder subscribe', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-RM01 positive: valid email and time are stored', async () => {
    const email = 'reminder@example.com';
    const res = await app.inject({
      method: 'POST',
      url: '/api/reminders/subscribe',
      payload: { email, time: '08:00' },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.email, email);
    assert.equal(body.time, '08:00');
    assert.equal(body.duplicate, false);

    const row = app.db.prepare('SELECT email, remind_time FROM ritual_reminders WHERE email = ?').get(email);
    assert.equal(row.email, email);
    assert.equal(row.remind_time, '08:00');
  });

  it('TC-RM02 positive: duplicate email updates time', async () => {
    const email = 'dup-reminder@example.com';
    await app.inject({
      method: 'POST',
      url: '/api/reminders/subscribe',
      payload: { email, time: '07:30' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/reminders/subscribe',
      payload: { email: 'DUP-REMINDER@example.com', time: '09:15' },
    });
    assert.equal(second.statusCode, 201);
    assert.equal(second.json().duplicate, true);
    assert.equal(second.json().time, '09:15');
    const count = app.db.prepare('SELECT COUNT(*) AS n FROM ritual_reminders WHERE lower(email) = lower(?)').get(email).n;
    assert.equal(count, 1);
  });

  it('TC-RM03 negative: invalid email is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reminders/subscribe',
      payload: { email: 'bad', time: '08:00' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-RM04 negative: invalid time is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reminders/subscribe',
      payload: { email: 'ok@example.com', time: '25:99' },
    });
    assert.equal(res.statusCode, 400);
  });
});
