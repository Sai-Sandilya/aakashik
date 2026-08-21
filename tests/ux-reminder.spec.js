/**
 * Ritual reminder: edit existing or add another after the success state.
 */
const { test, expect } = require('@playwright/test');
const { clearAuthStorage } = require('./helpers/storage');

const LANDING_URL = '/Aakashik%20Landing.dc.html';

async function fillAndSaveReminder(page, { contact = '9876543210', productId = 'immunity' } = {}) {
  await page.getByPlaceholder('Phone or email').scrollIntoViewIfNeeded();
  await page.getByLabel('Reminder product').selectOption(productId);
  await page.getByPlaceholder('Phone or email').fill(contact);
  await page.getByRole('button', { name: /Set My Reminder|Update Reminder/ }).click();
  await expect(page.getByText("You're all set")).toBeVisible({ timeout: 5000 });
}

test.describe('UX reminder — edit & add another', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  test('TC-RM01 positive: after save, Edit reminder reopens the form with values', async ({ page }) => {
    await page.goto(LANDING_URL);
    await fillAndSaveReminder(page, { contact: '9876500111' });

    await page.getByRole('button', { name: 'Edit reminder' }).click();
    await expect(page.getByRole('button', { name: 'Update Reminder' })).toBeVisible();
    await expect(page.getByPlaceholder('Phone or email')).toHaveValue('9876500111');
    await expect(page.getByText("You're all set")).toHaveCount(0);
  });

  test('TC-RM02 positive: edit updates the saved reminder', async ({ page }) => {
    await page.goto(LANDING_URL);
    await fillAndSaveReminder(page, { contact: '9876500222' });

    await page.getByRole('button', { name: 'Edit reminder' }).click();
    await page.getByLabel('Reminder product').selectOption('navojas');
    await page.getByPlaceholder('Phone or email').fill('9876500333');
    await page.getByRole('button', { name: 'Update Reminder' }).click();

    await expect(page.getByText("You're all set")).toBeVisible();
    await expect(page.getByText(/Navojas/i).first()).toBeVisible();
    await expect(page.getByText(/9876500333/)).toBeVisible();

    const rem = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_reminder') || '{}'));
    expect(rem.contact).toBe('9876500333');
    expect(rem.productName).toMatch(/Navojas/i);
    const list = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_reminders') || '[]'));
    expect(list.length).toBe(1);
  });

  test('TC-RM03 positive: Add another reminder shows a fresh form', async ({ page }) => {
    await page.goto(LANDING_URL);
    await fillAndSaveReminder(page, { contact: '9876500444' });

    await page.getByRole('button', { name: 'Add another reminder' }).click();
    await expect(page.getByRole('button', { name: 'Set My Reminder' })).toBeVisible();
    await expect(page.getByPlaceholder('Phone or email')).toHaveValue('');
    await expect(page.getByText("You're all set")).toHaveCount(0);
  });

  test('TC-RM04 positive: add another saves a second powder reminder', async ({ page }) => {
    await page.goto(LANDING_URL);
    await fillAndSaveReminder(page, { contact: '9876500555', productId: 'immunity' });

    await page.getByRole('button', { name: 'Add another reminder' }).click();
    await fillAndSaveReminder(page, { contact: '9876500666', productId: 'sunni' });

    const list = await page.evaluate(() => JSON.parse(localStorage.getItem('ak_reminders') || '[]'));
    expect(list.length).toBe(2);
    expect(list[0].productName).toMatch(/Daily Immunity/i);
    expect(list[1].productName).toMatch(/Sunni Pindi/i);
    await expect(page.getByText(/2 saved/i)).toBeVisible();
  });

  test('TC-RM05 negative: invalid WhatsApp contact still blocked after Add another', async ({ page }) => {
    await page.goto(LANDING_URL);
    await fillAndSaveReminder(page, { contact: '9876500777' });
    await page.getByRole('button', { name: 'Add another reminder' }).click();
    await page.getByPlaceholder('Phone or email').fill('not-a-phone');
    await page.getByRole('button', { name: 'Set My Reminder' }).click();
    await expect(page.getByText(/valid 10-digit phone/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("You're all set")).toHaveCount(0);
  });

  test('TC-RM06 positive: success panel exposes Edit and Add another actions', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      const entry = {
        contact: '9876500888',
        time: '09:30',
        channel: 'whatsapp',
        productId: 'immunity',
        productName: 'Daily Immunity',
        setAt: Date.now(),
      };
      localStorage.setItem('ak_reminder', JSON.stringify(entry));
      localStorage.setItem('ak_reminders', JSON.stringify([entry]));
    });
    await page.reload();
    await page.getByText("You're all set").scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Edit reminder' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add another reminder' })).toBeVisible();
  });
});
