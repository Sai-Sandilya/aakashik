import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { BUILTIN_PRODUCTS, DEFAULT_STOCK } from '../lib/constants.js';
import { withTransaction } from './transaction.js';

const require = createRequire(import.meta.url);

function openDatabase(dbPath) {
  try {
    const BetterSqlite = require('better-sqlite3');
    const db = new BetterSqlite(dbPath);
    db.pragma('foreign_keys = ON');
    return db;
  } catch (err) {
    console.warn('[aakashik-api] better-sqlite3 unavailable:', err?.message || err);
  }
  return null;
}

let nativeSqlite;
async function openNativeDatabase(dbPath) {
  if (!nativeSqlite) {
    nativeSqlite = await import('node:sqlite');
  }
  const db = new nativeSqlite.DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbInstance = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Owner'
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  google_id TEXT UNIQUE,
  avatar TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(lower(email), purpose);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sub TEXT NOT NULL DEFAULT '',
  element TEXT NOT NULL DEFAULT 'All',
  concern TEXT NOT NULL DEFAULT 'Immunity',
  price_n INTEGER NOT NULL,
  list_price_n INTEGER,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  photo TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'Product',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  hidden INTEGER NOT NULL DEFAULT 0,
  custom INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  placed_at INTEGER NOT NULL,
  total INTEGER NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  member_discount INTEGER NOT NULL DEFAULT 0,
  pay_method TEXT NOT NULL DEFAULT 'cod',
  payment_json TEXT NOT NULL DEFAULT '{}',
  delivery_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'store',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price INTEGER NOT NULL DEFAULT 0,
  line_text TEXT NOT NULL DEFAULT '',
  size TEXT
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active, hidden);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  subscribed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribed_at ON newsletter_subscribers(subscribed_at DESC);

CREATE TABLE IF NOT EXISTS ritual_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  remind_time TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  subscribed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ritual_reminders_time ON ritual_reminders(remind_time);
`;

function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) return;

  const now = Date.now();
  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, name, description, sub, element, concern, price_n, list_price_n, discount_pct,
      photo, kind, is_builtin, active, hidden, custom, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @sub, @element, @concern, @priceN, @listPriceN, 0,
      '', @kind, 1, 1, 0, 0, @now, @now
    )
  `);
  const insertInventory = db.prepare('INSERT INTO inventory (product_id, quantity) VALUES (?, ?)');

  withTransaction(db, () => {
    for (const p of BUILTIN_PRODUCTS) {
      insertProduct.run({
        id: p.id,
        name: p.name,
        description: p.name,
        sub: p.sub,
        element: p.element,
        concern: p.concern,
        priceN: p.priceN,
        listPriceN: p.priceN,
        kind: p.kind,
        now,
      });
      insertInventory.run(p.id, DEFAULT_STOCK[p.id] ?? 0);
    }

    db.prepare('INSERT INTO admin_users (email, password, name) VALUES (?, ?, ?)').run(
      config.adminEmail,
      config.adminPassword,
      'Aakashik Owner',
    );

    seedMockOrders(db, now);
  });
}

function seedMockOrders(db, now) {
  const mocks = [
    {
      id: 'AAK-10001', status: 'pending', placedAt: now - 3600000, total: 539, payMethod: 'cod',
      customer: { name: 'Ananya Rao', phone: '9876501001', email: 'ananya@example.com' },
      delivery: { address: '12 Lake View', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
      items: [{ productId: 'immunity', name: 'Daily Immunity', qty: 1, unitPrice: 349 }, { productId: 'ashta', name: 'Ashtagandham', qty: 1, unitPrice: 199 }],
      history: [{ status: 'pending', at: now - 3600000 }],
    },
    {
      id: 'AAK-10002', status: 'packed', placedAt: now - 86400000, total: 399, payMethod: 'upi',
      customer: { name: 'Rohit Mehta', phone: '9876501002', email: 'rohit@example.com' },
      delivery: { address: '88 Palm Grove', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      items: [{ productId: 'navojas', name: 'Navojas 250g', qty: 1, unitPrice: 399 }],
      history: [{ status: 'pending', at: now - 86400000 }, { status: 'packed', at: now - 80000000 }],
    },
    {
      id: 'AAK-10003', status: 'delivered', placedAt: now - 5 * 86400000, total: 599, payMethod: 'card',
      customer: { name: 'Kabir Singh', phone: '9876501004', email: 'kabir@example.com' },
      delivery: { address: '21 Ring Road', city: 'Delhi', state: 'Delhi', pincode: '110001' },
      items: [{ productId: 'kit-immunity', name: 'Immunity Ritual Kit', qty: 1, unitPrice: 599 }],
      history: [
        { status: 'pending', at: now - 5 * 86400000 },
        { status: 'packed', at: now - 4.5 * 86400000 },
        { status: 'shipped', at: now - 4 * 86400000 },
        { status: 'out_for_delivery', at: now - 3.5 * 86400000 },
        { status: 'delivered', at: now - 3 * 86400000 },
      ],
    },
  ];

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, status, placed_at, total, subtotal, member_discount, pay_method, payment_json, delivery_json, source, created_at, updated_at)
    VALUES (@id, @status, @placedAt, @total, @total, 0, @payMethod, @paymentJson, @deliveryJson, 'mock', @placedAt, @placedAt)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, name, qty, unit_price, line_text, size)
    VALUES (@orderId, @productId, @name, @qty, @unitPrice, @lineText, NULL)
  `);
  const insertHist = db.prepare('INSERT INTO order_status_history (order_id, status, at) VALUES (?, ?, ?)');

  for (const m of mocks) {
    const delivery = { ...m.delivery, ...m.customer };
    insertOrder.run({
      id: m.id,
      status: m.status,
      placedAt: m.placedAt,
      total: m.total,
      payMethod: m.payMethod,
      paymentJson: JSON.stringify({ method: m.payMethod, mock: true, status: m.payMethod === 'cod' ? 'cod' : 'paid' }),
      deliveryJson: JSON.stringify(delivery),
    });
    for (const it of m.items) {
      insertItem.run({
        orderId: m.id,
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        lineText: `${it.name} × ${it.qty} · ₹${it.unitPrice}`,
      });
    }
    for (const h of m.history) insertHist.run(m.id, h.status, h.at);
  }
}

function migrateSchema(db) {
  let userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!userCols.includes('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT \'\'');
    userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  }
  if (!userCols.includes('session_version')) {
    db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0');
  }
}

export async function createDb(options = {}) {
  const memory = options.memory ?? config.isTest;
  let dbPath = ':memory:';

  if (!memory) {
    const appRoot = path.resolve(path.join(__dirname, '..', '..'));
    const resolved = path.resolve(appRoot, options.dbPath || config.dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    dbPath = resolved;
    console.log('[aakashik-api] db path', dbPath);
  }

  const db = openDatabase(dbPath) || await openNativeDatabase(dbPath);
  if (!db) throw new Error('No SQLite driver available (better-sqlite3 and node:sqlite both failed)');
  db.exec(SCHEMA);
  migrateSchema(db);

  if (options.seed !== false) seedIfEmpty(db);

  return db;
}

export function getDb() {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance;
}

export async function initDb(options = {}) {
  if (!dbInstance) dbInstance = await createDb(options);
  return dbInstance;
}

export function setDb(db) {
  if (dbInstance && dbInstance !== db) {
    try { dbInstance.close(); } catch { /* ignore */ }
  }
  dbInstance = db;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function resetDbForTests() {
  closeDb();
  const db = await createDb({ memory: true, seed: true });
  setDb(db);
  return db;
}
