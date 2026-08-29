// @ts-check
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  STRONG_PASSWORD,
} = require('./helpers/storage');

const LANDING_URL = '/';
const AUTH_URL = '/login';

test.describe('UX low — polish & a11y', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  // TC-L29
  test('featured products section is rendered', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByRole('heading', { name: 'Featured Products' })).toBeVisible();
    await expect(page.locator('#featured')).toContainText('Daily Immunity');
    await expect(page.locator('#featured')).toContainText('Kaphahara');
  });

  // TC-L29b
  test('recently viewed appears after opening a product', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Quick View' }).first().click({ force: true });
    await page.getByRole('button', { name: 'Close' }).first().click();
    await expect(page.getByRole('heading', { name: 'Recently viewed' })).toBeVisible({ timeout: 5000 });
  });

  // TC-L30
  test('footer Ingredients and logo Home are real anchors', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.locator('footer a[href="#ingredients"]')).toBeVisible();
    await expect(page.locator('a[href="#top"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Instagram coming soon/i })).toBeVisible();
  });

  // TC-L31
  test('founders and category cards use real images', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.locator('img[alt*="Founders"]')).toBeVisible();
    await expect(page.locator('#categories img.catImg').first()).toBeVisible();
    const emptySlot = page.locator('image-slot#story-founders');
    await expect(emptySlot).toHaveCount(0);
  });

  // TC-L32
  test('Escape closes quick view modal', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Quick View' }).first().click({ force: true });
    await expect(page.getByRole('dialog', { name: /quick view/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /quick view/i })).toHaveCount(0);
  });

  // TC-L33
  test('toast has aria-live and account menu closes on outside click', async ({ page }) => {
    await seedEmailUser(page, {
      email: `low-${Date.now()}@test.com`,
      password: STRONG_PASSWORD,
      name: 'Low User',
    });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();
    await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();
    await page.locator('header').click({ position: { x: 20, y: 20 } });
    await expect(page.getByRole('button', { name: 'Profile' })).toHaveCount(0);

    await page.getByRole('button', { name: /Instagram coming soon/i }).click();
    await expect(page.locator('[role="status"][aria-live="polite"]')).toContainText(/coming soon/i);
  });

  // TC-L34
  test('mobile nav shows at 840px width (no gap with desktop nav)', async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await page.goto(LANDING_URL);
    await expect(page.locator('#ak-mobilenav')).toBeVisible();
    await expect(page.locator('#store-nav')).toBeHidden();
  });

  // TC-L35
  test('hero stats match catalog honesty', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText('40+', { exact: true })).toHaveCount(0);
    await expect(page.getByText('12k+', { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-count="9"]')).toBeVisible();
    await expect(page.getByText('2021').first()).toBeVisible();
  });

  // TC-L36
  test('auth signup links to terms on landing', async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.getByRole('button', { name: 'Create Account' }).click();
    const link = page.getByRole('link', { name: /Terms & Conditions/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /Aakashik%20Landing\.dc\.html#legal-terms/);
  });

  // TC-L37
  test('trust strip does not advertise net-banking', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/net-banking/i)).toHaveCount(0);
  });

  // TC-L38
  test('no Diwali festival banner and no sign-in-to-add copy', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByText(/Diwali/i)).toHaveCount(0);
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    await page.locator('[data-cart-icon="true"]').click({ force: true });
    await page.getByRole('button', { name: 'Proceed to Checkout' }).evaluate((el) => /** @type {HTMLElement} */ (el).click());
    await expect(page.getByText(/Sign in to add to cart/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sign in to check out' })).toBeVisible();
  });
});
