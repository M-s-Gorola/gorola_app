import { test, expect } from "@playwright/test";

test.describe("Rider & Store Owner Multi-Actor E2E Journey", () => {
  test.describe.configure({ mode: "serial" });

  const BASE_URL = "http://127.0.0.1:5180";

  test.beforeEach(async ({ request }) => {
    // Reset test riders, store owner, and store availability status before each test run
    await request.post(`${BASE_URL}/api/v1/test/rider/reset`);
    await request.post(`${BASE_URL}/api/v1/test/store-owner/owner1@gorola.in/reset`);
    await request.post(`${BASE_URL}/api/v1/test/store/store_gorola_hillside_mart/reset-status`);
  });

  // E2E-040: Rider Unauthenticated Navigation Guard
  test("E2E-040: Rider Unauthenticated Navigation Guard", async ({ page }) => {
    // Try to access /rider/orders directly without an active Rider session
    await page.goto(`${BASE_URL}/rider/orders`);

    // Verify automatic redirect to rider login page
    await expect(page).toHaveURL(/.*\/rider\/login/);
    await expect(page.getByRole("heading", { name: "Rider Partner Portal" })).toBeVisible();
  });

  // E2E-041: Complete Rider Acceptance, Isolation, Store Dispatch, Map Tracking, and Earnings Lifecycle
  test("E2E-041: Rider Acceptance, Isolation, Store Dispatch, Map View & Earnings Flow", async ({
    page,
    request
  }) => {
    // ── STEP 1: API SETUP — Create Buyer Session & Place Order ─────────────
    // A. Send OTP for buyer
    await request.post(`${BASE_URL}/api/v1/auth/buyer/send-otp`, {
      data: { phone: "+919876543212" }
    });

    // B. Verify OTP to get buyer access token
    const verifyRes = await request.post(`${BASE_URL}/api/v1/auth/buyer/verify-otp`, {
      data: { phone: "+919876543212", otp: "123456" }
    });
    const verifyJson = await verifyRes.json();
    const buyerToken = verifyJson.data?.accessToken;
    expect(buyerToken).toBeTruthy();

    // C. Create delivery address for buyer with coordinates
    const addressRes = await request.post(`${BASE_URL}/api/v1/addresses`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
      data: {
        label: "Home E2E",
        landmarkDescription: "Near Mall Road Clock Tower",
        flatRoom: "Flat 4B",
        lat: 30.4598,
        lng: 78.0664,
        isDefault: true
      }
    });
    const addressJson = await addressRes.json();
    const addressId = addressJson.data?.id;
    expect(addressId).toBeTruthy();

    // D. Fetch product variant ID from store catalog & Add item to cart
    const productsRes = await request.get(`${BASE_URL}/api/v1/products?storeId=store_gorola_hillside_mart`);
    const productsJson = await productsRes.json();
    const product = productsJson.data?.items?.find((p: any) => p.id === "prod_rice_1") || productsJson.data?.items?.[0];
    const productVariantId = product?.highestPricedVariantId || product?.variants?.[0]?.id;
    if (!productVariantId) {
      console.error("Products response:", JSON.stringify(productsJson));
    }
    expect(productVariantId).toBeTruthy();

    await request.post(`${BASE_URL}/api/v1/cart/items`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
      data: {
        productVariantId,
        quantity: 1
      }
    });

    // E. Checkout / Place order
    const checkoutRes = await request.post(`${BASE_URL}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
      data: {
        addressMode: "saved",
        addressId,
        paymentMethod: "COD"
      }
    });
    const checkoutJson = await checkoutRes.json();
    if (!checkoutJson.success) {
      console.error("Order placement failed:", checkoutJson);
    }
    const orderId = checkoutJson.data?.id;
    expect(orderId).toBeTruthy();

    // F. Authenticate Store Owner to move order to PREPARING status
    const storeLoginRes = await request.post(`${BASE_URL}/api/v1/auth/store-owner/login`, {
      data: { email: "owner1@gorola.in", password: "Owner#123" }
    });
    const storeLoginJson = await storeLoginRes.json();
    const storeToken = storeLoginJson.data?.accessToken;
    expect(storeToken).toBeTruthy();

    const statusRes = await request.put(`${BASE_URL}/api/v1/store/orders/${orderId}/status`, {
      headers: { Authorization: `Bearer ${storeToken}` },
      data: { status: "PREPARING" }
    });
    expect(statusRes.status()).toBe(200);

    // ── STEP 2: RIDER 1 LOGIN & ORDER ACCEPTANCE ─────────────────────────────
    await page.goto(`${BASE_URL}/rider/login`);
    await page.locator("#rider-email").fill("rider1@gorola.in");
    await page.locator("#rider-password").fill("Rider#123");
    await page.getByRole("button", { name: "Login" }).click();

    // Verify landing on active orders page
    await expect(page.getByRole("heading", { name: /Shift Orders|Today's Bookings/i })).toBeVisible();

    // Locate compact card for the created order under "Ready for Pickup"
    const orderCard = page.locator(`[data-testid="order-card-${orderId}"]`);
    await expect(orderCard).toBeVisible({ timeout: 15000 });

    // Click compact card to open detail overlay modal
    await orderCard.click();
    const riderModal = page.locator('[data-testid="rider-order-modal"]');
    await expect(riderModal).toBeVisible();

    // Click "Accept Order" button
    const acceptBtn = riderModal.getByRole("button", { name: /Accept Order|Accept Visit/i });
    await expect(acceptBtn).toBeVisible();

    const acceptPromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/v1/rider/orders/${orderId}/accept`) && resp.request().method() === "PUT",
      { timeout: 15000 }
    );
    await acceptBtn.click();

    // Confirm acceptance in Radix dialog
    const acceptDialog = page.getByRole("dialog");
    await expect(acceptDialog).toBeVisible();
    await acceptDialog.getByRole("button", { name: "Confirm" }).click();
    await acceptPromise;

    // Verify modal displays accepted badge
    await expect(riderModal.getByText(/Accepted \(Go pick/i)).toBeVisible();

    // Close the overlay modal
    await riderModal.getByRole("button", { name: "Close modal" }).click();
    await expect(riderModal).not.toBeVisible();

    // ── STEP 3: OTHER RIDER ISOLATION VERIFICATION ───────────────────────────
    // Log out Rider 1
    await page.goto(`${BASE_URL}/rider/account`);
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/.*\/rider\/login/);

    // Log in as Rider 2 (Isolation Rider)
    await page.locator("#rider-email").fill("rider_iso@gorola.in");
    await page.locator("#rider-password").fill("Rider#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: /Shift Orders|Today's Bookings/i })).toBeVisible();

    // Confirm that Rider 1's accepted order is NOT visible in Rider 2's feed
    await expect(page.locator(`[data-testid="order-card-${orderId}"]`)).not.toBeVisible();

    // ── STEP 4: STORE OWNER DISPATCH & LIVE MAP VIEW ─────────────────────────
    // Log in as Store Owner
    await page.goto(`${BASE_URL}/store/login`);
    await page.getByLabel("Email address").fill("owner1@gorola.in");
    await page.getByLabel("Password").fill("Owner#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(/.*\/store\/dashboard/);

    // Navigate to Incoming Orders page
    await page.goto(`${BASE_URL}/store/orders`);
    await expect(page.getByRole("heading", { name: "Incoming Orders" })).toBeVisible();

    // Open order details modal on Store Owner panel
    const storeOrderCard = page.locator(`[data-testid="order-card-${orderId}"]`);
    await expect(storeOrderCard).toBeVisible({ timeout: 15000 });
    await storeOrderCard.click();

    const storeModal = page.locator('[data-testid="order-details-modal"]');
    await expect(storeModal).toBeVisible();

    // Verify Status Transition Log displays "Order Accepted" and rider name
    await expect(storeModal.getByText("Order Accepted")).toBeVisible();
    await expect(storeModal.getByText("Hillside Rider", { exact: false })).toBeVisible();

    // Verify Dispatch Order button is now enabled
    const dispatchBtn = storeModal.getByRole("button", { name: "Dispatch Order" });
    await expect(dispatchBtn).toBeEnabled();

    const dispatchPromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/v1/store/orders/${orderId}/status`) && resp.request().method() === "PUT",
      { timeout: 15000 }
    );
    await dispatchBtn.click();

    // Confirm dispatch in Radix dialog
    const dispatchDialog = page.getByRole("dialog");
    await expect(dispatchDialog).toBeVisible();
    await dispatchDialog.getByRole("button", { name: "Confirm" }).click();
    await dispatchPromise;

    // Verify that live tracking map container is rendered on the store modal
    await expect(storeModal.locator('[data-testid="store-order-map"]')).toBeVisible({ timeout: 15000 });

    // Close store modal
    await storeModal.getByRole("button", { name: "Close modal" }).click();
    await expect(storeModal).not.toBeVisible();

    // ── STEP 5: RIDER DELIVERY EXECUTION ─────────────────────────────────────
    // Log in back as Rider 1
    await page.goto(`${BASE_URL}/rider/login`);
    await page.locator("#rider-email").fill("rider1@gorola.in");
    await page.locator("#rider-password").fill("Rider#123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: /Shift Orders|Today's Bookings/i })).toBeVisible();

    // Switch to "Out for Delivery" tab
    const deliveryTab = page.getByRole("button", { name: /Out for Delivery|Departed/i });
    await deliveryTab.click();

    // Click active order card
    const activeDeliveryCard = page.locator(`[data-testid="order-card-${orderId}"]`);
    await expect(activeDeliveryCard).toBeVisible({ timeout: 15000 });
    await activeDeliveryCard.click();
    await expect(riderModal).toBeVisible();

    // Click "Mark as Delivered" button
    const markDeliveredBtn = riderModal.getByRole("button", { name: /Mark as Delivered|Mark Visit Complete/i });
    await expect(markDeliveredBtn).toBeVisible();

    const deliverPromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/v1/rider/orders/${orderId}/status`) && resp.request().method() === "PUT",
      { timeout: 15000 }
    );
    await markDeliveredBtn.click();

    // Confirm delivery in Radix dialog
    const deliverDialog = page.getByRole("dialog");
    await expect(deliverDialog).toBeVisible();
    await deliverDialog.getByRole("button", { name: "Confirm" }).click();
    await deliverPromise;

    // Verify modal closes automatically after delivery
    await expect(riderModal).not.toBeVisible();

    // ── STEP 6: EARNINGS VERIFICATION ─────────────────────────────────────────
    // Navigate to Rider Earnings page
    await page.getByRole("link", { name: "Earnings" }).click();
    await expect(page.getByRole("heading", { name: "Earnings Dashboard" })).toBeVisible();

    // Verify payout history contains the delivered order and payout amount
    await expect(page.getByText(`Order: ${orderId}`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/\+ ₹\d+\.\d{2}/)).toBeVisible();
  });
});
