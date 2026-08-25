import { before, after, beforeEach } from 'node:test';
import { buildApp } from '../src/app.js';
import { createDb, setDb, closeDb } from '../src/db/index.js';
import { config } from '../src/config.js';

let app;
let db;

export async function setupTestApp() {
  closeDb();
  db = createDb({ memory: true, seed: true });
  setDb(db);
  app = await buildApp({ db, logger: false, closeDbOnShutdown: false });
  await app.ready();
  return { app, db };
}

export async function teardownTestApp() {
  if (app) await app.close();
  closeDb();
  app = null;
  db = null;
}

export function adminLoginPayload() {
  return { email: config.adminEmail, password: config.adminPassword };
}

export async function loginAdmin() {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: adminLoginPayload(),
  });
  const body = res.json();
  return { res, token: body.token, admin: body.admin };
}

export function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

export function sampleDelivery(overrides = {}) {
  return {
    name: 'Test Customer',
    phone: '9876543210',
    email: 'test@example.com',
    address: '12 Test Lane',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    ...overrides,
  };
}

export function sampleOrderPayload(overrides = {}) {
  return {
    items: [{ productId: 'immunity', qty: 1 }],
    delivery: sampleDelivery(),
    payMethod: 'cod',
    total: 349,
    subtotal: 349,
    ...overrides,
  };
}

export { app, db, before, after, beforeEach };
