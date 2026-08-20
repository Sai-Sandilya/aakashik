// @ts-check
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  readStoredCode,
  STRONG_PASSWORD,
} = require('./helpers/storage');
const {
  gotoAuth,
  switchToSignup,
  switchToSignin,
  fillContact,
  fillPassword,
  fillConfirmPassword,
  submitButton,
  enterOtpAndVerify,
  waitForAuthSuccess,
  signupWithEmail,
  signInWithEmail,
  openForgotPassword,
  submitForgotForm,
} = require('./helpers/auth-ui');

test.describe('Auth page — validation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  // TC-A01
  test('shows email error for invalid email-like text (not phone error)', async ({ page }) => {
    await gotoAuth(page);
    await switchToSignup(page);
    await fillContact(page, 'saisdjhsd');
    await fillPassword(page, STRONG_PASSWORD);
    await fillConfirmPassword(page, STRONG_PASSWORD);
    await submitButton(page, 'Create Account').click();

    await expect(page.getByText(/valid email/i).first()).toBeVisible();
    await expect(page.getByText(/10-digit Indian mobile/i)).not.toBeVisible();
  });

  // TC-A02
  test('shows phone error for invalid phone number', async ({ page }) => {
    await gotoAuth(page);
    await fillContact(page, '12345');
    await fillPassword(page, STRONG_PASSWORD);
    await submitButton(page, 'Sign In').click();

    await expect(page.getByText(/10-digit Indian mobile/i).first()).toBeVisible();
  });

  // TC-A03
  test('blocks signup when password is too weak', async ({ page }) => {
    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill('Weak Pass User');
    await fillContact(page, `weak-${Date.now()}@test.com`);
    await fillPassword(page, 'short');
    await fillConfirmPassword(page, 'short');
    await submitButton(page, 'Create Account').click();

    await expect(page.getByText(/8\+ characters with upper, lower, number and symbol/i).first()).toBeVisible();
  });

  // TC-A04
  test('blocks signup when passwords do not match', async ({ page }) => {
    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill('Mismatch User');
    await fillContact(page, `mismatch-${Date.now()}@test.com`);
    await fillPassword(page, STRONG_PASSWORD);
    await fillConfirmPassword(page, 'Other@9999');
    await submitButton(page, 'Create Account').click();

    await expect(page.getByText(/Passwords do not match/i).first()).toBeVisible();
  });
});

test.describe('Auth page — create account', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  // TC-A05
  test('email signup sends OTP and completes account creation', async ({ page }) => {
    const email = `signup-${Date.now()}@test.com`;
    const name = 'Aakashik Tester';

    await signupWithEmail(page, { name, email, password: STRONG_PASSWORD });

    await expect(page.getByText(/Demo verification code/i).first()).toBeVisible();

    const otp = await readStoredCode(page, 'ak_pending_otp');
    expect(otp).toMatch(/^\d{4}$/);

    await enterOtpAndVerify(page, otp);
    await waitForAuthSuccess(page);

    await expect(page.getByRole('heading', { name: 'Account created!' })).toBeVisible();

    const logged = await page.evaluate(() => localStorage.getItem('ak_logged'));
    expect(logged).toBe('1');
  });

  // TC-A06
  test('phone signup sends OTP without password and completes account creation', async ({ page }) => {
    const phone = `9${String(Date.now()).slice(-9)}`;
    const name = 'Phone Tester';

    await gotoAuth(page);
    await switchToSignup(page);
    await page.getByPlaceholder('Enter full name').fill(name);
    await fillContact(page, phone);
    await submitButton(page, 'Create Account').click();

    await expect(page.getByText(/Demo verification code/i).first()).toBeVisible();

    const otp = await readStoredCode(page, 'ak_pending_otp');
    await enterOtpAndVerify(page, otp);
    await waitForAuthSuccess(page);

    await expect(page.getByRole('heading', { name: 'Account created!' })).toBeVisible();
  });
});

test.describe('Auth page — sign in', () => {
  const email = `login-${Date.now()}@test.com`;

  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Login Tester' });
  });

  // TC-A07
  test('email sign-in with correct password succeeds', async ({ page }) => {
    await signInWithEmail(page, { email, password: STRONG_PASSWORD });
    await waitForAuthSuccess(page);
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Enter the store' })).toBeVisible();
  });

  // TC-A08
  test('email sign-in with wrong password shows generic error', async ({ page }) => {
    await signInWithEmail(page, { email, password: 'Wrong@9999' });
    await expect(page.getByText('Incorrect email or password')).toBeVisible({ timeout: 10_000 });
  });

  // TC-A09
  test('can switch between sign in and create account tabs', async ({ page }) => {
    await gotoAuth(page);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await switchToSignup(page);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    await switchToSignin(page);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });
});

test.describe('Auth page — forgot password', () => {
  const email = `reset-${Date.now()}@test.com`;
  const oldPassword = STRONG_PASSWORD;
  const newPassword = 'NewPass@5678';

  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
    await seedEmailUser(page, { email, password: oldPassword, name: 'Reset Tester' });
  });

  // TC-A10
  test('forgot password flow sends reset code and updates password', async ({ page }) => {
    await gotoAuth(page);
    await openForgotPassword(page);

    await fillContact(page, email);
    await submitForgotForm(page);

    await expect(page.getByText(/Demo reset code:/i).first()).toBeVisible();

    const resetCode = await readStoredCode(page, 'ak_reset');
    expect(resetCode).toMatch(/^\d{4}$/);

    await page.getByPlaceholder('4-digit code').fill(resetCode);
    await fillPassword(page, newPassword);
    await fillConfirmPassword(page, newPassword);
    await submitForgotForm(page);

    await expect(page.getByText(/Password updated/i)).toBeVisible({ timeout: 10_000 });
  });

  // TC-A11
  test('can sign in with new password after reset', async ({ page }) => {
    await gotoAuth(page);
    await openForgotPassword(page);
    await fillContact(page, email);
    await submitForgotForm(page);

    const resetCode = await readStoredCode(page, 'ak_reset');
    await page.getByPlaceholder('4-digit code').fill(resetCode);
    await fillPassword(page, newPassword);
    await fillConfirmPassword(page, newPassword);
    await submitForgotForm(page);
    await expect(page.getByText(/Password updated/i)).toBeVisible({ timeout: 10_000 });

    await signInWithEmail(page, { email, password: newPassword });
    await waitForAuthSuccess(page);
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
  });
});
