/**
 * Remaining UX audit issues (1-23) — positive and negative E2E coverage.
 */
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  hashPassword,
  readStoredCode,
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
  signInWithEmail,
} = require('./helpers/auth-ui');

const LANDING_URL = '/Aakashik%20Landing.dc.html';

test.describe('UX remaining — password hashing & demo OTP (1-2, 11-12)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-R01 positive: email signup stores pwHash, not plaintext password', async ({ page }) => {
    const email = `hash-${Date.now()}@test.com`;
    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill('Hash User');
    await fillContact(page, email);
    await fillPassword(page, STRONG_PASSWORD);
    await fillConfirmPassword(page, STRONG_PASSWORD);
    await submitButton(page, 'Create Account').click();
    await expect(page.getByText(/Demo verification code/i)).toBeVisible({ timeout: 8000 });

    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_pending_otp') || 'null'));
    expect(pending.pwHash).toBeTruthy();
    expect(pending.password).toBeFalsy();
    const usersBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(usersBefore[email]).toBeFalsy();

    const code = await readStoredCode(page, 'ak_pending_otp');
    await enterOtpAndVerify(page, code);
    await waitForAuthSuccess(page);

    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[email].pwHash).toBeTruthy();
    expect(users[email].password).toBeFalsy();
    const expected = await hashPassword(page, STRONG_PASSWORD);
    expect(users[email].pwHash).toBe(expected);
  });

  test('TC-R02 negative: wrong password fails against hashed user', async ({ page }) => {
    const email = `wrong-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD });
    await page.evaluate(() => {
      localStorage.removeItem('ak_logged');
      localStorage.removeItem('ak_persist');
      sessionStorage.removeItem('ak_logged');
    });
    await signInWithEmail(page, { email, password: 'Wrong@9999' });
    await expect(page.getByText('Incorrect email or password')).toBeVisible({ timeout: 8000 });
  });

  test('TC-R03 positive: legacy plaintext password migrates to pwHash on sign-in', async ({ page }) => {
    const email = `legacy-${Date.now()}@test.com`;
    await page.goto(LANDING_URL);
    await page.evaluate(({ email, password }) => {
      const users = {};
      users[email] = { name: 'Legacy', email, phone: '', password, verified: true };
      localStorage.setItem('ak_users', JSON.stringify(users));
    }, { email, password: STRONG_PASSWORD });
    await signInWithEmail(page, { email, password: STRONG_PASSWORD });
    await waitForAuthSuccess(page);
    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_users') || '{}'));
    expect(users[email].pwHash).toBeTruthy();
    expect(users[email].password).toBeFalsy();
  });

  test('TC-R04 positive: auth page shows demo banner', async ({ page }) => {
    await gotoAuth(page);
    await expect(page.getByText(/Demo auth — accounts stay in this browser only/i)).toBeVisible();
  });

  test('TC-R05 negative: phone sign-in without existing account is blocked', async ({ page }) => {
    await gotoAuth(page);
    await fillContact(page, '9876500123');
    await submitButton(page, 'Sign In').click();
    await expect(page.getByText(/No account for this phone/i)).toBeVisible({ timeout: 5000 });
  });

  test('TC-R06 positive: phone signup still creates account via OTP', async ({ page }) => {
    const phone = '9876500' + String(Math.floor(Math.random() * 900) + 100);
    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill('Phone User');
    await fillContact(page, phone);
    await submitButton(page, 'Create Account').click();
    const code = await readStoredCode(page, 'ak_pending_otp');
    expect(code).toMatch(/^\d{4}$/);
    await enterOtpAndVerify(page, code);
    await waitForAuthSuccess(page);
  });
});

test.describe('UX remaining — shopper honesty (3–7, 10)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-R07 positive: reviews show sample-story copy, not fake volume', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.locator('#reviews').scrollIntoViewIfNeeded();
    await expect(page.getByText(/4 sample stories \(demo\)/i)).toBeVisible();
    await expect(page.getByText(/Sample story/i).first()).toBeVisible();
    await expect(page.getByText(/1,240\+/)).toHaveCount(0);
    await expect(page.getByText(/Verified buyer/i)).toHaveCount(0);
  });

  test('TC-R08 negative: medical overclaims removed from sample reviews', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/antibiotics/i)).toHaveCount(0);
    await expect(page.getByText(/sugar readings/i)).toHaveCount(0);
  });

  test('TC-R09 positive: kit prices match Save ₹ math vs singles', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.locator('#kits').scrollIntoViewIfNeeded();
    await expect(page.getByText('Immunity Ritual Kit').first()).toBeVisible();
    await expect(page.getByText(/₹599/).first()).toBeVisible();
    await expect(page.getByText(/Save ₹148 vs singles/i)).toBeVisible();
    await expect(page.getByText(/₹349/).first()).toBeVisible();
    await expect(page.getByText(/Save ₹99 vs singles/i)).toBeVisible();
  });

  test('TC-R10 positive: diabetic product renamed Softly', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText('Sugar Balance Support').first()).toBeVisible();
    await expect(page.getByText('Diabetic Care')).toHaveCount(0);
  });

  test('TC-R11 positive: order confirm is local/demo only', async ({ page }) => {
    const email = `ord-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD });
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Place Order' }) });
    await form.getByPlaceholder('Full name').fill('Buyer');
    await form.getByPlaceholder('10-digit mobile').fill('9876543210');
    await form.getByPlaceholder('House, street, area').fill('12 Lane');
    await form.getByPlaceholder('City').fill('Hyderabad');
    await form.getByPlaceholder('6-digit pin').fill('500001');
    await form.locator('select').selectOption({ label: 'Telangana' });
    await page.getByRole('button', { name: 'Place Order' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByText(/order saved on this device \(demo\)/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/confirmation is on its way/i)).toHaveCount(0);
  });

  test('TC-R12 positive: track modal discloses simulated timeline', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await expect(page.getByText(/simulated demo timeline/i)).toBeVisible();
  });

  test('TC-R13 positive: reminder + newsletter are device-only demo', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/Demo only — preference is saved on this device/i)).toBeVisible();
    await expect(page.getByText(/Join our newsletter \(demo — this device\)/i)).toBeVisible();
  });
});

test.describe('UX remaining — checkout remember, validation, discounts (8–9, 14–15)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-R14 positive: checkout Keep me signed in persists session', async ({ page }) => {
    const email = `rem-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD });
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
    await page.getByPlaceholder('10-digit phone or you@example.com').fill(email);
    await page.locator('input[type="password"]').fill(STRONG_PASSWORD);
    const remember = page.locator('label').filter({ hasText: 'Keep me signed in' }).locator('input');
    await expect(remember).toBeChecked();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible({ timeout: 10000 });
    const flags = await page.evaluate(() => ({
      persist: localStorage.getItem('ak_persist'),
      logged: localStorage.getItem('ak_logged'),
    }));
    expect(flags.persist).toBe('1');
    expect(flags.logged).toBe('1');
  });

  test('TC-R15 negative: checkout invalid phone is rejected', async ({ page }) => {
    const email = `badph-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD });
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Place Order' }) });
    await form.getByPlaceholder('Full name').fill('Buyer');
    await form.getByPlaceholder('10-digit mobile').fill('12345');
    await form.getByPlaceholder('House, street, area').fill('12 Lane');
    await form.getByPlaceholder('City').fill('Hyderabad');
    await form.getByPlaceholder('6-digit pin').fill('500001');
    await form.locator('select').selectOption({ label: 'Telangana' });
    await page.getByRole('button', { name: 'Place Order' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByText(/valid 10-digit phone/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toHaveCount(0);
  });

  test('TC-R16 positive: delivery fields have visible labels', async ({ page }) => {
    const email = `lab-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD });
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Place Order' }) });
    await expect(form.getByText('Full name', { exact: true })).toBeVisible();
    await expect(form.getByText('Phone', { exact: true })).toBeVisible();
    await expect(form.getByText('Email', { exact: true })).toBeVisible();
    await expect(form.getByText('Address', { exact: true })).toBeVisible();
    await expect(form.getByText('State / UT', { exact: true })).toBeVisible();
  });

  test('TC-R17 positive: member + subscribe do not stack beyond 10%', async ({ page }) => {
    const email = `stack-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD });
    // immunity 349; with 10% once → 314.1
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: true, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await expect(page.getByText(/Subscribe 10% off|10% off applies once/i).first()).toBeVisible({ timeout: 8000 });
    // List ₹349, one 10% discount → rounded ₹314
    await expect(page.getByText('₹314').first()).toBeVisible();
  });

  test('TC-R18 negative: guest without subscribe pays full list (no member discount)', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await expect(page.getByText('₹349').first()).toBeVisible();
    await expect(page.getByText(/Member 10% off/i)).toHaveCount(0);
  });
});

test.describe('UX remaining — a11y, i18n, geo, polish (13, 16–22)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-R19 positive: cart/search/wishlist expose dialog roles', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await expect(page.getByRole('dialog', { name: 'Your Cart' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  });

  test('TC-R20 positive: i18n disclosure mentions cart/checkout stay English', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Language' }).click();
    await expect(page.getByText(/Partial — cart & checkout stay English/i)).toBeVisible();
  });

  test('TC-R21 positive: weather is opt-in, not auto-requested', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByRole('button', { name: /Use my location for a seasonal tip/i })).toBeVisible();
  });

  test('TC-R22 positive: placeholders use example.com', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByPlaceholder(/you@example\.com/)).toBeVisible();
    await expect(page.getByPlaceholder(/you@gmail\.com/)).toHaveCount(0);
  });

  test('TC-R23 positive: dead image-slot import removed', async ({ page }) => {
    const res = await page.goto(LANDING_URL);
    expect(res && res.ok()).toBeTruthy();
    const html = await page.content();
    expect(html).not.toMatch(/image-slot\.js/);
  });

  test('TC-R24 positive: track found shows simulated badge', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([
        { id: 'AAK-42424', placedAt: Date.now(), total: 199, items: [], delivery: {} },
      ]));
    });
    await page.getByRole('button', { name: 'Track now' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await page.getByPlaceholder('e.g. AAK-10482').fill('AAK-42424');
    await page.getByRole('button', { name: 'Track Order' }).click();
    await expect(page.getByText(/Simulated timeline \(demo\)/i)).toBeVisible();
  });
});
