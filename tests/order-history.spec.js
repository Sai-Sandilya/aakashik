// @ts-check
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  STRONG_PASSWORD,
} = require('./helpers/storage');

const LANDING_URL = '/';
const ORDERS_EMAIL = `orders-${Date.now()}@test.com`;

/** @param {import('@playwright/test').Page} page */
async function seedOrders(page, email = ORDERS_EMAIL) {
  await page.evaluate((userEmail) => {
    localStorage.setItem('ak_orders', JSON.stringify([
      {
        id: 'AAK-77777',
        placedAt: Date.now() - 3600000,
        total: 548,
        items: [
          { id: 'immunity', name: 'Daily Immunity', qty: 1 },
          { id: 'ashta', name: 'Ashtagandham', qty: 1 },
        ],
        delivery: { name: 'Test', email: userEmail, phone: '' },
      },
      {
        id: 'AAK-66666',
        placedAt: Date.now() - 80 * 3600000,
        total: 199,
        items: [{ id: 'kaphahara', name: 'Kaphahara', qty: 1, size: '100g' }],
        delivery: { name: 'Someone Else', email: 'other-user@test.com', phone: '' },
      },
    ]));
  }, email);
}

test.describe('Order History UX', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
    await seedEmailUser(page, {
      email: ORDERS_EMAIL,
      password: STRONG_PASSWORD,
      name: 'Order User',
    });
  });

  test('TC-OH01 positive: Order History opens from account menu', async ({ page }) => {
    await page.goto(LANDING_URL);
    await seedOrders(page);
    await page.reload();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Order History' }).click();
    await expect(page.getByRole('heading', { name: 'Order History' })).toBeVisible();
    await expect(page.getByText('AAK-77777')).toBeVisible();
    await expect(page.getByText('AAK-66666')).toHaveCount(0);
    await expect(page.getByText('Products: Daily Immunity, Ashtagandham')).toBeVisible();
  });

  test('TC-OH02 positive: order card shows status and Track Order', async ({ page }) => {
    await page.goto(LANDING_URL);
    await seedOrders(page);
    await page.reload();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Order History' }).click();
    await expect(page.getByText('AAK-77777')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Track Order' }).first()).toBeVisible();
    await expect(page.getByText('Order Confirmed').first()).toBeVisible();
  });

  test('TC-OH03 positive: Track from Order History opens tracking steps', async ({ page }) => {
    await page.goto(LANDING_URL);
    await seedOrders(page);
    await page.reload();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Order History' }).click();
    await page.getByRole('button', { name: 'Track Order' }).first().click();
    await expect(page.getByRole('heading', { name: 'Track Your Order' }).last()).toBeVisible();
    await expect(page.getByText('Order AAK-77777')).toBeVisible();
    await expect(page.getByText('Packed with care').last()).toBeVisible();
    await expect(page.getByText('Shipped').last()).toBeVisible();
    await expect(page.getByText('Delivered', { exact: true }).last()).toBeVisible();
  });

  test('TC-OH04 negative: empty Order History shows empty state', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Order History' }).click();
    await expect(page.getByText(/No orders yet/i)).toBeVisible();
  });

  test('TC-OH05 negative: Profile no longer shows Recent orders section', async ({ page }) => {
    await page.goto(LANDING_URL);
    await seedOrders(page);
    await page.reload();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
    await expect(page.getByText('Recent orders')).toHaveCount(0);
  });

  test('TC-OH06 positive: Order Placed screen offers Track Order', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible({ timeout: 8000 });
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Place Order' }) });
    await form.getByPlaceholder('Full name').fill('Buyer');
    await form.getByPlaceholder('10-digit mobile').fill('9876543210');
    await form.getByPlaceholder('you@example.com').fill(`buyer-${Date.now()}@test.com`);
    await form.getByPlaceholder('House, street, area').fill('12 Lane');
    await form.getByPlaceholder('City').fill('Hyderabad');
    await form.getByPlaceholder('6-digit pin').fill('500001');
    await form.locator('select').selectOption({ label: 'Telangana' });
    await page.getByRole('button', { name: 'Place Order' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Track Order' }).click();
    await expect(page.getByRole('heading', { name: 'Track Your Order' }).last()).toBeVisible();
    await expect(page.getByText('Order Confirmed').last()).toBeVisible();
  });
});
