// @ts-check
const { test, expect } = require('@playwright/test');

const LANDING_URL = '/';

/** @param {import('@playwright/test').Page} page */
function searchDialog(page) {
  return page.getByRole('dialog', { name: 'Search' });
}

/** @param {import('@playwright/test').Locator} dialog @param {number} index */
function chipRow(dialog, index) {
  return dialog.locator('.searchChipRow > div').nth(index);
}

/** @param {import('@playwright/test').Page} page */
async function openSearch(page) {
  await page.getByRole('button', { name: 'Search' }).click();
  const dialog = searchDialog(page);
  await expect(dialog).toBeVisible({ timeout: 8000 });
  return dialog;
}

/** @param {import('@playwright/test').Page} page @param {string} heading */
async function openCategory(page, heading) {
  await page.getByRole('heading', { name: 'Shop by Category' }).scrollIntoViewIfNeeded();
  await page.getByRole('heading', { name: heading }).click();
  const dialog = searchDialog(page);
  await expect(dialog).toBeVisible({ timeout: 8000 });
  return dialog;
}

/** @param {import('@playwright/test').Page} page */
async function openMobileSearch(page) {
  await page.setViewportSize({ width: 840, height: 900 });
  await page.locator('#ak-mobilenav').getByRole('button', { name: 'Search' }).click();
  const dialog = searchDialog(page);
  await expect(dialog).toBeVisible({ timeout: 8000 });
  return dialog;
}

/** @param {import('@playwright/test').Page} page @param {Record<string, number>} overrides */
async function seedStock(page, overrides) {
  await page.evaluate((stock) => {
    const base = {
      sunni: 25, diabetic: 20, immunity: 30, kaphahara: 40, ashta: 35, navojas: 40,
      'kit-immunity': 15, 'kit-glow': 15, 'sample-trio': 50,
    };
    localStorage.setItem('ak_stock', JSON.stringify({ ...base, ...stock }));
  }, overrides);
}

/** @param {import('@playwright/test').Locator} dialog @param {string} name */
function productCard(dialog, name) {
  return dialog.locator('.searchCard').filter({ has: dialog.page().getByRole('heading', { name }) }).first();
}

test.describe('Search overlay — full automation (TC-SO)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      [
        'ak_cart', 'ak_wishlist', 'ak_custom_products', 'ak_hidden_ids', 'ak_stock',
        'ak_recent', 'ak_lang',
      ].forEach((k) => localStorage.removeItem(k));
    });
    await page.reload();
  });

  // ─── Open / close entry points ───────────────────────────────────────────

  test('TC-SO01 positive: header Search opens Apothecary Shelf browse mode', async ({ page }) => {
    const dialog = await openSearch(page);
    await expect(dialog.getByText('The Apothecary Shelf')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
    await expect(dialog.getByPlaceholder('Search blends, herbs, concerns…')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    await expect(dialog.locator('.searchCard').first()).toBeVisible();
  });

  test('TC-SO02 positive: Close button dismisses overlay', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByRole('button', { name: /Close/i }).click();
    await expect(searchDialog(page)).toHaveCount(0);
  });

  test('TC-SO03 positive: Escape key dismisses overlay', async ({ page }) => {
    await openSearch(page);
    await page.keyboard.press('Escape');
    await expect(searchDialog(page)).toHaveCount(0);
  });

  test('TC-SO04 positive: reopening Search after Close works', async ({ page }) => {
    let dialog = await openSearch(page);
    await dialog.getByRole('button', { name: /Close/i }).click();
    dialog = await openSearch(page);
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
  });

  test('TC-SO05 positive: nav Bath & Body opens Skin & Body shelf', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Bath & Body' }).click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('heading', { name: 'Bath & body rituals' })).toBeVisible();
  });

  test('TC-SO06 positive: nav Kashayams opens Immunity shelf', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Kashayams' }).click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('heading', { name: 'Daily defense rituals' })).toBeVisible();
  });

  test('TC-SO07 positive: nav Spiritual opens sacred blends shelf', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Spiritual' }).click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('heading', { name: 'Sacred fragrant blends' })).toBeVisible();
  });

  // ─── Category cards ──────────────────────────────────────────────────────

  test('TC-SO08 positive: Natural Bath Powders → bath rituals + Sunni Pindi', async ({ page }) => {
    const dialog = await openCategory(page, 'Natural Bath Powders');
    await expect(dialog.getByRole('heading', { name: 'Bath & body rituals' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Herbal Sunni Pindi' })).toBeVisible();
    await expect(dialog.getByText(/rituals? found/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  });

  test('TC-SO09 positive: Targeted Kashayams → metabolic shelf', async ({ page }) => {
    const dialog = await openCategory(page, 'Targeted Kashayams');
    await expect(dialog.getByRole('heading', { name: 'Targeted wellness brews' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Sugar Balance Support|Softly/i })).toBeVisible();
  });

  test('TC-SO10 positive: Daily Wellness Kashayams → immunity shelf', async ({ page }) => {
    const dialog = await openCategory(page, 'Daily Wellness Kashayams');
    await expect(dialog.getByRole('heading', { name: 'Daily defense rituals' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
  });

  test('TC-SO11 positive: Spiritual Wellness → sacred blends', async ({ page }) => {
    const dialog = await openCategory(page, 'Spiritual Wellness');
    await expect(dialog.getByRole('heading', { name: 'Sacred fragrant blends' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO12 positive: category Shop now link also opens filtered search', async ({ page }) => {
    await page.getByRole('heading', { name: 'Shop by Category' }).scrollIntoViewIfNeeded();
    await page.getByText('Shop now →').nth(1).click();
    await expect(searchDialog(page)).toBeVisible({ timeout: 8000 });
  });

  // ─── Concern chips (every button) ────────────────────────────────────────

  test('TC-SO13 positive: Concern All resets contextual title to browse', async ({ page }) => {
    const dialog = await openCategory(page, 'Spiritual Wellness');
    await chipRow(dialog, 0).getByRole('button', { name: 'All', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
  });

  test('TC-SO14 positive: Concern Immunity filters to Daily Immunity + kits', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Daily defense rituals' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
    await expect(productCard(dialog, 'Ashtagandham')).toHaveCount(0);
  });

  test('TC-SO15 positive: Concern Sugar shows Sugar Balance Support', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Targeted wellness brews' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Sugar Balance Support|Softly/i })).toBeVisible();
    await expect(productCard(dialog, 'Daily Immunity')).toHaveCount(0);
  });

  test('TC-SO16 positive: Concern Respiratory shows Kaphahara', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Respiratory', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Breath & seasonal comfort' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Kaphahara' })).toBeVisible();
  });

  test('TC-SO17 positive: Concern Digestion shows Navojas', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Digestion', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Gut comfort rituals' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Navojas' })).toBeVisible();
  });

  test('TC-SO18 positive: Concern Skin & Body shows Sunni + Glow kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Skin & Body', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Bath & body rituals' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Herbal Sunni Pindi' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Glow & Cleanse Kit' })).toBeVisible();
    await expect(productCard(dialog, 'Ashtagandham')).toHaveCount(0);
    await expect(productCard(dialog, 'Daily Immunity')).toHaveCount(0);
  });

  test('TC-SO19 positive: Concern Spiritual shows Ashtagandham only as product', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Sacred fragrant blends' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
    await expect(productCard(dialog, 'Herbal Sunni Pindi')).toHaveCount(0);
  });

  // ─── Element chips (every button) ────────────────────────────────────────

  test('TC-SO20 positive: Element Earth shows Sunni / Glow kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 1).getByRole('button', { name: 'Earth', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Herbal Sunni Pindi' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Glow & Cleanse Kit' })).toBeVisible();
  });

  test('TC-SO21 positive: Element Water shows Daily Immunity + Immunity kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 1).getByRole('button', { name: 'Water', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Immunity Ritual Kit' })).toBeVisible();
  });

  test('TC-SO22 positive: Element Fire shows Sugar Balance + Navojas', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 1).getByRole('button', { name: 'Fire', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: /Sugar Balance Support|Softly/i })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Navojas' })).toBeVisible();
  });

  test('TC-SO23 positive: Element Air shows Kaphahara', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 1).getByRole('button', { name: 'Air', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Kaphahara' })).toBeVisible();
  });

  test('TC-SO24 positive: Element Space shows Ashtagandham', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 1).getByRole('button', { name: 'Space', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO25 positive: Element All restores broader catalog', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 1).getByRole('button', { name: 'Space', exact: true }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'All', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO26 positive: Sample Trio (element All) still appears under Element Fire', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 1).getByRole('button', { name: 'Fire', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Sample Trio' })).toBeVisible();
  });

  // ─── Price chips (every button) ──────────────────────────────────────────

  test('TC-SO27 positive: Under ₹300 includes Sample Trio and excludes Immunity kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await expect(dialog.getByRole('heading', { name: 'Sample Trio' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Herbal Sunni Pindi' })).toBeVisible();
    await expect(productCard(dialog, 'Immunity Ritual Kit')).toHaveCount(0);
  });

  test('TC-SO28 positive: ₹300–400 includes Daily Immunity', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 2).getByRole('button', { name: '₹300–400' }).click();
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
    await expect(productCard(dialog, 'Sample Trio')).toHaveCount(0);
  });

  test('TC-SO29 positive: ₹400+ includes Immunity Ritual Kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 2).getByRole('button', { name: '₹400+' }).click();
    await expect(dialog.getByRole('heading', { name: 'Immunity Ritual Kit' })).toBeVisible();
    await expect(productCard(dialog, 'Sample Trio')).toHaveCount(0);
  });

  test('TC-SO30 positive: All prices restores full set', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 2).getByRole('button', { name: '₹400+' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: 'All prices' }).click();
    await expect(dialog.getByRole('heading', { name: 'Sample Trio' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Immunity Ritual Kit' })).toBeVisible();
  });

  // ─── Text search ─────────────────────────────────────────────────────────

  test('TC-SO31 positive: search by exact product name', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Navojas');
    await expect(dialog.getByRole('heading', { name: 'Navojas' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Search results' })).toBeVisible();
  });

  test('TC-SO32 positive: search is case-insensitive', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('ashtagandham');
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO33 positive: search by herb name (Tulsi)', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Tulsi');
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
  });

  test('TC-SO34 positive: search by concern keyword Spiritual', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Spiritual');
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO35 positive: search by element keyword Space', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Space');
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO36 positive: search kits by Ritual Kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Ritual Kit');
    await expect(dialog.getByRole('heading', { name: 'Immunity Ritual Kit' })).toBeVisible();
  });

  test('TC-SO37 positive: partial name Kapha matches Kaphahara', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Kapha');
    await expect(dialog.getByRole('heading', { name: 'Kaphahara' })).toBeVisible();
  });

  test('TC-SO38 positive: typing query shows Try: suggestion chips', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Kapha');
    await expect(dialog.getByText('Try:')).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('button', { name: 'Kaphahara' })).toBeVisible();
  });

  test('TC-SO39 positive: suggestion chip opens Quick View', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Navojas');
    await expect(dialog.getByText('Try:')).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Navojas' }).click();
    await expect(page.getByRole('dialog', { name: /quick view/i })).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO40 negative: nonsense query shows empty state', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('zzzz-not-a-real-blend-999');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('.searchCard')).toHaveCount(0);
  });

  test('TC-SO41 positive: Show all rituals recovers from empty state', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('zzzz-not-a-real-blend-999');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Show all rituals' }).click();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
    await expect(dialog.locator('.searchCard').first()).toBeVisible();
  });

  // ─── Combined filters (positive + negative) ──────────────────────────────

  test('TC-SO42 positive: Immunity + Water still shows Daily Immunity', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Water' }).click();
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
  });

  test('TC-SO43 negative: Sugar + Earth yields empty (no match)', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Earth' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO44 negative: Spiritual + Under ₹300 ok; Spiritual + ₹400+ empty', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
    await chipRow(dialog, 2).getByRole('button', { name: '₹400+' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO45 negative: query + conflicting concern empties results', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual' }).click();
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Sunni');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO46 positive: Digestion + Fire + Under ₹300 shows Navojas', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Digestion' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Fire' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await expect(dialog.getByRole('heading', { name: 'Navojas' })).toBeVisible();
  });

  test('TC-SO47 positive: Clear filters resets concern+element+price+query', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Fire' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: '₹300–400' }).click();
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Balance');
    await dialog.getByRole('button', { name: 'Clear filters' }).click();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
    await expect(dialog.getByPlaceholder('Search blends, herbs, concerns…')).toHaveValue('');
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
  });

  // ─── Card content & actions ──────────────────────────────────────────────

  test('TC-SO48 positive: card shows concern, element, benefit, View, Add', async ({ page }) => {
    const dialog = await openCategory(page, 'Natural Bath Powders');
    const card = productCard(dialog, 'Herbal Sunni Pindi');
    await expect(card.getByText('Skin & Body')).toBeVisible();
    await expect(card.getByText(/Earth/)).toBeVisible();
    await expect(card.getByText(/Gentle herbal cleansing/i)).toBeVisible();
    await expect(card.getByRole('button', { name: 'View' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Add to Cart' })).toBeVisible();
  });

  test('TC-SO49 positive: herb chips render on card', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Daily Immunity');
    const card = productCard(dialog, 'Daily Immunity');
    await expect(card.getByText('Tulsi', { exact: true }).first()).toBeVisible();
    await expect(card.getByText('Pepper', { exact: true }).first()).toBeVisible();
  });

  test('TC-SO50 positive: photo product shows real image thumb', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Kaphahara');
    const card = productCard(dialog, 'Kaphahara');
    await expect(card.locator('img[alt="Kaphahara"]')).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO51 positive: no-photo product uses jar mockup (no broken img)', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Ashtagandham');
    const card = productCard(dialog, 'Ashtagandham');
    await expect(card.locator('.searchJar')).toBeVisible();
    await expect(card.locator('img')).toHaveCount(0);
  });

  test('TC-SO52 positive: sized product shows Choose Size and opens Quick View', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Kaphahara');
    const card = productCard(dialog, 'Kaphahara');
    await expect(card.getByRole('button', { name: 'Choose Size' })).toBeVisible();
    await card.getByRole('button', { name: 'Choose Size' }).click();
    await expect(page.getByRole('dialog', { name: /quick view/i })).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO53 positive: View opens Quick View', async ({ page }) => {
    const dialog = await openCategory(page, 'Natural Bath Powders');
    await productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('dialog', { name: /quick view/i })).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO54 positive: Add to Cart from search updates localStorage + toast', async ({ page }) => {
    const dialog = await openCategory(page, 'Natural Bath Powders');
    await productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
    const cartCount = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ak_cart') || '{}')).length);
    expect(cartCount).toBeGreaterThan(0);
  });

  test('TC-SO55 positive: wishlist heart from search card persists', async ({ page }) => {
    const dialog = await openCategory(page, 'Natural Bath Powders');
    await productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Wishlist' }).click();
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('ak_wishlist') || '{}')).length > 0);
    const wished = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_wishlist') || '{}'));
    expect(wished.sunni || wished['sunni']).toBeTruthy();
  });

  test('TC-SO56 negative: out-of-stock card shows badge and blocks add', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_stock', JSON.stringify({
        sunni: 0, diabetic: 20, immunity: 30, kaphahara: 40, ashta: 35, navojas: 40,
        'kit-immunity': 15, 'kit-glow': 15, 'sample-trio': 50,
      }));
      localStorage.removeItem('ak_cart');
    });
    await page.reload();
    const dialog = await openCategory(page, 'Natural Bath Powders');
    const card = productCard(dialog, 'Herbal Sunni Pindi');
    await expect(card.getByRole('button', { name: 'Out of stock' })).toBeVisible();
    await card.getByRole('button', { name: 'Out of stock' }).click();
    await expect(page.getByText(/Out of stock — ask the owner to restock/i)).toBeVisible({ timeout: 8000 });
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_cart') || '{}'));
    expect(Object.keys(cart).length).toBe(0);
  });

  test('TC-SO57 positive: result count text updates with filters', async ({ page }) => {
    const dialog = await openSearch(page);
    await expect(dialog.getByText(/rituals? found/i)).toBeVisible();
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual' }).click();
    await expect(dialog.getByText(/1 ritual found/i)).toBeVisible();
  });

  // ─── Catalog integrity / admin sync edges ────────────────────────────────

  test('TC-SO58 negative: hidden built-in product card itself is gone', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('ak_hidden_ids', JSON.stringify(['ashta'])));
    await page.reload();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible({ timeout: 8000 });
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual', exact: true }).click();
    // Spiritual concern alone used to show Ashtagandham; hidden SKU must not render as a card
    await expect(productCard(dialog, 'Ashtagandham')).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO59 positive: published custom product appears in search', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-forest-rose',
        name: 'Forest Rose Scrub',
        sub: 'Body Scrub',
        element: 'Earth',
        concern: 'Skin & Body',
        priceN: 279,
        listPriceN: 279,
        discountPct: 0,
        jar: '#D9BE9C',
        cap: '#A06437',
        benefit: 'A rose-scented scrub for soft skin.',
        herbs: ['Rose', 'Gram'],
        tag: 'New',
        active: true,
        stock: 12,
      }]));
      const stock = JSON.parse(localStorage.getItem('ak_stock') || '{}');
      stock['custom-forest-rose'] = 12;
      localStorage.setItem('ak_stock', JSON.stringify(stock));
    });
    await page.reload();
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Forest Rose');
    await expect(dialog.getByRole('heading', { name: 'Forest Rose Scrub' })).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO60 negative: inactive custom product stays off search', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-draft',
        name: 'Hidden Draft Blend',
        sub: 'Kashayam',
        element: 'Water',
        concern: 'Immunity',
        priceN: 199,
        jar: '#BCC8A2',
        cap: '#5E7A4C',
        benefit: 'Draft only',
        herbs: ['Tulsi'],
        tag: 'Draft',
        active: false,
        stock: 5,
      }]));
    });
    await page.reload();
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Hidden Draft Blend');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  // ─── Complex multi-step flows ────────────────────────────────────────────

  test('TC-SO61 complex: category → price → clear → add → close', async ({ page }) => {
    const dialog = await openCategory(page, 'Daily Wellness Kashayams');
    await expect(dialog.getByRole('heading', { name: 'Daily defense rituals' })).toBeVisible();
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await dialog.getByRole('button', { name: 'Clear filters' }).click();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
    await productCard(dialog, 'Daily Immunity').getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
    await dialog.getByRole('button', { name: /Close/i }).click();
    await expect(searchDialog(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Shop by Category' })).toBeVisible();
  });

  test('TC-SO62 complex: nav → element → query → suggestion → QV → Escape search still open then Close', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Kashayams' }).click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await chipRow(dialog, 1).getByRole('button', { name: 'Water' }).click();
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Immun');
    await expect(dialog.getByText('Try:')).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Daily Immunity' }).click();
    const qv = page.getByRole('dialog', { name: /quick view/i });
    await expect(qv).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(qv).toHaveCount(0);
    await expect(searchDialog(page)).toBeVisible();
    await dialog.getByRole('button', { name: /Close/i }).click();
    await expect(searchDialog(page)).toHaveCount(0);
  });

  test('TC-SO63 complex: impossible combo → Show all → wishlist → add kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Earth' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Show all rituals' }).click();
    await productCard(dialog, 'Ashtagandham').getByRole('button', { name: 'Wishlist' }).click();
    await productCard(dialog, 'Immunity Ritual Kit').getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
    const state = await page.evaluate(() => ({
      wish: JSON.parse(localStorage.getItem('ak_wishlist') || '{}'),
      cart: JSON.parse(localStorage.getItem('ak_cart') || '{}'),
    }));
    expect(state.wish.ashta || state.wish['ashta']).toBeTruthy();
    expect(Object.keys(state.cart).some((k) => k.startsWith('kit-immunity'))).toBeTruthy();
  });

  test('TC-SO64 complex: switch all concerns in sequence without crash', async ({ page }) => {
    const dialog = await openSearch(page);
    const concerns = ['Immunity', 'Sugar', 'Respiratory', 'Digestion', 'Skin & Body', 'Spiritual', 'All'];
    for (const c of concerns) {
      await chipRow(dialog, 0).getByRole('button', { name: c, exact: true }).click();
      await expect(dialog).toBeVisible();
    }
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
    await expect(dialog.locator('.searchCard').first()).toBeVisible();
  });

  test('TC-SO65 complex: switch all elements then all prices in sequence', async ({ page }) => {
    const dialog = await openSearch(page);
    for (const e of ['Earth', 'Water', 'Fire', 'Air', 'Space', 'All']) {
      await chipRow(dialog, 1).getByRole('button', { name: e, exact: true }).click();
      await expect(dialog).toBeVisible();
    }
    for (const p of ['Under ₹300', '₹300–400', '₹400+', 'All prices']) {
      await chipRow(dialog, 2).getByRole('button', { name: p }).click();
      await expect(dialog).toBeVisible();
    }
    await expect(dialog.locator('.searchCard').first()).toBeVisible();
  });

  test('TC-SO66 complex: OOS product recovers after restock mid-session', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_stock', JSON.stringify({
        sunni: 0, diabetic: 20, immunity: 30, kaphahara: 40, ashta: 35, navojas: 40,
        'kit-immunity': 15, 'kit-glow': 15, 'sample-trio': 50,
      }));
    });
    await page.reload();
    let dialog = await openCategory(page, 'Natural Bath Powders');
    await expect(productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Out of stock' })).toBeVisible();
    await dialog.getByRole('button', { name: /Close/i }).click();

    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ak_stock') || '{}');
      s.sunni = 25;
      localStorage.setItem('ak_stock', JSON.stringify(s));
    });
    await page.reload();
    dialog = await openCategory(page, 'Natural Bath Powders');
    const card = productCard(dialog, 'Herbal Sunni Pindi');
    await expect(card.getByRole('button', { name: 'Add to Cart' })).toBeVisible();
    await card.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO67 complex: search → View → close QV → Add still works on same card', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Daily Immunity');
    const card = productCard(dialog, 'Daily Immunity');
    await card.getByRole('button', { name: 'View' }).click();
    const qv = page.getByRole('dialog', { name: /quick view/i });
    await expect(qv).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(qv).toHaveCount(0);
    await expect(searchDialog(page)).toBeVisible();
    await card.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO68 complex: category filter survives until Clear; then nav reopen is fresh concern', async ({ page }) => {
    let dialog = await openCategory(page, 'Spiritual Wellness');
    await expect(dialog.getByRole('heading', { name: 'Sacred fragrant blends' })).toBeVisible();
    await dialog.getByRole('button', { name: /Close/i }).click();
    await page.getByRole('navigation').getByRole('link', { name: 'Bath & Body' }).click();
    dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('heading', { name: 'Bath & body rituals' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Herbal Sunni Pindi' })).toBeVisible();
  });

  // ─── Extended entry points & subtitles (TC-SO69–84) ───────────────────────

  test('TC-SO69 positive: mobile bottom nav Search opens overlay', async ({ page }) => {
    const dialog = await openMobileSearch(page);
    await expect(dialog.getByText('The Apothecary Shelf')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
  });

  test('TC-SO70 positive: first Shop now link opens Skin & Body shelf', async ({ page }) => {
    await page.getByRole('heading', { name: 'Shop by Category' }).scrollIntoViewIfNeeded();
    await page.getByText('Shop now →').first().click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('heading', { name: 'Bath & body rituals' })).toBeVisible();
  });

  test('TC-SO71 positive: third Shop now link opens Immunity shelf', async ({ page }) => {
    await page.getByRole('heading', { name: 'Shop by Category' }).scrollIntoViewIfNeeded();
    await page.getByText('Shop now →').nth(2).click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('heading', { name: 'Daily defense rituals' })).toBeVisible();
  });

  test('TC-SO72 positive: fourth Shop now link opens Spiritual shelf', async ({ page }) => {
    await page.getByRole('heading', { name: 'Shop by Category' }).scrollIntoViewIfNeeded();
    await page.getByText('Shop now →').nth(3).click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await expect(dialog.getByRole('heading', { name: 'Sacred fragrant blends' })).toBeVisible();
  });

  test('TC-SO73 positive: browse mode shows collection subtitle', async ({ page }) => {
    const dialog = await openSearch(page);
    await expect(dialog.getByText(/Filter by concern, element, or price/i)).toBeVisible();
  });

  test('TC-SO74 positive: Immunity concern shows defense subtitle', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity', exact: true }).click();
    await expect(dialog.getByText(/Tulsi, pepper and time-tested herbs/i)).toBeVisible();
  });

  test('TC-SO75 positive: Sugar concern shows metabolic subtitle', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar', exact: true }).click();
    await expect(dialog.getByText(/Traditional kashayams for everyday metabolic balance/i)).toBeVisible();
  });

  test('TC-SO76 positive: Respiratory concern shows breath subtitle', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Respiratory', exact: true }).click();
    await expect(dialog.getByText(/respiratory wellness rituals/i)).toBeVisible();
  });

  test('TC-SO77 positive: Digestion concern shows gut subtitle', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Digestion', exact: true }).click();
    await expect(dialog.getByText(/everyday gut balance/i)).toBeVisible();
  });

  test('TC-SO78 positive: Skin & Body concern shows bath subtitle', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Skin & Body', exact: true }).click();
    await expect(dialog.getByText(/Herbal Sunni Pindi and gentle chemical-free cleansing/i)).toBeVisible();
  });

  test('TC-SO79 positive: Spiritual concern shows sacred subtitle', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual', exact: true }).click();
    await expect(dialog.getByText(/Ashtagandham and ritual powders/i)).toBeVisible();
  });

  test('TC-SO80 positive: active query shows Search results title + quoted subtitle', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Navojas');
    await expect(dialog.getByRole('heading', { name: 'Search results' })).toBeVisible();
    await expect(dialog.getByText(/Showing blends matching “Navojas”/i)).toBeVisible();
  });

  test('TC-SO81 negative: whitespace-only query keeps browse mode', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('     ');
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
  });

  test('TC-SO82 positive: trimmed query matches despite leading/trailing spaces', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('  kaphahara  ');
    await expect(dialog.getByRole('heading', { name: 'Kaphahara' })).toBeVisible();
  });

  test('TC-SO83 negative: benefit-only keyword cleansing does not search (name/herbs only)', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('cleansing');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO84 positive: search by subcategory Bath Powder', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Bath Powder');
    await expect(dialog.getByRole('heading', { name: 'Herbal Sunni Pindi' })).toBeVisible();
  });

  // ─── Extended search & suggestions (TC-SO85–96) ────────────────────────────

  test('TC-SO85 negative: product tag Ayurvedic alone is not searchable', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Ayurvedic');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO86 positive: search Bundle shows ritual kits', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Bundle');
    await expect(dialog.getByRole('heading', { name: 'Immunity Ritual Kit' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Glow & Cleanse Kit' })).toBeVisible();
  });

  test('TC-SO87 positive: search Glow shows Glow & Cleanse Kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Glow');
    await expect(dialog.getByRole('heading', { name: 'Glow & Cleanse Kit' })).toBeVisible();
  });

  test('TC-SO88 positive: search Sample shows Sample Trio', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Sample');
    await expect(dialog.getByRole('heading', { name: 'Sample Trio' })).toBeVisible();
  });

  test('TC-SO89 negative: gibberish partial shows no Try suggestions', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('xyzzzz');
    await expect(dialog.getByText('Try:')).toHaveCount(0);
  });

  test('TC-SO90 positive: broad partial shows up to four Try name suggestions', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Ka');
    await expect(dialog.getByText('Try:')).toBeVisible({ timeout: 5000 });
    const tryButtons = dialog.locator('button').filter({ hasText: /Kaphahara|Navojas|Daily Immunity|Ashtagandham|Sunni|Glow|Sample|Sugar/i });
    await expect(tryButtons.first()).toBeVisible();
    expect(await tryButtons.count()).toBeLessThanOrEqual(4);
  });

  test('TC-SO91 positive: clearing query removes Try suggestions', async ({ page }) => {
    const dialog = await openSearch(page);
    const input = dialog.getByPlaceholder('Search blends, herbs, concerns…');
    await input.fill('Kapha');
    await expect(dialog.getByText('Try:')).toBeVisible({ timeout: 5000 });
    await input.fill('');
    await expect(dialog.getByText('Try:')).toHaveCount(0);
  });

  test('TC-SO92 positive: search turmeric matches Sunni Pindi herbs', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('turmeric');
    await expect(dialog.getByRole('heading', { name: 'Herbal Sunni Pindi' })).toBeVisible();
  });

  test('TC-SO93 positive: search sandalwood matches Ashtagandham', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('sandalwood');
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO94 positive: search fenugreek matches Sugar Balance Support', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('fenugreek');
    await expect(dialog.getByRole('heading', { name: /Sugar Balance Support|Softly/i })).toBeVisible();
  });

  test('TC-SO95 positive: deleting query mid-type updates results live', async ({ page }) => {
    const dialog = await openSearch(page);
    const input = dialog.getByPlaceholder('Search blends, herbs, concerns…');
    await input.fill('Navojas');
    await expect(dialog.getByRole('heading', { name: 'Navojas' })).toBeVisible();
    await input.fill('Nav');
    await expect(dialog.getByRole('heading', { name: 'Navojas' })).toBeVisible();
    await input.fill('');
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
  });

  test('TC-SO96 positive: query with Clear filters button visible when typing', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Immunity');
    await expect(dialog.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  });

  // ─── Extended filter matrix negatives (TC-SO97–106) ────────────────────────

  test('TC-SO97 positive: Immunity + Space still shows Sample Trio (element All)', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Space' }).click();
    await expect(dialog.getByRole('heading', { name: 'Sample Trio' })).toBeVisible();
    await expect(productCard(dialog, 'Ashtagandham')).toHaveCount(0);
  });

  test('TC-SO98 negative: Respiratory + Earth yields empty', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Respiratory' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Earth' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO99 negative: Digestion + Water yields empty', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Digestion' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Water' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO100 negative: Skin & Body + Fire yields empty', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Skin & Body' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Fire' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO101 negative: Sugar + Air yields empty', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Air' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO102 negative: Spiritual + Water yields empty', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Water' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO103 positive: Immunity + Under ₹300 includes Sample Trio', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await expect(dialog.getByRole('heading', { name: 'Sample Trio' })).toBeVisible();
  });

  test('TC-SO104 positive: Respiratory + Air + Under ₹300 shows Kaphahara', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Respiratory' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Air' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await expect(dialog.getByRole('heading', { name: 'Kaphahara' })).toBeVisible();
  });

  test('TC-SO105 positive: Skin & Body + Earth + ₹300–400 shows Glow kit', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Skin & Body' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Earth' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: '₹300–400' }).click();
    await expect(dialog.getByRole('heading', { name: 'Glow & Cleanse Kit' })).toBeVisible();
  });

  test('TC-SO106 positive: Sugar + Fire + ₹300–400 shows Sugar Balance Support', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Fire' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: '₹300–400' }).click();
    await expect(dialog.getByRole('heading', { name: /Sugar Balance Support|Softly/i })).toBeVisible();
  });

  // ─── Card actions & stock edges (TC-SO107–118) ───────────────────────────

  test('TC-SO107 positive: card shows product tag badge', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Daily Immunity');
    const card = productCard(dialog, 'Daily Immunity');
    await expect(card.getByText('100% Natural').first()).toBeVisible();
  });

  test('TC-SO108 positive: sized product shows from price on card', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Kaphahara');
    const card = productCard(dialog, 'Kaphahara');
    await expect(card.getByText(/from ₹199/i)).toBeVisible();
  });

  test('TC-SO109 positive: Navojas photo thumb renders in search', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Navojas');
    await expect(productCard(dialog, 'Navojas').locator('img[alt="Navojas"]')).toBeVisible();
  });

  test('TC-SO110 positive: wishlist toggle off removes product from storage', async ({ page }) => {
    const dialog = await openCategory(page, 'Natural Bath Powders');
    const heart = productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Wishlist' });
    await heart.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ak_wishlist') || '{}').sunni);
    await heart.click();
    const wished = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_wishlist') || '{}'));
    expect(wished.sunni).toBeFalsy();
  });

  test('TC-SO111 positive: double Add to Cart increments quantity in cart', async ({ page }) => {
    const dialog = await openCategory(page, 'Natural Bath Powders');
    const addBtn = productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Add to Cart' });
    await addBtn.click();
    await addBtn.click();
    const qty = await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('ak_cart') || '{}');
      const line = cart['sunni::std'];
      return line ? line.qty : 0;
    });
    expect(qty).toBe(2);
  });

  test('TC-SO112 negative: stock limit 1 blocks second add with toast', async ({ page }) => {
    await seedStock(page, { sunni: 1 });
    await page.reload();
    const dialog = await openCategory(page, 'Natural Bath Powders');
    const addBtn = productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Add to Cart' });
    await addBtn.click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
    await addBtn.click();
    await expect(page.getByText(/Only 1 left in stock/i)).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO113 negative: OOS sized product shows Out of stock on card', async ({ page }) => {
    await seedStock(page, { kaphahara: 0 });
    await page.reload();
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Kaphahara');
    await expect(productCard(dialog, 'Kaphahara').getByRole('button', { name: 'Out of stock' })).toBeVisible();
  });

  test('TC-SO114 positive: Add to Cart opens cart drawer', async ({ page }) => {
    const dialog = await openCategory(page, 'Natural Bath Powders');
    await productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByRole('dialog', { name: 'Your Cart' })).toBeVisible({ timeout: 8000 });
    await expect(searchDialog(page)).toBeVisible();
  });

  test('TC-SO115 positive: plural result count for multiple matches', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity' }).click();
    await expect(dialog.getByText(/rituals found/i)).toBeVisible();
    expect(await dialog.locator('.searchCard').count()).toBeGreaterThan(1);
  });

  test('TC-SO116 positive: bundle card shows Best Value tag', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Immunity Ritual Kit');
    await expect(productCard(dialog, 'Immunity Ritual Kit').getByText('Best Value').first()).toBeVisible();
  });

  test('TC-SO117 positive: search card has searchCard class for animation', async ({ page }) => {
    const dialog = await openSearch(page);
    await expect(dialog.locator('.searchCard').first()).toHaveClass(/searchCard/);
  });

  test('TC-SO118 positive: dialog exposes aria-modal for accessibility', async ({ page }) => {
    const dialog = await openSearch(page);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  // ─── Catalog / admin sync edges (TC-SO119–128) ───────────────────────────

  test('TC-SO119 negative: hide Sunni still shows Glow kit under Skin & Body', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('ak_hidden_ids', JSON.stringify(['sunni'])));
    await page.reload();
    const dialog = await openCategory(page, 'Natural Bath Powders');
    await expect(productCard(dialog, 'Herbal Sunni Pindi')).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Glow & Cleanse Kit' })).toBeVisible();
  });

  test('TC-SO120 negative: hide multiple SKUs reduces visible cards', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('ak_hidden_ids', JSON.stringify(['sunni', 'ashta', 'diabetic'])));
    await page.reload();
    const dialog = await openSearch(page);
    expect(await dialog.locator('.searchCard').count()).toBeLessThan(9);
  });

  test('TC-SO121 negative: hidden SKU still findable via kit herb text in search', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('ak_hidden_ids', JSON.stringify(['immunity'])));
    await page.reload();
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Daily Immunity');
    // Hidden single is gone, but Immunity Ritual Kit lists Daily Immunity in searchable herbs
    await expect(productCard(dialog, 'Daily Immunity')).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Immunity Ritual Kit' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO122 positive: custom product with discount shows strikethrough list price', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-sale',
        name: 'Monsoon Mist Scrub',
        sub: 'Scrub',
        element: 'Water',
        concern: 'Skin & Body',
        priceN: 180,
        listPriceN: 200,
        discountPct: 10,
        jar: '#BCC8A2',
        cap: '#5E7A4C',
        benefit: 'Cooling seasonal scrub.',
        herbs: ['Neem', 'Tulsi'],
        tag: 'Sale',
        active: true,
        stock: 8,
      }]));
      const stock = JSON.parse(localStorage.getItem('ak_stock') || '{}');
      stock['custom-sale'] = 8;
      localStorage.setItem('ak_stock', JSON.stringify(stock));
    });
    await page.reload();
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Monsoon Mist');
    const card = productCard(dialog, 'Monsoon Mist Scrub');
    await expect(card.getByText('₹200')).toBeVisible();
    await expect(card.getByText('₹180')).toBeVisible();
  });

  test('TC-SO123 positive: custom product appears under matching concern filter', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-rose',
        name: 'Rose Ubtan',
        sub: 'Ubtan',
        element: 'Earth',
        concern: 'Skin & Body',
        priceN: 229,
        listPriceN: 229,
        discountPct: 0,
        jar: '#D9BE9C',
        cap: '#A06437',
        benefit: 'Rose ubtan for glow.',
        herbs: ['Rose'],
        tag: 'New',
        active: true,
        stock: 6,
      }]));
    });
    await page.reload();
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Skin & Body' }).click();
    await expect(dialog.getByRole('heading', { name: 'Rose Ubtan' })).toBeVisible();
  });

  test('TC-SO124 negative: custom OOS product shows Out of stock in search', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-oos',
        name: 'Sold Out Serum',
        sub: 'Serum',
        element: 'Water',
        concern: 'Immunity',
        priceN: 299,
        listPriceN: 299,
        discountPct: 0,
        jar: '#BCC8A2',
        cap: '#5E7A4C',
        benefit: 'Temporarily unavailable.',
        herbs: ['Tulsi'],
        tag: 'New',
        active: true,
        stock: 0,
      }]));
      localStorage.setItem('ak_stock', JSON.stringify({ 'custom-oos': 0 }));
    });
    await page.reload();
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Sold Out Serum');
    await expect(productCard(dialog, 'Sold Out Serum').getByRole('button', { name: 'Out of stock' })).toBeVisible();
  });

  test('TC-SO125 negative: hide ashta + Spiritual filter shows empty not crash', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('ak_hidden_ids', JSON.stringify(['ashta'])));
    await page.reload();
    const dialog = await openCategory(page, 'Spiritual Wellness');
    await expect(productCard(dialog, 'Ashtagandham')).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO126 positive: custom + built-in both visible in browse', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-extra',
        name: 'Extra Glow Powder',
        sub: 'Powder',
        element: 'Earth',
        concern: 'Skin & Body',
        priceN: 199,
        listPriceN: 199,
        discountPct: 0,
        jar: '#D9BE9C',
        cap: '#A06437',
        benefit: 'Extra glow.',
        herbs: ['Turmeric'],
        tag: 'New',
        active: true,
        stock: 10,
      }]));
    });
    await page.reload();
    const dialog = await openSearch(page);
    await expect(dialog.getByRole('heading', { name: 'Herbal Sunni Pindi' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Extra Glow Powder' })).toBeVisible();
  });

  test('TC-SO127 negative: inactive custom ignored even if name searched', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_custom_products', JSON.stringify([{
        id: 'custom-off',
        name: 'Ghost Blend',
        sub: 'Powder',
        element: 'Air',
        concern: 'Respiratory',
        priceN: 199,
        jar: '#D6BA8D',
        cap: '#A8894E',
        benefit: 'Inactive.',
        herbs: ['Tulsi'],
        tag: 'Draft',
        active: false,
        stock: 5,
      }]));
    });
    await page.reload();
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Ghost Blend');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO128 positive: hidden immunity kit still hidden from Immunity concern', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('ak_hidden_ids', JSON.stringify(['kit-immunity'])));
    await page.reload();
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity' }).click();
    await expect(productCard(dialog, 'Immunity Ritual Kit')).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
  });

  // ─── Complex edge flows (TC-SO129–150) ───────────────────────────────────

  test('TC-SO129 complex: rapid open/close search five times without crash', async ({ page }) => {
    for (let i = 0; i < 5; i += 1) {
      const dialog = await openSearch(page);
      await dialog.getByRole('button', { name: /Close/i }).click();
      await expect(searchDialog(page)).toHaveCount(0);
    }
  });

  test('TC-SO130 complex: concern switch while query active updates title dynamically', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Immunity');
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity' }).click();
    await expect(dialog.getByRole('heading', { name: 'Daily defense rituals' })).toBeVisible();
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual' }).click();
    await expect(dialog.getByRole('heading', { name: 'Sacred fragrant blends' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
  });

  test('TC-SO131 complex: add three different products from search in one session', async ({ page }) => {
    const dialog = await openSearch(page);
    await productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Add to Cart' }).click();
    await productCard(dialog, 'Daily Immunity').getByRole('button', { name: 'Add to Cart' }).click();
    await productCard(dialog, 'Ashtagandham').getByRole('button', { name: 'Add to Cart' }).click();
    const keys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ak_cart') || '{}')));
    expect(keys.length).toBeGreaterThanOrEqual(3);
  });

  test('TC-SO132 complex: nav Bath → Earth → Under ₹300 → add Sunni → close', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Bath & Body' }).click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await chipRow(dialog, 1).getByRole('button', { name: 'Earth' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await productCard(dialog, 'Herbal Sunni Pindi').getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
    await dialog.getByRole('button', { name: /Close/i }).click();
    await expect(searchDialog(page)).toHaveCount(0);
  });

  test('TC-SO133 complex: impossible filters → Show all → Spiritual → add Ashtagandham', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Earth' }).click();
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Show all rituals' }).click();
    await chipRow(dialog, 0).getByRole('button', { name: 'Spiritual' }).click();
    await productCard(dialog, 'Ashtagandham').getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO134 complex: View from search then Add from Quick View', async ({ page }) => {
    const dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Daily Immunity');
    await productCard(dialog, 'Daily Immunity').getByRole('button', { name: 'View' }).click();
    const qv = page.getByRole('dialog', { name: 'Product quick view' });
    await expect(qv).toBeVisible({ timeout: 8000 });
    await qv.getByRole('button', { name: /Add to Cart/i }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO135 complex: respiratory filter → Kaphahara Choose Size → pick 250g in QV', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Respiratory' }).click();
    await productCard(dialog, 'Kaphahara').getByRole('button', { name: 'Choose Size' }).click();
    const qv = page.getByRole('dialog', { name: 'Product quick view' });
    await expect(qv).toBeVisible({ timeout: 8000 });
    await qv.getByRole('button', { name: /250g/i }).click();
    await qv.getByRole('button', { name: /Add to Cart/i }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO136 complex: wishlist two products then verify count badge', async ({ page }) => {
    const dialog = await openSearch(page);
    await productCard(dialog, 'Daily Immunity').getByRole('button', { name: 'Wishlist' }).click();
    await productCard(dialog, 'Navojas').getByRole('button', { name: 'Wishlist' }).click();
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('ak_wishlist') || '{}')).length >= 2);
    const count = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ak_wishlist') || '{}')).length);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('TC-SO137 complex: all filters + query then Clear restores full browse', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Digestion' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Fire' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Nav');
    await expect(dialog.getByRole('heading', { name: 'Navojas' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Clear filters' }).click();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
  });

  test('TC-SO138 complex: OOS kit recovers after restock and adds successfully', async ({ page }) => {
    await seedStock(page, { 'kit-glow': 0 });
    await page.reload();
    let dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Glow');
    await expect(productCard(dialog, 'Glow & Cleanse Kit').getByRole('button', { name: 'Out of stock' })).toBeVisible();
    await dialog.getByRole('button', { name: /Close/i }).click();
    await seedStock(page, { 'kit-glow': 5 });
    await page.reload();
    dialog = await openSearch(page);
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Glow');
    await productCard(dialog, 'Glow & Cleanse Kit').getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
  });

  test('TC-SO139 complex: Escape closes QV only; second Escape closes search', async ({ page }) => {
    const dialog = await openSearch(page);
    await productCard(dialog, 'Daily Immunity').getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('dialog', { name: /quick view/i })).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /quick view/i })).toHaveCount(0);
    await expect(searchDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(searchDialog(page)).toHaveCount(0);
  });

  test('TC-SO140 complex: mobile viewport category click add close full flow', async ({ page }) => {
    await page.setViewportSize({ width: 840, height: 900 });
    await page.getByRole('heading', { name: 'Shop by Category' }).scrollIntoViewIfNeeded();
    await page.getByRole('heading', { name: 'Targeted Kashayams' }).click();
    const dialog = searchDialog(page);
    await expect(dialog).toBeVisible({ timeout: 8000 });
    const card = dialog.locator('.searchCard').filter({ has: page.getByRole('heading', { name: /Sugar Balance Support|Softly/i }) }).first();
    await card.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
    await dialog.getByRole('button', { name: /Close/i }).click();
    await expect(searchDialog(page)).toHaveCount(0);
  });

  test('TC-SO141 complex: price ladder Under → mid → high updates cards each step', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    await expect(productCard(dialog, 'Sample Trio')).toBeVisible();
    await chipRow(dialog, 2).getByRole('button', { name: '₹300–400' }).click();
    await expect(productCard(dialog, 'Daily Immunity')).toBeVisible();
    await chipRow(dialog, 2).getByRole('button', { name: '₹400+' }).click();
    await expect(productCard(dialog, 'Immunity Ritual Kit')).toBeVisible();
  });

  test('TC-SO142 complex: search while concern active respects both filters', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity' }).click();
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Sample');
    await expect(dialog.getByRole('heading', { name: 'Sample Trio' })).toBeVisible();
    await expect(productCard(dialog, 'Ashtagandham')).toHaveCount(0);
  });

  test('TC-SO143 complex: close search reopen preserves last category concern filter', async ({ page }) => {
    let dialog = await openCategory(page, 'Spiritual Wellness');
    await dialog.getByRole('button', { name: /Close/i }).click();
    dialog = await openSearch(page);
    await expect(dialog.getByPlaceholder('Search blends, herbs, concerns…')).toHaveValue('');
    await expect(dialog.getByRole('heading', { name: 'Sacred fragrant blends' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO144 complex: add from search with cart already containing item merges qty', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ak_cart', JSON.stringify({
        'immunity::std': { productId: 'immunity', qty: 1, subscribe: false, size: null, sizePrice: null },
      }));
    });
    await page.reload();
    const dialog = await openSearch(page);
    await productCard(dialog, 'Daily Immunity').getByRole('button', { name: 'Add to Cart' }).click();
    const qty = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_cart') || '{}')['immunity::std'].qty);
    expect(qty).toBe(2);
  });

  test('TC-SO145 complex: Spiritual → Under ₹300 → add → wishlist same card', async ({ page }) => {
    const dialog = await openCategory(page, 'Spiritual Wellness');
    await chipRow(dialog, 2).getByRole('button', { name: 'Under ₹300' }).click();
    const card = productCard(dialog, 'Ashtagandham');
    await card.getByRole('button', { name: 'Add to Cart' }).click();
    await card.getByRole('button', { name: 'Wishlist' }).click();
    const state = await page.evaluate(() => ({
      cart: JSON.parse(localStorage.getItem('ak_cart') || '{}'),
      wish: JSON.parse(localStorage.getItem('ak_wishlist') || '{}'),
    }));
    expect(Object.keys(state.cart).some((k) => k.startsWith('ashta'))).toBeTruthy();
    expect(state.wish.ashta || state.wish['ashta']).toBeTruthy();
  });

  test('TC-SO146 complex: hide ashta → show all rituals after spiritual empty still works', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('ak_hidden_ids', JSON.stringify(['ashta'])));
    await page.reload();
    const dialog = await openCategory(page, 'Spiritual Wellness');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Show all rituals' }).click();
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
    await expect(dialog.locator('.searchCard').first()).toBeVisible();
  });

  test('TC-SO147 complex: element All after narrow filter restores cross-element results', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 1).getByRole('button', { name: 'Space' }).click();
    await expect(productCard(dialog, 'Daily Immunity')).toHaveCount(0);
    await chipRow(dialog, 1).getByRole('button', { name: 'All', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Daily Immunity' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Ashtagandham' })).toBeVisible();
  });

  test('TC-SO148 complex: query then Show all rituals clears query and filters', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Sugar' }).click();
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('zzzz');
    await expect(dialog.getByRole('heading', { name: 'No blends match yet' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Show all rituals' }).click();
    await expect(dialog.getByPlaceholder('Search blends, herbs, concerns…')).toHaveValue('');
    await expect(dialog.getByRole('heading', { name: 'Browse the collection' })).toBeVisible();
  });

  test('TC-SO149 complex: sequential category clicks switch concern context correctly', async ({ page }) => {
    let dialog = await openCategory(page, 'Natural Bath Powders');
    await expect(dialog.getByRole('heading', { name: 'Bath & body rituals' })).toBeVisible();
    await dialog.getByRole('button', { name: /Close/i }).click();
    dialog = await openCategory(page, 'Targeted Kashayams');
    await expect(dialog.getByRole('heading', { name: 'Targeted wellness brews' })).toBeVisible();
    await dialog.getByRole('button', { name: /Close/i }).click();
    dialog = await openCategory(page, 'Spiritual Wellness');
    await expect(dialog.getByRole('heading', { name: 'Sacred fragrant blends' })).toBeVisible();
  });

  test('TC-SO150 complex: mega flow touches every control type in one session', async ({ page }) => {
    const dialog = await openSearch(page);
    await chipRow(dialog, 0).getByRole('button', { name: 'Immunity' }).click();
    await chipRow(dialog, 1).getByRole('button', { name: 'Water' }).click();
    await chipRow(dialog, 2).getByRole('button', { name: '₹300–400' }).click();
    await dialog.getByPlaceholder('Search blends, herbs, concerns…').fill('Daily');
    await expect(dialog.getByText('Try:')).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Clear filters' }).click();
    await chipRow(dialog, 0).getByRole('button', { name: 'Skin & Body' }).click();
    const card = productCard(dialog, 'Herbal Sunni Pindi');
    await card.getByRole('button', { name: 'Wishlist' }).click();
    await card.getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('dialog', { name: /quick view/i })).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await card.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText(/Added to cart/i)).toBeVisible({ timeout: 8000 });
    await dialog.getByRole('button', { name: /Close/i }).click();
    await expect(searchDialog(page)).toHaveCount(0);
  });
});
