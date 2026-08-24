import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestApp,
  teardownTestApp,
  loginAdmin,
  authHeaders,
} from './helpers.js';

describe('API products', () => {
  let app;

  before(async () => {
    ({ app } = await setupTestApp());
  });

  after(async () => {
    await teardownTestApp();
  });

  it('TC-API10 positive: store catalog lists 9 built-in products', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products' });
    assert.equal(res.statusCode, 200);
    const { products } = res.json();
    assert.equal(products.length, 9);
    assert.ok(products.some((p) => p.id === 'immunity'));
    assert.ok(products.every((p) => p.active && !p.hidden));
  });

  it('TC-API11 positive: GET single product by id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products/immunity' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().product.name, 'Daily Immunity');
    assert.equal(res.json().product.priceN, 349);
  });

  it('TC-API12 negative: unknown product returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products/does-not-exist' });
    assert.equal(res.statusCode, 404);
  });

  it('TC-API13 positive: admin creates custom product with discount + stock', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Morning Tulsi Brew',
        description: 'A calming morning ritual blend.',
        priceN: 299,
        discountPct: 10,
        stock: 12,
        concern: 'Immunity',
        active: true,
      },
    });
    assert.equal(res.statusCode, 201);
    const { product } = res.json();
    assert.ok(product.id.startsWith('custom-'));
    assert.equal(product.priceN, 269);
    assert.equal(product.listPriceN, 299);
    assert.equal(product.discountPct, 10);
    assert.equal(product.stock, 12);
  });

  it('TC-API14 negative: create product missing name', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: { description: 'No name', priceN: 100, stock: 1 },
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-API15 negative: discount over 90% rejected', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Bad Discount',
        description: 'Test',
        priceN: 100,
        discountPct: 95,
        stock: 1,
      },
    });
    assert.equal(res.statusCode, 400);
  });

  it('TC-API16 positive: draft product hidden from store catalog', async () => {
    const { token } = await loginAdmin();
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Draft Only SKU',
        description: 'Not published yet',
        priceN: 150,
        stock: 5,
        active: false,
      },
    });
    const id = create.json().product.id;
    const store = await app.inject({ method: 'GET', url: '/api/products' });
    assert.ok(!store.json().products.some((p) => p.id === id));
    const admin = await app.inject({
      method: 'GET',
      url: '/api/admin/products',
      headers: authHeaders(token),
    });
    assert.ok(admin.json().products.some((p) => p.id === id && p.active === false));
  });

  it('TC-API17 positive: hide built-in removes from store', async () => {
    const { token } = await loginAdmin();
    const hide = await app.inject({
      method: 'PATCH',
      url: '/api/admin/products/sunni/visibility',
      headers: authHeaders(token),
      payload: { hidden: true },
    });
    assert.equal(hide.statusCode, 200);
    const store = await app.inject({ method: 'GET', url: '/api/products' });
    assert.ok(!store.json().products.some((p) => p.id === 'sunni'));
    const show = await app.inject({
      method: 'PATCH',
      url: '/api/admin/products/sunni/visibility',
      headers: authHeaders(token),
      payload: { hidden: false },
    });
    assert.equal(show.statusCode, 200);
  });

  it('TC-API18 positive: edit custom product updates name and discount', async () => {
    const { token } = await loginAdmin();
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Edit Me',
        description: 'Original',
        priceN: 200,
        discountPct: 0,
        stock: 3,
      },
    });
    const id = create.json().product.id;
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/products/${id}`,
      headers: authHeaders(token),
      payload: { name: 'Edited Name', discountPct: 20, listPriceN: 200 },
    });
    assert.equal(patch.statusCode, 200);
    assert.equal(patch.json().product.name, 'Edited Name');
    assert.equal(patch.json().product.priceN, 160);
  });

  it('TC-API19 positive: delete custom product', async () => {
    const { token } = await loginAdmin();
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/products',
      headers: authHeaders(token),
      payload: {
        name: 'Delete Me',
        description: 'Temporary',
        priceN: 99,
        stock: 1,
      },
    });
    const id = create.json().product.id;
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/admin/products/${id}`,
      headers: authHeaders(token),
    });
    assert.equal(del.statusCode, 200);
    const get = await app.inject({
      method: 'GET',
      url: `/api/admin/products`,
      headers: authHeaders(token),
    });
    assert.ok(!get.json().products.some((p) => p.id === id));
  });

  it('TC-API20 negative: cannot delete built-in product', async () => {
    const { token } = await loginAdmin();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/products/immunity',
      headers: authHeaders(token),
    });
    assert.equal(res.statusCode, 400);
  });
});
