# E2E Test Suite Investigation Report

This document outlines the detailed static analysis comparing the Playwright E2E tests in the `apps/web/tests/e2e` directory against the actual implementation (seed data, component UI, and selectors) in the GoRola codebase.

---

## 1. `store-owner-journey.spec.ts` (Merchant & Booking Dashboard Journey)

### E2E-020: Merchant Authentication & 2FA Setup Flow
*   **Playwright Expectations**:
    *   Login: Email (`getByLabel("Email address")`), Password (`getByLabel("Password")`), clicks button `"Login"`.
    *   Dashboard: Heading `"Dashboard"` visible.
    *   Settings page: text `"Two-Factor Auth is currently: Disabled"`, clicks `"Setup 2FA"`, enters code `"000000"` in `"Enter 6-digit TOTP Code"`, clicks `"Verify and Enable"`, checks status changes to `"Enabled"`.
    *   2FA Challenge: Logs out, logs in, fills input `"Two-Factor Code"` with `"000000"`, clicks `"Verify"`.
*   **Codebase Reality**:
    *   `StoreLoginPage.tsx` renders email and password fields with matching label texts.
    *   `StoreSettingsPage.tsx` renders `Two-Factor Auth is currently: Disabled` and input with label `Enter 6-digit TOTP Code`.
    *   `StoreTwoFactorPage.tsx` uses label `Two-Factor Code` for the TOTP field.
*   **Status**: **Matched**. No mismatches identified.

### E2E-021: Live Store Status Toggle & Real-time Buyer Visibility
*   **Playwright Expectations**:
    *   Toggles `button[role="switch"]` (expects `aria-checked` to change from `true` to `false`).
    *   In confirm modal, clicks `"Yes, Hide Store"`.
    *   Buyer storefront: navigates `/store/store_gorola_hillside_mart`, expects `"Store is currently offline and not accepting orders"`.
    *   Merchant dashboard: toggles back to `true`.
    *   Buyer storefront: banner is removed.
*   **Codebase Reality**:
    *   `StoreDashboardPage.tsx` renders a `<button role="switch">` containing `aria-checked={storeProfile?.isAcceptingOrders}`.
    *   Confirmation Dialog has a button with text `"Yes, Hide Store"`.
    *   `StoreDetailPage.tsx` displays the offline banner with `data-testid="store-offline-banner"` matching the text exactly.
*   **Status**: **Matched**. No mismatches identified.

### E2E-022: Multi-Actor Quick Commerce Live Order Status Transitions
*   **Playwright Expectations**:
    *   Buyer adds product to cart, places COD order, copies `orderId` from URL `/orders/<id>`, verifies status heading matches `PLACED` initially.
    *   Store Owner Orders Page: finds `[data-testid="order-card-{id}"]`, triggers sequential updates: `"Mark Preparing"`, `"Dispatch Order"`, and `"Mark Delivered"`.
    *   Buyer confirmation page updates via Socket.IO: `"Store is picking items"`, `"On the way"`, and `"Order Delivered"`.
*   **Codebase Reality**:
    *   Status transition buttons in `StoreOrdersPage.tsx` match the labels exactly.
    *   Status text transitions in `OrderConfirmationPage.tsx` map to the expected strings.
*   **Status**: **Matched**. Viewport scrolling/toast overlay issues are handled in playwright with `scrollIntoViewIfNeeded` and timeouts.

### E2E-023: Inventory Restock & Audit History Logging
*   **Playwright Expectations**:
    *   Searches for `"Basmati Rice Premium"`, clicks edit button `[data-testid="edit-product-prod_rice_1"]`.
    *   Clicks restock button `[data-testid="restock-button-0"]`, fills `#restock-qty-input` with `"10"`, and clicks `"Confirm Restock"`.
    *   Clicks adjust button `[data-testid="adjust-button-0"]`, fills `#adjust-qty-input` with `"15"`, `#adjust-reason-input` with audit reason, and clicks `"Confirm Adjustment"`.
    *   Navigates back, clicks stock history button `[data-testid="stock-history-prod_rice_1"]`, verifies `RESTOCK` and adjustment reason rows are rendered.
*   **Codebase Reality**:
    *   `StoreProductFormPage.tsx` defines inputs with ids: `restock-qty-input`, `adjust-qty-input`, and `adjust-reason-input`.
    *   Test IDs `restock-button-0` and `adjust-button-0` are correctly rendered for the first variant.
    *   `StoreStockHistoryPage.tsx` renders historical stock logs.
*   **Status**: **Matched**. (Search query corrected from "Basmati Rice Premium" to "Basmati Rice" to align with database seed "Premium Basmati Rice").

### E2E-024: Tenant-Isolated Discount Code Management
*   **Playwright Expectations**:
    *   Merchant creates coupon code `LOCAL25` with 25% discount and min order `₹300`.
    *   Fills dates using `input[type="date"]`.
    *   Buyer Cart: adds `"Premium Basmati Rice"`, increases quantity to 3, subtotal becomes `"360"`. Applies coupon, checks discount summary row `[data-testid="cart-discount-summary"]` contains `"90"`.
    *   Decreases quantity to 2, subtotal drops to `"240"` (< 300), expects coupon to be auto-removed.
*   **Codebase Reality & Mismatches**:
    *   **Product Name Mismatch**: The seeded product `prod_rice_1` in `dummy-data.ts` is named `"Basmati Rice Premium"` (unit `"5 kg"`, price `₹525.00`), while the test expects `"Premium Basmati Rice"` (unit `"1 kg"`, price `₹120.00`).
    *   **Button Selector Mismatch**: The test uses `/Increase Premium Basmati Rice quantity/i` which fails because the actual aria-label in the DOM is `"Increase Basmati Rice Premium quantity"`.
    *   **Calculation Mismatch**: Since the actual seeded price is `₹525.00`, a single item costs `₹525.00` (which is already > 300). Subtotal for 3 items is `₹1575.00` and discount is `₹393.75` (instead of expected subtotal `₹360` / discount `₹90`). Decreasing to 2 yields `₹1050.00` (still > 300), meaning the coupon is not automatically removed.
*   **Status**: ⚠️ **Mismatches Identified**.
    *   *Remedy*: Update `seed-e2e.ts` database seed overrides to force rename `prod_rice_1` to `"Premium Basmati Rice"` with a `1 kg` variant priced at `₹120.00`. Update E2E-023 search from `"Basmati Rice Premium"` to `"Basmati Rice"` to support partial matching on the renamed product.

### E2E-025: Booking Commerce UI Isolation & Normalization
*   **Playwright Expectations**:
    *   Booking merchant (`owner3@gorola.in` / `Mountain Medico`) views sidebar: has `"Services"`, lacks `"Products"`.
    *   Services page: lacks `"Restock"`, `"Adjust"`, or stock columns.
    *   Bookings List: maps `DELIVERED` status to show as `"COMPLETED"`, never raw `"DELIVERED"`.
*   **Codebase Reality**:
    *   `StoreLayout.tsx` strips/normalizes links if the store is a booking store.
    *   `StoreProductsPage.tsx` hides stock statuses for booking stores.
    *   `StoreBookingsPage.tsx` maps `status === "DELIVERED"` to render `"COMPLETED"`.
*   **Status**: **Matched**. No mismatches identified.

### E2E-026: Store Advertisements Lifecycle & Dynamic Carousel
*   **Playwright Expectations**:
    *   Merchant submits ad named `E2E Promo-${suffix}`, fills dates using `input[type="date"]`.
    *   Asserts status is `"Pending Approval"`.
    *   Approves ad via backdoor: `POST /api/v1/test/advertisements/${adId}/approve`.
    *   Asserts status updates to `"Approved & Active"`.
    *   Buyer Carousel: verifies ad title is rendered in the promotions carousel.
*   **Codebase Reality & Mismatch**:
    *   **Date Input Type Mismatch**: `StoreAdvertisementsPage.tsx` defines date fields as `type="datetime-local"`. Playwright tries to fill them using `page.locator('input[type="date"]')`, which returns 0 elements and times out.
*   **Status**: ⚠️ **Mismatch Identified**.
    *   *Remedy*: Update `StoreAdvertisementsPage.tsx` date fields to use the dual-input pattern (visible `type="date"` and hidden `type="datetime-local"`) implemented on the Discounts and Offers pages.

### E2E-027: Store Profile Settings & Password Migration
*   **Playwright Expectations**:
    *   Updates Description and Phone Number. Clicks `"Save Changes"` (first).
    *   Changes password from `"Owner#123"` to `"Owner#12345"`.
    *   Verifies logout, old password fails with `"Invalid email or password"`, new password logs in successfully, then resets password back.
*   **Codebase Reality**:
    *   `StoreSettingsPage.tsx` contains matching inputs, buttons, and label texts.
*   **Status**: **Matched**. No mismatches identified.

### E2E-028: Store-Wide Offers Creation & Automatic Application
*   **Playwright Expectations**:
    *   Merchant creates offer (15% off, min order `₹400`).
    *   Buyer storefront: verifies offer title is visible on `http://127.0.0.1:5180/store/store_gorola_hillside_mart` details page.
    *   Adds product, increases quantity to 4, checks subtotal `₹480` and discount `₹72` (15% of 480).
    *   Merchant deactivates the offer (status changes to `"Deactivated"`).
    *   Buyer page: reloads, verifies offer is no longer applied.
*   **Codebase Reality & Mismatches**:
    *   **Offers Display Mismatch**: `StoreDetailPage.tsx` does NOT query or render active store offers on the details page. Playwright's assertion `await expect(buyerPage.getByText(offerTitle)).toBeVisible();` will fail.
    *   **Product Mismatch**: Same product name, variant, label, and pricing discrepancies as E2E-024.
*   **Status**: ⚠️ **Mismatches Identified**.
    *   *Remedy*: Update `StoreDetailPage.tsx` to fetch and render active offers. Update product variant seeds in `seed-e2e.ts`.

### E2E-033: Stacked Booking Discount Code & Store-Wide Offer
*   **Playwright Expectations**:
    *   Merchant creates coupon (10% off, min order `₹300`) and store offer (15% off, min order `₹400`).
    *   Buyer: books diagnostic service (₹500), selects date and timeslot.
    *   Checkout: applies coupon, checks total discount is `₹125` (75 offer + 50 coupon).
    *   Address details: fills landmark placeholders `"Home"` with `"E2E Suite"`, and `"E.g. - near the red gate, behind Hotel Padmini"` with `"E2E Tower"`. Clicks `"Confirm Booking"`.
    *   Confirmation: expands breakdown, verifies both coupon and offer title are listed.
*   **Codebase Reality & Mismatches**:
    *   **Address Form Modal Mismatch**: `BookingTimeslotPage.tsx` does not render the address form fields inline. They are located inside a closed `Dialog` modal that opens when the user clicks `"Add New"`. Playwright fails to find the inputs.
    *   **Placeholder Character Mismatch**: The placeholder in `BookingTimeslotPage.tsx` is `"E.g. — near the red gate, behind Hotel Padmini"` (with unicode em-dash `—` / `\u2014`), while the test searches for `"E.g. - near the red gate, behind Hotel Padmini"` (with standard hyphen `-` / `\u002d`). Exact match fails.
*   **Status**: ⚠️ **Mismatches Identified**.
    *   *Remedy*: Update E2E-033 script to first click the `"Add New"` button, fill the labels using robust `[name="landmarkDescription"]` and `[name="label"]` selectors rather than fragile, character-sensitive placeholder selectors, click `"Save Address"`, and then click `"Confirm Booking"`.

---

## 2. `auth.spec.ts` (Buyer Auth Journey)

### E2E-006: OTP Login Flow & E2E-007: Auth Persistence
*   **Playwright Expectations**:
    *   Login: Navigates to `/login`, locates phone input `#buyer-phone`, types phone, clicks `"Send OTP"`.
    *   OTP: Confirms transitions to OTP input step, fills `[data-testid="otp-digit-${i}"]` for i = 0 to 5, clicks `"Verify"`, redirects to `/`.
    *   Navigation: Profile button `button[aria-label="Profile"]` becomes visible, login link `a[aria-label="Login"]` disappears.
    *   Persistence: Reloads page, confirms profile button is still visible.
*   **Codebase Reality**:
    *   `LoginPage.tsx` defines input `id="buyer-phone"` and button `Send OTP`.
    *   OTP inputs have attribute `data-testid={`otp-digit-${i}`}`.
    *   `BuyerNav.tsx` renders button `aria-label="Profile"` and link `aria-label="Login"`.
*   **Status**: **Matched**. No mismatches identified.

### Unauthenticated Redirect
*   **Playwright Expectations**:
    *   Direct hit to `/checkout` redirects unauthenticated user back to `/login`.
*   **Codebase Reality**:
    *   Route guards in `App.tsx` redirect unauthenticated paths to `/login`.
*   **Status**: **Matched**. No mismatches identified.

---

## 3. `booking-journey.spec.ts` (Buyer Booking & Timeslot Journey)

### E2E-030: Buyer Fasting Rules, Store Approval, and Store Booking Completion
*   **Playwright Expectations**:
    *   Login as buyer. Clicks `"Medical tests"` category card. Skips sub-category grid due to smart-redirect and lands on `/categories/medical-tests/all-tests`.
    *   Clicks Blood Sugar (Fasting) product card. Verifies "Book Now" is visible and "Add to cart" is absent.
    *   Proceeds to scheduling, verifies fasting alert banner, morning timeslot `"06:00-09:00"` is enabled, other slots are disabled.
    *   Fills date picker `#booking-date`, selects morning slot, selects/creates address, and clicks `"Confirm Booking"`.
    *   Lands on confirmation page `/bookings/<id>` in `Pending Approval` status.
    *   Store Owner: logs in, navigates to Bookings dashboard, views details, clicks `"Approve"`. Asserts buyer status updates to `Confirmed`.
    *   Store Owner: clicks `"Mark Completed"`. Asserts buyer status updates to `Service Done`.
*   **Codebase Reality**:
    *   Redirection logic in `SubCategoryGrid.tsx` redirects if only 1 subcategory exists.
    *   `ProductDetailPage.tsx` swaps "Add to Cart" with "Book Now" for booking store types.
    *   `BookingTimeslotPage.tsx` restricts timeslots for fasting variants, renders date picker `#booking-date` and button `"Confirm Booking"`.
    *   `StoreBookingsPage.tsx` handles status transitions and WebSocket broadcasts.
*   **Status**: **Matched**. No mismatches identified.

### E2E-031: Store Owner Booking Rejection and Reason Display
*   **Playwright Expectations**:
    *   Buyer books a fasting test.
    *   Store Owner: clicks `"Reject"` on details modal, fills reason `"Equipment failure"` in `textarea[placeholder*="reason"]`, and clicks `"Confirm Rejection"`.
    *   Buyer page: updates to status `Rejected` and displays `"Equipment failure"`.
*   **Codebase Reality**:
    *   `StoreBookingsPage.tsx` rejection modal has textarea with placeholder `Enter reason (e.g. Fully booked this morning)` which matches `placeholder*="reason"`.
    *   WebSocket updates correctly broadcast rejection status and reasons.
*   **Status**: **Matched**. No mismatches identified.

### E2E-032: Booking Lead Days Date Picker Restriction Validation
*   **Playwright Expectations**:
    *   Navigates to scheduling, inspects date input `min` attribute. Asserts min attribute is tomorrow's date string.
*   **Codebase Reality**:
    *   `BookingTimeslotPage.tsx` sets `minDateStr` using store-level `bookingLeadDays` (defaults to 1, meaning tomorrow).
*   **Status**: **Matched**. No mismatches identified.

---

## 4. `cart.spec.ts` (Cart & Discount Application)

### E2E-005: Cart Add / Remove / Subtotal
*   **Playwright Expectations**:
    *   Navigates to `/categories/groceries/rice-atta`.
    *   Clicks `"Add"` button on product card. Asserts cart badge shows `"1"`.
    *   Clicks `[data-testid="cart-button"]`, asserts drawer opens.
    *   Locates product, asserts price displays. Clicks `[data-testid="quantity-plus"]` -> quantity becomes 2. Clicks `[data-testid="quantity-minus"]` -> quantity becomes 1.
    *   Clicks `[data-testid="remove-item"]`, asserts cart shows empty.
*   **Codebase Reality**:
    *   `ProductGrid.tsx` renders Add button.
    *   `BuyerNav.tsx` renders cart badge `data-testid="cart-badge"` and button `data-testid="cart-button"`.
    *   `CartDrawer.tsx` contains quantity-plus, item-quantity, quantity-minus, remove-item test IDs, and displays empty states.
*   **Status**: **Matched**. No mismatches identified.

### E2E-013: Discount Code Apply in Cart
*   **Playwright Expectations**:
    *   Adds item, opens cart, fills `"TESTDEAL10"` in `input[placeholder*="Discount"]`, clicks `"Apply"`.
    *   Asserts `Total Discount` and `-Rs` text are visible inside cart drawer, total shown in `[data-testid="cart-total"]`.
*   **Codebase Reality**:
    *   `CartDrawer.tsx` renders input with placeholder `"Discount code"` and button `"Apply"`. Renders `Total Discount` and `cart-total`.
*   **Status**: **Matched**. No mismatches identified.

---

## 5. `catalog.spec.ts` (Buyer Catalog Browsing & Search)

### E2E-002: Category -> SubCategory -> Product Navigation
*   **Playwright Expectations**:
    *   Home page: clicks Groceries category card. Lands on `/categories/groceries`.
    *   Subcategory page: asserts `[data-testid="subcategory-card"]` list, clicks first subcategory card. Lands on `/categories/groceries/<subCategorySlug>`.
    *   Product grid: asserts `[data-testid="product-card"]` and `[data-testid="product-name"]` are visible.
*   **Codebase Reality**:
    *   `CategoryGrid.tsx` has `data-testid="category-card"`.
    *   `SubCategoryGrid.tsx` has `data-testid="subcategory-card"`.
    *   `ProductGrid.tsx` has `data-testid="product-card"` and `data-testid="product-name"`.
*   **Status**: **Matched**. No mismatches identified.

### E2E-003: Product Detail Page Navigation
*   **Playwright Expectations**:
    *   Clicks product card link. Lands on `/products/<slug>`.
    *   Asserts product name heading matches, asserts visible `[data-testid="variant-pill"]`.
    *   Clicks variant pill, price `[data-testid="product-price"]` updates with `/Rs\s*\d+/` pattern.
    *   Asserts `"Add to Cart"` button is enabled, clicks it, verifies cart badge counts up.
*   **Codebase Reality**:
    *   `ProductDetailPage.tsx` matches the layout: renders `h1` with product name, variant pills, price test ID, and "Add to Cart" button.
*   **Status**: **Matched**. No mismatches identified.

### E2E-004: Global Search End-to-End
*   **Playwright Expectations**:
    *   Navigates to home, types `"rice"` in `input[placeholder*="Search"]`, hits Enter.
    *   Asserts URL becomes `/search?q=rice`.
    *   Asserts search results contain `[data-testid="search-result-category"]`, `[data-testid="search-result-subcategory"]` or `[data-testid="product-card"]`.
*   **Codebase Reality**:
    *   `BuyerNav.tsx` has input with placeholder `"Search products"`.
    *   `SearchResultsPage.tsx` defines search-result-category, search-result-subcategory, and search-results-grid.
*   **Status**: **Matched**. No mismatches identified.

---

## 6. `checkout.spec.ts` (Checkout, Profile & Addresses CRUD)

### E2E-008: Checkout -> Order Confirmation
*   **Playwright Expectations**:
    *   Buyer adds product to cart, clicks `"Proceed to Checkout"`, lands on `/checkout`.
    *   Waits for loading indicator to clear. Selects radio `input[value="new"]`.
    *   Fills `[name="landmarkDescription"]` with landmark, clicks `"Continue"`.
    *   Clicks `"Place Order"`, waits for POST `/api/v1/orders`.
    *   Lands on `/orders/<id>`. Asserts heading `#occ-heading` matches `"Thank you"` and `[data-testid="order-subtotal"]` is visible.
*   **Codebase Reality**:
    *   `CheckoutPage.tsx` renders radio group with `value="new"` and label "Deliver to new location".
    *   Input field name is `landmarkDescription`.
    *   `OrderConfirmationPage.tsx` renders `id="occ-heading"` and `data-testid="order-subtotal"`.
*   **Status**: **Matched**. No mismatches identified.

### E2E-011: Profile Page Flow
*   **Playwright Expectations**:
    *   Clicks profile icon, navigates to profile, asserts phone matches `/9876543212/`.
    *   Fills `input[name="name"]` with `"Playwright Tester"`, clicks `"Update Name"`.
    *   Asserts success toast `"Profile updated successfully"`.
    *   Navigates home, checks hero greeting `.hero-greeting` includes `"Playwright Tester"`.
*   **Codebase Reality**:
    *   `ProfilePage.tsx` has input `name="name"` and button `Update Name`.
    *   `HeroSection.tsx` renders greeting text with class `.hero-greeting`.
*   **Status**: **Matched**. No mismatches identified.

### E2E-012: Saved Addresses CRUD
*   **Playwright Expectations**:
    *   Navigates to `/account/addresses`. Clicks `"Add New"`.
    *   Fills `input[name="label"]` and `[name="landmarkDescription"]`, scrolls to and clicks `"Save Address"`.
    *   Asserts success toast. Asserts card `[data-testid="address-card"]` is visible.
    *   Clicks dropdown trigger, clicks `"Set as Default"`, verifies `[data-testid="default-badge"]` is visible.
    *   Clicks dropdown trigger again, clicks `"Delete"`, accepts window confirm dialog, card disappears.
*   **Codebase Reality**:
    *   `SavedAddressesPage.tsx` renders matching inputs, "Save Address" button, default badge test ID, and address dropdown menus.
*   **Status**: **Matched**. No mismatches identified.

---

## 7. `home.spec.ts`, `mobile.spec.ts` & `subdomain.spec.ts`

### `home.spec.ts` (Aesthetics & Weather Mode)
*   **Playwright Expectations**:
    *   Checks mountain mark SVG `svg[data-testid="gorola-mountain-mark"]` in `nav`.
    *   Checks hero `h1` matches `/delivered|arrive|got you/i`.
    *   Checks `[data-testid="eta-banner"]` and `[data-testid="pulse-dot"]`.
    *   Checks sections `"Instant Delivery"` and `"Book a Service"` exist.
    *   Asserts exactly 5 category cards in grid.
    *   Toggles weather mode: clicks `[data-testid="dev-weather-toggle"]`. Confirms `body` has class `weather-mode`. Confirms hero `h1` switches, and ETA banner changes to `45-55 mins`.
*   **Codebase Reality**:
    *   `GorolaMountainMark.tsx` sets `data-testid="gorola-mountain-mark"`.
    *   `HeroSection.tsx` renders ETA banner and pulse dot, maps weather mode texts and times.
    *   Category grids render 5 categories.
    *   `DevWeatherToggle.tsx` toggles weather mode correctly.
*   **Status**: **Matched**. No mismatches identified.

### `mobile.spec.ts` (Responsive Layouts)
*   **Playwright Expectations**:
    *   Sets viewport to 375x667. Search input `input[placeholder*="Search"]` is visible in nav.
    *   Submits search, verifies results grid `[data-testid="search-results-grid"]` is visible.
*   **Codebase Reality**:
    *   `BuyerNav.tsx` keeps search input visible on small viewports.
    *   `SearchResultsPage.tsx` has results grid container matching the test ID.
*   **Status**: **Matched**. No mismatches identified.

### `subdomain.spec.ts` (Subdomain Route Routing)
*   **Playwright Expectations**:
    *   `store.gorola.com` root loads heading `h1` `"Store Partner Portal"`.
    *   `admin.gorola.com` root loads heading `h1` `"System Admin Sign In"`.
    *   `localhost/store/login` fallback loads `"Store Partner Portal"`.
*   **Codebase Reality**:
    *   Subdomain routing configurations and handlers in `router.tsx` and custom hooks map routes appropriately.
    *   Login page headers match expectations.
*   **Status**: **Matched**. No mismatches identified.

---

## Summary of Planned Alignment Actions

### 1. Database Seed Alignment (`seed-e2e.ts`)
*   **Action**: Update product seed data to rename `prod_rice_1` to `"Premium Basmati Rice"`, setting its active variant unit to `"1 kg"` and price to `₹120.00`.
*   **Rationale**: Fixes subtotal and discount calculations in E2E-024 and E2E-028, and avoids button label mismatches.

### 2. StoreDetailPage Offers Section (`StoreDetailPage.tsx`)
*   **Action**: Query active promotions/offers for the store and display them as small pills in the header.
*   **Rationale**: Prevents E2E-028 storefront offer visibility assertion failures.

### 3. StoreAdvertisementsPage Date Fields (`StoreAdvertisementsPage.tsx`)
*   **Action**: Change date inputs from plain `datetime-local` to the dual-input pattern (`type="date"` visible + `type="datetime-local"` hidden).
*   **Rationale**: Allows Playwright's `input[type="date"]` selector to successfully find and fill start/end dates in E2E-026.

### 4. Playwright Booking Address Modal Flow (`store-owner-journey.spec.ts`)
*   **Action**: Update E2E-033 script to click the `"Add New"` button, fill address details using robust `[name="label"]` and `[name="landmarkDescription"]` selectors (resolving the unicode em-dash issue), click `"Save Address"`, and then click `"Confirm Booking"`.
*   **Rationale**: Realigns the test with the actual modal-based address workflow on the booking page.
