import { listOrders, getOrder, getTrackPayload, createOrder, updateOrderStatus } from '../services/orders.js';
import { adminPreHandler } from './admin-guard.js';
import { sendError } from '../lib/errors.js';

export default async function orderRoutes(fastify) {
  fastify.post('/orders', async (request, reply) => {
    try {
      const order = createOrder(fastify.db, request.body || {});
      return reply.code(201).send({ order });
    } catch (err) {
      if (err.message && err.message.startsWith('insufficient_stock:')) {
        return reply.code(409).send({ error: 'insufficient_stock', message: 'Not enough stock for one or more items' });
      }
      return sendError(reply, err);
    }
  });

  fastify.get('/orders/:id/track', async (request, reply) => {
    const track = getTrackPayload(fastify.db, request.params.id);
    if (!track) return reply.code(404).send({ error: 'not_found', message: 'No order found' });
    return reply.send({ track });
  });

  fastify.get('/admin/orders', { preHandler: adminPreHandler }, async (request, reply) => {
    const { status, search } = request.query || {};
    return reply.send({ orders: listOrders(fastify.db, { status, search }) });
  });

  fastify.get('/admin/orders/:id', { preHandler: adminPreHandler }, async (request, reply) => {
    const order = getOrder(fastify.db, request.params.id);
    if (!order) return reply.code(404).send({ error: 'not_found', message: 'Order not found' });
    return reply.send({ order });
  });

  fastify.patch('/admin/orders/:id/status', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const { status } = request.body || {};
      const order = updateOrderStatus(fastify.db, request.params.id, status);
      return reply.send({ order });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
