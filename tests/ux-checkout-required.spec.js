/**
 * Checkout delivery fields must all be filled before Place Order succeeds.
 */
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  STRONG_PASSWORD,
} = require('./helpers/storage');

async function openDeliveryCheckout(page) {
  const email = `chk-${Date.now()}@test.com`;
  await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Checkout User' });
  await page.evaluate(() => {
    localStorage.setItem('ak_cart', JSON.stringify({
      'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
    }));
  });
  await page.reload();
  await page.locator('[data-cart-icon="true"]').click({ force: true });
  await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
  await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible({ timeout: 8000 });
  return page.locator('form').filter({ has: page.getByRole('button', { name: 'Place Order' }) });
}

async function fillCompleteDelivery(form) {
  await form.getByPlaceholder('Full name').fill('Test Buyer');
  await form.getByPlaceholder('10-digit mobile').fill('9876543210');
  await form.getByPlaceholder('you@example.com').fill(`buyer-${Date.now()}@test.com`);
  await form.getByPlaceholder('House, street, area').fill('12 Ritual Lane');
  await form.getByPlaceholder('City').fill('Hyderabad');
  await form.getByPlaceholder('6-digit pin').fill('500001');
  await form.locator('select').selectOption({ label: 'Telangana' });
}

async function clickPlaceOrder(page) {
  await page.getByRole('button', { name: 'Place Order' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
}

test.describe('UX checkout — required delivery fields', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-D01 negative: empty address/city/pin/state does not place order', async ({ page }) => {
    const form = await openDeliveryCheckout(page);
    // Name + email prefilled from profile; leave address fields empty (bug repro)
    await form.getByPlaceholder('Full name').fill('Demo Google User');
    await form.getByPlaceholder('you@example.com').fill('demo.google@aakashik.local');
    await form.getByPlaceholder('House, street, area').fill('');
    await form.getByPlaceholder('City').fill('');
    await form.getByPlaceholder('6-digit pin').fill('');
    await form.locator('select').selectOption({ value: '' });

    await clickPlaceOrder(page);

    await expect(page.getByRole('status')).toContainText(/Enter your delivery address/i, { timeout: 3000 });
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toHaveCount(0);
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_orders') || '[]'));
    expect(orders.length).toBe(0);
  });

  test('TC-D02 negative: missing state blocks order even when address filled', async ({ page }) => {
    const form = await openDeliveryCheckout(page);
    await form.getByPlaceholder('Full name').fill('Test Buyer');
    await form.getByPlaceholder('10-digit mobile').fill('9876543210');
    await form.getByPlaceholder('House, street, area').fill('12 Ritual Lane');
    await form.getByPlaceholder('City').fill('Hyderabad');
    await form.getByPlaceholder('6-digit pin').fill('500001');
    await form.locator('select').selectOption({ value: '' });

    await clickPlaceOrder(page);

    await expect(page.getByRole('status')).toContainText(/Select your state/i, { timeout: 3000 });
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toHaveCount(0);
  });

  test('TC-D03 negative: missing pincode blocks order', async ({ page }) => {
    const form = await openDeliveryCheckout(page);
    await form.getByPlaceholder('Full name').fill('Test Buyer');
    await form.getByPlaceholder('10-digit mobile').fill('9876543210');
    await form.getByPlaceholder('House, street, area').fill('12 Ritual Lane');
    await form.getByPlaceholder('City').fill('Hyderabad');
    await form.getByPlaceholder('6-digit pin').fill('');
    await form.locator('select').selectOption({ label: 'Telangana' });

    await clickPlaceOrder(page);

    await expect(page.getByRole('status')).toContainText(/6-digit pin/i, { timeout: 3000 });
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toHaveCount(0);
  });

  test('TC-D04 negative: no phone and no email blocks order', async ({ page }) => {
    const form = await openDeliveryCheckout(page);
    await form.getByPlaceholder('Full name').fill('Test Buyer');
    await form.getByPlaceholder('10-digit mobile').fill('');
    await form.getByPlaceholder('you@example.com').fill('');
    await form.getByPlaceholder('House, street, area').fill('12 Ritual Lane');
    await form.getByPlaceholder('City').fill('Hyderabad');
    await form.getByPlaceholder('6-digit pin').fill('500001');
    await form.locator('select').selectOption({ label: 'Telangana' });

    await clickPlaceOrder(page);

    await expect(page.getByRole('status')).toContainText(/phone or email/i, { timeout: 3000 });
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toHaveCount(0);
  });

  test('TC-D05 positive: complete delivery details places order', async ({ page }) => {
    const form = await openDeliveryCheckout(page);
    await fillCompleteDelivery(form);
    await clickPlaceOrder(page);

    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 8000 });
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_orders') || '[]'));
    expect(orders.length).toBe(1);
    expect(orders[0].delivery.address).toBe('12 Ritual Lane');
    expect(orders[0].delivery.city).toBe('Hyderabad');
    expect(orders[0].delivery.pincode).toBe('500001');
    expect(orders[0].delivery.state).toBeTruthy();
  });

  test('TC-D06 positive: helper copy mentions address fields are required', async ({ page }) => {
    await openDeliveryCheckout(page);
    await expect(page.getByText(/Address, city, pin and state are required/i)).toBeVisible();
  });
});
