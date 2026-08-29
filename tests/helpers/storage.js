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
  'ak_admin_logged',
  'ak_admin_orders',
  'ak_stock',
  'ak_custom_products',
  'ak_hidden_ids',
  'ak_dosha',
  'ak_lang',
  'ak_recent',
  'ak_lock_until',
  'ak_fail_count',
  'ak_terms_accepted',
];

/** Clear all Aakashik auth-related localStorage keys. */
async function clearAuthStorage(page) {
  await page.goto('/');
  await page.evaluate((keys) => {
    keys.forEach((k) => localStorage.removeItem(k));
    try { sessionStorage.removeItem('ak_logged'); } catch (e) {}
  }, AUTH_KEYS);
}

/** SHA-256 hex of `aakashik-demo|` + password (same as Auth/Landing). */
async function hashPassword(page, password) {
  return page.evaluate(async (pw) => {
    const data = new TextEncoder().encode('aakashik-demo|' + String(pw || ''));
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }, password);
}

/** Seed a verified email user directly in localStorage (skips OTP). Stores pwHash only. */
async function seedEmailUser(page, { email, password, name = 'Test User' }) {
  const pwHash = await hashPassword(page, password);
  await page.evaluate(({ email, pwHash, name }) => {
    const users = {};
    users[email] = {
      name,
      email,
      phone: '',
      pwHash,
      verified: true,
    };
    localStorage.setItem('ak_users', JSON.stringify(users));
    localStorage.setItem('ak_profile', JSON.stringify({ name, email, phone: '', verified: true }));
    localStorage.setItem('ak_logged', '1');
    localStorage.setItem('ak_persist', '1');
  }, { email, pwHash, name });
}

/** Seed a verified phone-only user (OTP login; no password). */
async function seedPhoneUser(page, { phone, name = 'Phone User' }) {
  await page.evaluate(({ phone, name }) => {
    const users = JSON.parse(localStorage.getItem('ak_users') || '{}');
    users[phone] = {
      name,
      email: '',
      phone,
      verified: true,
    };
    localStorage.setItem('ak_users', JSON.stringify(users));
    localStorage.setItem('ak_profile', JSON.stringify({ name, email: '', phone, verified: true }));
    localStorage.setItem('ak_logged', '1');
    localStorage.setItem('ak_persist', '1');
  }, { phone, name });
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
  hashPassword,
  seedEmailUser,
  seedPhoneUser,
  readStoredCode,
  isLoggedIn,
  readProfile,
};
