// @ts-check
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  STRONG_PASSWORD,
} = require('./helpers/storage');

const LANDING_URL = '/Aakashik%20Landing.dc.html';

/** @param {import('@playwright/test').Page} page */
function cartButton(page) {
  return page.locator('[data-cart-icon="true"]');
}

/** @param {import('@playwright/test').Page} page */
function wishlistButton(page) {
  return page.locator('[data-wishlist-icon="true"]');
}

/**
 * Seed cart + logged-in user and open delivery step.
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string, cart?: Record<string, unknown> }} [opts]
 */
async function openDeliveryCheckout(page, opts = {}) {
  const email = opts.email || `member-${Date.now()}@test.com`;
  const cart = opts.cart || {
    'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
  };
  await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Member User' });
  await page.evaluate((c) => {
    localStorage.setItem('ak_cart', JSON.stringify(c));
  }, cart);
  await page.reload();
  await cartButton(page).click({ force: true });
  await expect(page.getByRole('button', { name: 'Proceed to Checkout' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
  await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible({ timeout: 8000 });
  return email;
}

/** @param {import('@playwright/test').Page} page */
async function fillDeliveryBasics(page) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Place Order' }) });
  await form.getByPlaceholder('Full name').fill('Test Buyer');
  await form.getByPlaceholder('10-digit mobile').fill('9876543210');
  await form.getByPlaceholder('you@example.com').fill(`buyer-${Date.now()}@test.com`);
  await form.getByPlaceholder('House, street, area').fill('12 Ritual Lane');
  await form.getByPlaceholder('City').fill('Hyderabad');
  await form.getByPlaceholder(/Pincode|6-digit pin/).fill('500001');
  await form.locator('select').selectOption({ label: 'Telangana' });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, { productId: string, qty: number, subscribe: boolean, size: string | null, sizePrice: number | null }>} cart
 */
async function seedCartAndOpen(page, cart) {
  await page.goto(LANDING_URL);
  await page.evaluate((c) => localStorage.setItem('ak_cart', JSON.stringify(c)), cart);
  await page.reload();
  await cartButton(page).click({ force: true });
}

test.describe('UX high fixes', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      ['ak_cart', 'ak_wishlist', 'ak_orders', 'ak_newsletter', 'ak_reminder', 'ak_dosha', 'ak_lang'].forEach((k) => localStorage.removeItem(k));
    });
  });

  // --- 1 Shipping ads removed ---
  test('TC-H01 positive: no free-shipping ₹500 / ₹49 trust copy', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText('Pan-India Delivery')).toBeVisible();
    await expect(page.getByText(/Free Shipping over ₹500/i)).toHaveCount(0);
    await expect(page.getByText(/Flat ₹49/i)).toHaveCount(0);
  });

  test('TC-H02 negative: cart does not show free-shipping progress bar', async ({ page }) => {
    await seedCartAndOpen(page, {
      'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
    });
    await expect(page.getByText(/more for free shipping|unlocked free shipping/i)).toHaveCount(0);
  });

  // --- 3 Festive offer removed ---
  test('TC-H03 positive: Diwali promo code offer is not advertised', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/DIWALI15/i)).toHaveCount(0);
    await expect(page.getByText(/15% off gift sets/i)).toHaveCount(0);
  });

  // --- 10 No returns ---
  test('TC-H04 positive: trust strip says No Returns', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByRole('heading', { name: 'No Returns' })).toBeVisible();
    await expect(page.getByText(/Easy 7-Day Returns/i)).toHaveCount(0);
  });

  test('TC-H05 positive: order success states no returns', async ({ page }) => {
    await openDeliveryCheckout(page);
    await fillDeliveryBasics(page);
    await page.getByRole('button', { name: 'Place Order' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    const success = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Order Placed!' }) });
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 8000 });
    await expect(success.getByText('All sales are final. We do not accept returns on placed orders.')).toBeVisible();
    await expect(success.getByRole('button', { name: /Request return|Start return|Return item/i })).toHaveCount(0);
  });

  test('TC-H06 negative: refund policy says no returns after order placed', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Refund Policy' }).first().click();
    await expect(page.getByText(/do not accept returns or refunds once an order has been placed/i)).toBeVisible({ timeout: 8000 });
  });

  // --- 5 Track steps ---
  test('TC-H07 positive: tracking shows all 5 steps for fresh order', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-11111',
        placedAt: Date.now(),
        total: 349,
        items: [{ name: 'Daily Immunity', qty: 1 }],
        delivery: { name: 'Test' },
      }]));
    });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await page.getByPlaceholder('e.g. AAK-10482').fill('AAK-11111');
    await page.getByRole('button', { name: 'Track Order' }).click();
    const modal = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Track Your Order' }) }).filter({ hasText: 'Order Confirmed' });
    await expect(modal.getByText('Order Confirmed')).toBeVisible();
    await expect(modal.getByText('Packed with care')).toBeVisible();
    await expect(modal.getByText('Shipped')).toBeVisible();
    await expect(modal.getByText('Out for delivery')).toBeVisible();
    await expect(modal.getByText('Delivered', { exact: true })).toBeVisible();
  });

  test('TC-H08 positive: tracking shows all 5 steps for mid-progress order', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_orders', JSON.stringify([{
        id: 'AAK-22222',
        placedAt: Date.now() - 30 * 3600000,
        total: 349,
        items: [{ name: 'Daily Immunity', qty: 1 }],
      }]));
    });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await page.getByPlaceholder('e.g. AAK-10482').fill('AAK-22222');
    await page.getByRole('button', { name: 'Track Order' }).click();
    const modal = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Track Your Order' }) }).filter({ hasText: 'Order Confirmed' });
    await expect(modal.getByText('Order Confirmed')).toBeVisible();
    await expect(modal.getByText('Packed with care')).toBeVisible();
    await expect(modal.getByText('Shipped')).toBeVisible();
    await expect(modal.getByText('Out for delivery')).toBeVisible();
    await expect(modal.getByText('Delivered', { exact: true })).toBeVisible();
  });

  test('TC-H09 negative: unknown order still shows not-found (not fake steps)', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).click({ force: true });
    await page.getByPlaceholder('e.g. AAK-10482').fill('AAK-00000');
    await page.getByRole('button', { name: 'Track Order' }).click();
    await expect(page.getByText(/No order found/i)).toBeVisible();
  });

  // --- 4 Member discount ---
  test('TC-H10 positive: guest sees sign-in for member pricing', async ({ page }) => {
    await seedCartAndOpen(page, {
      'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
    });
    await expect(page.getByText(/Sign in for member pricing/i)).toBeVisible();
  });

  test('TC-H11 positive: logged-in member gets 10% discount line', async ({ page }) => {
    const email = `member-${Date.now()}@test.com`;
    await seedEmailUser(page, { email, password: STRONG_PASSWORD, name: 'Member User' });
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await cartButton(page).click({ force: true });
    await expect(page.getByText(/10% off applies once|Member 10% off|Member pricing applied/i).first()).toBeVisible();
    await expect(page.getByText('−₹35')).toBeVisible();
  });

  test('TC-H12 negative: guest total equals full catalog price (no silent member cut)', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await cartButton(page).click();
    await expect(page.getByText('₹349').first()).toBeVisible();
    await expect(page.getByText(/Member discount/i)).toHaveCount(0);
  });

  // --- 2 Mock payment ---
  test('TC-H13 positive: COD places order without payment fields', async ({ page }) => {
    await openDeliveryCheckout(page);
    await fillDeliveryBasics(page);
    await page.getByRole('button', { name: 'Cash on Delivery' }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 8000 });
    const orders = /** @type {Array<{ payMethod: string, returnsAccepted: boolean, payment?: { mock?: boolean, last4?: string } }>} */ (
      await page.evaluate(() => JSON.parse(localStorage.getItem('ak_orders') || '[]'))
    );
    expect(orders[0].payMethod).toBe('cod');
    expect(orders[0].returnsAccepted).toBe(false);
  });

  test('TC-H14 positive: valid UPI mock payment places order', async ({ page }) => {
    await openDeliveryCheckout(page);
    await fillDeliveryBasics(page);
    await page.getByRole('button', { name: 'UPI' }).click();
    await page.getByPlaceholder('UPI ID (e.g. name@upi)').fill('buyer@upi');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 8000 });
    const orders = /** @type {Array<{ payMethod: string, payment?: { mock?: boolean, last4?: string } }>} */ (
      await page.evaluate(() => JSON.parse(localStorage.getItem('ak_orders') || '[]'))
    );
    expect(orders[0].payMethod).toBe('upi');
    expect(orders[0].payment && orders[0].payment.mock).toBe(true);
  });

  test('TC-H15 negative: empty UPI ID blocks place order', async ({ page }) => {
    await openDeliveryCheckout(page);
    await fillDeliveryBasics(page);
    await page.getByRole('button', { name: 'UPI' }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/valid UPI ID/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toHaveCount(0);
  });

  test('TC-H16 negative: invalid UPI ID format is rejected', async ({ page }) => {
    await openDeliveryCheckout(page);
    await fillDeliveryBasics(page);
    await page.getByRole('button', { name: 'UPI' }).click();
    await page.getByPlaceholder('UPI ID (e.g. name@upi)').fill('not-a-upi');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/valid UPI ID/i)).toBeVisible();
  });

  test('TC-H17 positive: valid card mock payment places order', async ({ page }) => {
    await openDeliveryCheckout(page);
    await fillDeliveryBasics(page);
    await page.getByRole('button', { name: 'Card' }).click();
    await page.getByPlaceholder('Card number (16 digits)').fill('4111111111111111');
    await page.getByPlaceholder('MM/YY').fill('12/30');
    await page.getByPlaceholder('CVV').fill('123');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toBeVisible({ timeout: 8000 });
    const orders = /** @type {Array<{ payMethod: string, payment?: { mock?: boolean, last4?: string } }>} */ (
      await page.evaluate(() => JSON.parse(localStorage.getItem('ak_orders') || '[]'))
    );
    expect(orders[0].payMethod).toBe('card');
    expect(orders[0].payment && orders[0].payment.last4).toBe('1111');
  });

  test('TC-H18 negative: short card number is rejected', async ({ page }) => {
    await openDeliveryCheckout(page);
    await fillDeliveryBasics(page);
    await page.getByRole('button', { name: 'Card' }).click();
    await page.getByPlaceholder('Card number (16 digits)').fill('41111111');
    await page.getByPlaceholder('MM/YY').fill('12/30');
    await page.getByPlaceholder('CVV').fill('123');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/16-digit card number/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Order Placed!' })).toHaveCount(0);
  });

  test('TC-H19 negative: bad card expiry is rejected', async ({ page }) => {
    await openDeliveryCheckout(page);
    await fillDeliveryBasics(page);
    await page.getByRole('button', { name: 'Card' }).click();
    await page.getByPlaceholder('Card number (16 digits)').fill('4111111111111111');
    await page.getByPlaceholder('MM/YY').fill('13/30');
    await page.getByPlaceholder('CVV').fill('123');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/MM\/YY/i)).toBeVisible();
  });

  test('TC-H20 positive: mock payment disclaimer is visible', async ({ page }) => {
    await openDeliveryCheckout(page);
    await expect(page.getByText(/Mock payment — no real charge/i)).toBeVisible();
  });

  // --- 8 Cart lines by size ---
  test('TC-H21 positive: different sizes create separate cart lines', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'kaphahara::100g': { productId: 'kaphahara', qty: 1, subscribe: false, size: '100g', sizePrice: 199 },
        'kaphahara::250g': { productId: 'kaphahara', qty: 1, subscribe: false, size: '250g', sizePrice: 399 },
      }));
    });
    await page.reload();
    await cartButton(page).click();
    await expect(page.getByText('100g ·').first()).toBeVisible();
    await expect(page.getByText('250g ·').first()).toBeVisible();
    const keys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ak_cart') || '{}')));
    expect(keys).toContain('kaphahara::100g');
    expect(keys).toContain('kaphahara::250g');
  });

  test('TC-H22 negative: same size merges qty instead of duplicating', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'kaphahara::100g': { productId: 'kaphahara', qty: 2, subscribe: false, size: '100g', sizePrice: 199 },
      }));
    });
    await page.reload();
    const cart = /** @type {Record<string, { qty: number }>} */ (
      await page.evaluate(() => JSON.parse(localStorage.getItem('ak_cart') || '{}'))
    );
    expect(cart['kaphahara::100g'].qty).toBe(2);
    expect(Object.keys(cart).filter((k) => k.startsWith('kaphahara::')).length).toBe(1);
    await cartButton(page).click({ force: true });
    await expect(page.getByText('100g ·').first()).toBeVisible();
  });

  // --- 7 One source of truth / 6 real products ---
  test('TC-H23 positive: night ritual maps to Ashtagandham (real SKU)', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Night' }).click();
    await expect(page.getByRole('heading', { name: 'Ashtagandham' }).first()).toBeVisible();
    await expect(page.getByText(/Calm & Restore/i)).toHaveCount(0);
    await expect(page.getByText('₹199').first()).toBeVisible();
  });

  test('TC-H24 positive: summer season maps to Herbal Sunni Pindi with Quick View', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Summer' }).click();
    await expect(page.getByRole('heading', { name: 'Herbal Sunni Pindi', exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Cooling Sattva/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Quick View' }).first().click({ force: true });
    await expect(page.getByText('Herbal Sunni Pindi').first()).toBeVisible();
  });

  test('TC-H25 positive: jar shelf price matches catalog for Daily Immunity', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: 349 },
      }));
    });
    await page.reload();
    await cartButton(page).click({ force: true });
    await expect(page.getByText('₹349').first()).toBeVisible();
  });

  test('TC-H26 negative: phantom product names are gone from season cards', async ({ page }) => {
    await page.goto(LANDING_URL);
    for (const label of ['Monsoon', 'Autumn', 'Winter', 'Summer']) {
      await page.getByRole('button', { name: label }).click();
      await expect(page.getByText(/Cooling Sattva|Ojas Daily Wellness|Golden Immunity Kashayam|Kaphahara Respiratory/i)).toHaveCount(0);
    }
  });

  // --- 9 Wishlist view ---
  test('TC-H27 positive: wishlist drawer lists saved item', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.locator('[aria-label="Wishlist"]').first().click();
    await wishlistButton(page).click();
    await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible();
    await expect(page.getByText(/Your wishlist is empty/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('TC-H28 positive: remove from wishlist empties the drawer', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => localStorage.setItem('ak_wishlist', JSON.stringify({ immunity: true })));
    await page.reload();
    await wishlistButton(page).click();
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText(/Your wishlist is empty/i)).toBeVisible();
    const wish = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_wishlist') || '{}'));
    expect(Object.keys(wish).length).toBe(0);
  });

  test('TC-H29 negative: empty wishlist shows empty state', async ({ page }) => {
    await page.goto(LANDING_URL);
    await wishlistButton(page).click();
    await expect(page.getByText(/Your wishlist is empty/i)).toBeVisible();
  });

  test('TC-H30 positive: wishlist badge count updates', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.locator('[aria-label="Wishlist"]').first().click();
    await expect(wishlistButton(page).getByText('1')).toBeVisible();
  });

  test('TC-H31 positive: Auth page promises real 10% member pricing', async ({ page }) => {
    await page.goto('/Aakashik%20Auth.dc.html');
    await expect(page.getByText(/member pricing \(10% off\)/i).first()).toBeVisible();
  });
});
