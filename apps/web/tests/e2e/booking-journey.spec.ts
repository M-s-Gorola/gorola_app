import { test, expect } from '@playwright/test';

test.describe('Booking Journey Pipeline E2E', () => {
  test.setTimeout(120000);

  // Setup isE2E global flag before each test
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });
  });

  async function loginAsBuyer(page: any, phone: string) {
    await page.goto('http://127.0.0.1:5180/login');
    await page.locator('#buyer-phone').fill(phone);
    await page.locator('button', { hasText: /Send OTP/i }).click();
    
    // Wait for OTP screen
    await expect(page.locator('text=/Enter OTP/i')).toBeVisible({ timeout: 15000 });
    
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-digit-${i}"]`).fill((i + 1).toString());
      await page.waitForTimeout(100);
    }
    await page.locator('button', { hasText: /Verify/i }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
    
    // Wait for bootstrap/hydration to finish
    await expect(page.locator('text=/Restoring your session/i')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('button[aria-label="Profile"]')).toBeVisible({ timeout: 15000 });
  }

  async function loginAsStoreOwner(page: any, email: string) {
    await page.goto('http://store.gorola.com:5180/login');
    await page.locator('#store-login-email').fill(email);
    await page.locator('#store-login-password').fill('Owner#123');
    await page.locator('button', { hasText: /Login/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  }

  async function ensureAddressSelected(page: any) {
    const addressRadio = page.locator('input[name="booking-address"]');
    if (await addressRadio.count() === 0) {
      // Click Add New
      await page.locator('button', { hasText: /Add New|Add your first address/i }).first().click();
      await page.locator('input[name="label"]').fill('E2E Diagnostic Lab');
      await page.locator('[name="landmarkDescription"]').fill('Opposite the Aarna Main Hospital');
      await page.locator('button', { hasText: /Save Address/i }).click();
      await expect(page.locator('text=/Address added successfully/i')).toBeVisible({ timeout: 15000 });
    }
    await page.locator('input[name="booking-address"]').first().click();
  }

  test('E2E-030: Buyer Fasting Rules, Store Approval, and Store Booking Completion', async ({ browser }) => {
    // 1. Initialize Buyer and Store Owner independent contexts
    const buyerContext = await browser.newContext();
    const storeContext = await browser.newContext();
    
    const buyerPage = await buyerContext.newPage();
    const storePage = await storeContext.newPage();

    // Enable isE2E flag on both pages
    await buyerPage.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });
    await storePage.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });

    // 2. Buyer Checkout Flow
    await loginAsBuyer(buyerPage, '9876543214');
    
    // Navigate Category -> Single sub-category skips selection
    const medicalTestsCard = buyerPage.locator('[data-testid="category-card"]', { hasText: /Medical tests/i });
    await expect(medicalTestsCard).toBeVisible({ timeout: 15000 });
    await medicalTestsCard.click();

    // Assert smart redirect skips selection and goes to /categories/medical-tests/all-tests
    await expect(buyerPage).toHaveURL(/\/categories\/medical-tests\/all-tests/, { timeout: 15000 });

    // Select Blood Sugar (Fasting) product
    const bloodSugarProduct = buyerPage.locator('[data-testid="product-card"]', { hasText: /Blood Sugar \(Fasting\)/i });
    await expect(bloodSugarProduct).toBeVisible({ timeout: 15000 });
    await bloodSugarProduct.locator('a').first().click();

    // Assert Product Detail Page for Booking Store type has "Book Now" and no retail cart buttons
    await expect(buyerPage).toHaveURL(/\/products\/[a-zA-Z0-9-_]+/, { timeout: 15000 });
    const bookNowBtn = buyerPage.locator('button', { hasText: /Book Now/i });
    await expect(bookNowBtn).toBeVisible({ timeout: 15000 });
    await expect(buyerPage.locator('button', { hasText: /Add to cart/i })).not.toBeVisible();

    // Proceed to scheduling picker
    await bookNowBtn.click();
    await expect(buyerPage).toHaveURL(/\/bookings\/new/, { timeout: 15000 });

    // Assert Fasting banner and Morning Timeslot lock rules are enforced
    await expect(buyerPage.locator('text=/requires fasting/i')).toBeVisible({ timeout: 15000 });
    const morningSlotBtn = buyerPage.locator('button', { hasText: '06:00-09:00' });
    await expect(morningSlotBtn).toBeVisible();
    await expect(morningSlotBtn).toBeEnabled();

    // Non-morning slots (like afternoon/evening) are disabled or blocked
    const afternoonSlotBtn = buyerPage.locator('button', { hasText: '12:00-15:00' });
    if (await afternoonSlotBtn.count() > 0) {
      await expect(afternoonSlotBtn).toBeDisabled();
    }

    // Select date 2 days in the future to prevent timezone/midnight mismatches
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 2);
    const bookingDateStr = bookingDate.toISOString().split('T')[0];
    await buyerPage.locator('#booking-date').fill(bookingDateStr);

    // Click Timeslot
    await morningSlotBtn.click();

    // Select/Create address
    await ensureAddressSelected(buyerPage);

    // Confirm Booking
    const confirmBookingBtn = buyerPage.locator('button', { hasText: /Confirm Booking/i });
    await expect(confirmBookingBtn).toBeEnabled({ timeout: 10000 });
    await confirmBookingBtn.click();

    // Assert landing on receipt page in Pending Approval status
    await expect(buyerPage).toHaveURL(/\/bookings\/(?!new\b)[a-zA-Z0-9-_]+/, { timeout: 20000 });
    await expect(buyerPage.locator('text=/Pending Approval/i')).toBeVisible({ timeout: 15000 });

    // 3. Store Owner Portal Approval
    await loginAsStoreOwner(storePage, 'owner3@gorola.in');
    
    // In-app sidebar navigation to preserve in-memory session tokens
    await storePage.locator('text=Bookings').filter({ visible: true }).first().click();
    await expect(storePage.locator('h1', { hasText: 'Bookings Dashboard' })).toBeVisible({ timeout: 15000 });

    // Under Pending tab, click the booking card to open details modal
    await storePage.locator('text=View Details').first().click();

    // Now the Approve button in the modal should be visible
    const approveBtn = storePage.getByRole("button", { name: "Approve Booking" }).first();
    await expect(approveBtn).toBeVisible({ timeout: 15000 });
    await approveBtn.click({ force: true });

    // Confirm the status update dialog
    const confirmApproveBtn = storePage.getByRole("button", { name: "Confirm" }).first();
    await expect(confirmApproveBtn).toBeVisible({ timeout: 15000 });
    await confirmApproveBtn.click({ force: true });

    // Confirm booking moves to Approved tab
    await storePage.locator('button[role="tab"]', { hasText: /approved/i }).click();

    // Click upcoming card to open details modal
    await storePage.locator('text=View Details').first().click();

    // 4. Assert Live Socket update on Buyer's screen: Pending Approval -> Confirmed
    await expect(buyerPage.locator('text=/Confirmed/i').first()).toBeVisible({ timeout: 25000 });

    // 5. Store Owner marks the booking as On The Way
    const markOnTheWayBtn = storePage.locator('button', { hasText: 'Mark On The Way' }).first();
    await expect(markOnTheWayBtn).toBeVisible({ timeout: 15000 });
    await markOnTheWayBtn.click({ force: true });

    // Confirm the status update dialog for dispatch
    const confirmDispatchBtn = storePage.getByRole("button", { name: "Confirm" }).first();
    await expect(confirmDispatchBtn).toBeVisible({ timeout: 15000 });
    await confirmDispatchBtn.click({ force: true });

    // Assert Live Socket update on Buyer's screen: Confirmed -> Technician On The Way
    await expect(buyerPage.locator('text=/Technician On The Way/i').first()).toBeVisible({ timeout: 25000 });

    // Click on On The Way tab
    await storePage.locator('button[role="tab"]', { hasText: /on the way/i }).click();

    // Click card to open details modal
    await storePage.locator('text=View Details').first().click();

    // Store Owner completes the booking (Phase 7.8.1 completion button)
    const markCompletedBtn = storePage.locator('button', { hasText: 'Mark Completed' }).first();
    await expect(markCompletedBtn).toBeVisible({ timeout: 15000 });
    await markCompletedBtn.click({ force: true });

    // Confirm the status update dialog for completion
    const confirmCompleteBtn = storePage.getByRole("button", { name: "Confirm" }).first();
    await expect(confirmCompleteBtn).toBeVisible({ timeout: 15000 });
    await confirmCompleteBtn.click({ force: true });

    // Confirm booking moves to History tab
    await storePage.locator('button[role="tab"]', { hasText: /history/i }).click();
    await expect(storePage.locator('text=/COMPLETED/i').first()).toBeVisible({ timeout: 15000 });

    // 6. Assert Live Socket update on Buyer's screen: Technician On The Way -> Completed ("Service Done")
    await expect(buyerPage.locator('text=/Service Done/i')).toBeVisible({ timeout: 25000 });

    // Clean up browser contexts
    await buyerContext.close();
    await storeContext.close();
  });

  test('E2E-031: Store Owner Booking Rejection and Reason Display', async ({ browser }) => {
    const buyerContext = await browser.newContext();
    const storeContext = await browser.newContext();
    
    const buyerPage = await buyerContext.newPage();
    const storePage = await storeContext.newPage();

    await buyerPage.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });
    await storePage.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });

    // 1. Buyer creates second booking
    await loginAsBuyer(buyerPage, '9876543214');
    const medicalTestsCard = buyerPage.locator('[data-testid="category-card"]', { hasText: /Medical tests/i });
    await expect(medicalTestsCard).toBeVisible({ timeout: 15000 });
    await medicalTestsCard.click();
    await expect(buyerPage).toHaveURL(/\/categories\/medical-tests\/all-tests/, { timeout: 15000 });
    const bloodSugarProduct = buyerPage.locator('[data-testid="product-card"]', { hasText: /Blood Sugar \(Fasting\)/i });
    await expect(bloodSugarProduct).toBeVisible({ timeout: 15000 });
    await bloodSugarProduct.locator('a').first().click();

    const bookNowBtn = buyerPage.locator('button', { hasText: /Book Now/i });
    await bookNowBtn.click();

    // Select date 2 days in the future to prevent timezone/midnight mismatches
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 2);
    const bookingDateStr = bookingDate.toISOString().split('T')[0];
    await buyerPage.locator('#booking-date').fill(bookingDateStr);

    // Morning timeslot
    await buyerPage.locator('button', { hasText: '06:00-09:00' }).click();
    
    // Select/Create address
    await ensureAddressSelected(buyerPage);

    // Confirm Booking
    const confirmBookingBtn = buyerPage.locator('button', { hasText: /Confirm Booking/i });
    await confirmBookingBtn.click();

    // Assert landing on receipt page in Pending Approval
    await expect(buyerPage).toHaveURL(/\/bookings\/(?!new\b)[a-zA-Z0-9-_]+/, { timeout: 20000 });
    await expect(buyerPage.locator('text=/Pending Approval/i')).toBeVisible({ timeout: 15000 });

    // 2. Store Owner Rejection Flow
    await loginAsStoreOwner(storePage, 'owner3@gorola.in');
    
    // In-app sidebar navigation to preserve in-memory session tokens
    await storePage.locator('text=Bookings').filter({ visible: true }).first().click();

    // Click card to open modal
    await storePage.locator('text=View Details').first().click();

    const rejectBtn = storePage.locator('button', { hasText: 'Reject' }).first();
    await expect(rejectBtn).toBeVisible({ timeout: 15000 });
    await rejectBtn.click({ force: true });

    // Input rejection reason
    const reasonTextarea = storePage.locator('textarea[placeholder*="reason"]');
    await expect(reasonTextarea).toBeVisible({ timeout: 10000 });
    await reasonTextarea.fill('Equipment failure');

    const confirmRejectBtn = storePage.locator('button', { hasText: /Confirm Rejection/i });
    await confirmRejectBtn.click();

    // Verify booking moved to History tab
    await storePage.locator('button[role="tab"]', { hasText: /history/i }).click();
    await expect(storePage.locator('text=/REJECTED/i').first()).toBeVisible({ timeout: 15000 });

    // 3. Assert Live Socket update on Buyer's screen: Pending Approval -> Rejected with reason
    await expect(buyerPage.locator('text=/Rejected/i').first()).toBeVisible({ timeout: 25000 });

    await expect(buyerPage.locator('text=/Equipment failure/i')).toBeVisible({ timeout: 15000 });

    await buyerContext.close();
    await storeContext.close();
  });

  test('E2E-032: Booking Lead Days Date Picker Restriction Validation', async ({ page }) => {
    await loginAsBuyer(page, '9876543214');
    const medicalTestsCard = page.locator('[data-testid="category-card"]', { hasText: /Medical tests/i });
    await expect(medicalTestsCard).toBeVisible({ timeout: 15000 });
    await medicalTestsCard.click();
    await expect(page).toHaveURL(/\/categories\/medical-tests\/all-tests/, { timeout: 15000 });
    const bloodSugarProduct = page.locator('[data-testid="product-card"]', { hasText: /Blood Sugar \(Fasting\)/i });
    await expect(bloodSugarProduct).toBeVisible({ timeout: 15000 });
    await bloodSugarProduct.locator('a').first().click();

    const bookNowBtn = page.locator('button', { hasText: /Book Now/i });
    await bookNowBtn.click();
    
    // Assert lead days minimum date selection constraint
    const dateInput = page.locator('#booking-date');
    const minAttr = await dateInput.getAttribute('min');
    
    // Lead days = 1, so minimum selectable date is tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    expect(minAttr).toBe(tomorrowStr);
  });
});
