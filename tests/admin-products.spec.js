/**
 * Admin custom products — add / hide / delete syncs to the store catalog.
 */
const { test, expect } = require('@playwright/test');

const ADMIN_URL = '/Admin';
const LANDING_URL = '/';
const ADMIN_EMAIL = 'owner@aakashik.local';
const ADMIN_PASSWORD = 'Admin@1234';

async function clearProductStorage(page) {
  await page.goto(LANDING_URL);
  await page.evaluate(() => {
    localStorage.removeItem('ak_admin_logged');
    localStorage.removeItem('ak_admin_orders');
    localStorage.removeItem('ak_orders');
    localStorage.removeItem('ak_stock');
    localStorage.removeItem('ak_custom_products');
    localStorage.removeItem('ak_hidden_ids');
    localStorage.removeItem('ak_cart');
  });
}

async function adminLogin(page) {
  await page.goto(ADMIN_URL);
  await page.getByLabel('Admin email').fill(ADMIN_EMAIL);
  await page.getByLabel('Admin password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Enter Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Orders (mock)' })).toBeVisible({ timeout: 8000 });
}

async function openProducts(page) {
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Products (mock)' })).toBeVisible();
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
  test.beforeEach(async ({ page }) => {
    await clearProductStorage(page);
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
  test.beforeEach(async ({ page }) => {
    await clearProductStorage(page);
  });

  test('TC-PR05 positive: published product appears on store search', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-test-1',
        name: 'Forest Rose Scrub',
        description: 'Gentle rose scrub for glowing skin.',
        benefit: 'Gentle rose scrub for glowing skin.',
        concern: 'Skin & Body',
        listPriceN: 399,
        discountPct: 0,
        priceN: 399,
        active: true,
        custom: true,
        photo: '',
      }]));
      const stock = {
        sunni: 25, diabetic: 20, immunity: 30, kaphahara: 40, ashta: 35, navojas: 40,
        'kit-immunity': 15, 'kit-glow': 15, 'sample-trio': 50,
        'custom-test-1': 8,
      };
      localStorage.setItem('ak_stock', JSON.stringify(stock));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Search' }).first().click({ force: true });
    await page.getByPlaceholder(/Search blends/i).fill('Forest Rose');
    await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('heading', { name: 'Forest Rose Scrub' })).toBeVisible({ timeout: 8000 });
  });

  test('TC-PR06 positive: draft (inactive) product stays off the store', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-draft-1',
        name: 'Hidden Draft Blend',
        description: 'Should not appear',
        benefit: 'Should not appear',
        concern: 'Immunity',
        listPriceN: 199,
        discountPct: 0,
        priceN: 199,
        active: false,
        custom: true,
      }]));
    });
    await page.reload();
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

  test('TC-PR08 complex: delete custom product removes it from admin + store', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-del-1',
        name: 'Temp Delete Me',
        description: 'temp',
        benefit: 'temp',
        concern: 'Digestion',
        listPriceN: 149,
        discountPct: 0,
        priceN: 149,
        active: true,
        custom: true,
      }]));
      const stock = JSON.parse(localStorage.getItem('ak_stock') || '{}');
      stock['custom-del-1'] = 5;
      localStorage.setItem('ak_stock', JSON.stringify(stock));
      localStorage.setItem('ak_admin_logged', '1');
    });
    await page.goto(ADMIN_URL);
    await openProducts(page);
    await expect(page.locator('[data-product-row="custom-del-1"]')).toBeVisible();
    await page.locator('[data-product-row="custom-del-1"]').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/Deleted Temp Delete Me from store/i)).toBeVisible();
    const data = await page.evaluate(() => ({
      products: JSON.parse(localStorage.getItem('ak_custom_products') || '[]'),
      stock: JSON.parse(localStorage.getItem('ak_stock') || '{}'),
    }));
    expect(data.products.find((p) => p.id === 'custom-del-1')).toBeFalsy();
    expect(data.stock['custom-del-1']).toBeUndefined();

    await page.goto(LANDING_URL);
    await page.reload();
    await expect(page.getByText('Temp Delete Me')).toHaveCount(0);
  });
});

test.describe('Admin products — edit & inventory link', () => {
  test.beforeEach(async ({ page }) => {
    await clearProductStorage(page);
  });

  test('TC-PR09 positive: edit updates name and discount', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-edit-1',
        name: 'Old Name Blend',
        description: 'Old desc',
        benefit: 'Old desc',
        concern: 'Immunity',
        listPriceN: 500,
        discountPct: 0,
        priceN: 500,
        active: true,
        custom: true,
      }]));
      const stock = {
        sunni: 25, diabetic: 20, immunity: 30, kaphahara: 40, ashta: 35, navojas: 40,
        'kit-immunity': 15, 'kit-glow': 15, 'sample-trio': 50, 'custom-edit-1': 9,
      };
      localStorage.setItem('ak_stock', JSON.stringify(stock));
      localStorage.setItem('ak_admin_logged', '1');
    });
    await page.goto(ADMIN_URL);
    await openProducts(page);
    await page.locator('[data-product-row="custom-edit-1"]').getByRole('button', { name: 'Edit' }).click();
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
    await expect(page.getByRole('heading', { name: 'Inventory (mock)' })).toBeVisible();
    await expect(page.getByText('Inventory Linked Oil', { exact: true })).toBeVisible();
    await expect(page.getByText(/SKUs:\s*10/)).toBeVisible();
  });

  test('TC-PR11 complex: toggle draft hides from store then republish', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-tog-1',
        name: 'Toggle Ritual Tea',
        description: 'tea',
        benefit: 'tea',
        concern: 'Immunity',
        listPriceN: 220,
        discountPct: 0,
        priceN: 220,
        active: true,
        custom: true,
      }]));
      localStorage.setItem('ak_admin_logged', '1');
    });
    await page.goto(ADMIN_URL);
    await openProducts(page);
    await page.locator('[data-product-row="custom-tog-1"]').getByRole('button', { name: 'Hide (draft)' }).click();
    await expect(page.getByText(/set to draft/i)).toBeVisible();
    let active = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]')[0].active);
    expect(active).toBe(false);
    await page.locator('[data-product-row="custom-tog-1"]').getByRole('button', { name: 'Make active' }).click();
    await expect(page.getByText(/Toggle Ritual Tea published/i)).toBeVisible();
    active = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_custom_products') || '[]')[0].active);
    expect(active).toBe(true);
  });
});
