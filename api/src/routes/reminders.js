import { subscribeReminder } from '../services/reminders.js';
import { sendError } from '../lib/errors.js';

export default async function reminderRoutes(fastify) {
  fastify.post('/reminders/subscribe', async (request, reply) => {
    try {
      const result = subscribeReminder(fastify.db, request.body || {});
      return reply.code(201).send({ ok: true, ...result });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
