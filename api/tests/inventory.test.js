import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestApp,
  teardownTestApp,
  loginAdmin,
  authHeaders,
} from './helpers.js';

describe('API inventory', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-API30 positive: admin inventory lists 9 SKUs with stock', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 200);
    const { inventory } = res.json();
    assert.equal(inventory.length, 9);
    const immunity = inventory.find((r) => r.productId === 'immunity');
    assert.equal(immunity.quantity, 30);
    assert.equal(immunity.badge, 'in_stock');
  });

  it('TC-API31 positive: set exact stock quantity', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/sunni',
      headers: authHeaders(token),
      payload: { quantity: 4 },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().inventory.quantity, 4);
    assert.equal(res.json().inventory.badge, 'low_stock');
  });

  it('TC-API32 positive: adjust stock +1 and -1', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/sunni',
      headers: authHeaders(token),
      payload: { quantity: 10 },
    });
    const up = await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/sunni/adjust',
      headers: authHeaders(token),
      payload: { delta: 1 },
    });
    assert.equal(up.json().inventory.quantity, 11);
    const down = await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/sunni/adjust',
      headers: authHeaders(token),
      payload: { delta: -1 },
    });
    assert.equal(down.json().inventory.quantity, 10);
  });

  it('TC-API33 negative: invalid stock quantity rejected', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/immunity',
      headers: authHeaders(token),
      payload: { quantity: -5 },
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-API34 positive: out_of_stock filter', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/diabetic',
      headers: authHeaders(token),
      payload: { quantity: 0 },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory?filter=out',
      headers: authHeaders(token),
    });
    assert.ok(res.json().inventory.some((r) => r.productId === 'diabetic'));
    assert.ok(res.json().inventory.every((r) => r.quantity <= 0));
  });

  it('TC-API35 positive: low stock filter (1–5)', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/ashta',
      headers: authHeaders(token),
      payload: { quantity: 3 },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory?filter=low',
      headers: authHeaders(token),
    });
    const row = res.json().inventory.find((r) => r.productId === 'ashta');
    assert.ok(row);
    assert.equal(row.badge, 'low_stock');
  });

  it('TC-API36 positive: reseed restores default stock map', async () => {
    const { token } = await loginAdmin();
    await app.inject({
      method: 'PATCH',
      url: '/api/admin/inventory/immunity',
      headers: authHeaders(token),
      payload: { quantity: 1 },
    });
    const reseed = await app.inject({
      method: 'POST',
      url: '/api/admin/inventory/reseed',
      headers: authHeaders(token),
    });
    assert.equal(reseed.statusCode, 200);
    const immunity = reseed.json().inventory.find((r) => r.productId === 'immunity');
    assert.equal(immunity.quantity, 30);
  });

  it('TC-API37 positive: custom product appears in inventory after create', async () => {
    const { token } = await loginAdmin();
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Stock Test SKU',
        description: 'Inventory row test',
        priceN: 120,
        stock: 18,
      },
    });
    const id = create.json().product.id;
    const inv = await app.inject({
      method: 'GET',
      url: '/api/admin/inventory',
      headers: authHeaders(token),
    });
    const row = inv.json().inventory.find((r) => r.productId === id);
    assert.ok(row);
    assert.equal(row.quantity, 18);
  });
});
