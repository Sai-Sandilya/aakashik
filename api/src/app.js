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
import newsletterRoutes from './routes/newsletter.js';
import reminderRoutes from './routes/reminders.js';
import e2eResetRoutes from './routes/e2e-reset.js';
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

  // Must be set before register() so encapsulated plugins inherit this handler.
  // Otherwise Fastify's default serializer puts app codes in `code` and
  // `error: "Unauthorized"`, which breaks clients that read `error`.
  app.setErrorHandler((err, _request, reply) => {
    if (app.log?.error) app.log.error(err);
    const statusCode = Number(err.statusCode) || 500;
    const code = typeof err.code === 'string' && err.code && !err.code.startsWith('FST_')
      ? err.code
      : (statusCode >= 500 ? 'internal_error' : 'request_error');
    reply.code(statusCode).send({
      error: code,
      message: err.message || 'Unexpected server error',
    });
  });

  await app.register(customerAuthRoutes, { prefix: '/api' });

  await app.register(adminAuthRoutes, { prefix: '/api/admin' });
  await app.register(adminUsersRoutes, { prefix: '/api/admin' });
  await app.register(productRoutes, { prefix: '/api' });
  await app.register(inventoryRoutes, { prefix: '/api' });
  await app.register(orderRoutes, { prefix: '/api' });
  await app.register(newsletterRoutes, { prefix: '/api' });
  await app.register(reminderRoutes, { prefix: '/api' });
  await app.register(e2eResetRoutes, { prefix: '/api' });

  app.addHook('onClose', async () => {
    if (options.closeDbOnShutdown !== false && options.db) {
      try { options.db.close(); } catch { /* ignore */ }
    }
  });

  return app;
}
