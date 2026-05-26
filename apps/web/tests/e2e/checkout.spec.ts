import { test, expect } from '@playwright/test';

test.describe('Checkout & Account', () => {
  test.setTimeout(90000);
  
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { isE2E?: boolean }).isE2E = true;
    });
    // Each test handles its own login for total isolation
  });

  async function loginAs(page: any, phone: string) {
    await page.goto('/login');
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
    // Wait for bootstrap to finish
    await expect(page.locator('text=/Restoring your session/i')).not.toBeVisible();
    await expect(page.locator('button[aria-label="Profile"]')).toBeVisible({ timeout: 15000 });
  }

  test('E2E-008: Checkout -> Order Confirmation', async ({ page }) => {
    await loginAs(page, '9876543211');
    // Verify login
    await expect(page.locator('[data-testid="cart-button"]')).toBeVisible();

    // Add item to cart via UI navigation for stability
    await page.goto('/');
    await page.locator('[data-testid="category-card"]').first().click();
    await page.locator('[data-testid="subcategory-card"]').first().click();
    
    const addBtn = page.locator('button', { hasText: /Add/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    
    // Wait for the cart to be saved to the server after clicking Add
    const cartSavePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/v1/cart') && resp.request().method() === 'POST',
      { timeout: 15000 }
    );
    await addBtn.click({ force: true });
    await cartSavePromise;

    // Open cart -> Proceed to Checkout
    await page.locator('[data-testid="cart-button"]').click();
    await expect(page.locator('aside', { hasText: /Your cart/i })).toBeVisible();
    
    await page.locator('button', { hasText: /Proceed to Checkout/i }).click();
 
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
 
    // Wait for addresses to load so the radio buttons are stable
    await expect(page.locator('text=/Loading addresses/i')).not.toBeVisible({ timeout: 15000 });

    // Explicitly select "New Location" using Playwright's auto-waiting mechanism
    const newAddressRadio = page.locator('input[value="new"]');
    await newAddressRadio.click();

    // Assert address form visible
    await expect(page.locator('[name="landmarkDescription"]')).toBeVisible();

    // Type landmark (>= 10 chars)
    await page.locator('[name="landmarkDescription"]').fill('Near the old clock tower in Mussoorie');

    // Click Continue to Review step
    await page.locator('button', { hasText: /Continue/i }).click();
 
    // Click "Place Order" and wait for response
    const placeOrderBtn = page.locator('button', { hasText: /Place Order/i });
    await expect(placeOrderBtn).toBeVisible();
    
    const responsePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/v1/orders') && resp.request().method() === 'POST',
      { timeout: 15000 }
    );
    
    await expect(placeOrderBtn).toBeEnabled({ timeout: 10000 });
    await placeOrderBtn.click({ force: true });
    await responsePromise;

    // Assert navigation to confirmation page
    await expect(page).toHaveURL(/\/orders\/[a-z0-9-]+/);
    await page.waitForTimeout(2000); // Wait for animations and hydration
 
    // Assert confirmation details
    await expect(page.locator('#occ-heading')).toHaveText(/Thank you/i, { timeout: 15000 });
    await expect(page.locator('[data-testid="order-subtotal"]')).toBeVisible();
    await expect(page.locator('text=/Hillside Mart/i').first()).toBeVisible();
  });

  test('E2E-011: Profile Page Flow', async ({ page }) => {
    await loginAs(page, '9876543212');
    // Navigate to Profile
    await page.locator('button[aria-label="Profile"]').click();
    await page.locator('text=/Profile/i').first().click();

    await expect(page).toHaveURL(/\/profile/);

    // Assert phone
    await expect(page.locator('text=/9876543212/')).toBeVisible();

    // Update name
    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill('Playwright Tester');
    await page.locator('button', { hasText: /Update Name/i }).click();

    // Assert success toast
    await expect(page.locator('text=/Profile updated successfully/i')).toBeVisible();

    // Navigate Home and check greeting
    await page.goto('/');
    await expect(page.locator('.hero-greeting')).toHaveText(/Playwright Tester/i);
  });

  test('E2E-012: Saved Addresses CRUD', async ({ page }, testInfo) => {
    await loginAs(page, '9876543213');
    // Unique label prevents "Strict Mode" violations if the test retries or runs in parallel projects
    const uniqueLabel = `Home-${testInfo.project.name}-${testInfo.retry}`;

    // Navigate to Profile then Saved Addresses
    await page.locator('button[aria-label="Profile"]').click();
    await page.locator('text=/Profile/i').first().click();
    await expect(page.locator('h1')).toHaveText(/Your Profile/i, { timeout: 10000 });
    await page.locator('a:has-text("Saved Addresses")').click();
    await expect(page).toHaveURL(/\/account\/addresses/);
    await expect(page.locator('h1')).toHaveText(/Saved Addresses/i, { timeout: 15000 });
 
    // Add New Address
    await page.getByRole('button', { name: /Add New/i }).click();
    await page.locator('input[name="label"]').fill(uniqueLabel);
    await page.locator('[name="landmarkDescription"]').fill('Opposite Savoy Hotel, Landour');
    const saveBtn = page.locator('button', { hasText: /Save Address/i });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await saveBtn.scrollIntoViewIfNeeded();

    const refreshPromise = page.waitForResponse(async (resp) => {
      if (resp.url().includes('/api/v1/addresses') && resp.request().method() === 'GET') {
        const json = await resp.json().catch(() => ({}));
        return json.data?.addresses?.some((a: any) => a.label === uniqueLabel);
      }
      return false;
    }, { timeout: 20000 });

    await Promise.all([
      refreshPromise,
      page.evaluate((btn) => (btn as HTMLButtonElement).click(), await saveBtn.elementHandle())
    ]);

    // Assert success toast
    await expect(page.locator('text=/Address added successfully/i')).toBeVisible();
    await page.waitForTimeout(1000); // Allow React state and animations to settle
 
    // Assert card appears with the UNIQUE label
    const addressCard = page.locator('[data-testid="address-card"]', { hasText: uniqueLabel });
    await expect(addressCard).toBeVisible({ timeout: 15000 });

    // Set as Default
    const menuBtn = addressCard.locator('button[aria-haspopup="menu"]');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    
    const defaultItem = page.getByRole('menuitem', { name: /Set as Default/i });
    await expect(defaultItem).toBeVisible({ timeout: 10000 });

    // 1. Hook the GET address network response representing the post-update refresh
    const defaultRefreshPromise = page.waitForResponse(async (resp) => {
      if (resp.url().includes('/api/v1/addresses') && resp.request().method() === 'GET') {
        const json = await resp.json().catch(() => ({}));
        // Check that our modified address card is returned with its default state true
        return json.data?.addresses?.some((a: any) => a.label === uniqueLabel && a.isDefault === true);
      }
      return false;
    }, { timeout: 20000 });

    // 2. Click "Set as Default"
    await defaultItem.click();

    // 3. Wait for database and UI state synchronization to settle 100%
    await defaultRefreshPromise;
    await expect(addressCard.locator('[data-testid="default-badge"]')).toBeVisible();
 
    // Delete
    page.on('dialog', dialog => dialog.accept());
    await menuBtn.click();
    const deleteItem = page.getByRole('menuitem', { name: /Delete/i });
    await expect(deleteItem).toBeVisible({ timeout: 10000 });
    await deleteItem.click();
    
    // Explicitly wait for the card to disappear
    await expect(addressCard).not.toBeVisible({ timeout: 10000 });
  });
});
