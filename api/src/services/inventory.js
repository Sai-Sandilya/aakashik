import { DEFAULT_STOCK } from '../lib/constants.js';
import { withTransaction } from '../db/transaction.js';
import { getProductById } from './products.js';

export function listInventory(db, { filter = 'all' } = {}) {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.kind, p.is_builtin, i.quantity
    FROM products p
    JOIN inventory i ON i.product_id = p.id
    ORDER BY p.is_builtin DESC, p.name ASC
  `).all();

  return rows
    .map((r) => ({
      productId: r.id,
      name: r.name,
      kind: r.kind,
      isBuiltin: !!r.is_builtin,
      quantity: r.quantity,
      badge: stockBadge(r.quantity),
    }))
    .filter((row) => {
      if (filter === 'in_stock') return row.quantity > 5;
      if (filter === 'low') return row.quantity >= 1 && row.quantity <= 5;
      if (filter === 'out') return row.quantity <= 0;
      return true;
    });
}

export function stockBadge(qty) {
  if (qty <= 0) return 'out_of_stock';
  if (qty <= 5) return 'low_stock';
  return 'in_stock';
}

export function getStock(db, productId) {
  const row = db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(productId);
  return row ? row.quantity : 0;
}

export function setStock(db, productId, quantity) {
  const product = getProductById(db, productId);
  if (!product) return null;
  const qty = Math.max(0, Math.floor(Number(quantity)));
  db.prepare(`
    INSERT INTO inventory (product_id, quantity) VALUES (?, ?)
    ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity
  `).run(productId, qty);
  return { productId, quantity: qty, badge: stockBadge(qty) };
}

export function adjustStock(db, productId, delta) {
  const current = getStock(db, productId);
  const product = getProductById(db, productId);
  if (!product) return null;
  const next = Math.max(0, current + Math.floor(Number(delta)));
  return setStock(db, productId, next);
}

export function reseedStock(db) {
  withTransaction(db, () => {
    for (const [id, qty] of Object.entries(DEFAULT_STOCK)) {
      db.prepare(`
        INSERT INTO inventory (product_id, quantity) VALUES (?, ?)
        ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity
      `).run(id, qty);
    }
  });
  return listInventory(db);
}

export function deductStockForItems(db, items) {
  withTransaction(db, () => {
    for (const item of items) {
      const pid = item.productId || item.id;
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      const row = db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(pid);
      if (!row || row.quantity < qty) {
        throw new Error(`insufficient_stock:${pid}`);
      }
      db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE product_id = ?').run(qty, pid);
    }
  });
}
