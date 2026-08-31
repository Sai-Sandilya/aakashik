import { verifyAdminCredentials, signAdminToken, requireAdmin } from '../services/auth.js';
import { sendError, ApiError } from '../lib/errors.js';
import { validateAdminLogin } from '../lib/validation.js';
import { createRateLimit } from '../lib/rate-limit.js';
import { config } from '../config.js';

const adminLoginRateLimit = createRateLimit({ windowMs: 60_000, max: 10 });

export default async function adminAuthRoutes(fastify) {
  const loginHooks = (config.isTest || config.isE2e) ? [] : [adminLoginRateLimit];
  fastify.post('/login', { preHandler: loginHooks }, async (request, reply) => {
    try {
      const { email, password } = validateAdminLogin(request.body || {});
      const admin = await verifyAdminCredentials(fastify.db, email, password);
      const token = signAdminToken(admin);
      return reply.send({ token, admin: { email: admin.email, name: admin.name } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get('/me', async (request, reply) => {
    try {
      const payload = requireAdmin(request);
      const row = fastify.db.prepare('SELECT email, name FROM admin_users WHERE id = ?').get(Number(payload.sub));
      if (!row) throw new ApiError(401, 'unauthorized', 'Admin not found');
      return reply.send({ admin: row });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
