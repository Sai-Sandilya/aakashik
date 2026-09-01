import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestApp,
  teardownTestApp,
  loginAdmin,
  authHeaders,
  sampleOrderPayload,
} from './helpers.js';

describe('API integration flows', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-API60 complex: publish product → checkout → admin status → store track sync', async () => {
    const { token } = await loginAdmin();

    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Integration Ritual Oil',
        description: 'End-to-end API flow product',
        priceN: 450,
        discountPct: 10,
        stock: 4,
        concern: 'Skin & Body',
      },
    });
    const productId = create.json().product.id;

    const catalog = await app.inject({ method: 'GET', url: '/api/products' });
    assert.ok(catalog.json().products.some((p) => p.id === productId));

    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId, name: 'Integration Ritual Oil', qty: 2, unitPrice: 405 }],
        total: 810,
        subtotal: 810,
      }),
    });
    assert.equal(orderRes.statusCode, 201);
    const orderId = orderRes.json().order.id;

    const inv = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory',
      headers: authHeaders(token),
    });
    assert.equal(inv.json().inventory.find((r) => r.productId === productId).quantity, 2);

    const statuses = ['packed', 'shipped', 'out_for_delivery', 'delivered'];
    for (const status of statuses) {
      const step = await app.inject({
        method: 'PATCH',
        url: `/api/admin/orders/${orderId}/status`,
        headers: authHeaders(token),
        payload: { status },
      });
      assert.equal(step.statusCode, 200, `failed at ${status}`);
    }

    const track = await app.inject({ method: 'GET', url: `/api/orders/${orderId}/track` });
    assert.equal(track.json().track.status, 'delivered');
    assert.equal(track.json().track.steps.filter((s) => s.done).length, 5);
  });

  it('TC-API61 complex: hide built-in → checkout blocked for hidden SKU', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/products/navojas/visibility',
      headers: authHeaders(token),
      payload: { hidden: true },
    });

    const checkout = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'navojas', name: 'Navojas', qty: 1, unitPrice: 199 }],
      }),
    });
    assert.equal(checkout.statusCode, 400);
    assert.equal(checkout.json().error, 'invalid_product');

    await app.inject({
      method: 'PATCH',
      url: '/api/admin/products/navojas/visibility',
      headers: authHeaders(token),
      payload: { hidden: false },
    });
  });

  it('TC-API62 complex: concurrent checkout cannot oversell last unit', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/sample-trio',
      headers: authHeaders(token),
      payload: { quantity: 1 },
    });

    const payload = sampleOrderPayload({
      items: [{ productId: 'sample-trio', name: 'Sample Trio', qty: 1, unitPrice: 99 }],
      total: 99,
    });

    const first = await app.inject({ method: 'POST', url: '/api/orders', payload });
    const second = await app.inject({ method: 'POST', url: '/api/orders', payload });

    const codes = [first.statusCode, second.statusCode].sort();
    assert.deepEqual(codes, [201, 409]);
  });

  it('TC-API63 complex: draft → publish → inventory → delete lifecycle', async () => {
    const { token } = await loginAdmin();

    const draft = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Lifecycle SKU',
        description: 'Draft first',
        priceN: 180,
        stock: 6,
        active: false,
      },
    });
    const id = draft.json().product.id;

    let store = await app.inject({ method: 'GET', url: '/api/products' });
    assert.ok(!store.json().products.some((p) => p.id === id));

    await app.inject({
      method: 'PATCH',
      url: `/api/admin/products/${id}`,
      headers: authHeaders(token),
      payload: { active: true },
    });

    store = await app.inject({ method: 'GET', url: '/api/products' });
    assert.ok(store.json().products.some((p) => p.id === id));

    await app.inject({
      method: 'PATCH',
      url: `/api/admin/inventory/${id}`,
      headers: authHeaders(token),
      payload: { quantity: 0 },
    });

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: id, name: 'Lifecycle SKU', qty: 1 }],
        total: 180,
      }),
    });
    assert.equal(blocked.statusCode, 409);

    await app.inject({
      method: 'DELETE',
      url: `/api/admin/products/${id}`,
      headers: authHeaders(token),
    });

    const adminList = await app.inject({
      method: 'GET',
      url: '/api/admin/products',
      headers: authHeaders(token),
    });
    assert.ok(!adminList.json().products.some((p) => p.id === id));
  });

  it('TC-API64 complex: full order workflow with cancellation restores audit trail', async () => {
    const { token } = await loginAdmin();
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'kit-glow', name: 'Glow & Cleanse Kit', qty: 1, unitPrice: 349 }],
        total: 349,
      }),
    });
    const orderId = create.json().order.id;

    await app.inject({
      method: 'PATCH',
      url: `/api/admin/orders/${orderId}/status`,
      headers: authHeaders(token),
      payload: { status: 'packed' },
    });

    const cancel = await app.inject({
      method: 'PATCH',
      url: `/api/admin/orders/${orderId}/status`,
      headers: authHeaders(token),
      payload: { status: 'cancelled' },
    });
    assert.equal(cancel.statusCode, 200);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/orders/${orderId}`,
      headers: authHeaders(token),
    });
    const history = detail.json().order.statusHistory.map((h) => h.status);
    assert.deepEqual(history, ['pending', 'packed', 'cancelled']);

    const track = await app.inject({ method: 'GET', url: `/api/orders/${orderId}/track` });
    assert.equal(track.json().track.cancelled, true);
  });

  it('TC-API65 complex: unauthenticated admin mutations all return 401', async () => {
    const routes = [
      { method: 'GET', url: '/api/admin/products' },
      { method: 'POST', url: '/api/admin/products', payload: {} },
      { method: 'GET', url: '/api/admin/inventory' },
      { method: 'GET', url: '/api/admin/orders' },
      { method: 'PATCH', url: '/api/admin/orders/AAK-99999/status', payload: { status: 'packed' } },
    ];

    for (const r of routes) {
      const res = await app.inject(r);
      assert.equal(res.statusCode, 401, `${r.method} ${r.url}`);
    }
  });
});
