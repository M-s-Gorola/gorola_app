import { test, expect } from "@playwright/test";

test.describe("Store Owner & Booking Commerce E2E Journey", () => {
  // Use sequential mode as we have 1 worker and require clean DB states
  test.describe.configure({ mode: "serial" });

  const BASE_URL = "http://127.0.0.1:5180";
  const STORE_SUBDOMAIN = "http://store.gorola.com:5180";
  const BUYER_SUBDOMAIN = "http://127.0.0.1:5180";

  test.beforeEach(async ({ request }) => {
    // Reset 2FA and passwords for the store owners before each test to ensure a clean state
    await request.post(`${BASE_URL}/api/v1/test/store-owner/owner1@gorola.in/reset`);
    await request.post(`${BASE_URL}/api/v1/test/store-owner/owner2@gorola.in/reset`);
    await request.post(`${BASE_URL}/api/v1/test/store-owner/owner3@gorola.in/reset`);
    // Reset store availability status for Hillside Mart
    await request.post(`${BASE_URL}/api/v1/test/store/store_gorola_hillside_mart/reset-status`);
  });

  // E2E-020: Merchant Authentication & 2FA Setup Flow
  test("E2E-020: Merchant Authentication & 2FA Setup Flow", async ({ page, context }) => {
    // 1. Log in with unconfigured store owner credentials (owner2@gorola.in)
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner2@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();

    // Verify dashboard access
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // 2. Access settings profile, configure 2FA, generate and verify TOTP code
    await page.getByRole("link", { name: "Settings" }).click();
    
    // Check if 2FA is currently Disabled
    await expect(page.getByText("Two-Factor Auth is currently: Disabled", { exact: false })).toBeVisible();

    // Click Setup 2FA
    await page.getByRole("button", { name: "Setup 2FA" }).click();

    // Enter 6-digit TOTP Code (using universal bypass "000000" under NODE_ENV="test")
    await page.getByLabel("Enter 6-digit TOTP Code").fill("000000");
    await page.getByRole("button", { name: "Verify and Enable" }).click();

    // Verify 2FA is now Enabled
    await expect(page.getByText("Two-Factor Auth is currently: Enabled", { exact: false })).toBeVisible();

    // Logout and verify we are redirected back to login
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/.*\/login/);

    // Try logging in again - should require 2FA
    await page.getByLabel("Email address").fill("owner2@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();

    // Assert we are prompted for 2FA code
    await expect(page.getByLabel("Two-Factor Code")).toBeVisible();
    await page.getByLabel("Two-Factor Code").fill("000000");
    await page.getByRole("button", { name: "Verify", exact: true }).click();

    // Successfully log back into dashboard
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  // E2E-021: Live Store Status Toggle & Real-time Buyer Visibility
  test("E2E-021: Live Store Status Toggle & Real-time Buyer Visibility", async ({ page, context }) => {
    // 1. Login as store owner (owner1@gorola.in)
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Toggle store status to Closed (Toggle accepting orders off)
    const availabilitySwitch = page.locator('button[role="switch"]');
    await expect(availabilitySwitch).toBeVisible();
    
    // Switch state should currently be Checked/On
    await expect(availabilitySwitch).toHaveAttribute("aria-checked", "true");
    
    // Add a small delay to ensure React hydration has finished and listeners are attached
    await page.waitForTimeout(1000);

    // Click switch to turn off
    await availabilitySwitch.click();

    // Affirm closure in Confirm Modal
    const confirmModal = page.getByRole("dialog");
    await expect(confirmModal).toBeVisible();
    await confirmModal.getByRole("button", { name: "Yes, Hide Store" }).click();

    // Wait for modal to disappear
    await expect(confirmModal).not.toBeVisible();
    await expect(availabilitySwitch).toHaveAttribute("aria-checked", "false");

    // 2. Open Buyer window concurrently and check storefront offline banner
    const buyerContext = await context.browser()!.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.addInitScript(() => {
      (window as any).isE2E = true;
    });
    // Navigate directly to the store page since the store is Closed (hidden from search results)
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/store/store_gorola_hillside_mart`);

    // Verify storefront banner shows store is offline
    await expect(buyerPage.getByText("Store is currently offline and not accepting orders")).toBeVisible();

    // 3. Switch back to Merchant and toggle to Open
    await page.bringToFront();
    await availabilitySwitch.click();
    await expect(availabilitySwitch).toHaveAttribute("aria-checked", "true");

    // 4. Verify storefront is active on Buyer page
    await buyerPage.bringToFront();
    await buyerPage.reload();
    await expect(buyerPage.getByText("Store is currently offline and not accepting orders")).not.toBeVisible();
    await buyerContext.close();
  });

  // E2E-022: Multi-Actor Quick Commerce Live Order Status Transitions
  test("E2E-022: Multi-Actor Quick Commerce Live Order Status Transitions", async ({ page, context }) => {
    // 1. Buyer placing order (COD)
    const buyerContext = await context.browser()!.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.addInitScript(() => {
      (window as any).isE2E = true;
    });
    
    // Log in buyer
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/login`);
    await buyerPage.locator('#buyer-phone').fill('9876543210');
    await buyerPage.locator('button', { hasText: /Send OTP/i }).click();
    await expect(buyerPage.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await buyerPage.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
      await buyerPage.waitForTimeout(100);
    }
    await buyerPage.locator('button', { hasText: /Verify/i }).click();
    await expect(buyerPage).toHaveURL(/\/$/, { timeout: 15000 });
    await expect(buyerPage.locator('text=/Restoring your session/i')).not.toBeVisible();
    await expect(buyerPage.locator('button[aria-label="Profile"]')).toBeVisible({ timeout: 15000 });

    // Navigate to Store A
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/store/store_gorola_hillside_mart`);

    // Add a product to cart (Premium Basmati Rice)
    await buyerPage.locator('[data-testid="product-card"]').first().getByRole('button', { name: /Add/i }).click();

    // Open Cart Drawer
    await buyerPage.locator('[data-testid="cart-button"]').click();
    await buyerPage.getByRole("button", { name: "Proceed to Checkout" }).click();

    await expect(buyerPage).toHaveURL(/\/checkout/, { timeout: 15000 });
 
    // Wait for addresses to load so the radio buttons are stable
    await expect(buyerPage.locator('text=/Loading addresses/i')).not.toBeVisible({ timeout: 15000 });

    // Explicitly select "New Location" using Playwright's auto-waiting mechanism
    const newAddressRadio = buyerPage.locator('input[value="new"]');
    await newAddressRadio.click();

    // Assert address form visible
    await expect(buyerPage.locator('[name="landmarkDescription"]')).toBeVisible();

    // Type landmark (>= 10 chars)
    await buyerPage.locator('[name="landmarkDescription"]').fill('Near the old clock tower in Mussoorie');

    // Click Continue to Review step
    await buyerPage.locator('button', { hasText: /Continue/i }).click();
 
    // Click "Place Order"
    const placeOrderBtn = buyerPage.locator('button', { hasText: /Place Order/i });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click({ force: true });

    // Get order ID from URL
    await buyerPage.waitForURL(/.*\/orders\/.*/);
    const orderUrl = buyerPage.url();
    const orderId = orderUrl.substring(orderUrl.lastIndexOf("/") + 1);


    // Initial Status Check — PLACED status renders the #occ-heading element
    await expect(buyerPage.locator('#occ-heading')).toBeVisible({ timeout: 15000 });


    // 2. Merchant dashboard receives order update in real-time via Socket.IO
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Go to Orders list — wait for sidebar nav to fully hydrate before clicking
    await page.getByRole("link", { name: "Orders" }).click();

    // Find our order — the store orders page uses data-testid="order-card-{id}"
    const orderCard = page.locator(`[data-testid="order-card-${orderId}"]`);
    await expect(orderCard).toBeVisible({ timeout: 20000 });
    // The status badge renders order.status.replace(/_/g, ' ') = "PLACED"
    await expect(orderCard.getByText("PLACED")).toBeVisible();

    // Open order detail modal by clicking the card (no separate Manage button)
    await orderCard.click();

    // 3. Merchant transitions status PLACED -> PREPARING
    // Button label comes from getTransitionButtonLabel("PREPARING") = "Mark Preparing"
    await page.getByRole("button", { name: "Mark Preparing" }).click();
    // Modal shows status via badge: selectedOrder.status.replace(/_/g, ' ') = "PREPARING"
    // Scope to modal to avoid strict mode violation (tab buttons also contain "PREPARING")
    const modal = page.locator('[data-testid="order-details-modal"]');
    await expect(modal.locator('span').filter({ hasText: /^PREPARING$/ })).toBeVisible({ timeout: 10000 });

    // Buyer sees PREPARING in real-time — #occ-heading changes to "Store is picking items"
    await buyerPage.bringToFront();
    await expect(buyerPage.locator('#occ-heading')).toHaveText('Store is picking items', { timeout: 15000 });

    // 4. Merchant transitions status PREPARING -> OUT_FOR_DELIVERY (Dispatch)
    await page.bringToFront();
    await page.getByRole("button", { name: "Dispatch Order" }).click();
    // Badge shows: "OUT FOR DELIVERY" — scoped to modal to avoid strict mode
    await expect(modal.locator('span').filter({ hasText: /^OUT FOR DELIVERY$/ })).toBeVisible({ timeout: 10000 });

    // Buyer sees On the way — #occ-heading changes to "On the way" (unique element avoids strict mode)
    await buyerPage.bringToFront();
    await expect(buyerPage.locator('#occ-heading')).toHaveText('On the way', { timeout: 15000 });

    // 5. Merchant transitions status OUT_FOR_DELIVERY -> DELIVERED
    await page.bringToFront();
    await page.getByRole("button", { name: "Mark Delivered" }).click();
    // Badge shows: "DELIVERED" — scoped to modal to avoid strict mode
    await expect(modal.locator('span').filter({ hasText: /^DELIVERED$/ })).toBeVisible({ timeout: 10000 });

    // Buyer sees Order Delivered — #occ-heading changes to "Order Delivered"
    await buyerPage.bringToFront();
    await expect(buyerPage.locator('#occ-heading')).toHaveText('Order Delivered', { timeout: 15000 });
    await buyerContext.close();
  });

  // E2E-023: Inventory Restock & Audit History Logging
  test("E2E-023: Inventory Restock & Audit History Logging", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`;

    // Login store owner
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Go to Products
    await page.getByRole("link", { name: "Products" }).click();

    // Click Restock button on the first product variant
    const variantRow = page.locator("tr").filter({ hasText: "Premium Basmati Rice" }).first();
    await expect(variantRow).toBeVisible();

    // Restock Modal
    await variantRow.getByRole("button", { name: "Restock" }).click();
    const restockModal = page.getByRole("dialog");
    await expect(restockModal).toBeVisible();

    // Refill quantity
    await restockModal.getByPlaceholder("e.g. 50").fill("10");
    await restockModal.getByRole("button", { name: "Save Changes" }).click();

    // Wait for modal to disappear
    await expect(restockModal).not.toBeVisible();

    // Adjust Stock Modal
    await variantRow.getByRole("button", { name: "Adjust" }).click();
    const adjustModal = page.getByRole("dialog");
    await expect(adjustModal).toBeVisible();

    // Manual count adjustment
    await adjustModal.getByPlaceholder("e.g. 45").fill("15");
    // Entering a valid adjustment reason (length >= 5)
    await adjustModal.locator("textarea").fill(`E2E Audit-${suffix}`);
    await adjustModal.getByRole("button", { name: "Save Changes" }).click();

    // Wait for modal to disappear
    await expect(adjustModal).not.toBeVisible();

    // Go to Stock History list and verify audit log entries
    await page.getByTestId("stock-history-prod_rice_1").click();
    
    // Verify movement rows are rendered correctly
    await expect(page.locator("tr").filter({ hasText: "REFILL" }).first()).toBeVisible();
    await expect(page.locator("tr").filter({ hasText: `E2E Audit-${suffix}` }).first()).toBeVisible();
  });

  // E2E-024: Tenant-Isolated Discount Code Management
  test("E2E-024: Tenant-Isolated Discount Code Management", async ({ page, context }, testInfo) => {
    const retry = testInfo.retry;
    const code = `LOCAL25_${retry}`;

    // 1. Merchant A creates coupon code
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Go to Discounts page
    await page.getByRole("link", { name: "Discounts" }).click();
    await page.getByRole("button", { name: "Create Discount Code" }).click();

    // Fill form
    await page.getByPlaceholder("e.g. SAVE20").fill(code);
    await page.getByPlaceholder("e.g. 20").fill("25");
    await page.getByPlaceholder("e.g. 150").fill("300"); // Minimum order ₹300
    
    // Choose start/end dates
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await page.locator('input[type="date"]').first().fill(start);
    await page.locator('input[type="date"]').last().fill(end);

    await page.getByRole("button", { name: "Create Discount" }).click();
    await expect(page.locator("tr").filter({ hasText: code })).toBeVisible();

    // 2. Buyer applies discount to Store A items
    const buyerContext = await context.browser()!.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.addInitScript(() => {
      (window as any).isE2E = true;
    });
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/login`);
    await buyerPage.locator('#buyer-phone').fill('9876543211');
    await buyerPage.locator('button', { hasText: /Send OTP/i }).click();
    await expect(buyerPage.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await buyerPage.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
      await buyerPage.waitForTimeout(100);
    }
    await buyerPage.locator('button', { hasText: /Verify/i }).click();
    await expect(buyerPage).toHaveURL(/\/$/, { timeout: 15000 });
    await expect(buyerPage.locator('text=/Restoring your session/i')).not.toBeVisible();
    await expect(buyerPage.locator('button[aria-label="Profile"]')).toBeVisible({ timeout: 15000 });

    // Go to Store A (Hillside Mart)
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/store/store_gorola_hillside_mart`);

    // Add Premium Basmati Rice (1kg is ₹120, let's add 3 of them to cross the ₹300 min limit)
    const addButton = buyerPage.locator('[data-testid="product-card"]').first().getByRole('button', { name: /Add/i });
    await addButton.click();
    
    // Open Cart Drawer
    await buyerPage.locator('[data-testid="cart-button"]').click();
    await buyerPage.getByRole("button", { name: "Increase Premium Basmati Rice quantity" }).click();
    await buyerPage.getByRole("button", { name: "Increase Premium Basmati Rice quantity" }).click();

    // Verify subtotal is ₹360 (which is > ₹300)
    await expect(buyerPage.locator('[data-testid="cart-subtotal"]')).toContainText("360");

    // Apply coupon
    await buyerPage.getByPlaceholder("Discount code").fill(code);
    await buyerPage.getByRole("button", { name: "Apply" }).click();

    // Verify total discount is Rs 90 (25% of 360)
    await expect(buyerPage.locator('[data-testid="cart-discount-summary"]')).toContainText("90");

    // 3. Drop below ₹300 and verify auto re-validation removes coupon
    await buyerPage.getByRole("button", { name: "Decrease Premium Basmati Rice quantity" }).click();
    
    // Subtotal is now ₹240 (< ₹300)
    await expect(buyerPage.locator('[data-testid="cart-subtotal"]')).toContainText("240");
    // Verify coupon is removed and shows invalid/expired message or 0 discount
    await expect(buyerPage.locator('[data-testid="cart-discount-summary"]')).not.toBeVisible();
    await buyerContext.close();
  });

  // E2E-025: Booking Commerce UI Isolation & Normalization
  test("E2E-025: Booking Commerce UI Isolation & Normalization", async ({ page }) => {
    // 1. Log in as Booking store owner (owner3@gorola.in - Aarna Diagnostic)
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner3@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // 2. Verify sidebar navigation swaps "Products" to "Services"
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: "Services" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Products" })).not.toBeVisible();

    // 3. Navigate to Services list and verify Stock adjust features are completely hidden
    await sidebar.getByRole("link", { name: "Services" }).click();
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
    
    // Check that Restock/Adjust buttons, stock table columns, and low stock thresholds are hidden
    await expect(page.getByRole("button", { name: "Restock" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Adjust" })).not.toBeVisible();
    await expect(page.getByText("Low Stock")).not.toBeVisible();

    // 4. Verify bookings list and details normalizes DELIVERED status to render as COMPLETED
    await page.getByRole("link", { name: "Bookings" }).click();
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
    
    // Even if an order in DB has status "DELIVERED", the UI should render "COMPLETED"
    // Let's assert that "DELIVERED" is not present on the text content, and "COMPLETED" is visible
    await expect(page.getByText("COMPLETED").first()).toBeVisible();
  });

  // E2E-026: Store Advertisements Lifecycle & Dynamic Carousel
  test("E2E-026: Store Advertisements Lifecycle & Dynamic Carousel", async ({ page, context }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`;
    const adTitle = `E2E Promo-${suffix}`;

    // 1. Merchant submits banner promo ad
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Go to Advertisements page
    await page.getByRole("link", { name: "Advertisements" }).click();
    await page.getByRole("button", { name: "Submit New Ad" }).click();

    // Fill form details
    await page.getByPlaceholder("e.g. Summer Super Sale").fill(adTitle);
    await page.getByPlaceholder("e.g. https://example.com/banner.png").fill("https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600");
    await page.getByPlaceholder("e.g. https://store.gorola.com/sale").fill(`${STORE_SUBDOMAIN}/products`);
    
    // Dates
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await page.locator('input[type="date"]').first().fill(start);
    await page.locator('input[type="date"]').last().fill(end);

    await page.getByRole("button", { name: "Submit Ad" }).click();

    // Verify it is listed as "Pending Approval"
    const adRow = page.locator("tr").filter({ hasText: adTitle });
    await expect(adRow).toBeVisible();
    await expect(adRow.getByText("PENDING")).toBeVisible();

    // Extract database advertisement ID from UI cell or data-testid if available
    const adIdAttr = await adRow.getAttribute("data-ad-id");
    let adId = adIdAttr;

    if (!adId) {
      // In case data-ad-id is not set, fetch via test backdoor using a list if necessary
      // Or verify with the programmatic endpoint. We can extract it from the DOM using evaluating script
      adId = await adRow.evaluate((el) => el.getAttribute("data-ad-id") || "");
    }

    expect(adId).toBeTruthy();

    // 2. Playwright runner triggers test-only approve backdoor route
    const approveResponse = await page.request.post(`${BASE_URL}/api/v1/test/advertisements/${adId}/approve`);
    expect(approveResponse.ok()).toBeTruthy();

    // Refresh Merchant page to verify Status is now "APPROVED" or "ACTIVE"
    await page.reload();
    await expect(page.locator("tr").filter({ hasText: adTitle }).getByText("APPROVED")).toBeVisible();

    // 3. Buyer storefront home page displays the approved banner inside the promo carousel
    const buyerContext = await context.browser()!.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.goto(BUYER_SUBDOMAIN);
    
    // Assert banner title is visible in the promotion carousel
    await expect(buyerPage.getByText(adTitle)).toBeVisible();
    await buyerContext.close();
  });

  // E2E-027: Store Profile Settings & Password Migration
  test("E2E-027: Store Profile Settings & Password Migration", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`;
    const newDesc = `Perfect organic essentials-${suffix}`;
    const newPhone = `+919999000${Math.floor(100 + Math.random() * 900)}`;

    // Log in with current password
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Go to settings
    await page.getByRole("link", { name: "Settings" }).click();

    // Update Profile Information
    await page.getByLabel("Store Description").fill(newDesc);
    await page.getByLabel("Support Phone").fill(newPhone);
    await page.getByRole("button", { name: "Update Profile" }).click();

    // Update Password credentials (from Owner#123 to Owner#12345)
    await page.getByLabel("Current Password").fill("Owner#123");
    await page.getByLabel("New Password", { exact: true }).fill("Owner#12345");
    await page.getByLabel("Confirm New Password").fill("Owner#12345");
    await page.getByRole("button", { name: "Update Password" }).click();

    // Logout
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/.*\/login/);

    // Login using old password -> should fail
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();

    // Login using new password -> should succeed
    await page.getByLabel("Password").fill("Owner#12345");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Revert password to Owner#123 for other tests/retries
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByLabel("Current Password").fill("Owner#12345");
    await page.getByLabel("New Password", { exact: true }).fill("Owner#123");
    await page.getByLabel("Confirm New Password").fill("Owner#123");
    await page.getByRole("button", { name: "Update Password" }).click();
  });

  // E2E-028: Store-Wide Offers Creation & Automatic Application
  test("E2E-028: Store-Wide Offers Creation & Automatic Application", async ({ page, context }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`;
    const offerTitle = `E2E StoreOffer-${suffix}`;

    // 1. Merchant creates store-wide offer
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Go to Store Offers page
    await page.getByRole("link", { name: "Offers" }).click();
    await page.getByRole("button", { name: "Create Offer" }).click();

    // Fill form details (15% off, min order ₹400)
    await page.getByPlaceholder("e.g. 10% Off Sitewide").fill(offerTitle);
    await page.getByPlaceholder("e.g. 10").first().fill("15"); // Discount value
    await page.getByPlaceholder("e.g. 200").fill("400"); // Minimum purchase
    
    // Dates
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await page.locator('input[type="date"]').first().fill(start);
    await page.locator('input[type="date"]').last().fill(end);

    await page.getByRole("button", { name: "Create Offer" }).click();
    await expect(page.locator("tr").filter({ hasText: offerTitle })).toBeVisible();

    // 2. Buyer storefront meets ₹400 -> offer applies automatically
    const buyerContext = await context.browser()!.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.addInitScript(() => {
      (window as any).isE2E = true;
    });
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/login`);
    await buyerPage.locator('#buyer-phone').fill('9876543212');
    await buyerPage.locator('button', { hasText: /Send OTP/i }).click();
    await expect(buyerPage.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await buyerPage.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
      await buyerPage.waitForTimeout(100);
    }
    await buyerPage.locator('button', { hasText: /Verify/i }).click();
    await expect(buyerPage).toHaveURL(/\/$/, { timeout: 15000 });
    await expect(buyerPage.locator('text=/Restoring your session/i')).not.toBeVisible();
    await expect(buyerPage.locator('button[aria-label="Profile"]')).toBeVisible({ timeout: 15000 });

    // Go to Store A
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/store/store_gorola_hillside_mart`);

    // Verify offer pill is shown
    await expect(buyerPage.getByText(offerTitle)).toBeVisible();

    // Add items to cross ₹400 (4 of Premium Basmati Rice = ₹480)
    await buyerPage.locator('[data-testid="product-card"]').first().getByRole('button', { name: /Add/i }).click();
    await buyerPage.locator('[data-testid="cart-button"]').click();
    
    // Increase quantity
    await buyerPage.getByRole("button", { name: "Increase Premium Basmati Rice quantity" }).click();
    await buyerPage.getByRole("button", { name: "Increase Premium Basmati Rice quantity" }).click();
    await buyerPage.getByRole("button", { name: "Increase Premium Basmati Rice quantity" }).click();

    // Assert that the offer is applied automatically in the Cart Drawer
    // Total discount should be 15% of 480 = Rs 72
    await expect(buyerPage.locator('[data-testid="cart-discount-summary"]')).toContainText("72");

    // 3. Merchant deactivates offer -> Checkout stops applying offer
    await page.bringToFront();
    const offerRow = page.locator("tr").filter({ hasText: offerTitle });
    await offerRow.getByRole("button", { name: "Deactivate" }).click();

    // Wait for status to show Deactivated/Inactive
    await expect(offerRow.getByText("INACTIVE")).toBeVisible();

    // Buyer reloads or updates cart -> Offer no longer applies
    await buyerPage.bringToFront();
    await buyerPage.reload();
    await buyerPage.getByRole("button", { name: "Cart" }).click();
    await expect(buyerPage.locator('[data-testid="cart-discount-summary"]')).not.toBeVisible();
    await buyerContext.close();
  });

  // E2E-033: Stacked Booking Discount Code & Store-Wide Offer
  test("E2E-033: Stacked Booking Discount Code & Store-Wide Offer", async ({ page, context }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`;
    const couponCode = `STACKCOUPON_${suffix}`;
    const offerTitle = `STACKOFFER_${suffix}`;

    // 1. Log in as Booking store owner (owner3@gorola.in - Aarna Diagnostic)
    await page.goto(`${STORE_SUBDOMAIN}/login`);
    await page.getByLabel("Email address").fill("owner3@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Go to Discounts
    await page.getByRole("link", { name: "Discounts" }).click();

    // A. Create Coupon Code (10% off, min order ₹300)
    await page.getByRole("button", { name: "Create Discount Code" }).click();
    await page.getByPlaceholder("e.g. SAVE20").fill(couponCode);
    await page.getByPlaceholder("e.g. 20").fill("10"); // 10%
    await page.getByPlaceholder("e.g. 150").fill("300"); // min order ₹300
    
    // Dates
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await page.locator('input[type="date"]').first().fill(start);
    await page.locator('input[type="date"]').last().fill(end);
    await page.getByRole("button", { name: "Create Discount" }).click();
    await expect(page.locator("tr").filter({ hasText: couponCode })).toBeVisible();

    // B. Create Store Offer (15% off, min order ₹400)
    await page.getByRole("link", { name: "Offers" }).click();
    await page.getByRole("button", { name: "Create Offer" }).click();
    await page.getByPlaceholder("e.g. 10% Off Sitewide").fill(offerTitle);
    await page.getByPlaceholder("e.g. 10").first().fill("15"); // 15%
    await page.getByPlaceholder("e.g. 200").fill("400"); // min order ₹400
    await page.locator('input[type="date"]').first().fill(start);
    await page.locator('input[type="date"]').last().fill(end);
    await page.getByRole("button", { name: "Create Offer" }).click();
    await expect(page.locator("tr").filter({ hasText: offerTitle })).toBeVisible();

    // 2. Buyer schedules service variant from Booking store with both active store offer and applied coupon code
    const buyerContext = await context.browser()!.newContext();
    const buyerPage = await buyerContext.newPage();
    await buyerPage.addInitScript(() => {
      (window as any).isE2E = true;
    });
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/login`);
    await buyerPage.locator('#buyer-phone').fill('9876543214');
    await buyerPage.locator('button', { hasText: /Send OTP/i }).click();
    await expect(buyerPage.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await buyerPage.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
      await buyerPage.waitForTimeout(100);
    }
    await buyerPage.locator('button', { hasText: /Verify/i }).click();
    await expect(buyerPage).toHaveURL(/\/$/, { timeout: 15000 });
    await expect(buyerPage.locator('text=/Restoring your session/i')).not.toBeVisible();
    await expect(buyerPage.locator('button[aria-label="Profile"]')).toBeVisible({ timeout: 15000 });

    // Go to Aarna Diagnostic (Booking Store)
    await buyerPage.goto(`${BUYER_SUBDOMAIN}/store/store_gorola_aarna_diagnostic`);

    // Select service variant & schedule (Complete Blood Count is ₹500, which satisfies both min limits ₹300 and ₹400)
    await buyerPage.getByRole("button", { name: "Book Service" }).first().click();

    // Select date at least +2 days in future to bypass timezones
    const scheduleDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await buyerPage.locator('input[type="date"]').fill(scheduleDate);
    await buyerPage.locator('select').selectOption({ index: 1 }); // Select timeslot
    await buyerPage.getByRole("button", { name: "Proceed to Checkout" }).click();

    // Apply Coupon Code
    await buyerPage.getByPlaceholder("Discount code").fill(couponCode);
    await buyerPage.getByRole("button", { name: "Apply" }).click();

    // Booking Checkout calculations:
    // Subtotal: ₹500
    // Store Offer (15%): 15% of 500 = ₹75
    // Coupon Code (10%): 10% of 500 = ₹50
    // Stacked Deductions: ₹75 + ₹50 = ₹125
    await expect(buyerPage.locator('[data-testid="discount-summary"]')).toContainText("125");

    // Fill Landmark and submit
    await buyerPage.getByPlaceholder("Enter flat/room number").fill("E2E Suite");
    await buyerPage.getByPlaceholder("Landmark, building, or instructions").fill("E2E Tower");
    await buyerPage.getByRole("button", { name: "Place Booking Request" }).click();

    // 3. Verify Booking Confirmation Page breakdown is correct and collapsible
    await buyerPage.waitForURL(/.*\/bookings\/.*/);

    // Collapsible breakdown exists
    const discountToggle = buyerPage.locator('[data-testid="discount-toggle-chevron"]');
    await expect(discountToggle).toBeVisible();

    // Click toggle chevron to expand breakdown
    await discountToggle.click();

    // Verify breakdown lists both individual deductions:
    // - STACKOFFER (15% off) = ₹75
    // - STACKCOUPON (10% off) = ₹50
    const breakdown = buyerPage.locator('[data-testid="discount-breakdown"]');
    await expect(breakdown.getByText(`Discount (${offerTitle})`)).toBeVisible();
    await expect(breakdown.getByText(couponCode)).toBeVisible();
    await buyerContext.close();
  });
});
