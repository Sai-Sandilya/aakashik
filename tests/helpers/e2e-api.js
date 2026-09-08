/**
 * E2E helpers for the proxied Fastify API (requires scripts/start-e2e-api.sh).
 */
const ADMIN_EMAIL = 'owner@aakashik.local';
const ADMIN_PASSWORD = 'Admin@1234';

async function resetE2eApi(request) {
  const res = await request.post('/api/e2e/reset');
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`E2E API reset failed (${res.status()}): ${body}`);
  }
}

async function loginAdmin(request) {
  const res = await request.post('/api/admin/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`Admin login failed (${res.status()}): ${body}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error('Admin login missing token');
  return data.token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function setProductStock(request, productId, quantity, token) {
  const t = token || await loginAdmin(request);
  const res = await request.patch(`/api/admin/inventory/${encodeURIComponent(productId)}`, {
    headers: authHeaders(t),
    data: { quantity },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`Set stock failed for ${productId} (${res.status()}): ${body}`);
  }
  return t;
}

async function seedStockMap(request, overrides) {
  const token = await loginAdmin(request);
  for (const [id, qty] of Object.entries(overrides)) {
    await setProductStock(request, id, qty, token);
  }
  return token;
}

async function createCustomProduct(request, payload, token) {
  const t = token || await loginAdmin(request);
  const res = await request.post('/api/admin/products', {
    headers: authHeaders(t),
    data: payload,
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`Create product failed (${res.status()}): ${body}`);
  }
  const data = await res.json();
  return { token: t, product: data.product };
}

async function setProductHidden(request, productId, hidden, token) {
  const t = token || await loginAdmin(request);
  const res = await request.patch(`/api/admin/products/${encodeURIComponent(productId)}/visibility`, {
    headers: authHeaders(t),
    data: { hidden: !!hidden },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`Set visibility failed for ${productId} (${res.status()}): ${body}`);
  }
  return t;
}

async function waitForStoreCatalog(page) {
  await page.waitForFunction(() => {
    try {
      const stock = JSON.parse(localStorage.getItem('ak_stock') || '{}');
      return Number(stock.immunity) > 0 || Number(stock.sunni) > 0;
    } catch (e) {
      return false;
    }
  }, { timeout: 10000 }).catch(() => {});
}

/**
 * Create a real API customer + session cookie in the browser context.
 * Required for member pricing (10% off) after server-side session checks.
 */
async function seedApiEmailUser(page, {
  email = `member-${Date.now()}@test.com`,
  password = 'Test@1234',
  name = 'Member User',
} = {}) {
  const send = await page.request.post('/api/auth/send-otp', {
    data: { email, name, purpose: 'signup' },
  });
  if (!send.ok()) {
    const body = await send.text().catch(() => '');
    throw new Error(`send-otp failed (${send.status()}): ${body}`);
  }
  const { testCode } = await send.json();
  if (!testCode) throw new Error('send-otp missing testCode');

  const verify = await page.request.post('/api/auth/verify-signup', {
    data: { email, code: testCode, name, password, rememberMe: true },
  });
  if (!verify.ok()) {
    const body = await verify.text().catch(() => '');
    throw new Error(`verify-signup failed (${verify.status()}): ${body}`);
  }

  await page.goto('/');
  await page.evaluate(({ email, name }) => {
    localStorage.setItem('ak_profile', JSON.stringify({
      name, email, phone: '', verified: true,
    }));
    localStorage.setItem('ak_logged', '1');
    localStorage.setItem('ak_persist', '1');
    localStorage.setItem('ak_terms_accepted', '1');
  }, { email, name });
  await page.reload();
  // Wait until /api/auth/me has marked the shopper as member-eligible.
  await page.waitForFunction(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return false;
      const data = await res.json();
      return !!(data && data.loggedIn);
    } catch (e) {
      return false;
    }
  }, { timeout: 10000 });
  return { email, password, name };
}

module.exports = {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  resetE2eApi,
  loginAdmin,
  authHeaders,
  setProductStock,
  seedStockMap,
  createCustomProduct,
  setProductHidden,
  waitForStoreCatalog,
  seedApiEmailUser,
};
