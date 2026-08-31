import { subscribeNewsletter } from '../services/newsletter.js';
import { sendError } from '../lib/errors.js';

export default async function newsletterRoutes(fastify) {
  fastify.post('/newsletter/subscribe', async (request, reply) => {
    try {
      const result = subscribeNewsletter(fastify.db, request.body || {});
      return reply.code(201).send({ ok: true, ...result });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
