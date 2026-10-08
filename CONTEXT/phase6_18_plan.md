## Phase 6.18 Checklist — Financial Infrastructure: GST Foundation, Financial Data Integrity & Invoice Generator

**Root Cause / Goal:**
Several interrelated financial data integrity and configuration issues exist in the Order, Checkout, and Delivery modules that must be resolved before GST can be activated and before a legally-valid tax invoice can be produced:
1. **No discount/offer savings persisted:** `BuyerCheckoutService` and `booking-order.service.ts` compute `appliedDiscountAmount`, `appliedOfferAmount`, and promo titles at checkout, but never persist them to the database. UIs are forced to reverse-engineer savings via `subtotal + deliveryFee - total`, which breaks the moment tax is added to `total`.
2. **Missing promotion title audit trails:** `appliedOfferTitle` is not recorded on `Order`. If a store owner later edits or deletes an offer, historical order records and invoices cannot show what promotion was applied.
3. **No tax snapshot columns exist:** The `Order` table has no `taxRate` column to freeze the tax percentage rate that applied at the time of purchase.
4. **Semantic fee mismatch:** `booking-order.service.ts` writes the platform service fee into `deliveryFee`. UIs unconditionally label this "Delivery Fee" for booking orders that have no physical delivery.
5. **No GST settings infrastructure:** `SystemSetting` lacks `GST_RATE` and `GST_NUMBER` keys and Admin UI inputs.
6. **Hardcoded technician cut & rider rates:** `rider-earnings.repository.ts` uses hardcoded constants (`0.20` platform fee, `0.80` technician cut) for bookings and a fixed per-order rate for delivery.
7. **No standard invoice generator:** There is no service/CLI script to produce an itemized, compliant tax invoice.

**Fix / Approach:**
- **Phase 6.18.1:** Single Prisma migration adding four nullable snapshot columns to `Order`: `discountSavingAmount`, `offerSavingAmount`, `appliedOfferTitle`, `taxRate`.
- **Phase 6.18.2:** Conditional UI fee labels ("Service Fee" vs "Delivery Fee") across 6 admin and store pages based on `orderType`.
- **Phase 6.18.3:** Seed `GST_RATE = "0"` and `GST_NUMBER = ""` into `SystemSetting`, add admin form inputs in `AdminDashboardPage.tsx`, and expose `GST_RATE` via `useSystemSettings`.
- **Phase 6.18.4:** Wire `BuyerCheckoutService` and `booking-order.service.ts` to persist `discountSavingAmount`, `offerSavingAmount`, and `appliedOfferTitle` on order creation.
- **Phase 6.18.5:** Replace frontend arithmetic inference hacks (`subtotal + deliveryFee - total`) with stored values and render promotion chips/tags across Buyer, Store, and Admin order views.
- **Phase 6.18.6:** Introduce `TECHNICIAN_EARNING_RATE_PCT` in `SystemSetting` and dynamically select earning rates based on `orderType`.
- **Phase 6.18.7:** Create a decoupled CLI invoice script (`scripts/generate-invoice.ts`) and pure formatting engine (`InvoiceService`).
- **Phase 6.18.8:** Monorepo quality gates and full regression validation.

> **GST Tax Calculation Deliberately Deferred to Phase 6.19:** The tax calculation formula itself (taxable base pre vs post discount, MRP tax extraction) is deferred pending taxation research. Phase 6.18 establishes the complete foundation so tax computation slots in with zero structural rework.

---

### Phase 6.18.1: Order Schema — Financial & Promotional Snapshot Columns

**Root cause:** `Order` lacks columns to persist computed savings (`discountSavingAmount`, `offerSavingAmount`), promotional title snapshots (`appliedOfferTitle`), and the historical tax rate (`taxRate`). All four must be nullable Decimal/Text fields so existing orders and existing test fixtures require zero modifications.

**Approach:** Single Prisma migration adding four nullable columns to `Order`. Seed `GST_RATE` and `GST_NUMBER` into `SystemSetting`.

---

- [ ] **RED — Backend Integration (`apps/api/src/__tests__/integration/order/order.repository.test.ts`):**
  - [ ] Test: `OrderRepository.create()` accepts input containing `discountSavingAmount: new Decimal("50.00")`, `offerSavingAmount: new Decimal("25.00")`, `appliedOfferTitle: "Summer Special 10% OFF"`, `taxRate: new Decimal("18.00")` and persists them accurately.
  - [ ] Test: `OrderRepository.create()` with those fields omitted stores `null` for all four columns (backward compatibility).
  - [ ] **Run — confirm RED (columns do not exist on Prisma Order model).**

- [ ] **GREEN — Backend (Schema → Migration → Seed → Repository):**
  - [ ] [Schema] In `apps/api/prisma/schema.prisma`, add to `Order` model after `appliedDiscountCode`:
    ```prisma
    discountSavingAmount  Decimal?  @db.Decimal(10, 2)
    offerSavingAmount     Decimal?  @db.Decimal(10, 2)
    appliedOfferTitle     String?   @db.Text
    taxRate               Decimal?  @db.Decimal(5, 2)
    ```
  - [ ] [Migration] Run `pnpm --filter @gorola/api prisma migrate dev --name add_order_financial_snapshot_columns`. Apply migration to test database.
  - [ ] [Seed] In `apps/api/prisma/seed.ts`, add to `systemSetting.createMany`:
    ```typescript
    { key: "GST_RATE", value: "0", description: "GST percentage applied to orders. Set to 0 to disable tax.", updatedBy: "system" },
    { key: "GST_NUMBER", value: "", description: "Business GSTIN for tax invoice generation (e.g. 05AAAAA0000A1Z5).", updatedBy: "system" }
    ```
  - [ ] [Repository] In `apps/api/src/modules/order/order.repository.ts`, update `CreateOrderInput` interface and pass through the four snapshot fields in `create()`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Migration applied → `Order` rows support snapshot columns → existing rows retain `null` safely → tests pass → ✅ Done.

---

### Phase 6.18.2: Semantic Fix — "Delivery Fee" vs "Service Fee" Labels

**Root cause:** Six pages in Store and Admin portals unconditionally render the label "Delivery Fee" for `order.deliveryFee`. For `BOOKING` commerce orders, this column stores the platform service fee (there is no delivery).

**Approach:** Conditionally render `"Service Fee"` when `order.orderType === "BOOKING"` and `"Delivery Fee"` when `order.orderType === "QUICK"`.

---

- [ ] **RED — Frontend Unit (5 test files):**
  - [ ] **`StoreOrdersPage.test.tsx`:** Assert breakdown renders `"Service Fee"` when `orderType === "BOOKING"` and `"Delivery Fee"` when `orderType === "QUICK"`.
  - [ ] **`AdminOrdersPage.test.tsx`:** Assert breakdown renders `"Service Fee"` for booking orders.
  - [ ] **`AdminStoreDetailPage.test.tsx`:** Assert breakdown modal renders `"Service Fee"` for booking rows.
  - [ ] **`AdminUserDetailPage.test.tsx`:** Assert user orders modal renders `"Service Fee"` for booking rows.
  - [ ] **`StoreBookingsPage.test.tsx`:** Assert fee row is labeled `"Service Fee"`.
  - [ ] **Run all 5 tests — confirm RED.**

- [ ] **GREEN — Frontend Component Updates:**
  - [ ] In all 6 files, replace hardcoded `"Delivery Fee"` text with:
    ```tsx
    {order.orderType === "BOOKING" ? "Service Fee" : "Delivery Fee"}
    ```
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Store/Admin viewing booking order sees "Service Fee: ₹199" → quick order sees "Delivery Fee: ₹30" → ✅ Done.

---

### Phase 6.18.3: GST Settings Infrastructure (SystemSetting + Admin UI)

**Root cause:** Admin panel has no inputs for GST rate and business GSTIN number.

**Approach:** Seed keys in `SystemSetting`, add validation in admin settings controller, update `useSystemSettings` hook, and add inputs in `AdminDashboardPage.tsx`.

---

- [ ] **RED — Backend Integration (`apps/api/src/__tests__/integration/admin/admin.settings.test.ts`):**
  - [ ] Test: `PUT /api/v1/admin/settings` accepts `gstRate: "18"` and `gstNumber: "05AAAAA0000A1Z5"` and updates `SystemSetting`.
  - [ ] Test: `gstRate` validation rejects negative numbers or numbers > 100.
  - [ ] Test: `GET /api/v1/settings` public endpoint returns `GST_RATE: "18.00"`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Controller & Route):**
  - [ ] In `apps/api/src/modules/admin/admin.controller.ts`, add `gstRate` and `gstNumber` to the settings Zod schema.
  - [ ] Persist keys `GST_RATE` and `GST_NUMBER` with `AuditLog` entry.
  - [ ] Include `GST_RATE` in public `GET /api/v1/settings` response.
  - [ ] Run backend tests — **confirm GREEN.**

- [ ] **RED — Frontend Unit (`AdminDashboardPage.test.tsx`):**
  - [ ] Test: Form renders `id="gst-rate-input"` and `id="gst-number-input"`.
  - [ ] Test: Submitting form passes `gstRate` and `gstNumber` in payload.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Hook & Admin Form):**
  - [ ] [Hook] In `apps/web/src/lib/useSystemSettings.ts`, add `GST_RATE: string` to settings interface.
  - [ ] [Page] In `AdminDashboardPage.tsx`, add form state, inputs with IDs, and save handler.
  - [ ] Run frontend unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Admin enters GST Rate `18` and GSTIN → clicks Save → values persisted in DB with audit trail → `useSystemSettings` receives updated values → ✅ Done.

---

### Phase 6.18.4: Persist discountSavingAmount, offerSavingAmount & appliedOfferTitle at Checkout

**Root cause:** `BuyerCheckoutService` and `booking-order.service.ts` calculate promo savings and select offer titles, but omit them from the `order.create()` database transaction.

**Approach:** Pass `discountSavingAmount`, `offerSavingAmount`, and `appliedOfferTitle` into the `createOrder` data payload in both checkout pipelines.

---

- [ ] **RED — Backend Integration (`apps/api/src/__tests__/integration/order/order.controller.test.ts`):**
  - [ ] Test: Quick order with coupon saving ₹50 stores `discountSavingAmount = 50.00` and `appliedDiscountCode = "COUPON50"`.
  - [ ] Test: Quick order with store offer saving ₹25 stores `offerSavingAmount = 25.00` and `appliedOfferTitle = "Festive 10% OFF"`.
  - [ ] Test: Order with no promotions stores `discountSavingAmount = 0.00`, `offerSavingAmount = 0.00`, `appliedOfferTitle = null`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Service Updates):**
  - [ ] In `BuyerCheckoutService.ts`, pass `discountSavingAmount`, `offerSavingAmount`, and `appliedOfferTitle` to `placeOrderWithStock()`.
  - [ ] In `booking-order.service.ts`, pass `discountSavingAmount`, `offerSavingAmount`, and `appliedOfferTitle` to `tx.order.create()`.
  - [ ] In `order.controller.ts`, serialize these three fields in order responses.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Buyer places order with coupon & store offer → DB row records exact rupee savings and promotion title → ✅ Done.

---

### Phase 6.18.5: Replace Discount Inference Hack & Render Offer Titles Across All Portals

**Root cause:** UI components derive discount amounts using `subtotal + deliveryFee - total` and cannot show promotional offer titles.

**Approach:** Update Buyer, Store, and Admin order views to read `discountSavingAmount`, `offerSavingAmount`, and `appliedOfferTitle` directly from the API.

---

- [ ] **RED — Frontend Unit (Buyer, Store, Admin test files):**
  - [ ] **`OrderConfirmationPage.test.tsx`:** Assert summary renders coupon savings and offer title badge (`🎉 Offer: Festive 10% OFF (-₹25.00)`).
  - [ ] **`BookingConfirmationPage.test.tsx`:** Assert booking summary displays stored savings and offer name.
  - [ ] **`AccountOrdersPage.test.tsx`:** Assert order cards display savings chips and promo title.
  - [ ] **`StoreOrdersPage.test.tsx` / `StoreBookingsPage.test.tsx`:** Assert order details drawer displays `appliedOfferTitle`.
  - [ ] **`AdminOrdersPage.test.tsx` / `AdminStoreDetailPage.test.tsx` / `AdminUserDetailPage.test.tsx`:** Assert admin order breakdown modals display stored discount amounts and offer title.
  - [ ] **Run all frontend tests — confirm RED.**

- [ ] **GREEN — Frontend Component Updates:**
  - [ ] In `OrderConfirmationPage.tsx`, `BookingConfirmationPage.tsx`, `AccountOrdersPage.tsx`, `StoreOrdersPage.tsx`, `StoreBookingsPage.tsx`, `AdminOrdersPage.tsx`, `AdminStoreDetailPage.tsx`, and `AdminUserDetailPage.tsx`:
    - Replace arithmetic inference with stored values:
      ```typescript
      const discountAmount = Number(order.discountSavingAmount ?? 0) + Number(order.offerSavingAmount ?? 0);
      ```
    - Display promo chips for `appliedDiscountCode` and `appliedOfferTitle` when present.
  - [ ] Run all frontend tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Order with coupon & offer renders exact savings and promo titles across all Buyer, Store, and Admin views without deriving from total → ✅ Done.

---

### Phase 6.18.6: Separate Technician Earning Rate for Booking Commerce

**Root cause:** Booking field technicians and quick-commerce delivery riders share a single `RIDER_EARNING_RATE_PCT` setting, preventing independent payout rate configuration.

**Approach:** Add `TECHNICIAN_EARNING_RATE_PCT` to `SystemSetting`, update `rider-earnings.service.ts` to choose rate by `orderType`, and expose in Admin Dashboard.

---

- [ ] **RED — Backend Integration (`apps/api/src/__tests__/integration/rider/rider.earnings.trigger.test.ts`):**
  - [ ] Test: Seed `TECHNICIAN_EARNING_RATE_PCT = "50"` and `RIDER_EARNING_RATE_PCT = "80"`. Marking `BOOKING` order delivered creates `RiderEarning` at 50% of service fee.
  - [ ] Test: Marking `QUICK` order delivered creates `RiderEarning` at 80% of delivery fee.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Seed → Service → Controller):**
  - [ ] In `apps/api/prisma/seed.ts`, seed `TECHNICIAN_EARNING_RATE_PCT = "100"`.
  - [ ] In `rider-earnings.service.ts`, accept `orderType` and use `TECHNICIAN_EARNING_RATE_PCT` for `BOOKING` orders.
  - [ ] In `admin.controller.ts`, allow updating `technicianEarningRate` in `PUT /api/v1/admin/settings`.
  - [ ] In `AdminDashboardPage.tsx`, add input `id="technician-earning-rate-input"`.
  - [ ] Run integration and unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Booking completed → technician credited according to technician earning rate → delivery completed → rider credited according to rider earning rate → ✅ Done.

---

### Phase 6.18.7: Invoice Generator Script & Service

**Root cause:** GoRola lacks an invoice generation tool to output compliant order tax invoices.

**Approach:** Build decoupled `fetchInvoiceData(orderId)` and pure `formatInvoice(data: InvoiceData)` modules and expose CLI tool `scripts/generate-invoice.ts`.

---

- [ ] **RED — Unit (`apps/api/src/__tests__/unit/invoice/invoice-formatter.test.ts`):**
  - [ ] Test: `formatInvoice()` includes business GSTIN, customer details, itemized table, subtotal, delivery/service fee, coupon code, and offer title.
  - [ ] Test: `formatInvoice()` omits GST section when `taxRate` is null or 0.
  - [ ] Test: `formatInvoice()` renders "Service Fee" for `BOOKING` orders.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Script (Types → Formatter → Fetcher → CLI):**
  - [ ] [Types] Create `apps/api/src/modules/invoice/invoice.types.ts` defining `InvoiceData`.
  - [ ] [Formatter] Create `apps/api/src/modules/invoice/invoice-formatter.ts` exporting `formatInvoice(data: InvoiceData): string`.
  - [ ] [Fetcher] Create `apps/api/src/modules/invoice/invoice-data-fetcher.ts` exporting `fetchInvoiceData(orderId, db)`.
  - [ ] [CLI] Create `scripts/generate-invoice.ts` accepting `--orderId` argument and printing formatted invoice.
  - [ ] Run unit test — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Running `ts-node scripts/generate-invoice.ts --orderId <id>` fetches order, decrypts phone, formats items and promotions, and prints clean tax invoice to stdout → ✅ Done.

---

### Phase 6.18.8: Full Regression & Quality Gates

- [ ] **API Tests:** `pnpm --filter @gorola/api test -- --run` (100% green). ✅
- [ ] **Web Tests:** `pnpm --filter @gorola/web test -- --run` (100% green). ✅
- [ ] **Typecheck:** `pnpm typecheck` (0 errors across monorepo). ✅
- [ ] **Lint:** `pnpm lint` (0 errors, 0 warnings). ✅
- [ ] **Manual Smoke:** Create quick order with coupon + store offer → verify DB snapshot columns → verify UI chips → test invoice script output. ✅
- [ ] **Update Documentation:** Mark Phase 6.18 as COMPLETE in `CONTEXT/phase6_state.md` and queue Phase 6.19 in `CONTEXT/current_state.md`. ✅

---

## 🔮 Phase 6.19 Roadmap: Tax Calculation Logic, GST Rules & Advanced Invoice Formatting

> **Phase:** 6.19  
> **Status:** QUEUED (Follows Phase 6.18 completion)  
> **Primary Goal:** Activate live GST taxation at checkout and deliver client-facing PDF/printable invoice downloads.

### Core Objectives of Phase 6.19:

1. **GST Calculation Engine (`BuyerCheckoutService` & `booking-order.service.ts`):**
   - Read `GST_RATE` from `SystemSetting`.
   - Apply finalized tax rules (taxable base pre vs post discount, MRP tax extraction, CGST/SGST 50/50 split).
   - Snapshot calculated `taxRate` onto `Order.taxRate` at checkout.

2. **Price Breakdown Display (6 UI Views):**
   - Render dedicated "GST / Tax" row across all checkout and order review interfaces (`CheckoutPage`, `BookingTimeslotPage`, `CartDrawer`, `OrderConfirmationPage`, `AdminOrdersPage`, `StoreOrdersPage`).

3. **Advanced Invoice Generation & Buyer Download:**
   - Implement `GET /api/v1/orders/:id/invoice` endpoint returning formatted HTML/PDF.
   - Add "Download Tax Invoice" button in Buyer Order History (`/account/orders`) and Store/Admin detail views.
