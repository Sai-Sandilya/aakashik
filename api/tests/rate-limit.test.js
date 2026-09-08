import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimit, resetRateLimitsForTests } from '../src/lib/rate-limit.js';

function mockReply() {
  const reply = {
    statusCode: 200,
    body: null,
    code(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
  return reply;
}

describe('Auth rate limiting', () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it('TC-RL01 positive: allows traffic under the limit', async () => {
    const hook = createRateLimit({ max: 5, windowMs: 60_000, keyFn: () => 'client-a' });
    const request = { method: 'GET', url: '/api/auth/me', routerPath: '/api/auth/me', ip: '1.1.1.1', headers: {} };
    const reply = mockReply();
    await hook(request, reply);
    assert.equal(reply.statusCode, 200);
  });

  it('TC-RL02 negative: blocks excessive requests', async () => {
    const hook = createRateLimit({ max: 3, windowMs: 60_000, keyFn: () => 'client-b' });
    const request = { method: 'GET', url: '/api/auth/me', routerPath: '/api/auth/me', ip: '2.2.2.2', headers: {} };
    let reply = mockReply();
    for (let i = 0; i < 5; i += 1) {
      reply = mockReply();
      await hook(request, reply);
      if (reply.statusCode === 429) break;
    }
    assert.equal(reply.statusCode, 429);
    assert.equal(reply.body.error, 'rate_limit_exceeded');
  });

  it('TC-RL03 negative: spoofed X-Forwarded-For does not create a new bucket', async () => {
    const hook = createRateLimit({ max: 2, windowMs: 60_000 });
    const base = {
      method: 'POST',
      url: '/api/admin/login',
      routerPath: '/api/admin/login',
      ip: '203.0.113.10',
    };
    let reply = mockReply();
    for (let i = 0; i < 3; i += 1) {
      reply = mockReply();
      await hook({
        ...base,
        headers: { 'x-forwarded-for': `${10 + i}.0.0.1` },
      }, reply);
    }
    assert.equal(reply.statusCode, 429);
  });
});
