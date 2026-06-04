import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('E2E-001: Home Page Loads Correctly', async ({ page }) => {
    await page.goto('/');

    // Assert <nav> is visible and contains the GoRola mountain mark SVG
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    const logo = nav.locator('img[data-testid="gorola-mountain-mark"]');
    await expect(logo).toBeVisible();

    // Assert hero heading is visible (matches regex /delivered|arrive|got you/i)
    const heroHeading = page.locator('h1');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toHaveText(/delivered|arrive|got you/i);

    // Assert ETA banner is visible and contains the amber pulse dot
    const etaBanner = page.locator('[data-testid="eta-banner"]');
    await expect(etaBanner).toBeVisible();
    const pulseDot = page.locator('[data-testid="pulse-dot"]');
    await expect(pulseDot).toBeVisible();

    // Assert section headers are visible
    const instantDeliveryHeader = page.locator('h3:has-text("Instant Delivery")');
    await expect(instantDeliveryHeader).toBeVisible();

    const bookAServiceHeader = page.locator('h3:has-text("Book a Service")');
    await expect(bookAServiceHeader).toBeVisible();

    // Assert category grid renders exactly 5 cards (separated into Quick Commerce and Booking Commerce)
    const categoryCards = page.locator('[data-testid="category-card"]');
    await expect(categoryCards).toHaveCount(5);
    
    for (let i = 0; i < 5; i++) {
      const card = categoryCards.nth(i);
      const img = card.locator('img');
      if (await img.count() > 0) {
        await expect(img).toBeVisible();
        await expect(img).toHaveAttribute('src', /.+/);
      } else {
        const fallbackSymbol = card.locator('text=📦');
        await expect(fallbackSymbol).toBeVisible();
      }
    }

    // Assert advertisement carousel renders >= 1 slide ([data-testid="ad-slide"])
    const adSlides = page.locator('[data-testid="ad-slide"]');
    await expect(adSlides.first()).toBeVisible();
  });

  test('E2E-014: Weather Mode Full System Toggle', async ({ page }) => {
    await page.goto('/');
    // Wait for initial weather sync to finish
    await page.waitForTimeout(2000);
 
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
    await page.waitForTimeout(1000); // Wait for state change to propagate to body class
 
    // Assert body element has class weather-mode
    await expect(page.locator('body')).toHaveClass(/weather-mode/);

    // Assert hero heading text matches /stay in|coming|showed up/i
    const heroHeading = page.locator('h1');
    await expect(heroHeading).toHaveText(/stay in|coming|showed up/i);

    // Assert ETA banner text contains weather-mode ETA copy
    const etaBanner = page.locator('[data-testid="eta-banner"]');
    // Wait for the duration to flip to weather mode
    await expect(etaBanner).toHaveText(/45-55 mins/i, { timeout: 10000 });
    await expect(etaBanner).toHaveText(/coming|safe|safely|action movies|clouds/i);

    // Click [data-testid="dev-weather-toggle"] again — assert weather-mode class removed
    await toggle.click();
    await page.waitForTimeout(500); // Give it a moment to transition
    await expect(page.locator('body')).not.toHaveClass(/weather-mode/);
  });
});
