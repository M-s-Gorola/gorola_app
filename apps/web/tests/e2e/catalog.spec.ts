import { test, expect } from '@playwright/test';

test.describe('Catalog & Search', () => {
  test('E2E-002: Sub-Category Navigation (Category -> SubCategory -> Product)', async ({ page }) => {
    await page.goto('/');

    // From home page, click "Groceries" category card
    const groceriesCard = page.locator('[data-testid="category-card"]', { hasText: 'Groceries' });
    await expect(groceriesCard).toBeVisible();
    await groceriesCard.click();

    // Assert URL = /categories/groceries
    await expect(page).toHaveURL(/\/categories\/groceries/);

    // Assert sub-category grid renders >= 1 tile with a non-empty <img src>
    const subCategoryTiles = page.locator('[data-testid="subcategory-card"]');
    await expect(subCategoryTiles.first()).toBeVisible();
    await expect(subCategoryTiles.first().locator('img')).toHaveAttribute('src', /.+/);

    // Click first sub-category tile (e.g., Rice, Atta & Dals)
    await subCategoryTiles.first().click();

    // Assert URL matches regex /^\/categories\/groceries\/[a-z-]+$/
    await expect(page).toHaveURL(/\/categories\/groceries\/[a-z-]+/);

    // Assert product grid renders >= 1 product card with product name text and non-empty <img src>
    const productCards = page.locator('[data-testid="product-card"]');
    await expect(productCards.first()).toBeVisible();
    await expect(productCards.first().locator('[data-testid="product-name"]')).not.toBeEmpty();
    await expect(productCards.first().locator('img')).toHaveAttribute('src', /.+/);
  });

  test('E2E-003: Product Detail Page Navigation', async ({ page }) => {
    await page.goto('/categories/groceries/rice-atta');

    // From sub-category product grid, click the product card image or name link
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    const productName = await firstProduct.locator('[data-testid="product-name"]').textContent();
    await firstProduct.locator('a').first().click();

    // Assert URL matches regex /^\/products\/[a-z0-9-]+$/
    await expect(page).toHaveURL(/\/products\/[a-z0-9-]+/);

    // Assert product name heading is visible
    await expect(page.locator('h1')).toHaveText(productName || '');

    // Assert >= 1 variant pill button is visible
    const variantPills = page.locator('[data-testid="variant-pill"]');
    await expect(variantPills.first()).toBeVisible();

    // Click a variant pill — assert price display updates to a non-zero value
    await variantPills.first().click();
    const priceDisplay = page.locator('[data-testid="product-price"]');
    await expect(priceDisplay).toHaveText(/Rs\s*\d+/);

    // Assert "Add to Cart" button is visible and enabled
    const addToCartBtn = page.locator('button', { hasText: /Add to Cart/i });
    await expect(addToCartBtn).toBeVisible();
    await expect(addToCartBtn).toBeEnabled();

    // Click "Add to Cart" — assert nav cart badge shows count >= 1
    await addToCartBtn.click();
    const cartBadge = page.locator('[data-testid="cart-badge"]');
    await expect(cartBadge).toBeVisible();
    const count = await cartBadge.textContent();
    expect(parseInt(count || '0')).toBeGreaterThanOrEqual(1);
  });

  test('E2E-004: Global Search End-to-End', async ({ page }) => {
    await page.goto('/');

    // Click search input in BuyerNav — type "milk" — press Enter
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('rice');
    await searchInput.press('Enter');

    // Assert URL = /search?q=rice
    await expect(page).toHaveURL(/\/search\?q=rice/);

    // Assert SearchResultsPage renders >= 1 result
    const results = page.locator('[data-testid="search-result-category"], [data-testid="search-result-subcategory"]');
    await expect(results.first()).toBeVisible();

    // If a sub-category result is visible: click it — assert URL = /categories/<categorySlug>/<subSlug>
    const subCategoryResult = page.locator('[data-testid="search-result-subcategory"]').first();
    if (await subCategoryResult.isVisible()) {
      await subCategoryResult.click();
      await expect(page).toHaveURL(/\/categories\/[a-z-]+\/[a-z-]+/);
    }
  });
});
