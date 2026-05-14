import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

test.describe('Mobile Experience', () => {
  test('E2E-015: Mobile Search Form Submit (375px)', async ({ page }) => {
    await page.goto('/');

    // In mobile, search might be hidden behind a toggle or always visible depending on implementation.
    // Usually it's in the header.
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('rice');
    await searchInput.press('Enter');

    // Assert URL = /search?q=rice
    await expect(page).toHaveURL(/\/search\?q=rice/);

    // Assert results page responsive layout
    const resultsGrid = page.locator('[data-testid="search-results-grid"]');
    await expect(resultsGrid).toBeVisible();
    
    // Check if it's 1 or 2 columns in mobile
    const firstResult = page.locator('[data-testid="search-result-category"], [data-testid="search-result-subcategory"], [data-testid="product-card"]').first();
    await expect(firstResult).toBeVisible();
  });
});
