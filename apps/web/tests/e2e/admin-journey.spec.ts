import { test, expect } from "@playwright/test";

test.describe("Admin Panel E2E Journey", () => {
  // Serial mode is required since these tests mutate shared database state
  test.describe.configure({ mode: "serial" });

  const BASE_URL = "http://127.0.0.1:5180";
  const ADMIN_SUBDOMAIN = "http://admin.gorola.com:5180";
  const STORE_SUBDOMAIN = "http://store.gorola.com:5180";

  test.beforeEach(async ({ page, request }) => {
    // Reset all Admin states, feature flags, buyer suspension, ads, and dynamic stores before each run
    await request.post(`${BASE_URL}/api/v1/test/admin/reset`);

    // Set isE2E global flag on the page context
    await page.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });
  });

  // Helper function to log in as admin, dynamically handling both 2FA setup and verification paths
  async function loginAsAdmin(page) {
    await page.goto(`${ADMIN_SUBDOMAIN}/login`);
    await page.locator("#email").fill("admin@gorola.in");
    await page.locator("#password").fill("AdminGorola#123");

    // Hook login response
    const loginResponse = page.waitForResponse(
      resp => resp.url().includes("/api/v1/auth/admin/login") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await page.locator('button:has-text("Login")').click();
    await loginResponse;

    // Check if the server requires 2FA Setup or direct 2FA Verification
    await page.waitForURL(/\/(setup-2fa|2fa)/, { timeout: 15000 });
    const currentUrl = page.url();

    if (currentUrl.includes("/setup-2fa")) {
      await expect(page.locator("h1", { hasText: "Setup Two-Factor Authentication" })).toBeVisible({ timeout: 15000 });
      await page.locator("#setup-totp-code").fill("000000");

      // Hook 2FA setup verification response
      const verifySetupResp = page.waitForResponse(
        resp => resp.url().includes("/api/v1/auth/admin/verify-2fa") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await page.locator('button:has-text("Verify and Enable")').click();
      await verifySetupResp;

      await page.waitForURL(/\/login/, { timeout: 15000 });

      // Retry login now that 2FA is active
      await page.locator("#email").fill("admin@gorola.in");
      await page.locator("#password").fill("AdminGorola#123");

      const reloginResponse = page.waitForResponse(
        resp => resp.url().includes("/api/v1/auth/admin/login") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await page.locator('button:has-text("Login")').click();
      await reloginResponse;

      await page.waitForURL(/\/2fa/, { timeout: 15000 });
    }

    await expect(page.locator("h1", { hasText: "Two-Factor Authentication" })).toBeVisible({ timeout: 15000 });
    await page.locator("#totp-code").fill("000000");

    const finalLoginResp = page.waitForResponse(
      resp => resp.url().includes("/api/v1/auth/admin/login") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await page.locator('button:has-text("Verify")').click();
    await finalLoginResp;

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator("text=/Restoring your session/i")).not.toBeVisible({ timeout: 15000 });
  }

  // E2E-034: Admin Authentication & 2FA Setup Flow
  test("E2E-034: Admin Authentication & 2FA Setup Flow", async ({ page }) => {
    await loginAsAdmin(page);

    // Assert that the dashboard loads platform-wide metrics
    await expect(page.locator("h1", { hasText: "System Dashboard" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="total-orders-today"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="total-revenue-today"]')).toBeVisible({ timeout: 15000 });
  });

  // E2E-035: Feature Flag Toggle — Weather Mode
  test("E2E-035: Feature Flag Toggle — Weather Mode", async ({ browser, page }) => {
    // 1. Log in as admin and navigate to Feature Flags
    await loginAsAdmin(page);
    await page.locator("text=Feature Flags").filter({ visible: true }).first().click();
    await expect(page.locator("h1", { hasText: "Feature Flags" })).toBeVisible({ timeout: 15000 });

    // 2. Toggle WEATHER_MODE_ACTIVE on
    const weatherSwitch = page.getByRole("switch", { name: "Toggle flag WEATHER_MODE_ACTIVE" });
    await expect(weatherSwitch).toBeVisible({ timeout: 15000 });
    
    // Toggle should trigger a confirmation modal
    await weatherSwitch.click();
    const confirmModalTitle = page.locator('role=dialog >> h3', { hasText: /Confirm Feature Flag Update/i });
    await expect(confirmModalTitle).toBeVisible({ timeout: 10000 });
    
    const updateFlagResponse = page.waitForResponse(
      resp => resp.url().includes("/api/v1/admin/feature-flags/WEATHER_MODE_ACTIVE") && resp.request().method() === "PUT",
      { timeout: 15000 }
    );
    await page.locator('button:has-text("Confirm Update")').dispatchEvent('click');
    await updateFlagResponse;

    // Verify toast notification for success
    await expect(page.locator('text=/updated successfully/i')).toBeVisible({ timeout: 10000 });

    // 3. Open a separate buyer browser context to verify Weather Mode is active
    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });

    const getFlagResponse = buyerPage.waitForResponse(
      resp => resp.url().includes("/api/v1/feature-flags/WEATHER_MODE_ACTIVE") && resp.request().method() === "GET",
      { timeout: 15000 }
    );
    await buyerPage.goto(BASE_URL);
    await getFlagResponse;

    await expect(buyerPage.locator('text=/Restoring your session/i')).not.toBeVisible({ timeout: 15000 });

    // Verify buyer page theme changes and ETA updates
    const navBar = buyerPage.locator('nav[aria-label="Buyer navigation"]');
    await expect(navBar).toHaveAttribute("data-weather", "on", { timeout: 15000 });

    const etaBanner = buyerPage.locator('[data-testid="eta-banner"]');
    await expect(etaBanner).toContainText("45-55 mins", { timeout: 15000 });

    // 4. Clean up buyer context
    await buyerContext.close();
  });

  // E2E-036: Advertisement Approval Queue
  test("E2E-036: Advertisement Approval Queue", async ({ browser, page }) => {
    // 1. Log in as admin and navigate to Advertisements
    await loginAsAdmin(page);
    await page.locator("text=Advertisements").filter({ visible: true }).first().click();
    await expect(page.locator("h1", { hasText: "Advertisements" })).toBeVisible({ timeout: 15000 });

    // Ensure we are on the Pending tab
    const pendingTab = page.locator('button[role="tab"]', { hasText: /Pending/i }).first();
    await pendingTab.click();

    // Find the pending E2E advertisement
    const adCard = page.locator("div.bg-white", { hasText: "E2E Pending Ad" }).first();
    await expect(adCard).toBeVisible({ timeout: 15000 });

    // 2. Click approve and verify it moves to the Approved tab
    const approveResponse = page.waitForResponse(
      resp => resp.url().includes("/api/v1/admin/advertisements/") && resp.url().includes("/approve") && resp.request().method() === "PUT",
      { timeout: 15000 }
    );
    await adCard.getByRole("button", { name: "Approve", exact: true }).dispatchEvent('click');
    await approveResponse;
    await expect(page.locator('text=/approved and activated/i')).toBeVisible({ timeout: 10000 });

    const approvedTab = page.locator('button[role="tab"]', { hasText: /Approved/i }).first();
    await approvedTab.click();
    await expect(page.locator("div", { hasText: "E2E Pending Ad" }).first()).toBeVisible({ timeout: 15000 });

    // 3. Open buyer context and verify the advertisement is displayed in the homepage carousel
    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });

    const getAdsPromise = buyerPage.waitForResponse(
      resp => resp.url().includes("/api/v1/promotions/advertisements") && resp.request().method() === "GET",
      { timeout: 15000 }
    );
    await buyerPage.goto(BASE_URL);
    await getAdsPromise;

    await expect(buyerPage.locator('text=/Restoring your session/i')).not.toBeVisible({ timeout: 15000 });

    // Verify the ad is visible in the carousel
    const carouselAd = buyerPage.locator("text=E2E Pending Ad").first();
    await expect(carouselAd).toBeVisible({ timeout: 15000 });

    await buyerContext.close();
  });

  // E2E-037: Store Provisioning (Create Store + Owner)
  test("E2E-037: Store Provisioning (Create Store + Owner)", async ({ browser, page }) => {
    // 1. Log in as admin and navigate to Stores
    await loginAsAdmin(page);
    await page.locator("text=Stores").filter({ visible: true }).first().click();
    await expect(page.locator("h1", { hasText: "Platform Stores" })).toBeVisible({ timeout: 15000 });

    // 2. Click Add Store and fill the form
    await page.locator('[data-testid="add-store-button"]').click();
    await expect(page.locator("h2", { hasText: "Add New Store Partner" })).toBeVisible({ timeout: 10000 });

    const randomId = Math.floor(Math.random() * 10000);
    const storeName = `E2E Quick Store ${randomId}`;
    const ownerEmail = `e2e_owner_${randomId}@example.com`;

    await page.locator('[data-testid="store-name-input"]').fill(storeName);
    await page.locator('[data-testid="store-desc-input"]').fill("Provisioned via automated test");
    await page.locator('[data-testid="store-phone-input"]').fill("+919999999999");
    await page.locator('[data-testid="store-address-input"]').fill("E2E Testing Lane");
    
    // Choose store type Quick Commerce
    await page.locator('input[name="storeType"][value="QUICK_COMMERCE"]').check();

    // Owner credentials
    await page.locator('[data-testid="owner-email-input"]').fill(ownerEmail);
    await page.locator('[data-testid="owner-password-input"]').fill("OwnerTemp#123");

    // Submit form
    const createStoreResponse = page.waitForResponse(
      resp => resp.url().includes("/api/v1/admin/stores") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await page.locator('[data-testid="submit-create-store"]').dispatchEvent('click');
    await createStoreResponse;

    // Verify toast and presence in store list
    await expect(page.locator('text=/Store successfully created/i')).toBeVisible({ timeout: 15000 });
    await expect(page.locator("td", { hasText: storeName }).first()).toBeVisible({ timeout: 15000 });

    // 3. Log in as the newly provisioned store owner
    const storeContext = await browser.newContext();
    const storePage = await storeContext.newPage();
    await storePage.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });

    await storePage.goto(`${STORE_SUBDOMAIN}/login`);
    await storePage.locator("#store-login-email").fill(ownerEmail);
    await storePage.locator("#store-login-password").fill("OwnerTemp#123");
    
    const ownerLoginResponse = storePage.waitForResponse(
      resp => resp.url().includes("/api/v1/auth/store-owner/login") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await storePage.locator('button:has-text("Login")').click();
    await ownerLoginResponse;

    // Assert the store owner is logged in and lands on dashboard directly without 2FA setup
    await storePage.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(storePage.locator("h1", { hasText: "Dashboard" })).toBeVisible({ timeout: 15000 });

    await storeContext.close();
  });

  // E2E-038: User Management — Suspend & Unsuspend Buyer
  test("E2E-038: User Management — Suspend & Unsuspend Buyer", async ({ browser, page }) => {
    // 1. Log in as admin and navigate to Users
    await loginAsAdmin(page);
    await page.locator("text=Users").filter({ visible: true }).first().click();
    await expect(page.locator("h1", { hasText: "Platform Users" })).toBeVisible({ timeout: 15000 });

    // Search for the seeded user phone number
    const searchInput = page.locator('[data-testid="search-phone-input"]');
    await searchInput.fill("9876543210");
    await page.waitForTimeout(500); // Wait for debounce

    const toggleBtn = page.locator('button[data-testid^="toggle-status-"]').first();
    await expect(toggleBtn).toBeVisible({ timeout: 15000 });
    await expect(toggleBtn).toHaveText("Suspend");

    // Click suspend and confirm
    await toggleBtn.click();
    
    const suspendResponse = page.waitForResponse(
      resp => resp.url().includes("/api/v1/admin/users/") && resp.url().includes("/suspend") && resp.request().method() === "PUT",
      { timeout: 15000 }
    );
    await page.locator('[data-testid="confirm-status-change"]').dispatchEvent('click');
    await suspendResponse;
    
    await expect(page.locator('text=/User successfully suspended/i')).toBeVisible({ timeout: 10000 });
    await expect(toggleBtn).toHaveText("Unsuspend");

    // 2. Open buyer context and attempt OTP login
    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });

    await buyerPage.goto(`${BASE_URL}/login`);
    await buyerPage.locator("#buyer-phone").fill("9876543210");
    
    const sendOtpResponse1 = buyerPage.waitForResponse(
      resp => resp.url().includes("/api/v1/auth/buyer/send-otp") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await buyerPage.locator('button:has-text("Send OTP")').click();
    await sendOtpResponse1;
    
    await expect(buyerPage.locator("text=/Enter OTP/i")).toBeVisible({ timeout: 10000 });
    for (let i = 0; i < 6; i++) {
      await buyerPage.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString()); // fills 123456
    }
    
    const verifyOtpResponse1 = buyerPage.waitForResponse(
      resp => resp.url().includes("/api/v1/auth/buyer/verify-otp") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await buyerPage.locator('button:has-text("Verify")').click();
    await verifyOtpResponse1;

    // Verify account suspended error is displayed on screen
    await expect(buyerPage.locator('[role="alert"]', { hasText: /Account suspended/i })).toBeVisible({ timeout: 15000 });

    // 3. Admin unsuspends the user
    await toggleBtn.click();
    
    const unsuspendResponse = page.waitForResponse(
      resp => resp.url().includes("/api/v1/admin/users/") && resp.url().includes("/unsuspend") && resp.request().method() === "PUT",
      { timeout: 15000 }
    );
    await page.locator('[data-testid="confirm-status-change"]').dispatchEvent('click');
    await unsuspendResponse;
    
    await expect(page.locator('text=/User successfully unsuspended/i')).toBeVisible({ timeout: 10000 });
    await expect(toggleBtn).toHaveText("Suspend");

    // 4. Retry buyer login and verify it succeeds
    const verifyOtpResponse2 = buyerPage.waitForResponse(
      resp => resp.url().includes("/api/v1/auth/buyer/verify-otp") && resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await buyerPage.locator('button:has-text("Verify")').click();
    await verifyOtpResponse2;
    
    await expect(buyerPage).toHaveURL(/\/$/, { timeout: 15000 });
    await expect(buyerPage.locator('button[aria-label="Profile"]')).toBeVisible({ timeout: 15000 });

    await buyerContext.close();
  });

  // E2E-039: Audit Log Verification
  test("E2E-039: Audit Log Verification", async ({ page }) => {
    // 1. Log in as admin and navigate to Audit Logs
    await loginAsAdmin(page);
    await page.locator("text=Audit Logs").filter({ visible: true }).first().click();
    await expect(page.locator("h1", { hasText: "Platform Audit Logs" })).toBeVisible({ timeout: 15000 });

    // We should see logs for operations performed in other tests, or trigger one here (like resetting status)
    // Verify columns and read-only properties
    await expect(page.locator("text=Timestamp").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Actor").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Action").first()).toBeVisible({ timeout: 15000 });

    // Assert that no dynamic edit or delete buttons exist to ensure log immutability
    await expect(page.locator('button:has-text("Edit")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Delete")')).not.toBeVisible();
  });
});
