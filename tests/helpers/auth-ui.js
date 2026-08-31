/** @typedef {import('@playwright/test').Page} Page */

/**
 * @typedef {Object} MockEmailResetOptions
 * @property {string} email
 * @property {string} [otp]
 * @property {string} [password]
 */

const AUTH_URL = '/login';

async function gotoAuth(page) {
  await page.goto(AUTH_URL);
  await page.waitForSelector('#auth-form');
}

function tabButton(page, label) {
  return page.locator('#auth-form > div').first().getByRole('button', { name: label, exact: true });
}

function submitButton(page, label) {
  return page.locator('#auth-form form button[type="submit"]').filter({ hasText: label });
}

async function switchToSignup(page) {
  await tabButton(page, 'Create Account').click();
  await page.getByRole('heading', { name: 'Create Account' }).waitFor();
}

async function switchToSignin(page) {
  await tabButton(page, 'Sign In').click();
  await page.getByRole('heading', { name: 'Sign In' }).waitFor();
}

async function fillContact(page, value) {
  const main = page.getByPlaceholder('10-digit phone or you@example.com');
  if (await main.count()) {
    await main.fill(value);
    return;
  }
  await page.getByPlaceholder('you@example.com').fill(value);
}

async function fillPassword(page, value) {
  await page.locator('#auth-form input[type="password"]').first().fill(value);
}

async function fillConfirmPassword(page, value) {
  await page.locator('#auth-form input[type="password"]').nth(1).fill(value);
}

async function enterOtpAndVerify(page, code) {
  await page.getByPlaceholder('4-digit code').fill(code);
  await submitButton(page, 'Verify & Continue').click();
}

/**
 * @param {Page} page
 * @param {MockEmailResetOptions} options
 */
async function mockEmailResetApi(page, options) {
  const email = String((options && options.email) || '');
  const otp = (options && options.otp) || '5678';
  let currentPassword = (options && options.password) || 'Test@1234';
  await page.route('**/api/auth/send-otp', async (route) => {
    const body = route.request().postDataJSON();
    if (body.purpose === 'reset') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, expiresIn: 600 }),
      });
      return;
    }
    await route.continue();
  });
  await page.route('**/api/auth/reset-password', async (route) => {
    const body = route.request().postDataJSON();
    if (String(body.email).toLowerCase() !== email.toLowerCase() || String(body.code) !== otp) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Incorrect verification code.' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON();
    if (String(body.email).toLowerCase() === email.toLowerCase() && body.password === currentPassword) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          user: { name: 'Reset Tester', email, phone: '', provider: 'local' },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Incorrect email or password' }),
    });
  });
  return {
    /** @param {string} nextPassword */
    setPassword(nextPassword) {
      currentPassword = nextPassword;
    },
    otp,
  };
}

/**
 * @param {Page} page
 * @param {{ email: string, password: string, name?: string }} [options]
 */
async function mockEmailLoginApi(page, { email, password, name = 'Login Tester' } = {}) {
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON();
    if (String(body.email).toLowerCase() === String(email).toLowerCase() && body.password === password) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          user: { name, email, phone: '', provider: 'local' },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_credentials', message: 'Incorrect email or password' }),
    });
  });
}

/**
 * @param {Page} page
 * @param {{ otp?: string }} [options]
 */
async function mockEmailOtpApi(page, { otp = '1234' } = {}) {
  await page.route('**/api/auth/send-otp', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, expiresIn: 600 }),
    });
  });
  await page.route('**/api/auth/verify-signup', async (route) => {
    const body = route.request().postDataJSON();
    if (String(body.code) !== otp) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Incorrect verification code.' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        user: { name: body.name, email: body.email, phone: '', provider: 'local' },
      }),
    });
  });
}

async function acceptTermsIfShown(page) {
  const dialog = page.getByRole('dialog');
  if (!(await dialog.isVisible().catch(() => false))) return;
  await page.getByRole('checkbox', { name: /agree to the Terms/i }).check();
  await page.getByRole('button', { name: /Accept & Continue/i }).click();
}

async function waitForAuthSuccess(page) {
  await page.getByRole('dialog').waitFor({ timeout: 15_000 });
  await acceptTermsIfShown(page);
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 15_000 });
}

async function signupWithEmail(page, { name, email, password }) {
  await gotoAuth(page);
  await switchToSignup(page);
  await page.getByPlaceholder('Enter full name').fill(name);
  await fillContact(page, email);
  await fillPassword(page, password);
  await fillConfirmPassword(page, password);
  await submitButton(page, 'Create Account').click();
}

async function signInWithEmail(page, { email, password }) {
  await gotoAuth(page);
  await fillContact(page, email);
  await fillPassword(page, password);
  await submitButton(page, 'Sign In').click();
}

async function openForgotPassword(page) {
  await page.getByRole('button', { name: 'Forgot password?' }).click();
}

async function submitForgotForm(page) {
  await page.locator('#auth-form form button[type="submit"]').first().click();
}

module.exports = {
  AUTH_URL,
  gotoAuth,
  tabButton,
  submitButton,
  switchToSignup,
  switchToSignin,
  fillContact,
  fillPassword,
  fillConfirmPassword,
  enterOtpAndVerify,
  acceptTermsIfShown,
  mockEmailOtpApi,
  mockEmailLoginApi,
  mockEmailResetApi,
  waitForAuthSuccess,
  signupWithEmail,
  signInWithEmail,
  openForgotPassword,
  submitForgotForm,
};
