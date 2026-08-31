import { buildApp } from './app.js';
import { initDb } from './db/index.js';

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

await initDb();
const app = await buildApp({ logger: true });

try {
  await app.listen({ port, host });
  app.log.info(`Aakashik API listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
