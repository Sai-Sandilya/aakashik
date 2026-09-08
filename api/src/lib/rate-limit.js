const buckets = new Map();

/**
 * Rate-limit identity: use Fastify's request.ip only.
 * Do not read X-Forwarded-For here — clients can spoof that header.
 * With trustProxy enabled on the app, request.ip is set from the reverse proxy hop.
 */
function clientKey(request) {
  return request.ip || 'unknown';
}

export function createRateLimit({ windowMs = 60_000, max = 30, keyFn = clientKey } = {}) {
  return async function rateLimitHook(request, reply) {
    const key = `${request.method}:${request.routerPath || request.url}:${keyFn(request)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return reply.code(429).send({
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please try again later.',
      });
    }
  };
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
