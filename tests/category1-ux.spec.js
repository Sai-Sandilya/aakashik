// @ts-check
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  STRONG_PASSWORD,
} = require('./helpers/storage');

const LANDING_URL = '/';

/** @param {import('@playwright/test').Page} page */
function cartButton(page) {
  return page.locator('[data-cart-icon="true"]');
}

test.describe('Category 1 UX fixes', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.removeItem('ak_cart');
      localStorage.removeItem('ak_wishlist');
      localStorage.removeItem('ak_orders');
      localStorage.removeItem('ak_newsletter');
      localStorage.removeItem('ak_reminder');
      localStorage.removeItem('ak_dosha');
      localStorage.removeItem('ak_lang');
    });
  });

  // TC-C01
  test('guest can add to cart without signing in', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Add to Cart' }).first().click();
    await expect(page.getByText('Added to cart')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  // TC-C02
  test('cart persists after page reload', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Add to Cart' }).first().click();
    await expect(page.getByText('Added to cart')).toBeVisible({ timeout: 8000 });
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('ak_cart') || '{}')).length > 0);
    await page.reload();
    await cartButton(page).click();
    await expect(page.getByText(/Subtotal/i)).toBeVisible();
    await expect(page.locator('text=Your cart is empty')).not.toBeVisible();
  });

  // TC-C03
  test('wishlist persists after reload', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.locator('[aria-label="Wishlist"]').first().click();
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('ak_wishlist') || '{}')).length > 0);
    await page.reload();
    const wished = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ak_wishlist') || '{}')).length);
    expect(wished).toBeGreaterThan(0);
  });

  // TC-C04
  test('newsletter email is saved to localStorage', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const email = `news-${Date.now()}@test.com`;
    await page.locator('footer input[type="email"]').fill(email);
    await page.locator('footer button[type="submit"]').click();
    await expect(page.getByText(/Saved on this device \(demo\)/i)).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_newsletter') || '{}'));
    expect(stored.email).toBe(email);
  });

  // TC-C05
  test('reminder form saves contact and time', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Set My Reminder' }).scrollIntoViewIfNeeded();
    await page.getByPlaceholder('Phone or email').fill('9876543210');
    await page.getByRole('button', { name: 'Set My Reminder' }).click();
    await expect(page.getByText("You're all set")).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_reminder') || '{}'));
    expect(stored.contact).toBe('9876543210');
    expect(stored.time).toBeTruthy();
  });

  // TC-C06
  test('profile requires phone or email before save', async ({ page }) => {
    const email = `prof-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Profile User' });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Profile' }).click();
    await page.getByPlaceholder('Full name').fill('No Contact User');
    await page.getByPlaceholder('Phone number').fill('');
    await page.getByPlaceholder('Email address').fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Enter at least a phone number or email')).toBeVisible({ timeout: 8000 });
  });

  // TC-C07
  test('order tracking finds placed order by ID', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-99999',
        placedAt: Date.now() - 3600000,
        total: 349,
        items: [{ name: 'Daily Immunity', qty: 1 }],
        delivery: { name: 'Test' },
      }]));
    });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await page.getByPlaceholder('e.g. AAK-10482').fill('AAK-99999');
    await page.getByRole('button', { name: 'Track Order' }).click();
    await expect(page.getByText('AAK-99999')).toBeVisible();
    await expect(page.getByText('Order Confirmed')).toBeVisible();
  });

  // TC-C08
  test('order tracking shows not found for unknown ID', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await page.getByPlaceholder('e.g. AAK-10482').fill('AAK-00000');
    await page.getByRole('button', { name: 'Track Order' }).click();
    await expect(page.getByText(/No order found/i)).toBeVisible();
  });

  // TC-C09
  test('checkout auth locks after repeated failed logins', async ({ page }) => {
    const email = `lock-${Date.now()}@test.com`;
    await page.goto(LANDING_URL);
    await page.evaluate(({ email, password, name }) => {
      /** @type {Record<string, { name: string, email: string, phone: string, password: string, verified: boolean }>} */
      const users = {};
      users[email] = { name, email, phone: '', password, verified: true };
      localStorage.setItem('ak_users', JSON.stringify(users));
      localStorage.setItem('ak_cart', JSON.stringify({ immunity: { qty: 1, subscribe: false, size: null, sizePrice: null } }));
    }, { email, password: STRONG_PASSWORD, name: 'Lock User' });
    await page.reload();
    await cartButton(page).click();
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();

    for (let i = 0; i < 4; i++) {
      await page.getByPlaceholder('10-digit phone or you@example.com').fill(email);
      await page.locator('input[type="password"]').fill('Wrong@9999');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('Incorrect email or password')).toBeVisible({ timeout: 8000 });
    }
    await page.getByPlaceholder('10-digit phone or you@example.com').fill(email);
    await page.locator('input[type="password"]').fill('Wrong@9999');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/temporarily locked|Try again in \d+ minute/i).first()).toBeVisible({ timeout: 8000 });
  });

  // TC-C10
  test('language choice persists after reload', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('button', { name: 'हिन्दी' }).click();
    await page.reload();
    const lang = await page.evaluate(() => localStorage.getItem('ak_lang'));
    expect(lang).toBe('hi');
  });
});
