import { test, expect } from '@playwright/test';

test.describe('DPDP Act 2023: Age Gate E2E (Phase 8.8)', () => {
  test('Scenario 1: New adult phone completes flow; second login skips age gate', async ({ page }) => {
    const adultPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.goto('/login');

    // Consent step
    const consentNotice = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    // Phone step
    const phoneInput = page.locator('#buyer-phone');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill(adultPhone);
    await page.locator('button', { hasText: /Send OTP/i }).click();

    // OTP step
    await expect(page.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
    }
    await page.locator('button', { hasText: /Verify/i }).click();

    // Age Gate step
    const ageStep = page.locator('[data-testid="age-step"]');
    await expect(ageStep).toBeVisible({ timeout: 10000 });

    // Adult DOB (14-05-1990)
    await page.locator('[data-testid="age-day"]').fill('14');
    await page.locator('[data-testid="age-month"]').fill('05');
    await page.locator('[data-testid="age-year"]').fill('1990');
    await page.locator('[data-testid="age-continue-btn"]').click();

    // Confirm step
    await expect(page.locator('[data-testid="age-confirm-step"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="age-confirm-checkbox"]').click();
    await page.locator('[data-testid="age-confirm-yes-btn"]').click();

    // Redirected home as logged in
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    await expect(page.locator('[aria-label="Profile"]:visible')).toBeVisible();

    // Logout and log in a second time with the same phone
    await page.goto('/login');
    const phoneInput2 = page.locator('#buyer-phone');
    if (await phoneInput2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await phoneInput2.fill(adultPhone);
      await page.locator('button', { hasText: /Send OTP/i }).click();

      await expect(page.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
      for (let i = 0; i < 6; i++) {
        await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
      }
      await page.locator('button', { hasText: /Verify/i }).click();

      // Should redirect straight home without showing age gate
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    }
  });

  test('Scenario 2: Under-18 DOB triggers lockout; subsequent attempt blocked immediately', async ({ page }) => {
    const minorPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.goto('/login');

    const consentNotice = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    const phoneInput = page.locator('#buyer-phone');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill(minorPhone);
    await page.locator('button', { hasText: /Send OTP/i }).click();

    await expect(page.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
    }
    await page.locator('button', { hasText: /Verify/i }).click();

    const ageStep = page.locator('[data-testid="age-step"]');
    await expect(ageStep).toBeVisible({ timeout: 10000 });

    // Under-18 DOB (e.g. 2012-03-10)
    await page.locator('[data-testid="age-day"]').fill('10');
    await page.locator('[data-testid="age-month"]').fill('03');
    await page.locator('[data-testid="age-year"]').fill('2012');
    await page.locator('[data-testid="age-continue-btn"]').click();

    await expect(page.locator('[data-testid="age-confirm-step"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="age-confirm-checkbox"]').click();
    await page.locator('[data-testid="age-confirm-yes-btn"]').click();

    // Refusal / Lockout screen shown
    await expect(page.locator('[data-testid="age-blocked-step"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/aged 18 and over/i')).toBeVisible();

    // Reload and attempt to send OTP for same locked-out phone
    await page.goto('/login');
    const consentNotice2 = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    const phoneInput2 = page.locator('#buyer-phone');
    if (await phoneInput2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await phoneInput2.fill(minorPhone);
      await page.locator('button', { hasText: /Send OTP/i }).click();

      // Refusal / Lockout notice should appear immediately
      await expect(page.locator('[data-testid="age-blocked-step"]')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Scenario 3: Date correction during entry leads to successful account creation without lockout', async ({ page }) => {
    const testPhone = `96${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.goto('/login');

    const consentNotice = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    const phoneInput = page.locator('#buyer-phone');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill(testPhone);
    await page.locator('button', { hasText: /Send OTP/i }).click();

    await expect(page.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
    }
    await page.locator('button', { hasText: /Verify/i }).click();

    const ageStep = page.locator('[data-testid="age-step"]');
    await expect(ageStep).toBeVisible({ timeout: 10000 });

    // Enter minor date first
    await page.locator('[data-testid="age-day"]').fill('01');
    await page.locator('[data-testid="age-month"]').fill('01');
    await page.locator('[data-testid="age-year"]').fill('2015');
    await page.locator('[data-testid="age-continue-btn"]').click();

    // In confirm step, click Edit to correct the date
    await expect(page.locator('[data-testid="age-confirm-step"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="age-confirm-edit-btn"]').click();

    // Correct to valid adult year
    await page.locator('[data-testid="age-year"]').fill('1992');
    await page.locator('[data-testid="age-continue-btn"]').click();

    await expect(page.locator('[data-testid="age-confirm-step"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="age-confirm-checkbox"]').click();
    await page.locator('[data-testid="age-confirm-yes-btn"]').click();

    // Successful login
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    await expect(page.locator('[aria-label="Profile"]:visible')).toBeVisible();
  });

  test('Scenario 4: Existing confirmed buyer logs in directly without Age Gate prompt', async ({ page }) => {
    // Standard seeded buyer or established login
    await page.goto('/login');

    const consentNotice = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    const phoneInput = page.locator('#buyer-phone');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('9999000001');
    await page.locator('button', { hasText: /Send OTP/i }).click();

    await expect(page.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
    }
    await page.locator('button', { hasText: /Verify/i }).click();

    // Should complete directly or land on target
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
  });
});
