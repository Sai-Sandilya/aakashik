import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestApp,
  teardownTestApp,
  loginAdmin,
  authHeaders,
  sampleDelivery,
  sampleOrderPayload,
} from './helpers.js';

describe('API validation hardening (TC-VAL)', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  beforeEach(async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/reseed',
      headers: authHeaders(token),
    });
  });

  after(async () => {
    await teardownTestApp();
  });

  // Phase 1 — Server pricing
  it('TC-VAL01 negative: tampered unitPrice ignored — server uses catalog price', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'kit-immunity', qty: 1, unitPrice: 1 }],
        total: 1,
      }),
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'price_mismatch');
  });

  it('TC-VAL02 positive: checkout uses DB price for immunity ₹349', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ total: 349, subtotal: 349 }),
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().order.total, 349);
  });

  it('TC-VAL03 positive: member pricing applies 10% when loggedIn', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        loggedIn: true,
        total: 314,
        subtotal: 349,
        items: [{ productId: 'immunity', qty: 1 }],
      }),
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().order.total, 314);
    assert.equal(res.json().order.memberDiscount, 35);
  });

  it('TC-VAL04 positive: subscribe discount on line (10%)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'ashta', qty: 1, subscribe: true }],
        total: 179,
      }),
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().order.total, 179);
  });

  it('TC-VAL05 positive: subscribe wins over member — still 10% not 19%', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        loggedIn: true,
        items: [{ productId: 'ashta', qty: 1, subscribe: true }],
        total: 179,
      }),
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().order.total, 179);
    assert.equal(res.json().order.memberDiscount, 20);
  });

  it('TC-VAL06 positive: sized product uses valid size price', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'kaphahara', qty: 1, size: '250g', sizePrice: 399 }],
        total: 399,
      }),
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().order.total, 399);
  });

  // Phase 2 — Cart integrity
  it('TC-VAL07 negative: missing productId rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ items: [{ qty: 1 }] }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL08 negative: zero qty rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ items: [{ productId: 'immunity', qty: 0 }] }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL09 negative: qty over 99 rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ items: [{ productId: 'immunity', qty: 100 }] }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL10 positive: duplicate lines merged before stock check', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/immunity',
      headers: authHeaders(token),
      payload: { quantity: 1 },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [
          { productId: 'immunity', qty: 1 },
          { productId: 'immunity', qty: 1 },
        ],
        total: 698,
      }),
    });
    assert.equal(res.statusCode, 409);
  });

  it('TC-VAL11 negative: invalid size price for kaphahara', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'kaphahara', qty: 1, sizePrice: 50 }],
      }),
    });
    assert.equal(res.statusCode, 400);
  });

  // Phase 3 — Payment validation
  it('TC-VAL12 negative: invalid pay method rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ payMethod: 'bitcoin' }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL13 negative: UPI without valid ID rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        payMethod: 'upi',
        payment: { upiId: 'bad' },
      }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL14 positive: valid UPI checkout accepted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        payMethod: 'upi',
        payment: { upiId: 'name@upi' },
        total: 349,
      }),
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().order.payMethod, 'upi');
  });

  it('TC-VAL15 negative: invalid card number rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        payMethod: 'card',
        payment: { cardNumber: '1234', cardExpiry: '12/30', cardCvv: '123' },
      }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL16 positive: valid card checkout accepted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        payMethod: 'card',
        payment: { cardNumber: '4111111111111111', cardExpiry: '12/30', cardCvv: '123' },
        total: 349,
      }),
    });
    assert.equal(res.statusCode, 201);
  });

  // Phase 4 — Delivery hardening
  it('TC-VAL17 negative: missing state rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ delivery: sampleDelivery({ state: '' }) }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL18 negative: oversized address rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({ delivery: sampleDelivery({ address: 'x'.repeat(400) }) }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL19 negative: phone-only invalid prefix rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        delivery: sampleDelivery({ phone: '5123456789', email: '' }),
      }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL20 positive: phone-only valid Indian mobile accepted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        delivery: sampleDelivery({ phone: '9876543210', email: '' }),
        total: 349,
      }),
    });
    assert.equal(res.statusCode, 201);
  });

  it('TC-VAL21 negative: invalid track order id format', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orders/not-an-id/track' });
    assert.equal(res.statusCode, 400);
  });

  // Phase 5 & 6 — Atomic checkout + cancel restock
  it('TC-VAL24 positive: cancel pending order restores stock', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/ashta',
      headers: authHeaders(token),
      payload: { quantity: 5 },
    });
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'ashta', qty: 2 }],
        total: 398,
      }),
    });
    const orderId = create.json().order.id;
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/orders/${orderId}/status`,
      headers: authHeaders(token),
      payload: { status: 'cancelled' },
    });
    const inv = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory',
      headers: authHeaders(token),
    });
    assert.equal(inv.json().inventory.find((r) => r.productId === 'ashta').quantity, 5);
  });

  it('TC-VAL25 negative: cannot cancel already delivered order via bad transition', async () => {
    const { token } = await loginAdmin();
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'ashta', qty: 1 }],
        total: 199,
        subtotal: 199,
      }),
    });
    const id = create.json().order.id;
    for (const status of ['packed', 'shipped', 'out_for_delivery', 'delivered']) {
      const patch = await app.inject({
        method: 'PATCH',
        url: `/api/admin/orders/${id}/status`,
        headers: authHeaders(token),
        payload: { status },
      });
      assert.equal(patch.statusCode, 200);
    }
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/orders/${id}/status`,
      headers: authHeaders(token),
      payload: { status: 'cancelled' },
    });
    assert.equal(res.statusCode, 400);
  });

  // Phase 7 — Admin product guards
  it('TC-VAL30 negative: product name too long rejected', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'x'.repeat(200),
        description: 'Test',
        priceN: 100,
        stock: 1,
      },
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL31 negative: invalid concern category rejected', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Test SKU',
        description: 'Desc',
        priceN: 100,
        stock: 1,
        concern: 'FakeCategory',
      },
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL32 negative: oversized photo rejected', async () => {
    const { token } = await loginAdmin();
    const huge = 'data:image/png;base64,' + 'A'.repeat(2_100_000);
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Photo Test',
        description: 'Desc',
        priceN: 100,
        stock: 1,
        photo: huge,
      },
    });
    assert.equal(res.statusCode, 400);
  });

  // Phase 8 — Admin query guards
  it('TC-VAL40 negative: invalid order status filter rejected', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orders?status=hacked',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL41 negative: invalid inventory filter rejected', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory?filter=unknown',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL42 negative: status patch without status field', async () => {
    const { token } = await loginAdmin();
    const create = await app.inject({
      method: 'POST',
      url: '/api/orders',
      payload: sampleOrderPayload({
        items: [{ productId: 'sunni', qty: 1 }],
        total: 249,
        subtotal: 249,
      }),
    });
    const id = create.json().order.id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/orders/${id}/status`,
      headers: authHeaders(token),
      payload: {},
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-VAL43 negative: invalid admin email format on login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { email: 'not-an-email', password: 'Admin@1234' },
    });
    assert.equal(res.statusCode, 400);
  });
});
