import { listInventory, setStock, adjustStock, reseedStock } from '../services/inventory.js';
import { adminPreHandler } from './admin-guard.js';
import { sendError, ApiError } from '../lib/errors.js';
import { validateInventoryFilter, LIMITS } from '../lib/validation.js';

export default async function inventoryRoutes(fastify) {
  fastify.get('/admin/inventory', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const filter = validateInventoryFilter(request.query?.filter || 'all');
      return reply.send({ inventory: listInventory(fastify.db, { filter }) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.patch('/admin/inventory/:productId', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const quantity = Number(request.body?.quantity);
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > LIMITS.STOCK_MAX) {
        throw new ApiError(400, 'validation_error', 'Enter a valid stock quantity');
      }
      const row = setStock(fastify.db, request.params.productId, quantity);
      if (!row) return reply.code(404).send({ error: 'not_found', message: 'Product not found' });
      return reply.send({ inventory: row });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.post('/admin/inventory/:productId/adjust', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const delta = Number(request.body?.delta);
      if (!Number.isFinite(delta)) throw new ApiError(400, 'validation_error', 'delta must be a number');
      const row = adjustStock(fastify.db, request.params.productId, delta);
      if (!row) return reply.code(404).send({ error: 'not_found', message: 'Product not found' });
      return reply.send({ inventory: row });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.post('/admin/inventory/reseed', { preHandler: adminPreHandler }, async (_request, reply) => {
    const inventory = reseedStock(fastify.db);
    return reply.send({ inventory });
  });
}
