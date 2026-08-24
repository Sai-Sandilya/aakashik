import { ORDER_STATUSES, STATUS_LABELS, STATUS_TRANSITIONS } from '../lib/constants.js';
import { withTransaction } from '../db/transaction.js';
import { ApiError } from '../lib/errors.js';
import { deductStockForItems } from './inventory.js';
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
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
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
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!row) return null;
  return mapOrderRow(db, row);
}

export function getTrackPayload(db, id) {
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

function validateDelivery(delivery) {
  const d = delivery || {};
  const name = String(d.name || '').trim();
  const phone = String(d.phone || '').replace(/\D/g, '');
  const email = String(d.email || '').trim();
  const address = String(d.address || '').trim();
  const city = String(d.city || '').trim();
  const state = String(d.state || '').trim();
  const pincode = String(d.pincode || '').trim();

  if (!name) throw new ApiError(400, 'validation_error', 'Enter your full name');
  if (!phone && !email) throw new ApiError(400, 'validation_error', 'Enter phone or email for delivery');
  if (phone && (!/^\d{10}$/.test(phone) || !/^[6-9]/.test(phone))) {
    throw new ApiError(400, 'validation_error', 'Enter a valid 10-digit phone');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ApiError(400, 'validation_error', 'Enter a valid email format');
  }
  if (!address) throw new ApiError(400, 'validation_error', 'Enter your delivery address');
  if (!city) throw new ApiError(400, 'validation_error', 'Enter your city');
  if (!/^\d{6}$/.test(pincode)) throw new ApiError(400, 'validation_error', 'Enter a valid 6-digit pin code');
  if (!state) throw new ApiError(400, 'validation_error', 'Select your state / UT');

  return { name, phone, email, address, city, state, pincode };
}

function generateOrderId(db) {
  for (let i = 0; i < 20; i += 1) {
    const id = `AAK-${10000 + Math.floor(Math.random() * 90000)}`;
    const exists = db.prepare('SELECT 1 FROM orders WHERE id = ?').get(id);
    if (!exists) return id;
  }
  return `AAK-${Date.now()}`;
}

export function createOrder(db, payload) {
  const itemsIn = Array.isArray(payload.items) ? payload.items : [];
  if (!itemsIn.length) throw new ApiError(400, 'validation_error', 'Cart is empty');

  const delivery = validateDelivery(payload.delivery);
  const payMethod = payload.payMethod || 'cod';
  const payment = payload.payment || { method: payMethod, mock: true, status: payMethod === 'cod' ? 'cod' : 'authorized' };

  const normalizedItems = [];
  let total = 0;

  for (const raw of itemsIn) {
    const productId = raw.productId || raw.id;
    const product = getProductById(db, productId);
    if (!product || !product.active || product.hidden) {
      throw new ApiError(400, 'invalid_product', `Product not available: ${productId}`);
    }
    const qty = Math.max(1, Math.floor(Number(raw.qty) || 1));
    const unitPrice = Math.round(Number(raw.unitPrice ?? product.priceN));
    const lineTotal = unitPrice * qty;
    total += lineTotal;
    normalizedItems.push({
      productId,
      name: raw.name || product.name,
      qty,
      unitPrice,
      line: raw.line || `${raw.name || product.name} × ${qty} · ₹${unitPrice}`,
      size: raw.size || null,
    });
  }

  deductStockForItems(db, normalizedItems);

  const orderId = generateOrderId(db);
  const placedAt = Date.now();
  const subtotal = Math.round(Number(payload.subtotal ?? total));
  const memberDiscount = Math.round(Number(payload.memberDiscount ?? 0));
  const finalTotal = Math.round(Number(payload.total ?? total));

  withTransaction(db, () => {
    db.prepare(`
      INSERT INTO orders (
        id, status, placed_at, total, subtotal, member_discount, pay_method,
        payment_json, delivery_json, source, created_at, updated_at
      ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, 'store', ?, ?)
    `).run(
      orderId,
      placedAt,
      finalTotal,
      subtotal,
      memberDiscount,
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
  if (!ORDER_STATUSES.includes(nextStatus)) {
    throw new ApiError(400, 'invalid_status', 'Unknown order status');
  }
  const order = getOrder(db, orderId);
  if (!order) throw new ApiError(404, 'not_found', 'Order not found');

  const allowed = STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(400, 'invalid_transition', `Cannot move from ${order.status} to ${nextStatus}`);
  }

  const at = Date.now();
  withTransaction(db, () => {
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, at, orderId);
    db.prepare('INSERT INTO order_status_history (order_id, status, at) VALUES (?, ?, ?)').run(orderId, nextStatus, at);
  });

  return getOrder(db, orderId);
}
