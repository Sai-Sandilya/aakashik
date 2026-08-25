import { listOrders, getOrder, getTrackPayload, createOrder, updateOrderStatus } from '../services/orders.js';
import { adminPreHandler } from './admin-guard.js';
import { sendError } from '../lib/errors.js';
import { validateOrderStatusFilter, validateOrderId, validateStatusUpdate } from '../lib/validation.js';

export default async function orderRoutes(fastify) {
  fastify.post('/orders', async (request, reply) => {
    try {
      const order = createOrder(fastify.db, request.body || {});
      return reply.code(201).send({ order });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get('/orders/:id/track', async (request, reply) => {
    try {
      validateOrderId(request.params.id);
      const track = getTrackPayload(fastify.db, request.params.id);
      if (!track) return reply.code(404).send({ error: 'not_found', message: 'No order found' });
      return reply.send({ track });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get('/admin/orders', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const { status, search } = request.query || {};
      validateOrderStatusFilter(status);
      return reply.send({ orders: listOrders(fastify.db, { status, search }) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get('/admin/orders/:id', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      validateOrderId(request.params.id);
      const order = getOrder(fastify.db, request.params.id);
      if (!order) return reply.code(404).send({ error: 'not_found', message: 'Order not found' });
      return reply.send({ order });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.patch('/admin/orders/:id/status', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      validateOrderId(request.params.id);
      const status = validateStatusUpdate(request.body || {});
      const order = updateOrderStatus(fastify.db, request.params.id, status);
      return reply.send({ order });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
