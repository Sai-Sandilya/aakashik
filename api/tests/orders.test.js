import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestApp,
  teardownTestApp,
  loginAdmin,
  authHeaders,
  sampleOrderPayload,
  sampleDelivery,
} from './helpers.js';

describe('API orders', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-API40 positive: admin lists seeded mock orders', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orders',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const { orders } = res.json();
    assert.ok(orders.length >= 3);
    assert.ok(orders.some((o) => o.id === 'AAK-10001'));
  });

  it('TC-API41 positive: filter orders by status', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orders?status=delivered',
      headers: authHeaders(token),
    });
    assert.ok(res.json().orders.every((o) => o.status === 'delivered'));
  });

  it('TC-API42 positive: search orders by customer phone', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orders?search=9876501001',
      headers: authHeaders(token),
    });
    assert.ok(res.json().orders.some((o) => o.id === 'AAK-10001'));
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
      url: '/api/admin/inventory/immunity',
      headers: authHeaders(token),
      payload: { quantity: 0 },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload(),
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, 'insufficient_stock');
  });

  it('TC-API48 positive: track order returns 5-step timeline', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orders/AAK-10001/track' });
    assert.equal(res.statusCode, 200);
    const { track } = res.json();
    assert.equal(track.orderId, 'AAK-10001');
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
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'ashta', qty: 1 }],
        total: 199,
      }),
    });
    const id = create.json().order.id;
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/orders/${id}/status`,
      headers: authHeaders(token),
      payload: { status: 'packed' },
    });
    assert.equal(patch.statusCode, 200);
    assert.equal(patch.json().order.status, 'packed');
    assert.equal(patch.json().order.statusHistory.length, 2);
  });

  it('TC-API51 negative: invalid status jump pending → delivered', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/orders/AAK-10001/status',
      headers: authHeaders(token),
      payload: { status: 'delivered' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'invalid_transition');
  });

  it('TC-API52 positive: cancel from pending', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/orders/AAK-10001/status',
      headers: authHeaders(token),
      payload: { status: 'cancelled' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().order.status, 'cancelled');
    const track = await app.inject({ method: 'GET', url: '/api/orders/AAK-10001/track' });
    assert.equal(track.json().track.cancelled, true);
  });

  it('TC-API53 negative: delivered order has no further transitions', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/orders/AAK-10003/status',
      headers: authHeaders(token),
      payload: { status: 'packed' },
    });
    assert.equal(res.statusCode, 400);
  });
});
