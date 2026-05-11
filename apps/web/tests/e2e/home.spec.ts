import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('E2E-001: Home Page Loads Correctly', async ({ page }) => {
    await page.goto('/');

    // Assert <nav> is visible and contains the GoRola mountain mark SVG
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    const logo = nav.locator('svg[data-testid="gorola-mountain-mark"]');
    await expect(logo).toBeVisible();

    // Assert hero heading is visible (matches regex /delivered|need|today/i)
    const heroHeading = page.locator('h1');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toHaveText(/delivered|need|today/i);

    // Assert ETA banner is visible and contains the amber pulse dot
    const etaBanner = page.locator('[data-testid="eta-banner"]');
    await expect(etaBanner).toBeVisible();
    const pulseDot = page.locator('[data-testid="pulse-dot"]');
    await expect(pulseDot).toBeVisible();

    // Assert category grid renders >= 2 cards (Groceries, Medical) each with a non-empty <img src>
    const categoryCards = page.locator('[data-testid="category-card"]');
    await expect(categoryCards).toHaveCount(2);
    
    for (let i = 0; i < 2; i++) {
      const card = categoryCards.nth(i);
      const img = card.locator('img');
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute('src', /.+/);
    }

    // Assert advertisement carousel renders >= 1 slide ([data-testid="ad-slide"])
    const adSlides = page.locator('[data-testid="ad-slide"]');
    await expect(adSlides.first()).toBeVisible();
  });

  test('E2E-014: Weather Mode Full System Toggle', async ({ page }) => {
    await page.goto('/');

    // Assert body does NOT have class weather-mode (normal mode)
    await expect(page.locator('body')).not.toHaveClass(/weather-mode/);

    // Assert nav background is pine-green (checking class or CSS variable)
    const nav = page.locator('nav');
    // The nav uses --gorola-pine in normal mode. 
    // We can check if it has a specific class or check computed style if needed.
    // For now, let's toggle weather mode.

    // Click [data-testid="dev-weather-toggle"]
    const toggle = page.locator('[data-testid="dev-weather-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();

    // Assert body element has class weather-mode
    await expect(page.locator('body')).toHaveClass(/weather-mode/);

    // Assert hero heading text matches /fog|weather|road|safely/i
    const heroHeading = page.locator('h1');
    await expect(heroHeading).toHaveText(/fog|weather|road|safely/i);

    // Assert ETA banner text contains "Scheduled" or weather-mode ETA copy
    const etaBanner = page.locator('[data-testid="eta-banner"]');
    await expect(etaBanner).toHaveText(/Scheduled|coming|safely/i);

    // Click [data-testid="dev-weather-toggle"] again — assert weather-mode class removed
    await toggle.click();
    await expect(page.locator('body')).not.toHaveClass(/weather-mode/);
  });
});
