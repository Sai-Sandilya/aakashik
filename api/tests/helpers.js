import { before, after, beforeEach } from 'node:test';
import { buildApp } from '../src/app.js';
import { createDb, setDb, closeDb } from '../src/db/index.js';
import { config } from '../src/config.js';
import { hashPassword } from '../src/services/password.js';

let app;
let db;

export async function setupTestApp() {
  closeDb();
  db = await createDb({ memory: true, seed: true });
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

/** Create a customer row and return a session cookie header for inject(). */
export async function loginCustomer(overrides = {}) {
  const email = overrides.email || `member-${Date.now()}@example.com`;
  const password = overrides.password || 'Test@1234';
  const name = overrides.name || 'Member Customer';
  const now = Date.now();
  const pwHash = await hashPassword(password);
  app.db.prepare(`
    INSERT INTO users (email, name, phone, google_id, avatar, password_hash, verified, created_at, updated_at)
    VALUES (?, ?, '', NULL, '', ?, 1, ?, ?)
  `).run(email, name, pwHash, now, now);

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  const setCookie = res.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie)
    ? setCookie.map((c) => String(c).split(';')[0]).join('; ')
    : String(setCookie || '').split(';')[0];
  return { res, email, password, cookie: cookieHeader };
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

/** Create a real checkout order (no seeded mocks). */
export async function createOrder(overrides = {}, injectOpts = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/orders',
    payload: sampleOrderPayload(overrides),
    ...injectOpts,
  });
  return { res, order: res.json().order, statusCode: res.statusCode };
}

/** Advance an order through status steps. */
export async function setOrderStatus(token, orderId, status) {
  return app.inject({
    method: 'PATCH',
    url: `/api/admin/orders/${orderId}/status`,
    headers: authHeaders(token),
    payload: { status },
  });
}

export { app, db, before, after, beforeEach };
