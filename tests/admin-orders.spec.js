/**
 * Mock Admin Orders console — owner reviews orders before real DB.
 */
const { test, expect } = require('@playwright/test');
const { clearAuthStorage } = require('./helpers/storage');

const ADMIN_URL = '/Aakashik%20Admin.dc.html';
const LANDING_URL = '/Aakashik%20Landing.dc.html';
const ADMIN_EMAIL = 'owner@aakashik.local';
const ADMIN_PASSWORD = 'Admin@1234';

async function clearAdminStorage(page) {
  await page.goto(LANDING_URL);
  await page.evaluate(() => {
    localStorage.removeItem('ak_admin_logged');
    localStorage.removeItem('ak_admin_orders');
    localStorage.removeItem('ak_orders');
  });
}

async function adminLogin(page) {
  await page.goto(ADMIN_URL);
  await page.getByLabel('Admin email').fill(ADMIN_EMAIL);
  await page.getByLabel('Admin password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Enter Orders' }).click();
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
    await page.getByRole('button', { name: 'Enter Orders' }).click();
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

  test('TC-AD05 positive: status filter shows only pending', async ({ page }) => {
    await page.getByRole('button', { name: 'Pending', exact: true }).click();
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

  test('TC-AD09 positive: pending can move to packed then shipped then delivered', async ({ page }) => {
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await expect(page.getByText(/AAK-10001 → Packed/i)).toBeVisible();
    await page.getByRole('button', { name: 'Mark Shipped' }).click();
    await expect(page.getByText(/AAK-10001 → Shipped/i)).toBeVisible();
    await page.getByRole('button', { name: 'Mark Delivered' }).click();
    await expect(page.getByText(/AAK-10001 → Delivered/i)).toBeVisible();

    const stored = await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('ak_admin_orders') || '[]');
      return list.find((o) => o.id === 'AAK-10001');
    });
    expect(stored.status).toBe('delivered');
    expect(stored.statusHistory.map((h) => h.status)).toEqual(['pending', 'packed', 'shipped', 'delivered']);
  });

  test('TC-AD10 negative: cannot jump pending straight to delivered', async ({ page }) => {
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await expect(page.getByRole('button', { name: 'Mark Delivered' })).toBeDisabled();
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

  test('TC-AD13 positive: sync imports a store checkout order', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Sync store orders' }).click();
    await expect(page.getByText(/Synced 1 store order/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /AAK-42424/ })).toBeVisible();
    await page.getByRole('button', { name: /AAK-42424/ }).click();
    await expect(page.getByText('Store Buyer', { exact: true })).toBeVisible();
    await expect(page.getByText(/Synced from store checkout/i)).toBeVisible();
  });

  test('TC-AD14 negative: sync with no store orders shows toast', async ({ page }) => {
    await adminLogin(page);
    await page.getByRole('button', { name: 'Sync store orders' }).click();
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
    await page.getByRole('button', { name: 'Sync store orders' }).click();
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

  test('TC-AD16 positive: store footer links to owner admin demo', async ({ page }) => {
    await clearAuthStorage(page);
    await page.goto(LANDING_URL);
    const link = page.getByRole('link', { name: /Owner admin \(demo\)/i });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toHaveAttribute('href', /Aakashik%20Admin\.dc\.html/);
  });
});

test.describe('Admin orders — complex cross-flows', () => {
  test.beforeEach(async ({ page }) => {
    await clearAdminStorage(page);
  });

  test('TC-AD17 complex: filter + search + status update persistence after reload', async ({ page }) => {
    await adminLogin(page);
    await page.getByRole('button', { name: 'Pending', exact: true }).click();
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await page.getByRole('button', { name: 'Mark Packed' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Orders (mock)' })).toBeVisible();
    await page.getByRole('button', { name: 'Packed', exact: true }).click();
    await expect(page.getByRole('button', { name: /AAK-10001/ })).toBeVisible();
    await page.getByRole('button', { name: /AAK-10001/ }).click();
    await expect(page.getByText(/History/i)).toBeVisible();
    await expect(page.getByText(/Packed ·/i).first()).toBeVisible();
  });

  test('TC-AD18 complex: duplicate sync does not create duplicate IDs', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Sync store orders' }).click();
    await page.getByRole('button', { name: 'Sync store orders' }).click();
    await expect(page.getByText(/already synced/i)).toBeVisible();
    const count = await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('ak_admin_orders') || '[]');
      return list.filter((o) => o.id === 'AAK-55555').length;
    });
    expect(count).toBe(1);
  });
});
