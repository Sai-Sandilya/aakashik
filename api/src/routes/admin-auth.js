import { verifyAdminCredentials, signAdminToken, requireAdmin } from '../services/auth.js';
import { sendError, ApiError } from '../lib/errors.js';

export default async function adminAuthRoutes(fastify) {
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body || {};
      if (!email || !password) {
        throw new ApiError(400, 'validation_error', 'Email and password are required');
      }
      const admin = verifyAdminCredentials(fastify.db, email, password);
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
