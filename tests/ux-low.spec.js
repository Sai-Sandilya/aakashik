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

  test('TC-L32b positive: Ingredients toggle only when pack back exists', async ({ page }) => {
    await page.goto(LANDING_URL);
    // Daily Immunity has no pack photos → no Ingredients toggle
    await page.locator('#featured').getByRole('heading', { name: 'Daily Immunity' }).locator('xpath=ancestor::div[contains(@style,\"border-radius\")][1]').getByRole('button', { name: 'View' }).click();
    let qv = page.getByRole('dialog', { name: 'Product quick view' });
    await expect(qv).toBeVisible({ timeout: 8000 });
    await expect(qv.getByRole('button', { name: 'Ingredients' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Kaphahara has front + back pack photos
    await page.locator('#featured').getByRole('heading', { name: 'Kaphahara' }).locator('xpath=ancestor::div[contains(@style,\"border-radius\")][1]').getByRole('button', { name: 'View' }).click();
    qv = page.getByRole('dialog', { name: 'Product quick view' });
    await expect(qv).toBeVisible({ timeout: 8000 });
    await expect(qv.getByRole('button', { name: 'Ingredients' })).toBeVisible();
    await expect(qv.getByRole('button', { name: 'Front' })).toBeVisible();
  });

  test('TC-L32c positive: invalid Quick View id closes without crash', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.locator('#dc-root')).toBeVisible({ timeout: 15000 });
    const set = await page.evaluate(() => {
      const seen = new Set();
      const visit = (fiber) => {
        if (!fiber || seen.has(fiber)) return false;
        seen.add(fiber);
        const logic = fiber.stateNode && fiber.stateNode.logic;
        if (logic && typeof logic.setState === 'function' && logic.state && Object.prototype.hasOwnProperty.call(logic.state, 'quickView')) {
          logic.setState({ quickView: 'missing-sku-xyz' });
          return true;
        }
        return visit(fiber.child) || visit(fiber.sibling);
      };
      const root = document.getElementById('dc-root');
      if (root) {
        for (const k of Object.keys(root)) {
          if (k.startsWith('__reactContainer') || k.startsWith('__reactFiber')) {
            let fiber = root[k];
            if (fiber && fiber.stateNode && fiber.stateNode.current) fiber = fiber.stateNode.current;
            else if (fiber && fiber.current) fiber = fiber.current;
            if (visit(fiber)) return true;
          }
        }
      }
      for (const el of document.querySelectorAll('#dc-root *')) {
        for (const k of Object.keys(el)) {
          if (k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')) {
            if (visit(el[k])) return true;
          }
        }
      }
      return false;
    });
    expect(set).toBe(true);
    await expect.poll(async () => page.getByRole('dialog', { name: 'Product quick view' }).count(), { timeout: 8000 }).toBe(0);
  });

  test('TC-L32d positive: Quick View Out of stock add is disabled', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => localStorage.setItem('ak_stock', JSON.stringify({ immunity: 0 })));
    await page.reload();
    await page.locator('#featured').getByRole('heading', { name: 'Daily Immunity' }).locator('xpath=ancestor::div[contains(@style,\"border-radius\")][1]').getByRole('button', { name: 'View' }).click();
    const qv = page.getByRole('dialog', { name: 'Product quick view' });
    await expect(qv).toBeVisible({ timeout: 8000 });
    const addBtn = qv.getByRole('button', { name: 'Out of stock' });
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toBeDisabled();
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
    await expect(link).toHaveAttribute('href', '/#legal-terms');
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

  // TC-L39
  test('TC-L39 positive: #legal-disclaimer hash opens Disclaimer modal', async ({ page }) => {
    await page.goto('/#legal-disclaimer');
    await expect(page.locator('#dc-root')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Disclaimer' })).toBeVisible({ timeout: 8000 });
  });

  // TC-L40
  test('TC-L40 positive: reopening Track clears previous order ID', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Track now' }).click();
    const input = page.getByPlaceholder('e.g. AAK-10482');
    await input.fill('AAK-OLD99');
    await page.getByRole('dialog', { name: 'Track Your Order' }).getByLabel('Close').click();
    await page.getByRole('button', { name: 'Track now' }).click();
    await expect(input).toHaveValue('');
  });

  // TC-L41
  test('TC-L41 positive: Track modal shows Order History hint', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Track now' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Track now' }).click();
    const track = page.getByRole('dialog', { name: 'Track Your Order' });
    await expect(track.getByText(/Order History/i)).toBeVisible();
  });

  // TC-L42
  test('TC-L42 positive: opening Track closes Search overlay', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.locator('#dc-root')).toBeVisible({ timeout: 15000 });
    const primed = await page.evaluate(() => {
      const seen = new Set();
      const visit = (fiber) => {
        if (!fiber || seen.has(fiber)) return null;
        seen.add(fiber);
        const logic = fiber.stateNode && fiber.stateNode.logic;
        if (logic && typeof logic.setState === 'function' && logic.state && Object.prototype.hasOwnProperty.call(logic.state, 'searchOpen')) {
          return logic;
        }
        return visit(fiber.child) || visit(fiber.sibling);
      };
      const root = document.getElementById('dc-root');
      if (!root) return false;
      for (const k of Object.keys(root)) {
        if (k.startsWith('__reactContainer') || k.startsWith('__reactFiber')) {
          let fiber = root[k];
          if (fiber && fiber.stateNode && fiber.stateNode.current) fiber = fiber.stateNode.current;
          const logic = visit(fiber);
          if (logic) {
            logic.setState({ searchOpen: true, searchQuery: '', fConcern: 'all', fElement: 'all', fPrice: 'all' });
            return true;
          }
        }
      }
      return false;
    });
    expect(primed).toBe(true);
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => /Track now/i.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Track Your Order' })).toBeVisible();
  });

  // TC-L43
  test('TC-L43 positive: Escape does not dismiss overlays behind terms gate', async ({ page }) => {
    await seedEmailUser(page, {
      email: `terms-esc-${Date.now()}@test.com`,
      password: STRONG_PASSWORD,
      name: 'Terms Esc',
      acceptTerms: false,
    });
    await page.goto(LANDING_URL);
    await expect(page.locator('[aria-labelledby="home-terms-title"]')).toBeVisible({ timeout: 8000 });
    const primed = await page.evaluate(() => {
      const seen = new Set();
      const visit = (fiber) => {
        if (!fiber || seen.has(fiber)) return null;
        seen.add(fiber);
        const logic = fiber.stateNode && fiber.stateNode.logic;
        if (logic && typeof logic.setState === 'function' && logic.state && Object.prototype.hasOwnProperty.call(logic.state, 'termsOpen')) {
          return logic;
        }
        return visit(fiber.child) || visit(fiber.sibling);
      };
      const root = document.getElementById('dc-root');
      if (!root) return false;
      for (const k of Object.keys(root)) {
        if (k.startsWith('__reactContainer') || k.startsWith('__reactFiber')) {
          let fiber = root[k];
          if (fiber && fiber.stateNode && fiber.stateNode.current) fiber = fiber.stateNode.current;
          const logic = visit(fiber);
          if (logic) {
            logic.setState({ searchOpen: true, searchQuery: 'immunity', fConcern: 'all', fElement: 'all', fPrice: 'all' });
            return true;
          }
        }
      }
      return false;
    });
    expect(primed).toBe(true);
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
    await expect(page.locator('[aria-labelledby="home-terms-title"]')).toBeVisible();
  });

  // TC-L44
  test('TC-L44 positive: terms gate links to full legal policies', async ({ page }) => {
    await seedEmailUser(page, {
      email: `terms-legal-${Date.now()}@test.com`,
      password: STRONG_PASSWORD,
      name: 'Terms Legal',
      acceptTerms: false,
    });
    await page.goto(LANDING_URL);
    const terms = page.locator('[aria-labelledby="home-terms-title"]');
    await expect(terms).toBeVisible({ timeout: 8000 });
    await expect(terms.getByRole('button', { name: 'Privacy Policy' })).toBeVisible();
    await expect(terms.getByRole('button', { name: 'Refund Policy' })).toBeVisible();
    await expect(terms.getByRole('button', { name: 'Disclaimer' })).toBeVisible();
    await terms.getByRole('button', { name: 'Privacy Policy' }).click();
    await expect(page.getByRole('dialog', { name: 'Legal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    await expect(terms).toBeVisible();
  });

  // TC-L45
  test('TC-L45 positive: terms gate clears Search overlay on open', async ({ page }) => {
    await seedEmailUser(page, {
      email: `terms-clear-${Date.now()}@test.com`,
      password: STRONG_PASSWORD,
      name: 'Terms Clear',
      acceptTerms: false,
    });
    await page.goto(LANDING_URL);
    await expect(page.locator('[aria-labelledby="home-terms-title"]')).toBeVisible({ timeout: 8000 });
    const reopened = await page.evaluate(() => {
      const seen = new Set();
      const visit = (fiber) => {
        if (!fiber || seen.has(fiber)) return null;
        seen.add(fiber);
        const logic = fiber.stateNode && fiber.stateNode.logic;
        if (logic && typeof logic._maybeOpenTermsGate === 'function') return logic;
        return visit(fiber.child) || visit(fiber.sibling);
      };
      const root = document.getElementById('dc-root');
      if (!root) return false;
      for (const k of Object.keys(root)) {
        if (k.startsWith('__reactContainer') || k.startsWith('__reactFiber')) {
          let fiber = root[k];
          if (fiber && fiber.stateNode && fiber.stateNode.current) fiber = fiber.stateNode.current;
          const logic = visit(fiber);
          if (logic) {
            logic.setState({ termsOpen: false, searchOpen: true, searchQuery: 'tulsi', fConcern: 'all', fElement: 'all', fPrice: 'all' });
            logic._maybeOpenTermsGate();
            return true;
          }
        }
      }
      return false;
    });
    expect(reopened).toBe(true);
    await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
    await expect(page.locator('[aria-labelledby="home-terms-title"]')).toBeVisible();
  });

  // TC-L46
  test('TC-L46 positive: opening legal from footer closes language menu', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Language' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.locator('footer').getByRole('button', { name: 'Privacy Policy' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Language' })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('dialog', { name: 'Legal' })).toBeVisible();
  });

  // TC-L47
  test('TC-L47 positive: opening Search closes breathe widget', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Breathe with us' }).click();
    await expect(page.getByRole('dialog', { name: 'Guided breathing exercise' })).toBeVisible();
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('dialog', { name: 'Guided breathing exercise' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Breathe with us' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  });

  // TC-L48
  test('TC-L48 positive: breathe panel exposes dialog semantics and live phase', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Breathe with us' }).click();
    const dialog = page.getByRole('dialog', { name: 'Guided breathing exercise' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.locator('[aria-live="polite"]')).toContainText(/Breathe/i);
  });

  // TC-L49
  test('TC-L49 positive: mobile Shop opens Apothecary Search shelf', async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await page.goto(LANDING_URL);
    await page.locator('#ak-mobilenav').getByRole('button', { name: 'Shop' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByText('The Apothecary Shelf')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
  });

  // TC-L50
  test('TC-L50 positive: mobile Account menu anchors above bottom nav', async ({ page }) => {
    await seedEmailUser(page, {
      email: `mob-${Date.now()}@test.com`,
      password: STRONG_PASSWORD,
      name: 'Mobile User',
    });
    await page.evaluate(() => localStorage.setItem('ak_terms_accepted', '1'));
    await page.setViewportSize({ width: 840, height: 900 });
    await page.goto(LANDING_URL);
    await expect(page.locator('#ak-header-account')).toBeHidden();
    await page.locator('#ak-mobilenav').getByRole('button', { name: 'Account options' }).click();
    const menu = page.locator('[data-mobile-account-menu="true"]');
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    const navBox = await page.locator('#ak-mobilenav').boundingBox();
    expect(menuBox).toBeTruthy();
    expect(navBox).toBeTruthy();
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(navBox.y + 2);
  });

  // TC-L51
  test('TC-L51 positive: mobile Shop closes breathe widget', async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Breathe with us' }).click();
    await expect(page.getByRole('dialog', { name: 'Guided breathing exercise' })).toBeVisible();
    await page.locator('#ak-mobilenav').getByRole('button', { name: 'Shop' }).click();
    await expect(page.getByRole('dialog', { name: 'Guided breathing exercise' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  });

  // TC-L52
  test('TC-L52 positive: sound preference persists in localStorage', async ({ page }) => {
    await page.goto(LANDING_URL);
    const toggle = page.locator('#ak-sound-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Sound on');
    expect(await page.evaluate(() => localStorage.getItem('ak_sound'))).toBe('1');
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    expect(await page.evaluate(() => localStorage.getItem('ak_sound'))).toBe('0');
  });

  // TC-L53
  test('TC-L53 positive: rapid toasts show the latest message', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.locator('#dc-root')).toBeVisible({ timeout: 15000 });
    const fired = await page.evaluate(() => {
      const seen = new Set();
      const visit = (fiber) => {
        if (!fiber || seen.has(fiber)) return null;
        seen.add(fiber);
        const logic = fiber.stateNode && fiber.stateNode.logic;
        if (logic && typeof logic.showToast === 'function') return logic;
        return visit(fiber.child) || visit(fiber.sibling);
      };
      const root = document.getElementById('dc-root');
      if (root) {
        for (const k of Object.keys(root)) {
          if (k.startsWith('__reactContainer') || k.startsWith('__reactFiber')) {
            let fiber = root[k];
            if (fiber && fiber.stateNode && fiber.stateNode.current) fiber = fiber.stateNode.current;
            else if (fiber && fiber.current) fiber = fiber.current;
            const logic = visit(fiber);
            if (logic) {
              logic.showToast('First toast');
              logic.showToast('Second toast');
              return true;
            }
          }
        }
      }
      return false;
    });
    expect(fired).toBe(true);
    const toast = page.locator('#ak-toast');
    await expect(toast).toContainText('Second toast');
    await expect(toast).not.toContainText('First toast');
    await expect(toast).toHaveAttribute('aria-atomic', 'true');
  });

  // TC-L54
  test('TC-L54 positive: mobile toast sits above bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: /Instagram coming soon/i }).click();
    const toastBox = await page.locator('#ak-toast').boundingBox();
    const navBox = await page.locator('#ak-mobilenav').boundingBox();
    expect(toastBox).toBeTruthy();
    expect(navBox).toBeTruthy();
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(navBox.y + 2);
  });

  // TC-L55
  test('TC-L55 positive: dosha quiz completes, persists, and shows Vata result', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('heading', { name: 'Find Your Dosha' }).scrollIntoViewIfNeeded();
    const option = page.locator('#dosha-quiz-panel').locator('div[style*="flex-direction: column"] button');
    for (let i = 0; i < 4; i += 1) {
      await option.first().click();
    }
    await expect(page.locator('#dosha-result-panel')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vata', exact: true })).toBeVisible();
    await expect(page.locator('#ak-toast')).toContainText(/dosha result is ready/i);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_dosha') || 'null'));
    expect(stored.ans).toEqual(['vata', 'vata', 'vata', 'vata']);
    await page.reload();
    await expect(page.locator('#dosha-result-panel')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vata', exact: true })).toBeVisible();
  });

  // TC-L56
  test('TC-L56 positive: dosha back trims saved answers', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('heading', { name: 'Find Your Dosha' }).scrollIntoViewIfNeeded();
    const option = page.locator('#dosha-quiz-panel').locator('div[style*="flex-direction: column"] button');
    await option.first().click();
    await option.nth(1).click();
    await page.getByRole('button', { name: 'Previous question' }).click();
    const state = await page.evaluate(() => {
      const seen = new Set();
      const visit = (fiber) => {
        if (!fiber || seen.has(fiber)) return null;
        seen.add(fiber);
        const logic = fiber.stateNode && fiber.stateNode.logic;
        if (logic && logic.state && Object.prototype.hasOwnProperty.call(logic.state, 'doshaStep')) return logic.state;
        return visit(fiber.child) || visit(fiber.sibling);
      };
      const root = document.getElementById('dc-root');
      for (const k of Object.keys(root || {})) {
        if (k.startsWith('__reactContainer') || k.startsWith('__reactFiber')) {
          let fiber = root[k];
          if (fiber && fiber.stateNode && fiber.stateNode.current) fiber = fiber.stateNode.current;
          else if (fiber && fiber.current) fiber = fiber.current;
          const st = visit(fiber);
          if (st) return { step: st.doshaStep, ans: st.doshaAns };
        }
      }
      return null;
    });
    expect(state).toEqual({ step: 1, ans: ['vata'] });
    expect(await page.evaluate(() => localStorage.getItem('ak_dosha'))).toBeNull();
  });

  // TC-L57
  test('TC-L57 positive: dosha Browse matching rituals opens concern shelf', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('heading', { name: 'Find Your Dosha' }).scrollIntoViewIfNeeded();
    const option = page.locator('#dosha-quiz-panel').locator('div[style*="flex-direction: column"] button');
    for (let i = 0; i < 4; i += 1) {
      await option.first().click();
    }
    await page.getByRole('button', { name: 'Browse matching rituals' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('heading', { name: 'Bath & body rituals' })).toBeVisible();
  });

  // TC-L58
  test('TC-L58 positive: WhatsApp reminder normalizes phone before save', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Set My Reminder' }).scrollIntoViewIfNeeded();
    await page.locator('#reminder-contact').fill('+91 98765 43210');
    await page.getByRole('button', { name: 'Set My Reminder' }).click();
    await expect(page.locator('#ak-reminder-panel').getByText("You're all set")).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_reminder') || '{}'));
    expect(stored.contact).toBe('9876543210');
    expect(stored.channel).toBe('whatsapp');
  });

  // TC-L59
  test('TC-L59 negative: invalid newsletter email is rejected', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator('#newsletter-email').fill('not-an-email');
    await page.locator('footer button[type="submit"]').click();
    await expect(page.locator('#ak-toast')).toContainText(/valid email/i);
    await expect(page.locator('#newsletter-email')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ak_newsletter'))).toBeNull();
  });

  // TC-L60
  test('TC-L60 positive: email reminder channel persists valid address', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Set My Reminder' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Email reminder channel' }).click();
    await page.locator('#reminder-contact').fill('Remind.Me@Example.COM');
    await page.getByRole('button', { name: 'Set My Reminder' }).click();
    await expect(page.getByRole('status').filter({ hasText: "You're all set" })).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_reminder') || '{}'));
    expect(stored.contact).toBe('remind.me@example.com');
    expect(stored.channel).toBe('email');
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: /Email · remind\.me@example\.com/i })).toBeVisible();
  });

  // TC-L61
  test('TC-L61 positive: back-to-top is hidden until scroll and exposes focus state', async ({ page }) => {
    await page.goto(LANDING_URL);
    const top = page.locator('#ak-top');
    await expect(top).toHaveAttribute('aria-hidden', 'true');
    await expect(top).toHaveAttribute('tabindex', '-1');
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(top).toHaveAttribute('aria-hidden', 'false');
    await expect(top).toHaveAttribute('tabindex', '0');
  });

  // TC-L62
  test('TC-L62 positive: back-to-top closes Search overlay and scrolls home', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(page.locator('#ak-top')).toHaveAttribute('tabindex', '0');
    await page.locator('#ak-top').click();
    await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
    await expect(page.locator('#ak-vine-track')).toHaveAttribute('aria-valuenow', '0');
  });

  // TC-L63
  test('TC-L63 positive: reduced motion disables ambient motes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(LANDING_URL);
    await expect(page.locator('#dc-root')).toBeVisible({ timeout: 15000 });
    const reduced = await page.evaluate(() => {
      const seen = new Set();
      const visit = (fiber) => {
        if (!fiber || seen.has(fiber)) return null;
        seen.add(fiber);
        const logic = fiber.stateNode && fiber.stateNode.logic;
        if (logic && Object.prototype.hasOwnProperty.call(logic, '_reducedMotion')) return logic;
        return visit(fiber.child) || visit(fiber.sibling);
      };
      const root = document.getElementById('dc-root');
      for (const k of Object.keys(root || {})) {
        if (k.startsWith('__reactContainer') || k.startsWith('__reactFiber')) {
          let fiber = root[k];
          if (fiber && fiber.stateNode && fiber.stateNode.current) fiber = fiber.stateNode.current;
          else if (fiber && fiber.current) fiber = fiber.current;
          const logic = visit(fiber);
          if (logic) return { reduced: !!logic._reducedMotion, hasMoteTimer: !!logic._moteInt };
        }
      }
      return null;
    });
    expect(reduced).toEqual({ reduced: true, hasMoteTimer: false });
    await page.waitForTimeout(700);
    const motes = await page.evaluate(() => document.querySelectorAll('body > span[aria-hidden="true"]').length);
    expect(motes).toBe(0);
  });
});
