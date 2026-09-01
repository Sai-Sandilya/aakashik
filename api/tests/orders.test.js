import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestApp,
  teardownTestApp,
  loginAdmin,
  authHeaders,
  sampleOrderPayload,
  sampleDelivery,
  createOrder,
  setOrderStatus,
} from './helpers.js';

describe('API orders', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-API40 positive: admin lists created store orders', async () => {
    const { token } = await loginAdmin();
    const { order } = await createOrder({
      delivery: sampleDelivery({ phone: '9876501001', name: 'List Buyer' }),
    });
    assert.ok(order && order.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orders',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const { orders } = res.json();
    assert.ok(orders.length >= 1);
    assert.ok(orders.some((o) => o.id === order.id));
  });

  it('TC-API41 positive: filter orders by status', async () => {
    const { token } = await loginAdmin();
    const { order } = await createOrder({
      items: [{ productId: 'ashta', qty: 1 }],
      total: 199,
      subtotal: 199,
    });
    for (const status of ['packed', 'shipped', 'out_for_delivery', 'delivered']) {
      const patch = await setOrderStatus(token, order.id, status);
      assert.equal(patch.statusCode, 200, status);
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orders?status=delivered',
      headers: authHeaders(token),
    });
    assert.ok(res.json().orders.every((o) => o.status === 'delivered'));
    assert.ok(res.json().orders.some((o) => o.id === order.id));
  });

  it('TC-API42 positive: search orders by customer phone', async () => {
    const { token } = await loginAdmin();
    const phone = '9876501999';
    const { order } = await createOrder({
      delivery: sampleDelivery({ phone, name: 'Search Buyer' }),
      items: [{ productId: 'sunni', qty: 1 }],
      total: 249,
      subtotal: 249,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/orders?search=${phone}`,
      headers: authHeaders(token),
    });
    assert.ok(res.json().orders.some((o) => o.id === order.id));
  });

  it('TC-API43 positive: checkout creates order and deducts stock', async () => {
    const { token } = await loginAdmin();
    const before = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory',
      headers: authHeaders(token),
    });
    const immunityBefore = before.json().inventory.find((r) => r.productId === 'immunity').quantity;

    const create = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload(),
    });
    assert.equal(create.statusCode, 201);
    const order = create.json().order;
    assert.match(order.id, /^AAK-\d+$/);
    assert.equal(order.status, 'pending');
    assert.equal(order.items.length, 1);

    const after = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory',
      headers: authHeaders(token),
    });
    const immunityAfter = after.json().inventory.find((r) => r.productId === 'immunity').quantity;
    assert.equal(immunityAfter, immunityBefore - 1);
  });

  it('TC-API44 negative: checkout with empty cart rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: { items: [], delivery: sampleDelivery() },
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-API45 negative: checkout missing delivery name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ delivery: sampleDelivery({ name: '' }) }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-API46 negative: invalid pincode rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ delivery: sampleDelivery({ pincode: '12345' }) }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-API47 negative: insufficient stock returns 409', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/diabetic',
      headers: authHeaders(token),
      payload: { quantity: 0 },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'diabetic', qty: 1 }],
        total: 399,
        subtotal: 399,
      }),
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, 'insufficient_stock');
  });

  it('TC-API48 positive: track order returns 5-step timeline', async () => {
    const { order } = await createOrder({
      items: [{ productId: 'kaphahara', qty: 1, size: '100g', sizePrice: 199 }],
      total: 199,
      subtotal: 199,
    });
    const res = await app.inject({ method: 'GET', url: `/api/orders/${order.id}/track` });
    assert.equal(res.statusCode, 200);
    const { track } = res.json();
    assert.equal(track.orderId, order.id);
    assert.equal(track.steps.length, 5);
    assert.equal(track.steps[0].key, 'pending');
    assert.equal(track.steps[0].current, true);
  });

  it('TC-API49 negative: track unknown order returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orders/AAK-99999/track' });
    assert.equal(res.statusCode, 404);
  });

  it('TC-API50 positive: admin advances pending → packed', async () => {
    const { token } = await loginAdmin();
    const { order } = await createOrder({
      items: [{ productId: 'ashta', qty: 1 }],
      total: 199,
      subtotal: 199,
    });
    const patch = await setOrderStatus(token, order.id, 'packed');
    assert.equal(patch.statusCode, 200);
    assert.equal(patch.json().order.status, 'packed');
    assert.equal(patch.json().order.statusHistory.length, 2);
  });

  it('TC-API51 negative: invalid status jump pending → delivered', async () => {
    const { token } = await loginAdmin();
    const { order } = await createOrder({
      items: [{ productId: 'navojas', qty: 1, size: '100g', sizePrice: 199 }],
      total: 199,
      subtotal: 199,
    });
    const res = await setOrderStatus(token, order.id, 'delivered');
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'invalid_transition');
  });

  it('TC-API52 positive: cancel from pending', async () => {
    const { token } = await loginAdmin();
    const { order } = await createOrder({
      items: [{ productId: 'sample-trio', qty: 1 }],
      total: 99,
      subtotal: 99,
    });
    const res = await setOrderStatus(token, order.id, 'cancelled');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().order.status, 'cancelled');
    const track = await app.inject({ method: 'GET', url: `/api/orders/${order.id}/track` });
    assert.equal(track.json().track.cancelled, true);
  });

  it('TC-API53 negative: delivered order has no further transitions', async () => {
    const { token } = await loginAdmin();
    const { order } = await createOrder({
      items: [{ productId: 'kit-glow', qty: 1 }],
      total: 349,
      subtotal: 349,
    });
    for (const status of ['packed', 'shipped', 'out_for_delivery', 'delivered']) {
      assert.equal((await setOrderStatus(token, order.id, status)).statusCode, 200);
    }
    const res = await setOrderStatus(token, order.id, 'packed');
    assert.equal(res.statusCode, 400);
  });
});
