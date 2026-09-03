/**
 * Admin custom products — add / hide / delete syncs to the store catalog.
 */
const { test, expect } = require('@playwright/test');
const { resetE2eApi, createCustomProduct, waitForStoreCatalog, loginAdmin, authHeaders } = require('./helpers/e2e-api');

const ADMIN_URL = '/Admin';
const LANDING_URL = '/';
const ADMIN_EMAIL = 'owner@aakashik.local';
const ADMIN_PASSWORD = 'Admin@1234';

async function seedAdminSession(page) {
  await page.evaluate(() => {
    sessionStorage.setItem('ak_admin_token', 'ak-demo-mock-session');
    localStorage.setItem('ak_admin_logged', '1');
  });
}

async function clearProductStorage(page, request) {
  if (request) await resetE2eApi(request);
  await page.goto(LANDING_URL);
  await page.evaluate(() => {
    localStorage.removeItem('ak_admin_logged');
    localStorage.removeItem('ak_admin_orders');
    localStorage.removeItem('ak_orders');
    localStorage.removeItem('ak_stock');
    localStorage.removeItem('ak_custom_products');
    localStorage.removeItem('ak_hidden_ids');
    localStorage.removeItem('ak_cart');
    try { sessionStorage.removeItem('ak_admin_token'); } catch (er) {}
  });
}

async function adminLogin(page) {
  await page.goto(ADMIN_URL);
  await page.getByLabel('Admin email').fill(ADMIN_EMAIL);
  await page.getByLabel('Admin password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Enter Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible({ timeout: 15000 });
}

async function openProducts(page) {
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
}

async function fillProductForm(page, {
  name = 'Demo Tulsi Mist',
  desc = 'A calming herbal mist for evening rituals.',
  price = '299',
  discount = '10',
  stock = '12',
  concern = 'Spiritual',
} = {}) {
  await page.getByLabel('Product name').fill(name);
  await page.getByLabel('Product description').fill(desc);
  await page.getByLabel('Product price').fill(price);
  await page.getByLabel('Product discount percent').fill(discount);
  await page.getByLabel('Product stock quantity').fill(stock);
  await page.getByLabel('Product category').selectOption(concern);
}

test.describe('Admin products — add & publish', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearProductStorage(page, request);
  });

  test('TC-PR01 positive: Products tab opens with add form', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    await expect(page.getByRole('heading', { name: 'Add product' })).toBeVisible();
    await expect(page.getByLabel('Product name')).toBeVisible();
    await expect(page.getByText(/Custom:\s*0/)).toBeVisible();
  });

  test('TC-PR02 positive: publish custom product stores catalog + stock', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    await fillProductForm(page);
    await page.getByRole('button', { name: 'Publish product' }).click();
    await expect(page.getByText(/Added Demo Tulsi Mist to store/i)).toBeVisible();
    await expect(page.getByText('Demo Tulsi Mist', { exact: true })).toBeVisible();
    const data = await page.evaluate(() => ({
      products: JSON.parse(localStorage.getItem('ak_custom_products') || '[]'),
      stock: JSON.parse(localStorage.getItem('ak_stock') || '{}'),
    }));
    expect(data.products).toHaveLength(1);
    expect(data.products[0].name).toBe('Demo Tulsi Mist');
    expect(data.products[0].priceN).toBe(269);
    expect(data.products[0].listPriceN).toBe(299);
    expect(data.products[0].discountPct).toBe(10);
    expect(data.stock[data.products[0].id]).toBe(12);
  });

  test('TC-PR03 negative: missing name is rejected', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    await fillProductForm(page, { name: '' });
    await page.getByRole('button', { name: 'Publish product' }).click();
    await expect(page.getByText(/Enter a product name/i)).toBeVisible();
    const count = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]').length);
    expect(count).toBe(0);
  });

  test('TC-PR04 negative: invalid discount over 90 rejected', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    await fillProductForm(page, { discount: '95' });
    await page.getByRole('button', { name: 'Publish product' }).click();
    await expect(page.getByText(/Discount must be 0–90%/i)).toBeVisible();
  });
});

test.describe('Admin products — store visibility', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearProductStorage(page, request);
  });

  test('TC-PR05 positive: published product appears on store search', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    await fillProductForm(page, {
      name: 'Forest Rose Scrub',
      desc: 'Gentle rose scrub for glowing skin.',
      price: '399',
      discount: '0',
      stock: '8',
      concern: 'Skin & Body',
    });
    await page.getByRole('button', { name: 'Publish product' }).click();
    await expect(page.getByText(/Added Forest Rose Scrub/i)).toBeVisible();
    await page.goto(LANDING_URL);
    await page.reload();
    await waitForStoreCatalog(page);
    await page.getByRole('button', { name: 'Search' }).first().click({ force: true });
    await page.getByPlaceholder(/Search blends/i).fill('Forest Rose');
    await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('heading', { name: 'Forest Rose Scrub' })).toBeVisible({ timeout: 8000 });
  });

  test('TC-PR06 positive: draft (inactive) product stays off the store', async ({ page, request }) => {
    await createCustomProduct(request, {
      name: 'Hidden Draft Blend',
      description: 'Should not appear',
      concern: 'Immunity',
      listPriceN: 199,
      stock: 5,
      active: false,
    });
    await page.goto(LANDING_URL);
    await page.reload();
    await waitForStoreCatalog(page);
    await page.getByRole('button', { name: 'Search' }).first().click({ force: true });
    await page.getByPlaceholder(/Search blends/i).fill('Hidden Draft');
    await expect(page.getByRole('dialog', { name: 'Search' }).getByText('Hidden Draft Blend')).toHaveCount(0);
  });

  test('TC-PR07 complex: hide built-in removes it from store; show restores', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    const row = page.locator('[data-product-row="immunity"]');
    await row.getByRole('button', { name: 'Hide from store' }).click();
    await expect(page.getByText(/Daily Immunity hidden from store/i)).toBeVisible();

    await page.goto(LANDING_URL);
    await page.reload();
    await waitForStoreCatalog(page);
    const onStore = await page.evaluate(() => {
      const hidden = JSON.parse(localStorage.getItem('ak_hidden_ids') || '[]');
      return hidden.includes('immunity');
    });
    expect(onStore).toBe(true);

    await page.goto(ADMIN_URL);
    await openProducts(page);
    await page.locator('[data-product-row="immunity"]').getByRole('button', { name: 'Show on store' }).click();
    await expect(page.getByText(/Daily Immunity shown on store/i)).toBeVisible();
    const hidden = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_hidden_ids') || '[]'));
    expect(hidden.includes('immunity')).toBe(false);
  });

  test('TC-PR08 complex: delete custom product removes it from admin + store', async ({ page, request }) => {
    await adminLogin(page);
    await openProducts(page);
    await fillProductForm(page, {
      name: 'Temp Delete Me',
      desc: 'temp',
      price: '149',
      discount: '0',
      stock: '5',
      concern: 'Digestion',
    });
    await page.getByRole('button', { name: 'Publish product' }).click();
    await expect(page.getByText(/Added Temp Delete Me/i)).toBeVisible();
    const productId = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]')[0].id);
    const token = await loginAdmin(request);
    const delRes = await request.delete(`/api/admin/products/${encodeURIComponent(productId)}`, {
      headers: authHeaders(token),
    });
    expect(delRes.ok()).toBeTruthy();
    await page.reload();
    await openProducts(page);
    await expect(page.getByText('Temp Delete Me', { exact: true })).toHaveCount(0);
    const data = await page.evaluate(() => ({
      products: JSON.parse(localStorage.getItem('ak_custom_products') || '[]'),
      stock: JSON.parse(localStorage.getItem('ak_stock') || '{}'),
    }));
    expect(data.products.find((p) => p.id === productId)).toBeFalsy();
    expect(data.stock[productId]).toBeUndefined();

    await page.goto(LANDING_URL);
    await page.reload();
    await waitForStoreCatalog(page);
    await expect(page.getByText('Temp Delete Me')).toHaveCount(0);
  });
});

test.describe('Admin products — edit & inventory link', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearProductStorage(page, request);
  });

  test('TC-PR09 positive: edit updates name and discount', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    await fillProductForm(page, {
      name: 'Old Name Blend',
      desc: 'Old desc',
      price: '500',
      discount: '0',
      stock: '9',
      concern: 'Immunity',
    });
    await page.getByRole('button', { name: 'Publish product' }).click();
    await expect(page.getByText(/Added Old Name Blend/i)).toBeVisible();
    const productId = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]')[0].id);
    await page.locator(`[data-product-row="${productId}"]`).getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit custom product' })).toBeVisible();
    await page.getByLabel('Product name').fill('New Name Blend');
    await page.getByLabel('Product discount percent').fill('20');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(/Updated New Name Blend/i)).toBeVisible();
    const p = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]')[0]);
    expect(p.name).toBe('New Name Blend');
    expect(p.discountPct).toBe(20);
    expect(p.priceN).toBe(400);
  });

  test('TC-PR10 complex: custom SKU appears in Inventory after publish', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    await fillProductForm(page, { name: 'Inventory Linked Oil', stock: '4' });
    await page.getByRole('button', { name: 'Publish product' }).click();
    await expect(page.getByText(/Added Inventory Linked Oil to store/i)).toBeVisible();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    await expect(page.getByText('Inventory Linked Oil', { exact: true })).toBeVisible();
    await expect(page.getByText(/SKUs:\s*10/)).toBeVisible();
  });

  test('TC-PR11 complex: toggle draft hides from store then republish', async ({ page }) => {
    await adminLogin(page);
    await openProducts(page);
    await fillProductForm(page, {
      name: 'Toggle Ritual Tea',
      desc: 'tea',
      price: '220',
      discount: '0',
      stock: '6',
      concern: 'Immunity',
    });
    await page.getByRole('button', { name: 'Publish product' }).click();
    await expect(page.getByText(/Added Toggle Ritual Tea/i)).toBeVisible();
    const productId = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]')[0].id);
    await page.locator(`[data-product-row="${productId}"]`).getByRole('button', { name: 'Hide (draft)' }).click();
    await expect(page.getByText(/set to draft/i)).toBeVisible();
    let active = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]')[0].active);
    expect(active).toBe(false);
    await page.locator(`[data-product-row="${productId}"]`).getByRole('button', { name: 'Make active' }).click();
    await expect(page.getByText(/Toggle Ritual Tea published/i)).toBeVisible();
    active = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]')[0].active);
    expect(active).toBe(true);
  });
});
