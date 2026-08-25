import {
  listStoreProducts,
  getStoreProduct,
  listAdminProducts,
  getProductById,
  createCustomProduct,
  updateCustomProduct,
  deleteCustomProduct,
  setProductVisibility,
} from '../services/products.js';
import { adminPreHandler } from './admin-guard.js';
import { sendError, ApiError } from '../lib/errors.js';
import { validateProductInput } from '../lib/validation.js';

export default async function productRoutes(fastify) {
  fastify.get('/products', async (_request, reply) => {
    return reply.send({ products: listStoreProducts(fastify.db) });
  });

  fastify.get('/products/:id', async (request, reply) => {
    const product = getStoreProduct(fastify.db, request.params.id);
    if (!product) return reply.code(404).send({ error: 'not_found', message: 'Product not found' });
    return reply.send({ product });
  });

  fastify.get('/admin/products', { preHandler: adminPreHandler }, async (request, reply) => {
    const { search } = request.query || {};
    return reply.send({ products: listAdminProducts(fastify.db, { search }) });
  });

  fastify.post('/admin/products', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const validated = validateProductInput(request.body || {});
      const product = createCustomProduct(fastify.db, {
        name: validated.name,
        description: validated.description,
        listPriceN: validated.listPriceN,
        discountPct: validated.discountPct ?? 0,
        stock: validated.stock ?? 0,
        concern: validated.concern || 'Immunity',
        photo: validated.photo || '',
        active: validated.active !== false,
      });
      return reply.code(201).send({ product });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.patch('/admin/products/:id', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const existing = getProductById(fastify.db, request.params.id);
      if (!existing) return reply.code(404).send({ error: 'not_found', message: 'Product not found' });
      if (existing.isBuiltin) {
        return reply.code(400).send({ error: 'builtin_not_editable', message: 'Built-in products cannot be edited' });
      }
      const body = request.body || {};
      validateProductInput(body, { partial: true });
      if (body.name !== undefined && !String(body.name).trim()) {
        throw new ApiError(400, 'validation_error', 'Enter a product name');
      }
      if (body.description !== undefined && !String(body.description).trim()) {
        throw new ApiError(400, 'validation_error', 'Enter a product description');
      }
      const product = updateCustomProduct(fastify.db, request.params.id, body);
      return reply.send({ product });
    } catch (err) {
      if (err.message === 'builtin_not_editable') {
        return reply.code(400).send({ error: 'builtin_not_editable', message: 'Built-in products cannot be edited' });
      }
      return sendError(reply, err);
    }
  });

  fastify.delete('/admin/products/:id', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const existing = getProductById(fastify.db, request.params.id);
      if (!existing) return reply.code(404).send({ error: 'not_found', message: 'Product not found' });
      if (existing.isBuiltin) {
        return reply.code(400).send({ error: 'builtin_not_deletable', message: 'Built-in products cannot be deleted' });
      }
      deleteCustomProduct(fastify.db, request.params.id);
      return reply.send({ ok: true, id: request.params.id });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.patch('/admin/products/:id/visibility', { preHandler: adminPreHandler }, async (request, reply) => {
    try {
      const { hidden } = request.body || {};
      if (typeof hidden !== 'boolean') throw new ApiError(400, 'validation_error', 'hidden must be boolean');
      const product = setProductVisibility(fastify.db, request.params.id, hidden);
      if (!product) return reply.code(404).send({ error: 'not_found', message: 'Product not found' });
      return reply.send({ product });
    } catch (err) {
      if (err.message === 'custom_visibility_via_active') {
        return reply.code(400).send({ error: 'custom_use_active', message: 'Use active flag for custom products' });
      }
      return sendError(reply, err);
    }
  });
}
