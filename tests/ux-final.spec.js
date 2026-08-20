// @ts-check
/**
 * Final polish UX fixes — max positive + negative coverage.
 */
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  readStoredCode,
  hashPassword,
  STRONG_PASSWORD,
} = require('./helpers/storage');
const {
  gotoAuth,
  switchToSignup,
  fillContact,
  fillPassword,
  fillConfirmPassword,
  submitButton,
  enterOtpAndVerify,
  waitForAuthSuccess,
  openForgotPassword,
  submitForgotForm,
  signInWithEmail,
} = require('./helpers/auth-ui');

const LANDING_URL = '/Aakashik%20Landing.dc.html';

test.describe('UX final — Auth honesty & account safety', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-F01 positive: Auth form uses demo OTP copy (not “sent by SMS/email”)', async ({ page }) => {
    await gotoAuth(page);
    await switchToSignup(page);
    await fillContact(page, '9876500111');
    await expect(page.getByText(/Demo OTP shown on screen — not sent by SMS/i)).toBeVisible();
    await fillContact(page, `demo-${Date.now()}@test.com`);
    await expect(page.getByText(/Demo verification code shown on screen — not emailed/i)).toBeVisible();
  });

  test('TC-F02 negative: Auth static copy no longer claims we will send OTP', async ({ page }) => {
    await gotoAuth(page);
    await switchToSignup(page);
    await fillContact(page, '9876500112');
    await expect(page.getByText(/We'll send a one-time verification code to your phone/i)).toHaveCount(0);
  });

  test('TC-F03 positive: OTP verify keeps pwHash even if pending storage is cleared mid-delay', async ({ page }) => {
    const email = `race-${Date.now()}@test.com`;
    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill('Race User');
    await fillContact(page, email);
    await fillPassword(page, STRONG_PASSWORD);
    await fillConfirmPassword(page, STRONG_PASSWORD);
    await submitButton(page, 'Create Account').click();
    const code = await readStoredCode(page, 'ak_pending_otp');
    expect(code).toMatch(/^\d{4}$/);
    await page.getByPlaceholder('4-digit code').fill(code);
    // Clear pending right after submit starts — snapshot in Auth must still apply pwHash
    await Promise.all([
      submitButton(page, 'Verify & Continue').click(),
      page.waitForTimeout(50).then(() => page.evaluate(() => localStorage.removeItem('ak_pending_otp'))),
    ]);
    await waitForAuthSuccess(page);
    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[email].pwHash).toBeTruthy();
    expect(users[email].password).toBeFalsy();
    const expected = await hashPassword(page, STRONG_PASSWORD);
    expect(users[email].pwHash).toBe(expected);
  });

  test('TC-F04 negative: forgot password rejects unknown email (no orphan account)', async ({ page }) => {
    await gotoAuth(page);
    await openForgotPassword(page);
    await fillContact(page, `missing-${Date.now()}@test.com`);
    await submitForgotForm(page);
    await expect(page.getByText(/No account found for this email/i)).toBeVisible({ timeout: 5000 });
    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(Object.keys(users).length).toBe(0);
    const reset = await page.evaluate(() => localStorage.getItem('ak_reset'));
    expect(reset).toBeNull();
  });

  test('TC-F05 positive: forgot password still works for existing email', async ({ page }) => {
    const email = `resetok-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Reset Ok' });
    await page.evaluate(() => {
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      sessionStorage.removeItem('ak_logged');
    });
    await gotoAuth(page);
    await openForgotPassword(page);
    await fillContact(page, email);
    await submitForgotForm(page);
    await expect(page.getByText(/Demo reset code:/i)).toBeVisible();
    const code = await readStoredCode(page, 'ak_reset');
    await page.getByPlaceholder('4-digit code').fill(code);
    await fillPassword(page, 'NewPass@5678');
    await fillConfirmPassword(page, 'NewPass@5678');
    await submitForgotForm(page);
    await expect(page.getByText(/Password updated/i)).toBeVisible({ timeout: 10000 });
    await signInWithEmail(page, { email, password: 'NewPass@5678' });
    await waitForAuthSuccess(page);
  });

  test('TC-F06 negative: email signup blocked when account already exists', async ({ page }) => {
    const email = `exists-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Exists' });
    await page.evaluate(() => {
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      sessionStorage.removeItem('ak_logged');
    });
    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill('Hacker');
    await fillContact(page, email);
    await fillPassword(page, 'Hacker@9999');
    await fillConfirmPassword(page, 'Hacker@9999');
    await submitButton(page, 'Create Account').click();
    await expect(page.getByText(/An account already exists for this email/i)).toBeVisible({ timeout: 5000 });
    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    const expected = await hashPassword(page, STRONG_PASSWORD);
    expect(users[email].pwHash).toBe(expected);
  });

  test('TC-F07 positive: demo Google social writes ak_users entry', async ({ page }) => {
    await gotoAuth(page);
    await page.getByRole('button', { name: /Google \(demo\)/i }).click();
    await waitForAuthSuccess(page);
    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users['demo.google@aakashik.local']).toBeTruthy();
  });
});

test.describe('UX final — Landing honesty, layout, a11y', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-F08 positive: Pan-India tile discloses demo / not live shipping', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/Pan-India Delivery \(planned\)/i)).toBeVisible();
    await expect(page.getByText(/shipping partners are not connected yet/i)).toBeVisible();
  });

  test('TC-F09 negative: live “Dispatched in 24–48 hours” claim removed', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/Dispatched in 24–48 hours/i)).toHaveCount(0);
  });

  test('TC-F10 positive: reviews subtitle matches sample/demo framing', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.locator('#reviews').scrollIntoViewIfNeeded();
    await expect(page.getByText(/Sample stories for this demo/i)).toBeVisible();
    await expect(page.getByText(/Real words from homes/i)).toHaveCount(0);
  });

  test('TC-F11 negative: story/herb overclaims softened', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/Healing Inspired by Purpose/i)).toHaveCount(0);
    await expect(page.getByText(/Wellness Inspired by Purpose/i)).toBeVisible();
    await expect(page.getByText(/cough, cold, sore throat, fever/i)).toHaveCount(0);
    await expect(page.getByText(/healthy blood sugar management/i)).toHaveCount(0);
  });

  test('TC-F12 positive: kit cards use fixed padding (not huge bottom clamp)', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.locator('#kits').scrollIntoViewIfNeeded();
    const pad = await page.locator('#kits').locator('div').filter({ hasText: 'Immunity Ritual Kit' }).first().evaluate((el) => {
      const card = el.closest('[style*="flex-direction: column"]') || el;
      // Find the content pad node inside kit cards
      const node = document.querySelector('#kits [style*="padding: 20px 22px"]');
      return node ? getComputedStyle(node).paddingBottom : '';
    });
    expect(pad).toMatch(/20px|22px/);
  });

  test('TC-F13 positive: checkout signup blocks existing email', async ({ page }) => {
    const email = `chkexist-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Exist' });
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
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.getByPlaceholder('Full name').fill('Takeover');
    await page.getByPlaceholder('10-digit phone or you@example.com').fill(email);
    await page.locator('input[type="password"]').first().fill('Takeover@9999');
    await page.locator('input[type="password"]').nth(1).fill('Takeover@9999');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/An account already exists for this email/i)).toBeVisible({ timeout: 5000 });
  });

  test('TC-F14 positive: cart dialog receives focus when opened', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    const dialog = page.getByRole('dialog', { name: 'Your Cart' });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => dialog.evaluate((el) => el.contains(document.activeElement)), { timeout: 5000 }).toBe(true);
  });

  test('TC-F15 positive: Tab cycles inside cart dialog (focus trap)', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    const dialog = page.getByRole('dialog', { name: 'Your Cart' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
    await expect.poll(async () => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  });

  test('TC-F16 positive: footer email/phone are clickable links', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.locator('footer a[href="mailto:care@aakashikwellness.in"]')).toBeVisible();
    await expect(page.locator('footer a[href="tel:+918766284078"]')).toBeVisible();
  });

  test('TC-F17 positive: reminder eyebrow no longer says “dose”', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/Gentle ritual reminders/i)).toBeVisible();
    await expect(page.getByText(/Never miss a dose/i)).toHaveCount(0);
  });

  test('TC-F18 positive: order history empty state mentions simulated tracking', async ({ page }) => {
    const email = `hist-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Order History' }).click();
    await expect(page.getByText(/simulated demo tracking/i)).toBeVisible();
  });

  test('TC-F19 positive: privacy policy describes demo orders / mock payments', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Privacy Policy' }).click();
    await expect(page.getByText(/Save demo orders on this device/i)).toBeVisible();
    await expect(page.getByText(/mock checkout only/i)).toBeVisible();
  });

  test('TC-F20 negative: privacy no longer claims live shipping partners as current', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Privacy Policy' }).click();
    await expect(page.getByText(/share necessary information with shipping partners and service providers to fulfil your orders/i)).toHaveCount(0);
  });
});
