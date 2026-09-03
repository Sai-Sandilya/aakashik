/**
 * Mock Admin Inventory — owner updates stock; store checkout respects it.
 */
const { test, expect } = require('@playwright/test');
const { clearAuthStorage, seedEmailUser } = require('./helpers/storage');
const { resetE2eApi, seedStockMap, waitForStoreCatalog } = require('./helpers/e2e-api');

const ADMIN_URL = '/Admin';
const LANDING_URL = '/';
const ADMIN_EMAIL = 'owner@aakashik.local';
const ADMIN_PASSWORD = 'Admin@1234';
const STRONG_PASSWORD = 'Test@1234';

async function clearInvStorage(page, request) {
  if (request) await resetE2eApi(request);
  await page.goto(LANDING_URL);
  await page.evaluate(() => {
    localStorage.removeItem('ak_admin_logged');
    localStorage.removeItem('ak_admin_orders');
    localStorage.removeItem('ak_orders');
    localStorage.removeItem('ak_stock');
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

async function openInventory(page) {
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
}

function stockRow(page, id) {
  return page.locator(`[data-stock-row="${id}"]`);
}

test.describe('Admin inventory — tab & seeding', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearInvStorage(page, request);
  });

  test('TC-IN01 positive: Inventory tab shows seeded SKUs', async ({ page }) => {
    await adminLogin(page);
    await openInventory(page);
    await expect(page.getByText(/SKUs:\s*9/)).toBeVisible();
    await expect(page.getByText('Daily Immunity', { exact: true })).toBeVisible();
    await expect(page.getByText('Immunity Ritual Kit', { exact: true })).toBeVisible();
    await expect(page.getByText(/Out of stock:\s*0/)).toBeVisible();
  });

  test('TC-IN02 positive: Orders tab still available after Inventory', async ({ page }) => {
    await adminLogin(page);
    await openInventory(page);
    await page.getByRole('button', { name: 'Orders', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.getByText(/Total:/i)).toBeVisible();
  });
});

test.describe('Admin inventory — update & filters', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearInvStorage(page, request);
    await adminLogin(page);
    await openInventory(page);
  });

  test('TC-IN03 positive: Save sets exact stock quantity', async ({ page }) => {
    const row = stockRow(page, 'immunity');
    await row.getByLabel('Stock for Daily Immunity').fill('7');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Daily Immunity stock set to 7/i)).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_stock') || '{}').immunity);
    expect(stored).toBe(7);
  });

  test('TC-IN04 positive: + / − adjust stock by one', async ({ page }) => {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_stock') || '{}').sunni);
    const row = stockRow(page, 'sunni');
    await row.getByRole('button', { name: 'Increase stock' }).click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('ak_stock') || '{}').sunni)).toBe(before + 1);
    await row.getByRole('button', { name: 'Decrease stock' }).click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('ak_stock') || '{}').sunni)).toBe(before);
  });

  test('TC-IN05 negative: Save rejects non-numeric stock', async ({ page }) => {
    const row = stockRow(page, 'ashta');
    await row.getByLabel('Stock for Ashtagandham').fill('abc');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Enter a whole number for stock/i)).toBeVisible();
  });

  test('TC-IN06 positive: Out of stock filter after zeroing a SKU', async ({ page }) => {
    const row = stockRow(page, 'sample-trio');
    await row.getByLabel('Stock for Sample Trio').fill('0');
    await row.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Out of stock', exact: true }).click();
    await expect(page.getByText('Sample Trio', { exact: true })).toBeVisible();
    await expect(page.getByText('Daily Immunity', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Out of stock:\s*1/)).toBeVisible();
  });

  test('TC-IN07 positive: Low stock filter for qty 1–5', async ({ page }) => {
    const row = stockRow(page, 'navojas');
    await row.getByLabel('Stock for Navojas').fill('3');
    await row.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Low stock', exact: true }).click();
    await expect(page.getByText('Navojas', { exact: true })).toBeVisible();
    await expect(page.getByText(/Low stock:\s*[1-9]/)).toBeVisible();
  });

  test('TC-IN08 positive: Reseed stock restores defaults', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_stock', JSON.stringify({
        sunni: 0, diabetic: 0, immunity: 0, kaphahara: 0, ashta: 0, navojas: 0,
        'kit-immunity': 0, 'kit-glow': 0, 'sample-trio': 0,
      }));
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: /Orders|Inventory/ })).toBeVisible({ timeout: 8000 });
    if (await page.getByRole('heading', { name: 'Orders' }).count()) {
      await openInventory(page);
    }
    await page.getByRole('button', { name: 'Reseed stock' }).click();
    await expect(page.getByText(/Stock levels reseeded/i)).toBeVisible();
    const immunity = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_stock') || '{}').immunity);
    expect(immunity).toBe(30);
  });
});

test.describe('Admin inventory — store sync complex flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearAuthStorage(page);
    await clearInvStorage(page, request);
  });

  test('TC-IN09 positive: zero stock blocks add-to-cart on store', async ({ page, request }) => {
    await seedStockMap(request, { sunni: 0 });
    await page.goto(LANDING_URL);
    await page.evaluate(() => localStorage.removeItem('ak_cart'));
    await page.reload();
    await waitForStoreCatalog(page);
    await page.getByRole('button', { name: 'Out of stock' }).first().click({ force: true });
    await expect(page.getByText(/Out of stock — ask the owner to restock/i)).toBeVisible({ timeout: 8000 });
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_cart') || '{}'));
    expect(Object.keys(cart).length).toBe(0);
  });

  test('TC-IN10 positive: checkout deducts stock in ak_stock', async ({ page, request }) => {
    const email = `inv-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Inv Buyer' });
    await seedStockMap(request, { immunity: 5 });
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 2, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await waitForStoreCatalog(page);
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible({ timeout: 8000 });
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Place Order' }) });
    await form.getByPlaceholder('Full name').fill('Inv Buyer');
    await form.getByPlaceholder('10-digit mobile').fill('9876501234');
    await form.getByPlaceholder('you@example.com').fill(email);
    await form.getByPlaceholder('House, street, area').fill('12 Stock Street');
    await form.getByPlaceholder('City').fill('Hyderabad');
    await form.getByPlaceholder('6-digit pin').fill('500001');
    await form.locator('select').selectOption({ label: 'Telangana' });
    await page.getByRole('button', { name: 'Place Order' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 10000 });
    const left = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_stock') || '{}').immunity);
    expect(left).toBe(3);
  });

  test('TC-IN11 complex: admin zeros stock then store cannot add; restock unlocks cart', async ({ page }) => {
    await adminLogin(page);
    await openInventory(page);
    const row = stockRow(page, 'immunity');
    await row.getByLabel('Stock for Daily Immunity').fill('0');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/stock set to 0/i)).toBeVisible();

    await page.goto(LANDING_URL);
    await page.evaluate(() => localStorage.removeItem('ak_cart'));
    await page.reload();
    await waitForStoreCatalog(page);
    const blocked = await page.evaluate(() => Number(JSON.parse(localStorage.getItem('ak_stock') || '{}').immunity || 0));
    expect(blocked).toBe(0);

    await page.goto(ADMIN_URL);
    await expect(page.getByRole('heading', { name: /Orders|Inventory/ })).toBeVisible({ timeout: 8000 });
    await openInventory(page);
    const row2 = stockRow(page, 'immunity');
    await row2.getByLabel('Stock for Daily Immunity').fill('4');
    await row2.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/stock set to 4/i)).toBeVisible();

    await page.goto(LANDING_URL);
    await page.reload();
    await waitForStoreCatalog(page);
    const restocked = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_stock') || '{}').immunity);
    expect(restocked).toBe(4);
  });

  test('TC-IN12 complex: cannot cart more than available stock', async ({ page, request }) => {
    await seedStockMap(request, { immunity: 1 });
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await waitForStoreCatalog(page);
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Increase' }).click();
    await expect(page.getByRole('status')).toContainText(/Only 1 left in stock/i, { timeout: 8000 });
    const qty = await page.evaluate(() => (JSON.parse(localStorage.getItem('ak_cart') || '{}')['immunity::std'] || {}).qty);
    expect(qty).toBe(1);
  });

  test('TC-IN13 complex: search inventory + set stock persists across reload', async ({ page }) => {
    await adminLogin(page);
    await openInventory(page);
    await page.getByLabel('Search inventory').fill('glow');
    await expect(page.getByText('Glow & Cleanse Kit', { exact: true })).toBeVisible();
    await expect(page.getByText('Daily Immunity', { exact: true })).toHaveCount(0);
    const row = stockRow(page, 'kit-glow');
    await row.getByLabel('Stock for Glow & Cleanse Kit').fill('11');
    await row.getByRole('button', { name: 'Save' }).click();
    await page.reload();
    await openInventory(page);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_stock') || '{}')['kit-glow']);
    expect(stored).toBe(11);
  });
});
