import './load-env.js';
import { buildApp } from './src/app.js';
import { initDb } from './src/db/index.js';

console.log('[aakashik-api] boot', process.version, 'PORT=', process.env.PORT, 'cwd=', process.cwd());
console.log('[aakashik-api] google oauth', process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing');

const start = async () => {
  try {
    await initDb();
    const app = await buildApp({ logger: true });
    await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0',
    });
    app.log.info('Aakashik API ready');
  } catch (err) {
    console.error('[aakashik-api] FATAL startup error:', err);
    process.exit(1);
  }
};

start();
