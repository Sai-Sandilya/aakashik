// @ts-check
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  readProfile,
  isLoggedIn,
  STRONG_PASSWORD,
} = require('./helpers/storage');
const {
  gotoAuth,
  fillContact,
  fillPassword,
  submitButton,
  openForgotPassword,
  submitForgotForm,
  waitForAuthSuccess,
} = require('./helpers/auth-ui');

const LANDING_URL = '/';
const AUTH_URL = '/login';

test.describe('UX medium — session & profile', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  // TC-M12
  test('keep me signed in off uses sessionStorage only', async ({ page }) => {
    const email = `session-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Session User' });
    await page.evaluate(() => {
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      localStorage.removeItem('ak_profile');
      sessionStorage.removeItem('ak_logged');
    });

    await gotoAuth(page);
    await page.locator('label').filter({ hasText: 'Keep me signed in' }).locator('input').uncheck();
    await fillContact(page, email);
    await fillPassword(page, STRONG_PASSWORD);
    await submitButton(page, 'Sign In').click();
    await waitForAuthSuccess(page);

    const flags = await page.evaluate(() => ({
      local: localStorage.getItem('ak_logged'),
      persist: localStorage.getItem('ak_persist'),
      session: sessionStorage.getItem('ak_logged'),
    }));
    expect(flags.local).toBeNull();
    expect(flags.persist).toBeNull();
    expect(flags.session).toBe('1');

    await page.goto(LANDING_URL);
    await expect(page.getByRole('button', { name: 'Account options' })).toBeVisible({ timeout: 8000 });
    expect(await isLoggedIn(page)).toBe(true);
  });

  // TC-M13
  test('new login replaces leftover profile (no merge)', async ({ page }) => {
    const email = `fresh-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Fresh User' });
    await page.evaluate(() => {
      localStorage.setItem('ak_profile', JSON.stringify({
        name: 'Leftover Name',
        email: 'leftover@old.test',
        phone: '9000000000',
        address: 'Old address should not survive',
        city: 'OldCity',
        state: 'OldState',
        pincode: '111111',
      }));
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      sessionStorage.removeItem('ak_logged');
    });

    await gotoAuth(page);
    await fillContact(page, email);
    await fillPassword(page, STRONG_PASSWORD);
    await submitButton(page, 'Sign In').click();
    await waitForAuthSuccess(page);

    const profile = await readProfile(page);
    expect(profile.name).toBe('Fresh User');
    expect(profile.email).toBe(email);
    expect(profile.address || '').toBe('');
    expect(profile.city || '').toBe('');
  });

  // TC-M14
  test('logout clears profile data', async ({ page }) => {
    const email = `clear-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Clear Me' });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    const profile = await page.evaluate(() => localStorage.getItem('ak_profile'));
    expect(profile).toBeNull();
  });
});

test.describe('UX medium — auth OTP / forgot / social', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  // TC-M15
  test('forgot password rejects phone (email-only)', async ({ page }) => {
    await gotoAuth(page);
    await openForgotPassword(page);
    await page.getByPlaceholder('you@example.com').fill('9876543210');
    await submitForgotForm(page);
    await expect(page.getByText(/email accounts only|Password reset is for email/i).first()).toBeVisible();
  });

  // TC-M16
  test('social buttons are labeled as demo', async ({ page }) => {
    await gotoAuth(page);
    await expect(page.getByRole('button', { name: /Google \(demo\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /GitHub \(demo\)/i })).toBeVisible();
    await expect(page.getByText(/Demo-only/i).first()).toBeVisible();
  });

  // TC-M17
  test('OTP without pending code is rejected', async ({ page }) => {
    await gotoAuth(page);
    await page.evaluate(() => {
      const users = JSON.parse(localStorage.getItem('ak_users') || '{}');
      users['9876543210'] = { name: 'Phone User', phone: '9876543210', email: '', verified: true };
      localStorage.setItem('ak_users', JSON.stringify(users));
    });
    await fillContact(page, '9876543210');
    await submitButton(page, 'Sign In').click();
    await expect(page.getByPlaceholder('4-digit code')).toBeVisible({ timeout: 5000 });

    await page.evaluate(() => localStorage.removeItem('ak_pending_otp'));
    await page.getByPlaceholder('4-digit code').fill('1234');
    await submitButton(page, 'Verify & Continue').click();
    await expect(page.getByText(/No active verification code/i).first()).toBeVisible();
  });

  // TC-M25
  test('lockout is shared via ak_lock_until', async ({ page }) => {
    const email = `lock-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Lock User' });
    await page.evaluate(() => {
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      sessionStorage.removeItem('ak_logged');
    });

    await gotoAuth(page);
    for (let i = 0; i < 5; i++) {
      await fillContact(page, email);
      await fillPassword(page, 'Wrong@9999');
      await submitButton(page, 'Sign In').click();
      await expect(page.getByText(/Incorrect email or password|temporarily locked/i).first()).toBeVisible({ timeout: 5000 });
    }
    await expect(page.getByText(/temporarily locked/i).first()).toBeVisible({ timeout: 5000 });
    const until = await page.evaluate(() => localStorage.getItem('ak_lock_until'));
    expect(Number(until)).toBeGreaterThan(Date.now());
  });
});

test.describe('UX medium — landing UX', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  // TC-M11
  test('delivery accepts phone OR email (not both required)', async ({ page }) => {
    const email = `deliv-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Buyer' });
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByText(/Provide phone or email/i)).toBeVisible();
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Place Order' }) });
    await form.getByPlaceholder('Full name').fill('Buyer');
    await form.getByPlaceholder(/Phone|10-digit mobile/).fill('9876543210');
    await form.getByPlaceholder('House, street, area').fill('12 Lane');
    await form.getByPlaceholder('City').fill('Hyderabad');
    await form.getByPlaceholder(/Pincode|6-digit pin/).fill('500001');
    await form.locator('select').selectOption({ label: 'Telangana' });
    await page.getByRole('button', { name: 'Place Order' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 8000 });
  });

  // TC-M18
  test('track modal allows retry without reopen', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([
        { id: 'AAK-99999', placedAt: Date.now(), total: 100, items: [], delivery: {} },
      ]));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Track now' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Track now' }).click();

    const input = page.getByPlaceholder('e.g. AAK-10482');
    await expect(input).toBeVisible();
    await input.fill('AAK-00000');
    await page.getByRole('button', { name: 'Track Order', exact: true }).click();
    await expect(page.getByText(/No order found for/i)).toBeVisible();
    await page.getByRole('button', { name: 'Track another order' }).click();
    await expect(page.getByPlaceholder('e.g. AAK-10482')).toBeVisible();
    await page.getByPlaceholder('e.g. AAK-10482').fill('AAK-99999');
    await page.getByRole('button', { name: 'Track Order', exact: true }).click();
    await expect(page.getByText(/Order AAK-99999/i)).toBeVisible();
  });

  // TC-M19
  test('order history is filtered per user', async ({ page }) => {
    const email = `mine-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Mine' });
    await page.goto(LANDING_URL);
    await page.evaluate((userEmail) => {
      localStorage.setItem('ak_orders', JSON.stringify([
        { id: 'AAK-11111', placedAt: Date.now(), total: 10, items: [{ name: 'Mine' }], delivery: { email: userEmail } },
        { id: 'AAK-22222', placedAt: Date.now(), total: 10, items: [{ name: 'Theirs' }], delivery: { email: 'theirs@test.com' } },
      ]));
    }, email);
    await page.reload();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Order History' }).click();
    await expect(page.getByText('AAK-11111')).toBeVisible();
    await expect(page.getByText('AAK-22222')).toHaveCount(0);
  });

  // TC-M20
  test('language switcher discloses partial translation', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Language' }).click();
    await expect(page.getByText(/Partial — cart & checkout stay English/i)).toBeVisible();
  });

  // TC-M21
  test('category card opens search filtered by concern', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('heading', { name: 'Spiritual Wellness' }).click();
    await expect(page.getByPlaceholder('Search blends, herbs, concerns…')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Ashtagandham').first()).toBeVisible();
  });

  // TC-M22
  test('search includes kits/bundles', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByPlaceholder('Search blends, herbs, concerns…').fill('Ritual Kit');
    await expect(page.getByText(/Immunity Ritual Kit/i).first()).toBeVisible({ timeout: 5000 });
  });

  // TC-M23
  test('price filter includes size price ranges', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('button', { name: 'Under ₹300' }).click();
    await expect(page.getByText('Kaphahara').first()).toBeVisible();
  });

  // TC-M24
  test('subscribe toggle is labeled as demo 10% save', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Quick View' }).first().click({ force: true });
    await expect(page.getByRole('button', { name: 'Save 10% (demo)' })).toBeVisible({ timeout: 8000 });
  });

  // TC-M26
  test('reminder validates phone for WhatsApp channel', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByPlaceholder('Phone or email').scrollIntoViewIfNeeded();
    await page.getByPlaceholder('Phone or email').fill('not-a-contact');
    await page.getByRole('button', { name: 'Set My Reminder' }).click();
    await expect(page.getByText(/valid 10-digit phone/i).first()).toBeVisible({ timeout: 5000 });
  });

  // TC-M27
  test('profile email change updates ak_users login key', async ({ page }) => {
    const oldEmail = `oldkey-${Date.now()}@test.com`;
    const newEmail = `newkey-${Date.now()}@test.com`;
    await seedEmailUser(page, { email: oldEmail, password: STRONG_PASSWORD, name: 'Key User' });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Profile' }).click();
    await page.getByPlaceholder('Email address').fill(newEmail);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(/Profile updated/i).first()).toBeVisible({ timeout: 5000 });

    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[newEmail]).toBeTruthy();
    expect(users[oldEmail]).toBeFalsy();
    expect(users[newEmail].pwHash || users[newEmail].password).toBeTruthy();
    expect(users[newEmail].password).toBeFalsy();
  });

  // TC-M28
  test('auth and landing links use clean URLs', async ({ page }) => {
    await page.goto(LANDING_URL);
    const href = await page.getByRole('link', { name: 'Sign in' }).getAttribute('href');
    expect(href).toMatch(/\/login\/?$/);
    await page.goto(AUTH_URL);
    const back = await page.getByRole('link', { name: 'Back to store' }).getAttribute('href');
    expect(back).toBe('/');
  });
});
