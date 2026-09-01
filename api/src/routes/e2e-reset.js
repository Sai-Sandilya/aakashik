import { resetE2eFixtures } from '../db/index.js';
import { config } from '../config.js';
import { sendError, ApiError } from '../lib/errors.js';

/** E2E-only reset — not registered in production. */
export default async function e2eResetRoutes(fastify) {
  if (!config.isE2e) return;

  fastify.post('/e2e/reset', async (_request, reply) => {
    try {
      resetE2eFixtures(fastify.db);
      return reply.send({ ok: true });
    } catch (err) {
      return sendError(reply, err instanceof ApiError ? err : new ApiError(500, 'e2e_reset_failed', err.message || 'Reset failed'));
    }
  });
}
