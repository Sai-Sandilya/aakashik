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
      const body = request.body || {};
      const name = String(body.name || '').trim();
      const description = String(body.description || '').trim();
      const priceN = Math.round(Number(body.priceN ?? body.listPriceN));
      const discountPct = Math.round(Number(body.discountPct || 0));
      const stock = Math.floor(Number(body.stock ?? 0));

      if (!name) throw new ApiError(400, 'validation_error', 'Enter a product name');
      if (!description) throw new ApiError(400, 'validation_error', 'Enter a product description');
      if (!Number.isFinite(priceN) || priceN <= 0) throw new ApiError(400, 'validation_error', 'Enter a valid price greater than 0');
      if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 90) {
        throw new ApiError(400, 'validation_error', 'Discount must be 0–90%');
      }
      if (!Number.isFinite(stock) || stock < 0) throw new ApiError(400, 'validation_error', 'Enter a valid stock quantity');

      const product = createCustomProduct(fastify.db, {
        name,
        description,
        listPriceN: priceN,
        discountPct,
        stock,
        concern: body.concern || 'Immunity',
        photo: body.photo || '',
        active: body.active !== false,
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
      if (body.discountPct !== undefined) {
        const d = Math.round(Number(body.discountPct));
        if (!Number.isFinite(d) || d < 0 || d > 90) {
          throw new ApiError(400, 'validation_error', 'Discount must be 0–90%');
        }
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
