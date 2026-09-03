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
  await page.waitForResponse(
    (r) => r.url().includes('/api/products') && r.status() === 200,
    { timeout: 15000 },
  ).catch(() => {});
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
};
