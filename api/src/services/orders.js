import { ORDER_STATUSES, STATUS_LABELS, STATUS_TRANSITIONS } from '../lib/constants.js';
import { withTransaction } from '../db/transaction.js';
import { ApiError } from '../lib/errors.js';
import {
  validateDelivery,
  validateCartItem,
  validatePayMethod,
  validatePaymentDetails,
  validateOrderStatusFilter,
  validateOrderId,
  validateStatusUpdate,
} from '../lib/validation.js';
import { computeOrderTotals, lineUnitPrice, resolveBasePrice } from '../lib/pricing.js';
import { getStock } from './inventory.js';
import { getProductById } from './products.js';

function parseJson(raw, fallback = {}) {
  try { return JSON.parse(raw || ''); } catch { return fallback; }
}

function mapOrderRow(db, row) {
  const items = db.prepare(`
    SELECT product_id AS productId, name, qty, unit_price AS unitPrice, line_text AS line, size
    FROM order_items WHERE order_id = ?
  `).all(row.id);

  const statusHistory = db.prepare(`
    SELECT status, at FROM order_status_history WHERE order_id = ? ORDER BY at ASC
  `).all(row.id);

  const delivery = parseJson(row.delivery_json);
  const payment = parseJson(row.payment_json);

  return {
    id: row.id,
    source: row.source,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    placedAt: row.placed_at,
    total: row.total,
    subtotal: row.subtotal,
    memberDiscount: row.member_discount,
    payMethod: row.pay_method,
    payment,
    paymentStatus: payment.status || (row.pay_method === 'cod' ? 'cod' : 'paid'),
    customer: {
      name: delivery.name || 'Customer',
      phone: delivery.phone || '',
      email: delivery.email || '',
    },
    delivery: {
      address: delivery.address || '',
      city: delivery.city || '',
      state: delivery.state || '',
      pincode: delivery.pincode || '',
    },
    items,
    statusHistory,
  };
}

export function listOrders(db, { status, search } = {}) {
  const safeStatus = validateOrderStatusFilter(status);
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (safeStatus && safeStatus !== 'all') {
    sql += ' AND status = ?';
    params.push(safeStatus);
  }
  sql += ' ORDER BY placed_at DESC';
  const rows = db.prepare(sql).all(...params);
  let orders = rows.map((r) => mapOrderRow(db, r));
  const q = String(search || '').trim().toLowerCase();
  if (q) {
    orders = orders.filter((o) => {
      const blob = [o.id, o.customer.name, o.customer.phone, o.customer.email].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }
  return orders;
}

export function getOrder(db, id) {
  validateOrderId(id);
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!row) return null;
  return mapOrderRow(db, row);
}

export function getTrackPayload(db, id) {
  validateOrderId(id);
  const order = getOrder(db, id);
  if (!order) return null;
  const keys = ['pending', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
  const cancelled = order.status === 'cancelled';
  let activeIdx = keys.indexOf(order.status);
  if (activeIdx < 0 && !cancelled) activeIdx = 0;
  const steps = keys.map((key, idx) => ({
    key,
    label: STATUS_LABELS[key],
    done: cancelled ? false : (activeIdx >= 0 && idx <= activeIdx),
    current: !cancelled && idx === activeIdx,
  }));
  return {
    orderId: order.id,
    status: order.status,
    statusLabel: order.statusLabel,
    cancelled,
    placedAt: order.placedAt,
    steps,
    statusHistory: order.statusHistory,
    estimatedNote: cancelled
      ? 'cancelled'
      : (order.status === 'delivered' ? 'delivered' : 'simulated demo tracking'),
  };
}

function aggregateCartLines(itemsIn) {
  const map = new Map();
  itemsIn.forEach((raw, index) => {
    const line = validateCartItem(raw, index);
    const key = `${line.productId}::${line.size || 'std'}`;
    const prev = map.get(key);
    if (prev) {
      prev.qty += line.qty;
      prev.subscribe = prev.subscribe || line.subscribe;
    } else {
      map.set(key, { ...line });
    }
  });
  return [...map.values()];
}

function normalizeOrderLines(db, cartLines, memberPricing) {
  const priced = [];
  for (const line of cartLines) {
    const product = getProductById(db, line.productId);
    if (!product || !product.active || product.hidden) {
      throw new ApiError(400, 'invalid_product', `Product not available: ${line.productId}`);
    }
    const basePrice = resolveBasePrice(product, line);
    const unitPrice = lineUnitPrice(basePrice, {
      subscribe: line.subscribe,
      memberPricing: memberPricing && !line.subscribe,
    });
    priced.push({
      productId: line.productId,
      name: product.name,
      qty: line.qty,
      basePrice,
      unitPrice,
      size: line.size,
      line: `${product.name}${line.size ? ` (${line.size})` : ''} × ${line.qty} · ₹${unitPrice}`,
    });
  }
  return priced;
}

function generateOrderId(db) {
  for (let i = 0; i < 20; i += 1) {
    const id = `AAK-${10000 + Math.floor(Math.random() * 90000)}`;
    const exists = db.prepare('SELECT 1 FROM orders WHERE id = ?').get(id);
    if (!exists) return id;
  }
  return `AAK-${Date.now()}`;
}

function restoreStockForOrder(db, orderId) {
  const items = db.prepare(`
    SELECT product_id AS productId, qty FROM order_items WHERE order_id = ?
  `).all(orderId);
  for (const it of items) {
    db.prepare(`
      UPDATE inventory SET quantity = quantity + ? WHERE product_id = ?
    `).run(it.qty, it.productId);
  }
}

export function createOrder(db, payload) {
  const itemsIn = Array.isArray(payload.items) ? payload.items : [];
  if (!itemsIn.length) throw new ApiError(400, 'validation_error', 'Cart is empty');

  const delivery = validateDelivery(payload.delivery);
  const payMethod = validatePayMethod(payload.payMethod);
  const payment = validatePaymentDetails(payMethod, payload.payment || {});

  const memberPricing = !!(payload.memberPricing || payload.loggedIn);
  const cartLines = aggregateCartLines(itemsIn);
  const normalizedItems = normalizeOrderLines(db, cartLines, memberPricing);
  const totals = computeOrderTotals(normalizedItems);

  if (payload.total != null) {
    const clientTotal = Math.round(Number(payload.total));
    if (Number.isFinite(clientTotal) && Math.abs(clientTotal - totals.total) > 1) {
      throw new ApiError(400, 'price_mismatch', 'Order total does not match catalog pricing');
    }
  }

  const orderId = generateOrderId(db);
  const placedAt = Date.now();

  withTransaction(db, () => {
    for (const it of normalizedItems) {
      const row = db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(it.productId);
      if (!row || row.quantity < it.qty) {
        throw new ApiError(409, 'insufficient_stock', 'Not enough stock for one or more items');
      }
    }

    for (const it of normalizedItems) {
      db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE product_id = ?').run(it.qty, it.productId);
    }

    db.prepare(`
      INSERT INTO orders (
        id, status, placed_at, total, subtotal, member_discount, pay_method,
        payment_json, delivery_json, source, created_at, updated_at
      ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, 'store', ?, ?)
    `).run(
      orderId,
      placedAt,
      totals.total,
      totals.subtotal,
      totals.memberDiscount,
      payMethod,
      JSON.stringify(payment),
      JSON.stringify(delivery),
      placedAt,
      placedAt,
    );

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, qty, unit_price, line_text, size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of normalizedItems) {
      insertItem.run(orderId, it.productId, it.name, it.qty, it.unitPrice, it.line, it.size);
    }
    db.prepare('INSERT INTO order_status_history (order_id, status, at) VALUES (?, ?, ?)').run(orderId, 'pending', placedAt);
  });

  return getOrder(db, orderId);
}

export function updateOrderStatus(db, orderId, nextStatus) {
  validateOrderId(orderId);
  const status = validateStatusUpdate({ status: nextStatus });

  const order = getOrder(db, orderId);
  if (!order) throw new ApiError(404, 'not_found', 'Order not found');

  const allowed = STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, 'invalid_transition', `Cannot move from ${order.status} to ${status}`);
  }

  const at = Date.now();
  withTransaction(db, () => {
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, at, orderId);
    db.prepare('INSERT INTO order_status_history (order_id, status, at) VALUES (?, ?, ?)').run(orderId, status, at);
    if (status === 'cancelled' && order.status !== 'delivered') {
      restoreStockForOrder(db, orderId);
    }
  });

  return getOrder(db, orderId);
}

export { getStock };
