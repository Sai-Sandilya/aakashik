/**
 * Phone signup must not overwrite an existing verified phone account.
 */
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedPhoneUser,
  readStoredCode,
} = require('./helpers/storage');
const {
  gotoAuth,
  switchToSignup,
  fillContact,
  submitButton,
  enterOtpAndVerify,
  waitForAuthSuccess,
} = require('./helpers/auth-ui');

const LANDING_URL = '/';

test.describe('UX phone signup — no overwrite', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-P01 negative: Auth phone signup blocked when phone already exists', async ({ page }) => {
    const phone = '9876500' + String(Math.floor(Math.random() * 900) + 100);
    await seedPhoneUser(page, { phone, name: 'Original Owner' });
    await page.evaluate(() => {
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      sessionStorage.removeItem('ak_logged');
    });

    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill('Attacker Name');
    await fillContact(page, phone);
    await submitButton(page, 'Create Account').click();

    await expect(page.getByText(/An account already exists for this phone/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Demo verification code/i)).toHaveCount(0);

    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[phone].name).toBe('Original Owner');
  });

  test('TC-P02 positive: Auth phone signup still works for a new number', async ({ page }) => {
    const phone = '9876501' + String(Math.floor(Math.random() * 900) + 100);
    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill('New Phone User');
    await fillContact(page, phone);
    await submitButton(page, 'Create Account').click();

    const code = await readStoredCode(page, 'ak_pending_otp');
    expect(code).toMatch(/^\d{4}$/);
    await enterOtpAndVerify(page, code);
    await waitForAuthSuccess(page);

    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[phone].name).toBe('New Phone User');
    expect(users[phone].verified).toBe(true);
  });

  test('TC-P03 positive: existing phone can still sign in with OTP', async ({ page }) => {
    const phone = '9876502' + String(Math.floor(Math.random() * 900) + 100);
    await seedPhoneUser(page, { phone, name: 'Returning Shopper' });
    await page.evaluate(() => {
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      sessionStorage.removeItem('ak_logged');
    });

    await gotoAuth(page);
    await fillContact(page, phone);
    await submitButton(page, 'Sign In').click();
    const code = await readStoredCode(page, 'ak_pending_otp');
    expect(code).toMatch(/^\d{4}$/);
    await enterOtpAndVerify(page, code);
    await waitForAuthSuccess(page);

    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[phone].name).toBe('Returning Shopper');
  });

  test('TC-P04 negative: checkout phone signup blocked when phone already exists', async ({ page }) => {
    const phone = '9876503' + String(Math.floor(Math.random() * 900) + 100);
    await seedPhoneUser(page, { phone, name: 'Checkout Owner' });
    await page.evaluate(() => {
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      sessionStorage.removeItem('ak_logged');
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();

    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByRole('heading', { name: 'Sign in to check out' })).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.getByPlaceholder('Full name').fill('Checkout Attacker');
    await page.getByPlaceholder('10-digit phone or you@example.com').fill(phone);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText(/An account already exists for this phone/i)).toBeVisible({ timeout: 5000 });

    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[phone].name).toBe('Checkout Owner');
  });

  test('TC-P05 positive: checkout phone signup works for a new number', async ({ page }) => {
    const phone = '9876504' + String(Math.floor(Math.random() * 900) + 100);
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();

    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByRole('heading', { name: 'Sign in to check out' })).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.getByPlaceholder('Full name').fill('Checkout New');
    await page.getByPlaceholder('10-digit phone or you@example.com').fill(phone);
    await page.getByRole('button', { name: 'Continue' }).click();

    const code = await readStoredCode(page, 'ak_pending_otp');
    expect(code).toMatch(/^\d{4}$/);
    await page.getByPlaceholder('4-digit code').fill(code);
    await page.getByRole('button', { name: 'Verify & Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible({ timeout: 10000 });

    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[phone].name).toBe('Checkout New');
  });
});
