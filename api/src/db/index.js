import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { BUILTIN_PRODUCTS, DEFAULT_STOCK } from '../lib/constants.js';
import { withTransaction } from './transaction.js';
import { hashPassword, isPasswordHash } from '../services/password.js';

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

async function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) return;

  const now = Date.now();
  const adminPasswordHash = await hashPassword(config.adminPassword);
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
      adminPasswordHash,
      'Aakashik Owner',
    );
  });
}

/** Wipe mutable commerce data and restore default stock (E2E only). */
export function resetE2eFixtures(db) {
  withTransaction(db, () => {
    db.exec(`
      DELETE FROM order_status_history;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE is_builtin = 0);
      DELETE FROM products WHERE is_builtin = 0;
    `);
    for (const [id, qty] of Object.entries(DEFAULT_STOCK)) {
      db.prepare(`
        INSERT INTO inventory (product_id, quantity) VALUES (?, ?)
        ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity
      `).run(id, qty);
    }
  });
  return { ok: true };
}

async function migratePlaintextAdminPassword(db) {
  if (config.isTest) return;
  const row = db.prepare('SELECT id, password FROM admin_users WHERE lower(email) = ?').get(String(config.adminEmail || '').trim().toLowerCase());
  if (!row || isPasswordHash(row.password)) return;
  if (row.password !== config.adminPassword) return;
  const hashed = await hashPassword(config.adminPassword);
  db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(hashed, row.id);
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

  if (options.seed !== false) await seedIfEmpty(db);
  await migratePlaintextAdminPassword(db);

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
