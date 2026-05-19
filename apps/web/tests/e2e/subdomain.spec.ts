import { test, expect } from "@playwright/test";

test.describe("Subdomain Routing E2E", () => {
  test("E2E subdomain store.gorola.com renders Store Partner Portal", async ({ page }) => {
    // Navigate to store subdomain root
    await page.goto("http://store.gorola.com:5180/");

    // Assert it loads the Store Partner Portal directly
    await expect(page.locator("h1", { hasText: "Store Partner Portal" })).toBeVisible({ timeout: 15000 });
  });

  test("E2E subdomain admin.gorola.com renders System Admin Sign In", async ({ page }) => {
    // Navigate to admin subdomain root
    await page.goto("http://admin.gorola.com:5180/");

    // Assert it loads the System Admin Sign In directly
    await expect(page.locator("h1", { hasText: "System Admin Sign In" })).toBeVisible({ timeout: 15000 });
  });

  test("E2E backward compatibility localhost renders Store Partner Portal at /store/login", async ({ page }) => {
    // Navigate to localhost fallback route
    await page.goto("http://127.0.0.1:5180/store/login");

    // Assert it loads the Store Partner Portal
    await expect(page.locator("h1", { hasText: "Store Partner Portal" })).toBeVisible({ timeout: 15000 });
  });
});
