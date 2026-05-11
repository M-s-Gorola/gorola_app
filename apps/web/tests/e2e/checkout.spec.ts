import { test, expect } from '@playwright/test';

test.describe('Checkout & Account', () => {
  test.setTimeout(60000);
  
  test.beforeEach(async ({ page }) => {
    // Log in before each test in this describe block
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
  });

  test('E2E-008: Checkout -> Order Confirmation', async ({ page }) => {
    // Verify login
    await expect(page.locator('[data-testid="cart-button"]')).toBeVisible();

    // Add item to cart via UI navigation for stability
    await page.goto('/');
    await page.locator('[data-testid="category-card"]').first().click();
    await page.locator('[data-testid="subcategory-card"]').first().click();
    
    const addBtn = page.locator('button', { hasText: /Add/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click({ force: true });

    // Open cart -> Proceed to Checkout
    await page.locator('[data-testid="cart-button"]').click();
    await expect(page.locator('aside', { hasText: /Your cart/i })).toBeVisible();
    
    await page.locator('button', { hasText: /Proceed to Checkout/i }).click();
 
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

    // Assert address form visible
    await expect(page.locator('[name="landmarkDescription"]')).toBeVisible();

    // Type landmark (>= 10 chars)
    await page.locator('[name="landmarkDescription"]').fill('Near the old clock tower in Mussoorie');

    // Click Continue to Review step
    await page.locator('button', { hasText: /Continue/i }).click();
 
    // Click "Place Order"
    const placeOrderBtn = page.locator('button', { hasText: /Place Order/i });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();

    // Assert redirect to Order Confirmation
    await expect(page).toHaveURL(/\/orders\/[a-z0-9-]+/);

    // Assert confirmation details
    await expect(page.locator('text=/PLACED/i')).toBeVisible();
    await expect(page.locator('[data-testid="order-subtotal"]')).toBeVisible();
    await expect(page.locator('text=/Hillside Mart/i').first()).toBeVisible();
  });

  test('E2E-011: Profile Page Flow', async ({ page }) => {
    // Navigate to Profile
    await page.locator('button[aria-label="Profile"]').click();
    await page.locator('text=/Profile/i').first().click();

    await expect(page).toHaveURL(/\/profile/);

    // Assert phone
    await expect(page.locator('text=/9876543211/')).toBeVisible();

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

  test('E2E-012: Saved Addresses CRUD', async ({ page }) => {
    await page.goto('/account/addresses');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1', { hasText: /Addresses/i })).toBeVisible();
 
    // Add New Address
    await page.getByRole('button', { name: /Add New/i }).click();
    await page.locator('input[name="label"]').fill('Home');
    await page.locator('[name="landmarkDescription"]').fill('Opposite Savoy Hotel, Landour');
    await page.locator('button', { hasText: /Save Address/i }).click();

    // Assert success toast
    await expect(page.locator('text=/Address added successfully/i')).toBeVisible();
 
    // Assert card appears
    const addressCard = page.locator('[data-testid="address-card"]', { hasText: 'Home' });
    await expect(addressCard).toBeVisible();

    // Set as Default
    await addressCard.locator('button[aria-haspopup="menu"]').click();
    const defaultItem = page.getByRole('menuitem', { name: /Set as Default/i });
    await expect(defaultItem).toBeVisible();
    await defaultItem.click();
    await expect(addressCard.locator('[data-testid="default-badge"]')).toBeVisible();
 
    // Delete
    page.on('dialog', dialog => dialog.accept());
    await addressCard.locator('button[aria-haspopup="menu"]').click();
    const deleteItem = page.getByRole('menuitem', { name: /Delete/i });
    await expect(deleteItem).toBeVisible();
    await deleteItem.click();
    await expect(addressCard).not.toBeVisible();
  });
});
