// @ts-check
const { test, expect } = require('@playwright/test');
const {
  clearAuthStorage,
  seedEmailUser,
  readProfile,
  isLoggedIn,
  STRONG_PASSWORD,
} = require('./helpers/storage');

const LANDING_URL = '/';

test.describe('Landing — guest vs logged-in UI', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
  });

  // TC-P03
  test('guest sees sign-in link instead of account menu', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account options' })).not.toBeVisible();
  });
});

test.describe('Landing — profile', () => {
  const email = `profile-${Date.now()}@test.com`;

  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
    await seedEmailUser(page, {
      email,
      password: STRONG_PASSWORD,
      name: 'Profile Tester',
    });
    await page.evaluate(() => localStorage.setItem('ak_terms_accepted', '1'));
  });

  // TC-P01
  test('logged-in user sees account menu with Profile, Order History and Log out', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();

    await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Order History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  // TC-P02
  test('profile modal saves delivery details and persists after reload', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Profile' }).click();

    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();

    const profileDialog = page.getByRole('dialog', { name: 'My Profile' });
    await profileDialog.getByPlaceholder('Full name').fill('Updated Name');
    await profileDialog.getByPlaceholder('Phone number').fill('9876543210');
    await profileDialog.getByPlaceholder('Email address').fill(email);
    await profileDialog.getByPlaceholder('Address (house, street, area)').fill('12 MG Road');
    await profileDialog.getByPlaceholder('City').fill('Hyderabad');
    await profileDialog.getByPlaceholder('Pin code').fill('500001');
    await profileDialog.locator('select').selectOption('Telangana');

    await page.getByRole('button', { name: 'Save changes' }).click();

    const profile = await readProfile(page);
    expect(profile.name).toBe('Updated Name');
    expect(profile.phone).toBe('9876543210');
    expect(profile.address).toBe('12 MG Road');
    expect(profile.city).toBe('Hyderabad');
    expect(profile.state).toBe('Telangana');
    expect(profile.pincode).toBe('500001');

    await page.reload();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Profile' }).click();

    const profileAfterReload = page.getByRole('dialog', { name: 'My Profile' });
    await expect(profileAfterReload.getByPlaceholder('Full name')).toHaveValue('Updated Name');
    await expect(profileAfterReload.getByPlaceholder('Address (house, street, area)')).toHaveValue('12 MG Road');
    await expect(profileAfterReload.getByPlaceholder('City')).toHaveValue('Hyderabad');
    await expect(profileAfterReload.getByPlaceholder('Pin code')).toHaveValue('500001');
  });

  test('TC-P04 positive: save profile keeps provider metadata', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('ak_profile') || '{}');
      p.provider = 'google';
      p.verified = true;
      localStorage.setItem('ak_profile', JSON.stringify(p));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Profile' }).click();
    const profileDialog = page.getByRole('dialog', { name: 'My Profile' });
    await profileDialog.getByPlaceholder('Phone number').fill('9876543210');
    await profileDialog.getByPlaceholder('Address (house, street, area)').fill('9 Lake View');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const profile = await readProfile(page);
    expect(profile.provider).toBe('google');
    expect(profile.verified).toBe(true);
    expect(profile.phone).toBe('9876543210');
    expect(profile.address).toBe('9 Lake View');
  });

  test('TC-P05 positive: cancel discards unsaved profile edits', async ({ page }) => {
    await page.goto(LANDING_URL);
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Profile' }).click();
    const profileDialog = page.getByRole('dialog', { name: 'My Profile' });
    await profileDialog.getByPlaceholder('Full name').fill('Should Not Persist');
    await profileDialog.getByPlaceholder('City').fill('DiscardCity');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'My Profile' })).toHaveCount(0);
    const profile = await readProfile(page);
    expect(profile.name).toBe('Profile Tester');
    expect(profile.city || '').toBe('');
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Profile' }).click();
    const profileAgain = page.getByRole('dialog', { name: 'My Profile' });
    await expect(profileAgain.getByPlaceholder('Full name')).toHaveValue('Profile Tester');
    await expect(profileAgain.getByPlaceholder('City')).toHaveValue('');
  });
});

test.describe('Landing — logout', () => {
  const email = `logout-${Date.now()}@test.com`;

  test.beforeEach(async ({ page }) => {
    await clearAuthStorage(page);
    await seedEmailUser(page, {
      email,
      password: STRONG_PASSWORD,
      name: 'Logout Tester',
    });
    await page.evaluate(() => localStorage.setItem('ak_terms_accepted', '1'));
  });

  // TC-L01
  test('logout clears session and shows sign-in link', async ({ page }) => {
    await page.goto(LANDING_URL);
    await expect(page.getByRole('button', { name: 'Account options' })).toBeVisible();

    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();

    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Account options' })).not.toBeVisible();

    expect(await isLoggedIn(page)).toBe(false);

    const cleared = await page.evaluate(() => ({
      persist: localStorage.getItem('ak_persist'),
      profile: localStorage.getItem('ak_profile'),
      session: sessionStorage.getItem('ak_logged'),
      terms: localStorage.getItem('ak_terms_accepted'),
    }));
    expect(cleared.persist).toBeNull();
    expect(cleared.profile).toBeNull();
    expect(cleared.session).toBeNull();
    expect(cleared.terms).toBeNull();
  });
});
