/** @typedef {import('@playwright/test').Page} Page */

const AUTH_KEYS = [
  'ak_logged',
  'ak_profile',
  'ak_users',
  'ak_pending_otp',
  'ak_reset',
  'ak_persist',
  'ak_cart',
  'ak_wishlist',
  'ak_orders',
  'ak_newsletter',
  'ak_reminder',
  'ak_dosha',
  'ak_lang',
  'ak_recent',
  'ak_lock_until',
  'ak_fail_count',
];

/** Clear all Aakashik auth-related localStorage keys. */
async function clearAuthStorage(page) {
  await page.goto('/Aakashik%20Landing.dc.html');
  await page.evaluate((keys) => {
    keys.forEach((k) => localStorage.removeItem(k));
    try { sessionStorage.removeItem('ak_logged'); } catch (e) {}
  }, AUTH_KEYS);
}

/** Seed a verified email user directly in localStorage (skips OTP). */
async function seedEmailUser(page, { email, password, name = 'Test User' }) {
  await page.evaluate(({ email, password, name }) => {
    const users = {};
    users[email] = {
      name,
      email,
      phone: '',
      password,
      verified: true,
    };
    localStorage.setItem('ak_users', JSON.stringify(users));
    localStorage.setItem('ak_profile', JSON.stringify({ name, email, phone: '', verified: true }));
    localStorage.setItem('ak_logged', '1');
    localStorage.setItem('ak_persist', '1');
  }, { email, password, name });
}

/** Read OTP or reset code from localStorage. */
async function readStoredCode(page, key) {
  return page.evaluate((storageKey) => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.code ? String(parsed.code) : null;
    } catch {
      return null;
    }
  }, key);
}

async function isLoggedIn(page) {
  return page.evaluate(() => {
    const persist = localStorage.getItem('ak_persist') === '1';
    const local = localStorage.getItem('ak_logged') === '1';
    let session = false;
    try { session = sessionStorage.getItem('ak_logged') === '1'; } catch (e) {}
    if (persist && local) return true;
    if (!persist && session) return true;
    return false;
  });
}

async function readProfile(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('ak_profile') || '{}');
    } catch {
      return {};
    }
  });
}

/** Strong password that passes all strength rules. */
const STRONG_PASSWORD = 'Test@1234';

module.exports = {
  AUTH_KEYS,
  STRONG_PASSWORD,
  clearAuthStorage,
  seedEmailUser,
  readStoredCode,
  isLoggedIn,
  readProfile,
};
