import { withTransaction } from '../db/transaction.js';

function mapProductRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sub: row.sub,
    element: row.element,
    concern: row.concern,
    priceN: row.price_n,
    listPriceN: row.list_price_n ?? row.price_n,
    discountPct: row.discount_pct,
    photo: row.photo || '',
    kind: row.kind,
    isBuiltin: !!row.is_builtin,
    custom: !!row.custom,
    active: !!row.active,
    hidden: !!row.hidden,
    stock: row.quantity ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listStoreProducts(db) {
  const rows = db.prepare(`
    SELECT p.*, i.quantity
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.active = 1 AND p.hidden = 0
    ORDER BY p.is_builtin DESC, p.created_at DESC
  `).all();
  return rows.map(mapProductRow);
}

export function getStoreProduct(db, id) {
  const row = db.prepare(`
    SELECT p.*, i.quantity
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.id = ? AND p.active = 1 AND p.hidden = 0
  `).get(id);
  return mapProductRow(row);
}

export function listAdminProducts(db, { search = '' } = {}) {
  let sql = `
    SELECT p.*, i.quantity
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
  `;
  const params = [];
  const q = String(search).trim().toLowerCase();
  if (q) {
    sql += ' WHERE lower(p.name) LIKE ? OR lower(p.id) LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY p.is_builtin DESC, p.created_at DESC';
  return db.prepare(sql).all(...params).map(mapProductRow);
}

export function getProductById(db, id) {
  const row = db.prepare(`
    SELECT p.*, i.quantity
    FROM products p
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.id = ?
  `).get(id);
  return mapProductRow(row);
}

export function salePrice(priceN, discountPct) {
  const price = Math.max(0, Math.round(Number(priceN) || 0));
  const disc = Math.min(90, Math.max(0, Math.round(Number(discountPct) || 0)));
  return Math.max(0, Math.round(price * (100 - disc) / 100));
}

export function createCustomProduct(db, payload) {
  const now = Date.now();
  const id = payload.id || `custom-${now}`;
  const listPrice = Math.round(Number(payload.listPriceN ?? payload.priceN));
  const discount = Math.round(Number(payload.discountPct || 0));
  const sale = salePrice(listPrice, discount);
  const stockQty = Math.max(0, Math.floor(Number(payload.stock ?? 0)));

  withTransaction(db, () => {
    db.prepare(`
      INSERT INTO products (
        id, name, description, sub, element, concern, price_n, list_price_n, discount_pct,
        photo, kind, is_builtin, active, hidden, custom, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Product', 0, ?, 0, 1, ?, ?)
    `).run(
      id,
      payload.name,
      payload.description,
      payload.sub || 'Owner added',
      payload.element || 'All',
      payload.concern || 'Immunity',
      sale,
      listPrice,
      discount,
      payload.photo || '',
      payload.active === false ? 0 : 1,
      now,
      now,
    );
    db.prepare(`
      INSERT INTO inventory (product_id, quantity) VALUES (?, ?)
      ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity
    `).run(id, stockQty);
  });
  return getProductById(db, id);
}

export function updateCustomProduct(db, id, payload) {
  const existing = getProductById(db, id);
  if (!existing) return null;
  if (existing.isBuiltin) throw new Error('builtin_not_editable');

  const now = Date.now();
  const listPrice = Math.round(Number(payload.listPriceN ?? payload.priceN ?? existing.listPriceN));
  const discount = Math.round(Number(payload.discountPct ?? existing.discountPct));
  const sale = salePrice(listPrice, discount);

  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      concern = COALESCE(?, concern),
      price_n = ?,
      list_price_n = ?,
      discount_pct = ?,
      photo = COALESCE(?, photo),
      active = COALESCE(?, active),
      updated_at = ?
    WHERE id = ?
  `).run(
    payload.name ?? null,
    payload.description ?? null,
    payload.concern ?? null,
    sale,
    listPrice,
    discount,
    payload.photo ?? null,
    payload.active === undefined ? null : (payload.active ? 1 : 0),
    now,
    id,
  );

  if (payload.stock !== undefined) {
    const stockQty = Math.max(0, Math.floor(Number(payload.stock)));
    db.prepare(`
      INSERT INTO inventory (product_id, quantity) VALUES (?, ?)
      ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity
    `).run(id, stockQty);
  }

  return getProductById(db, id);
}

export function deleteCustomProduct(db, id) {
  const existing = getProductById(db, id);
  if (!existing) return false;
  if (existing.isBuiltin) throw new Error('builtin_not_deletable');
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return true;
}

export function setProductVisibility(db, id, hidden) {
  const existing = getProductById(db, id);
  if (!existing) return null;
  if (!existing.isBuiltin) throw new Error('custom_visibility_via_active');
  db.prepare('UPDATE products SET hidden = ?, updated_at = ? WHERE id = ?').run(hidden ? 1 : 0, Date.now(), id);
  return getProductById(db, id);
}
