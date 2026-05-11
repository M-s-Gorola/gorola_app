import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('E2E-006: OTP Login Flow', async ({ page }) => {
    await page.goto('/login');

    // Assert phone input is visible
    const phoneInput = page.locator('#buyer-phone');
    await expect(phoneInput).toBeVisible();

    // Enter 9876543210
    await phoneInput.fill('9876543210');

    // Click "Send OTP"
    await page.locator('button', { hasText: /Send OTP/i }).click();

    // Assert UI transitions to OTP input step
    await expect(page.locator('text=/Enter OTP/i')).toBeVisible();

    // Enter the test OTP (123456)
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
      await page.waitForTimeout(100); // Small delay to allow focus/state updates
    }

    // Click "Verify"
    await page.locator('button', { hasText: /Verify/i }).click();

    // Assert redirect to /
    await expect(page).toHaveURL('http://localhost:5173/', { timeout: 10000 });

    // Assert nav shows Profile icon (not Login text)
    await expect(page.locator('button[aria-label="Profile"]')).toBeVisible();
    await expect(page.locator('a[aria-label="Login"]')).not.toBeVisible();
  });

  test('E2E-007: Auth Persistence (Page Reload)', async ({ page }) => {
    // Prerequisite: Log in
    await page.goto('/login');
    await page.locator('#buyer-phone').fill('9876543211');
    await page.locator('button', { hasText: /Send OTP/i }).click();

    // Wait for OTP screen
    await expect(page.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 10000 });
    
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
      await page.waitForTimeout(100);
    }
    await page.locator('button', { hasText: /Verify/i }).click();
    await expect(page).toHaveURL('http://localhost:5173/', { timeout: 10000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert nav STILL shows Profile icon
    await expect(page.locator('button[aria-label="Profile"]')).toBeVisible();
    
    // New incognito context for unauth check is handled by Playwright by default in each test,
    // but let's just test a direct hit to /checkout without previous login in this test's scope if possible.
  });

  test('Unauthenticated Redirect', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate directly to /checkout without being logged in
    await page.goto('/checkout');
    
    // Assert redirect to /login
    await expect(page).toHaveURL(/\/login/);
    
    await context.close();
  });
});
