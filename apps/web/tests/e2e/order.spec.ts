import { test, expect } from '@playwright/test';

test.describe('Order Management', () => {
  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.locator('#buyer-phone').fill('9876543212');
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

  test('E2E-009: Order Status Machine (All 4 States)', async ({ page }) => {
    // We seeded orders with specific IDs in seed-e2e.ts: e2e_order_placed, e2e_order_preparing, e2e_order_delivered, e2e_order_cancelled

    // Check PLACED
    await page.goto('/orders/e2e_order_placed');
    await expect(page.locator('h1')).toHaveText(/Thank you/i);
 
    // Check PREPARING
    await page.goto('/orders/e2e_order_preparing');
    await expect(page.locator('h1')).toHaveText(/picking items/i);
 
    // Check DELIVERED
    await page.goto('/orders/e2e_order_delivered');
    await expect(page.locator('h1')).toHaveText(/Delivered/i);
 
    // Check CANCELLED
    await page.goto('/orders/e2e_order_cancelled');
    await expect(page.locator('h1')).toHaveText(/Cancelled/i);
  });

  test('E2E-010: Order History and Reorder', async ({ page }) => {
    await page.goto('/account/orders');

    // Assert list renders >= 1 order card
    const orderCards = page.locator('[data-testid="order-card"]');
    await expect(orderCards.first()).toBeVisible();

    // Click "Reorder" on an order card
    const firstReorderBtn = orderCards.first().locator('button', { hasText: /Reorder/i });
    await firstReorderBtn.click();

    // Assert cart drawer opens and count is updated
    const cartDrawer = page.locator('aside', { hasText: /Your cart/i });
    await expect(cartDrawer).toBeVisible();
    
    const cartBadge = page.locator('[data-testid="cart-badge"]');
    const count = await cartBadge.textContent();
    expect(parseInt(count || '0')).toBeGreaterThanOrEqual(1);
  });
});
