import { expect, test } from "@playwright/test";

test.describe("Admin Age-Gate Dashboard Pipeline (8.8.14)", () => {
  test.describe.configure({ mode: "serial" });

  const BASE_URL = "http://127.0.0.1:5180";
  const ADMIN_SUBDOMAIN = "http://admin.gorola.com:5180";

  test.beforeEach(async ({ page, request }) => {
    await request.post(`${BASE_URL}/api/v1/test/admin/reset`);

    await page.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });
  });

  async function loginAsAdmin(page) {
    await page.goto(`${ADMIN_SUBDOMAIN}/login`);
    await page.locator("#email").fill("admin@gorola.in");
    await page.locator("#password").fill("AdminGorola#123");

    const loginResponse = page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/auth/admin/login") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await page.locator('button:has-text("Login")').click();
    await loginResponse;

    await page.waitForURL(/\/(setup-2fa|2fa)/, { timeout: 15000 });
    const currentUrl = page.url();

    if (currentUrl.includes("/setup-2fa")) {
      await expect(page.locator("h1", { hasText: "Setup Two-Factor Authentication" })).toBeVisible({
        timeout: 15000
      });
      await page.locator("#setup-totp-code").fill("000000");

      const verifySetupResp = page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/auth/admin/verify-2fa") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await page.locator('button:has-text("Verify and Enable")').click();
      await verifySetupResp;

      await page.waitForURL(/\/login/, { timeout: 15000 });

      // Retry login now that 2FA is active
      await page.locator("#email").fill("admin@gorola.in");
      await page.locator("#password").fill("AdminGorola#123");

      const reloginResponse = page.waitForResponse(
        (resp) => resp.url().includes("/api/v1/auth/admin/login") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await page.locator('button:has-text("Login")').click();
      await reloginResponse;

      await page.waitForURL(/\/2fa/, { timeout: 15000 });
    }

    await expect(page.locator("h1", { hasText: "Two-Factor Authentication" })).toBeVisible({ timeout: 15000 });
    await page.locator("#totp-code").fill("000000");

    const finalLoginResp = page.waitForResponse(
      (resp) => resp.url().includes("/api/v1/auth/admin/login") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await page.locator('button:has-text("Verify")').click();
    await finalLoginResp;

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator("text=/Restoring your session/i")).not.toBeVisible({ timeout: 15000 });
  }

  test("Scenario 1: Look up locked phone and clear lockout via UnlockModal", async ({ page, request }) => {
    // 1. Lock a test phone via age refusal
    const lockedPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.goto("/login");

    const consentNotice = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    const phoneInput = page.locator("#buyer-phone");
    await phoneInput.fill(lockedPhone);
    await page.locator("button", { hasText: /Send OTP/i }).click();

    await expect(page.locator("text=/Enter OTP/i")).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
    }
    await page.locator("button", { hasText: /Verify/i }).click();

    // Minor DOB -> refusal lockout
    await expect(page.locator('[data-testid="age-step"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="age-day"]').fill("14");
    await page.locator('[data-testid="age-month"]').fill("05");
    await page.locator('[data-testid="age-year"]').fill("2015");
    await page.locator('[data-testid="age-continue-btn"]').click();

    await expect(page.locator('[data-testid="age-confirm-step"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="age-confirm-checkbox"]').click();
    await page.locator('[data-testid="age-confirm-yes-btn"]').click();

    await expect(page.locator('[data-testid="age-blocked-step"]')).toBeVisible({ timeout: 10000 });

    // 2. Admin logs in and navigates to Age Gate Dashboard
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_SUBDOMAIN}/age-gate`);

    await expect(page.locator("h1", { hasText: /Age Gate Case Pipeline/i })).toBeVisible();

    // 3. Search for locked phone
    const searchInput = page.locator('input[placeholder="Enter 10-digit mobile number"]');
    await searchInput.fill(lockedPhone);
    await page.locator('button:has-text("Look Up")').click();

    // 4. Verify lockout card appears
    await expect(page.locator("text=/Lockout Record/i")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("ACTIVE LOCKOUT", { exact: true })).toBeVisible();

    // 5. Click Unlock Lockout and submit reason
    await page.locator('button:has-text("Unlock Lockout")').click();
    await expect(page.locator("text=/Unlock Age-Gate Lockout/i")).toBeVisible();

    const reasonTextarea = page.locator('textarea[placeholder*="verified government ID"]');
    await reasonTextarea.fill("Verified government photo ID showing 18+ eligibility in person");
    await page.locator('button:has-text("Confirm Unlock")').click();

    // 6. Verify success toast and lockout is cleared
    await expect(page.locator("text=/lockout cleared successfully/i")).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 2: Decline age-gate appeal records administrative decline", async ({ page, request }) => {
    // 1. Lock a test phone
    const appealPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.goto("/login");

    const consentNotice = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    const phoneInput = page.locator("#buyer-phone");
    await phoneInput.fill(appealPhone);
    await page.locator("button", { hasText: /Send OTP/i }).click();

    await expect(page.locator("text=/Enter OTP/i")).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
    }
    await page.locator("button", { hasText: /Verify/i }).click();

    // Minor DOB
    await expect(page.locator('[data-testid="age-step"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="age-day"]').fill("01");
    await page.locator('[data-testid="age-month"]').fill("01");
    await page.locator('[data-testid="age-year"]').fill("2012");
    await page.locator('[data-testid="age-continue-btn"]').click();

    await expect(page.locator('[data-testid="age-confirm-step"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="age-confirm-checkbox"]').click();
    await page.locator('[data-testid="age-confirm-yes-btn"]').click();

    await expect(page.locator('[data-testid="age-blocked-step"]')).toBeVisible({ timeout: 10000 });

    // 2. Admin logs in and navigates to Age Gate Dashboard
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_SUBDOMAIN}/age-gate`);

    // 3. Look up appeal phone
    const searchInput = page.locator('input[placeholder="Enter 10-digit mobile number"]');
    await searchInput.fill(appealPhone);
    await page.locator('button:has-text("Look Up")').click();

    await expect(page.locator("text=/Lockout Record/i")).toBeVisible({ timeout: 10000 });

    // 4. Click Decline Appeal and submit reason
    await page.locator('button:has-text("Decline Appeal")').click();
    await expect(page.locator("text=/Decline Age-Gate Appeal/i")).toBeVisible();

    const reasonTextarea = page.locator('textarea[placeholder*="reason for declining"]');
    await reasonTextarea.fill("Submitted document does not establish 18+ eligibility requirement");
    await page.locator('button:has-text("Confirm Decline")').click();

    // 5. Verify success toast
    await expect(page.locator("text=/Appeal decline recorded/i")).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 3: Erase underage account on user detail page and verify lockout", async ({ page, request }) => {
    // 1. Register an adult buyer
    const userPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.goto("/login");

    const consentNotice = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    const phoneInput = page.locator("#buyer-phone");
    await phoneInput.fill(userPhone);
    await page.locator("button", { hasText: /Send OTP/i }).click();

    await expect(page.locator("text=/Enter OTP/i")).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
    }
    await page.locator("button", { hasText: /Verify/i }).click();

    // Adult DOB
    await expect(page.locator('[data-testid="age-step"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="age-day"]').fill("10");
    await page.locator('[data-testid="age-month"]').fill("08");
    await page.locator('[data-testid="age-year"]').fill("1995");
    await page.locator('[data-testid="age-continue-btn"]').click();

    await expect(page.locator('[data-testid="age-confirm-step"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="age-confirm-checkbox"]').click();
    await page.locator('[data-testid="age-confirm-yes-btn"]').click();

    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    // 2. Admin logs in and opens Age Gate lookup
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_SUBDOMAIN}/age-gate`);

    const searchInput = page.locator('input[placeholder="Enter 10-digit mobile number"]');
    await searchInput.fill(userPhone);
    await page.locator('button:has-text("Look Up")').click();

    await expect(page.locator("text=/Buyer Account/i")).toBeVisible({ timeout: 10000 });

    // 3. Click Erase Underage
    await page.locator('button:has-text("Erase Underage")').click();
    await expect(page.locator("text=/Erase Underage Account/i")).toBeVisible();

    const reasonTextarea = page.locator('textarea[placeholder*="underage erasure"]');
    await reasonTextarea.fill("User confirmed to be under 18 years of age by parent report");
    await page.locator('button:has-text("Erase & Block 90 Days")').click();

    // 4. Verify toast
    await expect(page.locator("text=/Underage account erased & locked/i")).toBeVisible({ timeout: 10000 });
  });

  test("Scenario 4: User Detail page displays Age Confirmation status and supports suspension", async ({ page, request }) => {
    // 1. Register buyer
    const userPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const userLast4 = userPhone.slice(-4);
    await page.goto("/login");

    const consentNotice = page.locator('[data-testid="consent-notice-step"]');
    if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
      await page.locator('[data-testid="consent-continue-btn"]').click();
    }

    const phoneInput = page.locator("#buyer-phone");
    await phoneInput.fill(userPhone);
    await page.locator("button", { hasText: /Send OTP/i }).click();

    await expect(page.locator("text=/Enter OTP/i")).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
    }
    await page.locator("button", { hasText: /Verify/i }).click();

    // Adult DOB
    await expect(page.locator('[data-testid="age-step"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="age-day"]').fill("15");
    await page.locator('[data-testid="age-month"]').fill("03");
    await page.locator('[data-testid="age-year"]').fill("1992");
    await page.locator('[data-testid="age-continue-btn"]').click();

    await expect(page.locator('[data-testid="age-confirm-step"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="age-confirm-checkbox"]').click();
    await page.locator('[data-testid="age-confirm-yes-btn"]').click();

    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    // 2. Admin logs in, goes to Users list, and navigates to the user
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_SUBDOMAIN}/users`);

    await expect(page.locator("h1", { hasText: "Platform Users" })).toBeVisible();

    const userRow = page.locator("tr", { hasText: userLast4 });
    await expect(userRow).toBeVisible({ timeout: 10000 });
    await userRow.locator('button:has-text("View Details")').click();

    // 3. User detail page checks
    await expect(page.locator('[data-testid="admin-user-detail-page"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="user-age-confirmation"]')).toBeVisible();

    // 4. Verify Erase Underage button is present
    await expect(page.locator('[data-testid="erase-underage-user-button"]')).toBeVisible();
  });
});
