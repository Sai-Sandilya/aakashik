/**
 * Mock Admin Orders console — owner reviews orders before real DB.
 */
const { test, expect } = require('@playwright/test');
const { clearAuthStorage } = require('./helpers/storage');

const ADMIN_URL = '/Aakashik%20Admin.dc.html';
const LANDING_URL = '/Aakashik%20Landing.dc.html';``
const ADMIN_EMAIL = 'owner@aakashik.local';
const ADMIN_PASSWORD = 'Admin@1234';

async function clearAdminStorage(page) {
  await page.goto(LANDING_URL);
  await page.evaluate(() => {
    localStorage.removeItem('ak_admin_logged');
    localStorage.removeItem('ak_admin_orders');
    localStorage.removeItem('ak_orders');
    localStorage.removeItem('ak_stock');
  });
}

async function adminLogin(page) {
  await page.goto(ADMIN_URL);
  await page.getByLabel('Admin email').fill(ADMIN_EMAIL);
  await page.getByLabel('Admin password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Enter Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Orders (mock)' })).toBeVisible({ timeout: 8000 });
}

test.describe('Admin orders — auth gate', () => {
  test.beforeEach(async ({ page }) => {
    await clearAdminStorage(page);
  });

  test('TC-AD01 negative: wrong password is rejected', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await page.getByLabel('Admin email').fill(ADMIN_EMAIL);
    await page.getByLabel('Admin password').fill('Wrong@9999');
    await page.getByRole('button', { name: 'Enter Admin' }).click();
    await expect(page.getByText(/Incorrect admin email or password/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Orders (mock)' })).toHaveCount(0);
  });

  test('TC-AD02 positive: demo owner can sign in', async ({ page }) => {
    await adminLogin(page);
    await expect(page.getByText(/Total:/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'AAK-10001' })).toBeVisible();
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
  test.beforeEach(async ({ page }) => {
    await clearAdminStorage(page);
    await adminLogin(page);
  });

  test('TC-AD04 positive: mock seeds five sample orders', async ({ page }) => {
    await expect(page.getByText(/Total:\s*5/)).toBeVisible();
    await expect(page.getByRole('button', { name: /AAK-10001/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /AAK-10005/ })).toBeVisible();
  });

  test('TC-AD05 positive: status filter shows only confirmed', async ({ page }) => {
    await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
    await expect(page.getByRole('button', { name: /AAK-10001/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /AAK-10002/ })).toHaveCount(0);
    await expect(page.getByText(/Visible:\s*1/)).toBeVisible();
  });

  test('TC-AD06 positive: search by customer phone finds order', async ({ page }) => {
    await page.getByLabel('Search orders').fill('9876501003');
    await expect(page.getByRole('button', { name: /AAK-10003/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /AAK-10001/ })).toHaveCount(0);
  });

  test('TC-AD07 negative: search with no match shows empty state', async ({ page }) => {
    await page.getByLabel('Search orders').fill('ZZZ-NO-MATCH');
    await expect(page.getByText(/No orders match this filter/i)).toBeVisible();
  });
});

test.describe('Admin orders — detail & status transitions', () => {
  test.beforeEach(async ({ page }) => {
    await clearAdminStorage(page);
    await adminLogin(page);
  });

  test('TC-AD08 positive: selecting order shows customer + items', async ({ page }) => {
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await expect(page.getByRole('heading', { name: 'AAK-10001' })).toBeVisible();
    await expect(page.getByText('Ananya Rao', { exact: true })).toBeVisible();
    await expect(page.getByText(/Daily Immunity/)).toBeVisible();
    await expect(page.getByText(/Hyderabad/)).toBeVisible();
  });

  test('TC-AD09 positive: confirmed can move through full track timeline to delivered', async ({ page }) => {
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await expect(page.getByText(/AAK-10001 → Packed with care/i)).toBeVisible();
    await page.getByRole('button', { name: 'Mark Shipped' }).click();
    await expect(page.getByText(/AAK-10001 → Shipped/i)).toBeVisible();
    await page.getByRole('button', { name: 'Mark Out for delivery' }).click();
    await expect(page.getByText(/AAK-10001 → Out for delivery/i)).toBeVisible();
    await page.getByRole('button', { name: 'Mark Delivered' }).click();
    await expect(page.getByText(/AAK-10001 → Delivered/i)).toBeVisible();

    const stored = await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('ak_admin_orders') || '[]');
      return list.find((o) => o.id === 'AAK-10001');
    });
    expect(stored.status).toBe('delivered');
    expect(stored.statusHistory.map((h) => h.status)).toEqual([
      'pending', 'packed', 'shipped', 'out_for_delivery', 'delivered',
    ]);
  });

  test('TC-AD10 negative: cannot jump confirmed straight to delivered', async ({ page }) => {
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await expect(page.getByRole('button', { name: 'Mark Delivered' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark Out for delivery' })).toBeDisabled();
    const stored = await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('ak_admin_orders') || '[]');
      return list.find((o) => o.id === 'AAK-10001');
    });
    expect(stored.status).toBe('pending');
  });

  test('TC-AD11 negative: delivered order has no further status actions', async ({ page }) => {
    await page.getByRole('button', { name: /AAK-10004/ }).click();
    await expect(page.getByRole('button', { name: 'Mark Packed' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark Shipped' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark Out for delivery' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark Delivered' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancel order' })).toBeDisabled();
  });

  test('TC-AD12 positive: pending order can be cancelled', async ({ page }) => {
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await page.getByRole('button', { name: 'Cancel order' }).click();
    await expect(page.getByText(/AAK-10001 → Cancelled/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelled', exact: true }).click();
    await expect(page.getByRole('button', { name: /AAK-10001/ })).toBeVisible();
  });
});

test.describe('Admin orders — store sync & reseed', () => {
  test.beforeEach(async ({ page }) => {
    await clearAdminStorage(page);
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
      }]));
    });

    await adminLogin(page);
    await expect(page.getByRole('button', { name: /AAK-42424/ })).toBeVisible();
    await page.getByRole('button', { name: /AAK-42424/ }).click();
    await expect(page.getByText('Store Buyer', { exact: true })).toBeVisible();
    await expect(page.getByText(/Synced from store checkout/i)).toBeVisible();
  });

  test('TC-AD14 negative: pull with no store orders shows toast', async ({ page }) => {
    await adminLogin(page);
    await page.getByRole('button', { name: 'Pull store orders now' }).click();
    await expect(page.getByText(/No store orders found/i)).toBeVisible();
  });

  test('TC-AD15 positive: reseed restores mocks but keeps store-sourced orders', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-77777',
        placedAt: Date.now(),
        total: 199,
        payMethod: 'upi',
        items: [{ name: 'Ashtagandham', qty: 1 }],
        delivery: { name: 'Keep Me', phone: '9876500888', email: '', address: 'A', city: 'B', state: 'C', pincode: '500001' },
      }]));
    });
    await adminLogin(page);
    await expect(page.getByRole('button', { name: /AAK-77777/ })).toBeVisible();
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await page.getByRole('button', { name: 'Reseed mocks' }).click();
    await expect(page.getByText(/Mock orders reseeded/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /AAK-77777/ })).toBeVisible();
    const statuses = await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('ak_admin_orders') || '[]');
      return {
        mock: (list.find((o) => o.id === 'AAK-10001') || {}).status,
        store: (list.find((o) => o.id === 'AAK-77777') || {}).source,
      };
    });
    expect(statuses.mock).toBe('pending');
    expect(statuses.store).toBe('store');
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
  test.beforeEach(async ({ page }) => {
    await clearAdminStorage(page);
  });

  test('TC-AD17 complex: filter + search + status update persistence after reload', async ({ page }) => {
    await adminLogin(page);
    await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders (mock)' })).toBeVisible();
    await page.getByRole('button', { name: 'Packed', exact: true }).click();
    await expect(page.getByRole('button', { name: /AAK-10001/ })).toBeVisible();
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await expect(page.getByText(/History/i)).toBeVisible();
    await expect(page.getByText(/Packed with care ·/i).first()).toBeVisible();
  });

  test('TC-AD18 complex: duplicate pull does not create duplicate IDs', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-55555',
        placedAt: Date.now(),
        total: 99,
        payMethod: 'cod',
        items: [{ name: 'Sample Trio', qty: 1 }],
        delivery: { name: 'Dup Check', phone: '9876500777', email: 'dup@example.com', address: 'X', city: 'Y', state: 'Z', pincode: '560001' },
      }]));
    });
    await adminLogin(page);
    await expect(page.getByRole('button', { name: /AAK-55555/ })).toBeVisible();
    await page.getByRole('button', { name: 'Pull store orders now' }).click();
    await expect(page.getByText(/already up to date/i)).toBeVisible();
    const count = await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('ak_admin_orders') || '[]');
      return list.filter((o) => o.id === 'AAK-55555').length;
    });
    expect(count).toBe(1);
  });

  test('TC-AD19 complex: live pull shows new store order without refresh', async ({ page }) => {
    await adminLogin(page);
    await expect(page.getByRole('heading', { name: 'Orders (mock)' })).toBeVisible();
    await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('ak_orders') || '[]');
      list.unshift({
        id: 'AAK-88888',
        placedAt: Date.now(),
        total: 349,
        payMethod: 'cod',
        items: [{ name: 'Daily Immunity', qty: 1 }],
        delivery: {
          name: 'Live Pull Buyer',
          phone: '9876500666',
          email: 'live@example.com',
          address: '9 Live Lane',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
        },
      });
      localStorage.setItem('ak_orders', JSON.stringify(list));
    });
    await expect(page.getByRole('button', { name: /AAK-88888/ })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/New store order received/i)).toBeVisible();
  });

  test('TC-AD20 complex: admin status update matches store Track Your Order', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-88912',
        placedAt: Date.now(),
        status: 'pending',
        statusHistory: [{ status: 'pending', at: Date.now() }],
        total: 224,
        payMethod: 'cod',
        payment: { method: 'cod', mock: true, status: 'ok' },
        items: [{ name: 'Herbal Sunni Pindi', qty: 1, line: '₹224' }],
        delivery: {
          name: 'Demo Google User',
          phone: '8328584109',
          email: 'demo.google@aakashik.local',
          address: 'jdshgfhj',
          city: 'hgsdfhj',
          state: 'Andhra Pradesh',
          pincode: '530016',
        },
      }]));
    });
    await adminLogin(page);
    await page.getByRole('button', { name: /AAK-88912/ }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await expect(page.getByText(/AAK-88912 → Packed with care/i)).toBeVisible();

    const storeStatus = await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('ak_orders') || '[]');
      return (list.find((o) => o.id === 'AAK-88912') || {}).status;
    });
    expect(storeStatus).toBe('packed');

    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await page.getByPlaceholder('e.g. AAK-10482').fill('AAK-88912');
    await page.getByRole('button', { name: 'Track Order' }).click();
    const dialog = page.getByRole('dialog', { name: 'Track Your Order' });
    await expect(dialog.getByText('Order Confirmed')).toBeVisible();
    await expect(dialog.getByText('Packed with care')).toBeVisible();
    await expect(dialog.getByText('Out for delivery')).toBeVisible();
    await expect(dialog.getByText('Delivered', { exact: true })).toBeVisible();
  });
});
