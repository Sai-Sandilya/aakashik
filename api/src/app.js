import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { createDb, getDb, initDb, setDb } from './db/index.js';
import adminAuthRoutes from './routes/admin-auth.js';
import adminUsersRoutes from './routes/admin-users.js';
import customerAuthRoutes from './routes/customer-auth.js';
import productRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import orderRoutes from './routes/orders.js';
import { config } from './config.js';

export async function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: options.bodyLimit ?? 3 * 1024 * 1024,
  });

  const db = options.db || (options.dbOptions ? await createDb(options.dbOptions) : getDb());
  setDb(db);
  app.decorate('db', db);

  await app.register(cors, {
    origin: options.corsOrigin ?? config.frontendUrl,
    credentials: true,
  });

  await app.register(cookie);

  const apiRoot = async () => ({
    ok: true,
    service: 'aakashik-api',
    version: '1.0.0',
    health: '/api/health',
    ts: Date.now(),
  });

  app.get('/', apiRoot);
  app.get('/api', apiRoot);
  app.get('/health', async () => ({ ok: true, service: 'aakashik-api', ts: Date.now() }));
  app.get('/api/health', async () => ({ ok: true, service: 'aakashik-api', ts: Date.now() }));

  await app.register(customerAuthRoutes, { prefix: '/api' });

  await app.register(adminAuthRoutes, { prefix: '/api/admin' });
  await app.register(adminUsersRoutes, { prefix: '/api/admin' });
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
