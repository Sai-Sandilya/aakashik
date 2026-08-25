import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createDb, getDb, setDb } from './db/index.js';
import adminAuthRoutes from './routes/admin-auth.js';
import productRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import orderRoutes from './routes/orders.js';

export async function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: options.bodyLimit ?? 3 * 1024 * 1024,
  });

  const db = options.db || getDb() || createDb(options.dbOptions);
  setDb(db);
  app.decorate('db', db);

  await app.register(cors, {
    origin: options.corsOrigin ?? true,
    credentials: true,
  });

  app.get('/health', async () => ({ ok: true, service: 'aakashik-api', ts: Date.now() }));

  await app.register(adminAuthRoutes, { prefix: '/api/admin' });
  await app.register(productRoutes, { prefix: '/api' });
  await app.register(inventoryRoutes, { prefix: '/api' });
  await app.register(orderRoutes, { prefix: '/api' });

  app.setErrorHandler((err, _request, reply) => {
    app.log.error(err);
    reply.code(err.statusCode || 500).send({
      error: err.code || 'internal_error',
      message: err.message || 'Unexpected server error',
    });
  });

  app.addHook('onClose', async () => {
    if (options.closeDbOnShutdown !== false && options.db) {
      try { options.db.close(); } catch { /* ignore */ }
    }
  });

  return app;
}
