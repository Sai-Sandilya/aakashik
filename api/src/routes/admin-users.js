import { adminPreHandler } from './admin-guard.js';
import { publicUser } from '../services/customer-auth.js';

export default async function adminUsersRoutes(fastify) {
  fastify.get('/users', { preHandler: adminPreHandler }, async (_request, reply) => {
    const rows = fastify.db.prepare(`
      SELECT id, email, name, phone, google_id, avatar, verified, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    return reply.send({
      total: rows.length,
      users: rows.map((row) => {
        const user = publicUser(row);
        // Never expose password hashes or internal auth secrets to admin UI.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          avatar: user.avatar,
          provider: user.provider,
          verified: !!row.verified,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }),
    });
  });
}
