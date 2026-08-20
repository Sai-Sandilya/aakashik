/** @typedef {import('@playwright/test').Page} Page */

const AUTH_URL = '/Aakashik%20Auth.dc.html';

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
  const main = page.getByPlaceholder('10-digit phone or you@gmail.com');
  if (await main.count()) {
    await main.fill(value);
    return;
  }
  await page.getByPlaceholder('you@gmail.com').fill(value);
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

async function waitForAuthSuccess(page) {
  await page.getByRole('heading', { name: /Welcome back!|Account created!/ }).waitFor({ timeout: 15_000 });
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
  waitForAuthSuccess,
  signupWithEmail,
  signInWithEmail,
  openForgotPassword,
  submitForgotForm,
};
