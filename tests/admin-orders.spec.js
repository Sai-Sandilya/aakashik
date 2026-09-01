/**
 * Admin Orders console — real API orders (no seeded mock AAK-1000x).
 */
const { test, expect } = require('@playwright/test');
const { clearAuthStorage } = require('./helpers/storage');
const { resetE2eApi } = require('./helpers/e2e-api');

const ADMIN_URL = '/Admin';
const LANDING_URL = '/';
const ADMIN_EMAIL = 'owner@aakashik.local';
const ADMIN_PASSWORD = 'Admin@1234';

async function clearAdminStorage(page, request) {
  if (request) await resetE2eApi(request);
  await page.goto(LANDING_URL);
  await page.evaluate(() => {
    localStorage.removeItem('ak_admin_logged');
    localStorage.removeItem('ak_admin_orders');
    localStorage.removeItem('ak_orders');
    localStorage.removeItem('ak_stock');
    try { sessionStorage.removeItem('ak_admin_token'); } catch (er) {}
  });
}

async function adminLogin(page) {
  await page.goto(ADMIN_URL);
  await page.getByLabel('Admin email').fill(ADMIN_EMAIL);
  await page.getByLabel('Admin password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Enter Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible({ timeout: 15000 });
}

async function createApiOrder(request, overrides = {}) {
  const delivery = {
    name: 'Test Buyer',
    phone: '9876543210',
    email: 'buyer@example.com',
    address: '12 Test Lane',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    ...(overrides.delivery || {}),
  };
  const payload = {
    items: overrides.items || [{ productId: 'immunity', qty: 1 }],
    delivery,
    payMethod: overrides.payMethod || 'cod',
    total: overrides.total != null ? overrides.total : 349,
    subtotal: overrides.subtotal != null ? overrides.subtotal : 349,
  };
  const res = await request.post('/api/orders', { data: payload });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.order;
}

async function adminToken(request) {
  const res = await request.post('/api/admin/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token;
}

async function setStatus(request, token, orderId, status) {
  const res = await request.patch(`/api/admin/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).order;
}

async function refreshOrders(page) {
  await page.getByRole('button', { name: 'Pull store orders now' }).click();
  await expect(page.getByText(/Pulled|up to date|No store orders/i)).toBeVisible({ timeout: 8000 });
}

test.describe('Admin orders — auth gate', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearAdminStorage(page, request);
  });

  test('TC-AD01 negative: wrong password is rejected', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByLabel('Admin email').fill(ADMIN_EMAIL);
    await page.getByLabel('Admin password').fill('Wrong@9999');
    await page.getByRole('button', { name: 'Enter Admin' }).click();
    await expect(page.getByText(/Incorrect admin email or password/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Orders' })).toHaveCount(0);
  });

  test('TC-AD02 positive: owner can sign in', async ({ page }) => {
    await adminLogin(page);
    await expect(page.getByText(/Total:/i)).toBeVisible();
  });

  test('TC-AD03 positive: logout returns to sign-in', async ({ page }) => {
    await adminLogin(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
    const flag = await page.evaluate(() => localStorage.getItem('ak_admin_logged'));
    expect(flag).toBeNull();
  });
});

test.describe('Admin orders — list, filter, search', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearAdminStorage(page, request);
    await adminLogin(page);
  });

  test('TC-AD04 positive: created store orders appear in list', async ({ page, request }) => {
    const a = await createApiOrder(request);
    const b = await createApiOrder(request, {
      items: [{ productId: 'ashta', qty: 1 }],
      total: 199,
      subtotal: 199,
      delivery: { phone: '9876501002', name: 'Second Buyer' },
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: new RegExp(a.id) })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(b.id) })).toBeVisible();
    await expect(page.getByText(/Total:\s*2/)).toBeVisible();
  });

  test('TC-AD05 positive: status filter shows only confirmed', async ({ page, request }) => {
    const pending = await createApiOrder(request);
    const packed = await createApiOrder(request, {
      items: [{ productId: 'ashta', qty: 1 }],
      total: 199,
      subtotal: 199,
    });
    const token = await adminToken(request);
    await setStatus(request, token, packed.id, 'packed');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(pending.id) })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(packed.id) })).toHaveCount(0);
  });

  test('TC-AD06 positive: search by customer phone finds order', async ({ page, request }) => {
    const order = await createApiOrder(request, {
      delivery: { phone: '9876501333', name: 'Phone Buyer' },
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Search orders').fill('9876501333');
    await expect(page.getByRole('button', { name: new RegExp(order.id) })).toBeVisible();
  });

  test('TC-AD07 negative: search with no match shows empty state', async ({ page }) => {
    await page.getByLabel('Search orders').fill('ZZZ-NO-MATCH');
    await expect(page.getByText(/No orders match this filter/i)).toBeVisible();
  });
});

test.describe('Admin orders — detail & status transitions', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearAdminStorage(page, request);
    await adminLogin(page);
  });

  test('TC-AD08 positive: selecting order shows customer + items', async ({ page, request }) => {
    const order = await createApiOrder(request, {
      delivery: { name: 'Ananya Rao', phone: '9876501001', city: 'Hyderabad' },
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp(order.id) }).click();
    await expect(page.getByRole('heading', { name: order.id })).toBeVisible();
    await expect(page.getByText('Ananya Rao', { exact: true })).toBeVisible();
    await expect(page.getByText(/Daily Immunity/)).toBeVisible();
    await expect(page.getByText(/Hyderabad/)).toBeVisible();
  });

  test('TC-AD09 positive: confirmed can move through full track timeline to delivered', async ({ page, request }) => {
    const order = await createApiOrder(request);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp(order.id) }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await expect(page.getByText(new RegExp(`${order.id} → Packed with care`, 'i'))).toBeVisible();
    await page.getByRole('button', { name: 'Mark Shipped' }).click();
    await expect(page.getByText(new RegExp(`${order.id} → Shipped`, 'i'))).toBeVisible();
    await page.getByRole('button', { name: 'Mark Out for delivery' }).click();
    await expect(page.getByText(new RegExp(`${order.id} → Out for delivery`, 'i'))).toBeVisible();
    await page.getByRole('button', { name: 'Mark Delivered' }).click();
    await expect(page.getByText(new RegExp(`${order.id} → Delivered`, 'i'))).toBeVisible();
  });

  test('TC-AD10 negative: cannot jump confirmed straight to delivered', async ({ page, request }) => {
    const order = await createApiOrder(request, {
      items: [{ productId: 'ashta', qty: 1 }],
      total: 199,
      subtotal: 199,
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp(order.id) }).click();
    await expect(page.getByRole('button', { name: 'Mark Delivered' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark Packed' })).toBeEnabled();
  });

  test('TC-AD11 negative: delivered order has no further status actions', async ({ page, request }) => {
    const order = await createApiOrder(request, {
      items: [{ productId: 'sunni', qty: 1 }],
      total: 249,
      subtotal: 249,
    });
    const token = await adminToken(request);
    for (const status of ['packed', 'shipped', 'out_for_delivery', 'delivered']) {
      await setStatus(request, token, order.id, status);
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp(order.id) }).click();
    await expect(page.getByRole('button', { name: 'Mark Packed' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark Delivered' })).toBeDisabled();
  });

  test('TC-AD12 positive: pending order can be cancelled', async ({ page, request }) => {
    const order = await createApiOrder(request, {
      items: [{ productId: 'sample-trio', qty: 1 }],
      total: 99,
      subtotal: 99,
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp(order.id) }).click();
    await page.getByRole('button', { name: 'Cancel order' }).click();
    await expect(page.getByText(new RegExp(`${order.id} → Cancelled`, 'i'))).toBeVisible();
  });
});

test.describe('Admin orders — store sync', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearAdminStorage(page, request);
  });

  test('TC-AD13 positive: login auto-pulls a store checkout order', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-42424',
        placedAt: Date.now(),
        total: 349,
        payMethod: 'cod',
        payment: { method: 'cod', mock: true, status: 'ok' },
        items: [{ name: 'Daily Immunity', qty: 1, line: '₹349' }],
        delivery: {
          name: 'Store Buyer',
          phone: '9876500999',
          email: 'buyer@example.com',
          address: '1 Demo Street',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500001',
        },
        source: 'store',
      }]));
    });

    await adminLogin(page);
    await expect(page.getByRole('button', { name: /AAK-42424/ })).toBeVisible();
    await page.getByRole('button', { name: /AAK-42424/ }).click();
    await expect(page.getByText('Store Buyer', { exact: true })).toBeVisible();
    await expect(page.getByText(/From store checkout/i)).toBeVisible();
  });

  test('TC-AD14 negative: pull with no store orders shows toast', async ({ page, request }) => {
    await clearAdminStorage(page, request);
    await adminLogin(page);
    await page.getByRole('button', { name: 'Pull store orders now' }).click();
    await expect(page.getByText(/No store orders found/i)).toBeVisible();
  });

  test('TC-AD16 positive: admin page opens by direct URL only (not linked from store footer)', async ({ page }) => {
    await clearAuthStorage(page);
    await page.goto(LANDING_URL);
    await expect(page.getByRole('link', { name: /Owner admin/i })).toHaveCount(0);
    await page.goto(ADMIN_URL);
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  });
});

test.describe('Admin orders — complex cross-flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearAdminStorage(page, request);
    await adminLogin(page);
  });

  test('TC-AD17 complex: filter + search + status update persistence after reload', async ({ page, request }) => {
    const order = await createApiOrder(request, {
      delivery: { phone: '9876501444', name: 'Persist Buyer' },
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Search orders').fill('9876501444');
    await page.getByRole('button', { name: new RegExp(order.id) }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await expect(page.getByText(new RegExp(`${order.id} → Packed`, 'i'))).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp(order.id) }).click();
    await expect(page.getByText(/Packed with care/i).first()).toBeVisible();
  });

  test('TC-AD18 complex: duplicate pull does not create duplicate IDs', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-55555',
        placedAt: Date.now(),
        total: 199,
        items: [{ name: 'Ashtagandham', qty: 1 }],
        delivery: { name: 'Dup', phone: '9876500555', email: '', address: 'A', city: 'B', state: 'C', pincode: '500001' },
        source: 'store',
      }]));
    });
    await refreshOrders(page);
    await refreshOrders(page);
    const count = await page.getByRole('button', { name: /AAK-55555/ }).count();
    expect(count).toBe(1);
  });

  test('TC-AD19 complex: live pull shows new store order without refresh', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-66666',
        placedAt: Date.now(),
        total: 249,
        items: [{ name: 'Herbal Sunni Pindi', qty: 1 }],
        delivery: { name: 'Live', phone: '9876500666', email: '', address: 'A', city: 'B', state: 'C', pincode: '500001' },
        source: 'store',
      }]));
    });
    await expect(page.getByRole('button', { name: /AAK-66666/ })).toBeVisible({ timeout: 8000 });
  });

  test('TC-AD20 complex: admin status update matches store Track Your Order', async ({ page, request }) => {
    const order = await createApiOrder(request);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: new RegExp(order.id) }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await expect(page.getByText(new RegExp(`${order.id} → Packed`, 'i'))).toBeVisible();

    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await page.getByPlaceholder('e.g. AAK-10482').fill(order.id);
    await page.getByRole('button', { name: 'Track Order' }).click();
    await expect(page.getByText('Packed with care')).toBeVisible({ timeout: 8000 });
  });
});
