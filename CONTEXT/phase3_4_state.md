# GoRola — Phase 3 & 4 State

> **This file covers Phase 3 (Store Owner Panel) and Phase 4 (Admin Panel).**
> Phase 3 starts after Phase 2.23 is complete. Phase 4 starts after Phase 3 is complete.
> For overall project status: read `current_state.md` first.
> For Phase 1 & 2 history: read `phase1_2_state.md`. For Phase 5: read `phase5_state.md`.

---

## Phase Status

| Phase   | Name              | Status       | Notes |
| ------- | ----------------- | ------------ | ----- |
| Phase 3 | Store Owner Panel | IN PROGRESS  | Phase 3.3 completed with live Sockets! |
| Phase 4 | Admin Panel       | NOT STARTED  | Start after Phase 3 complete |

---

## 📍 Last Updated

- **Date:** 2026-05-20
- **Session Summary:** Solved store session state persistence by isolating store owner sessions to a distinct cookie namespace (`"storeOwnerRefreshToken"`), completely preventing session conflicts on reload. Upgraded HTTP Fastify and Socket.io CORS to dynamically mirror origins in development mode, unblocking Vite port shifts. Added WebSocket real-time updates to the buyer's `OrderHistoryPage.tsx` so merchant status changes propagate instantly with custom notifications. Implemented premium manual refresh mechanisms with active loading spinners (`animate-spin`) and multi-stage Sonner status toasts on both client and merchant pages.
- **Next Session Must Start With:** Phase 3.4 — Product Management (CRUD + Variants).
- **In Progress Right Now:** None.
- **Current Blocker:** None.

> ⚠️ **Update THIS block at the end of every session** (not `current_state.md`). Also mark completed checklist items `[x]` and append to the Session Notes section at the bottom. Update `current_state.md` ONLY when Phase 3 or Phase 4 changes status (NOT STARTED → IN PROGRESS → COMPLETE).


## In Progress Right Now

_(None - Phase 3.2 is completed successfully. Next task is Phase 3.3.)_

---

## ⚠️ Booking Commerce Awareness (READ BEFORE STARTING PHASE 3)

GoRola now supports **two store types** (introduced in Phase 7):

| `StoreType` | Examples | Order flow |
|---|---|---|
| `QUICK_COMMERCE` | Groceries, Medical Store, Electronics | Instant cart → place order → rider delivers |
| `BOOKING_COMMERCE` | Medical Tests, Repairs | Browse → pick timeslot → book → store approves → field staff visits |

**What this means for Phase 3 and 4:**
- Every store owner dashboard, order list, and product form built here works for **BOTH** store types.
- The approval queue, timeslot engine, and booking-specific fields are built in **Phase 7** — not here.
- The only Phase 3 item that changes is **3.8a** (Store Availability Toggles — new section below). Build it here because the store dashboard is where these toggles live.
- Phase 4.5 (Admin Store Management) must include `storeType` when creating a store — noted in that section.
- Build everything generically now. Phase 7 layering will not require you to undo anything here.

---

## Architecture Reminder

- Store Owner Panel and Admin Panel live inside **`apps/web/src/pages/store/`** and **`apps/web/src/pages/admin/`** respectively — same single Vite SPA, same single Vercel deployment.
- Access is gated by React route guards: `StoreRoute` (requires STORE_OWNER role) and `AdminRoute` (requires ADMIN role + 2FA verified).
- Backend controllers for all store-facing endpoints live in **`apps/api/src/modules/store-owner/`** (new module). Admin controllers live in **`apps/api/src/modules/admin/`**.
- All repositories already exist from Phase 1. Phase 3 and 4 are about adding **Service + Controller + Routes** layers on top of them.

---

## Mandatory API Contract Gate (applies to every section in Phase 3 AND Phase 4)

Before marking any checklist item complete:
- [ ] Required backend endpoint(s) implemented and returning correct envelope
- [ ] Backend integration tests verify: endpoint contract, HTTP status codes, auth/role guards, and audit behavior
- [ ] Endpoint routes registered in `registerAppRoutes` in `routes.ts` (verifiable by running `GET /api/debug/routes` in dev)
- [ ] Frontend tests verify: expected API response shape, loading state, empty state, error state

---

## Phase 3 — Store Owner Panel Checklist

---

### 3.1 — Store Owner Auth (Login + Mandatory 2FA)

**Root Cause / Goal:**
The backend auth services for store owner login and 2FA (`store-owner-auth.service.ts`) already exist from Phase 1.5. The HTTP routes for `POST /api/v1/auth/store-owner/login`, `POST /api/v1/auth/store-owner/setup-2fa`, and `POST /api/v1/auth/store-owner/verify-2fa` were wired in Session 19. **Goal:** Verify all routes are correctly registered at runtime, build the complete frontend auth flow (`StoreLoginPage`, `StoreTwoFactorPage`, `StoreSetup2FAPage`), and add the `StoreRoute` guard that blocks all `/store/*` routes unless STORE_OWNER role + `twoFactorVerified` flag are both true in the JWT session.

**Fix / Approach:**
1. [Backend Verification] Confirm all 3 auth routes respond correctly in an integration test against the live server (not mocked). Check `routes.ts` to ensure `registerStoreOwnerAuthRoutes` is called inside `registerAppRoutes`.
2. [Frontend] Build `StoreLoginPage.tsx` → `/store/login`. Build `StoreTwoFactorPage.tsx` → `/store/2fa`. Build `StoreSetup2FAPage.tsx` → `/store/setup-2fa` (only shown if 2FA not yet configured).
3. [Frontend Guard] Build `StoreRoute` component: reads JWT claims, redirects to `/store/login` if not STORE_OWNER, redirects to `/store/2fa` if `twoFactorVerified = false`.
4. [Frontend Layout] Build `StoreLayout.tsx`: top nav + sidebar with links to Dashboard, Orders, Products, Ads, Offers, Discounts, Settings.

---

- [x] **RED — Integration (`store-owner-auth.routes.test.ts` — new file):**
  - [x] Test: `POST /api/v1/auth/store-owner/login` with correct email + password → returns `{ success: true, data: { requiresTwoFactor: true } }` with HTTP 200
  - [x] Test: `POST /api/v1/auth/store-owner/login` with wrong password → returns `{ success: false, error: { code: 'AUTH_FAILED' } }` with HTTP 401
  - [x] Test: `POST /api/v1/auth/store-owner/login` after 10 failed attempts → returns HTTP 429 with `RATE_LIMITED` code
  - [x] Test: `POST /api/v1/auth/store-owner/verify-2fa` with valid TOTP → returns `{ success: true, data: { accessToken, refreshToken } }` with HTTP 200
  - [x] Test: `POST /api/v1/auth/store-owner/verify-2fa` with invalid TOTP → returns HTTP 401 with `INVALID_TOTP` code
  - [x] Test: `POST /api/v1/auth/store-owner/setup-2fa` (authenticated store owner without 2FA) → returns `{ success: true, data: { secret, qrUri } }`
  - [x] **Run — confirm RED if any route is missing or returns wrong shape.**

- [x] **GREEN — Backend Verification (`routes.ts`, `auth.controller.ts`):**
  - [x] Open `routes.ts` — confirm `registerStoreOwnerAuthRoutes(app)` is called inside `registerAppRoutes`
  - [x] If missing: add the call; verify all 3 routes appear in `GET /api/debug/routes` response
  - [x] Confirm `StoreOwnerAuthService` is correctly injected into the controller
  - [x] Run integration tests — **confirm GREEN**

- [x] **RED — Unit/Component (`StoreLoginPage.test.tsx`):**
  - [x] Test: renders email input with `id="store-login-email"` and password input with `id="store-login-password"` and submit button
  - [x] Test: submitting with empty email shows validation error "Email is required"
  - [x] Test: on successful login API response (`requiresTwoFactor: true`), `navigate` is called with `/store/2fa`
  - [x] Test: on 401 API response, error message "Invalid credentials" is shown
  - [x] **Run — confirm RED (component does not exist)**

- [x] **RED — Unit/Component (`StoreTwoFactorPage.test.tsx`):**
  - [x] Test: renders 6-digit OTP input with `id="totp-input"` and "Verify" button
  - [x] Test: "Setup 2FA" link is visible if store owner has `twoFactorEnabled = false` in session
  - [x] Test: on valid TOTP submission, `setStoreOwnerSession` is called and `navigate` goes to `/store/dashboard`
  - [x] Test: on invalid TOTP, error "Invalid code" is shown
  - [x] **Run — confirm RED (component does not exist)**

- [x] **RED — Unit/Component (`StoreRoute.test.tsx`):**
  - [x] Test: unauthenticated user accessing `/store/dashboard` → `<Navigate to="/store/login" />` is rendered
  - [x] Test: STORE_OWNER user with `twoFactorVerified = false` → `<Navigate to="/store/2fa" />` is rendered
  - [x] Test: STORE_OWNER user with `twoFactorVerified = true` → children component is rendered
  - [x] **Run — confirm RED (component does not exist)**

- [x] **GREEN — Frontend (all components + guard):**
  - [x] [Component] Create `apps/web/src/pages/store/StoreLoginPage.tsx` with email + password form, calls `POST /api/v1/auth/store-owner/login`, navigates to `/store/2fa` on success
  - [x] [Component] Create `apps/web/src/pages/store/StoreTwoFactorPage.tsx` with TOTP input, calls `POST /api/v1/auth/store-owner/verify-2fa`, navigates to `/store/dashboard` on success
  - [x] [Component] Create `apps/web/src/pages/store/StoreSetup2FAPage.tsx`: calls `POST /api/v1/auth/store-owner/setup-2fa`, shows QR code image (using `qrUri` from response), then prompts for TOTP confirmation
  - [x] [Guard] Create `apps/web/src/components/store/StoreRoute.tsx`: checks Zustand `useStoreOwnerAuthStore` for role and `twoFactorVerified` flag
  - [x] [Layout] Create `apps/web/src/components/store/StoreLayout.tsx`: sidebar nav with links to all store pages, store name in header, logout button
  - [x] [Router] Add all `/store/*` routes in `App.tsx` wrapped in `<StoreRoute>` and `<StoreLayout>`
  - [x] Run all unit tests — **confirm GREEN**

- [x] **Verification chain:**
  - [x] Navigate to `/store/dashboard` while unauthenticated → redirected to `/store/login` → enter correct email + password → redirected to `/store/2fa` → enter valid TOTP → redirected to `/store/dashboard` → `StoreLayout` with sidebar is visible → ✅ Done.

---

### 3.2 — Store Dashboard (KPI Summary)

**Root Cause / Goal:**
No store dashboard endpoint exists. The store owner needs a real-time overview of their store's performance: today's order count and revenue, pending orders requiring action, weekly revenue trend, top-selling products, low-stock alerts, and active advertisement/offer counts. All data must be scoped strictly to the authenticated store owner's `storeId` — no cross-store data leakage.

**Fix / Approach:**
1. [Backend] Create `GET /api/v1/store/dashboard` in a new `store-owner.controller.ts`. The service method aggregates data from `OrderRepository`, `ProductVariantRepository`, `AdvertisementRepository`, `OfferRepository` — all filtered by `storeId` extracted from the JWT.
2. [Frontend] Create `StoreDashboardPage.tsx` → route `/store/dashboard`. Display metrics as cards + a Recharts bar chart for the 7-day revenue trend.

---

- [x] **RED — Integration (`store-owner.dashboard.test.ts` — new file):**
  - [x] Test setup: create a store, store owner, 3 products with variants, 2 orders (1 PLACED, 1 DELIVERED) for today using the test DB seed helper
  - [x] Test: `GET /api/v1/store/dashboard` with valid STORE_OWNER JWT and `storeId` matching the test store → HTTP 200 with body shape `{ success: true, data: { todayOrderCount, todayRevenue, pendingOrdersCount, weeklyRevenue: [{ date, revenue }], topProducts: [{ name, soldCount }], lowStockItems: [{ productName, variantLabel, stockQty }], activeAdvertisementsCount, activeOffersCount } }`
  - [x] Test: `todayOrderCount` = 2, `pendingOrdersCount` = 1 (only the PLACED order), `todayRevenue` is a positive number
  - [x] Test: `GET /api/v1/store/dashboard` with JWT from a DIFFERENT store owner → `todayOrderCount` = 0 (strict store isolation)
  - [x] Test: `GET /api/v1/store/dashboard` with no JWT → HTTP 401
  - [x] Test: `GET /api/v1/store/dashboard` with BUYER role JWT → HTTP 403
  - [x] **Run — confirm RED (404 — endpoint does not exist)**

- [x] **GREEN — Backend (Service → Controller → Routes):**
  - [x] [Service] Create `apps/api/src/modules/store-owner/store-owner.service.ts` with method `getDashboard(storeId: string)`:
    - `todayOrderCount`: `OrderRepository.countByStoreAndDateRange(storeId, startOfToday, endOfToday)`
    - `todayRevenue`: sum of `Order.total` for today's DELIVERED + PLACED orders for this store
    - `pendingOrdersCount`: `OrderRepository.countByStoreAndStatus(storeId, 'PLACED')`
    - `weeklyRevenue`: loop last 7 days, sum daily revenue → array of `{ date: 'YYYY-MM-DD', revenue: number }`
    - `topProducts`: top 5 by `OrderItem` count for this store's products in last 30 days
    - `lowStockItems`: `ProductVariantRepository.findLowStockByStore(storeId)` (variants where `isLowStock = true`)
    - `activeAdvertisementsCount`: `AdvertisementRepository.countActiveByStore(storeId)`
    - `activeOffersCount`: `OfferRepository.countActiveByStore(storeId)`
  - [x] [Controller] Create `apps/api/src/modules/store-owner/store-owner.controller.ts` with `GET /api/v1/store/dashboard` handler: extract `storeId` from `request.user.storeId`, call service, return
  - [x] [Routes] Add `registerStoreOwnerRoutes(app)` in `routes.ts` — register `GET /api/v1/store/dashboard` with `requireAuth` + `requireRole('STORE_OWNER')` middleware
  - [x] Run integration tests — **confirm GREEN**

- [x] **RED — Unit/Component (`StoreDashboardPage.test.tsx`):**
  - [x] Test: shows skeleton loading state while `GET /api/v1/store/dashboard` is pending
  - [x] Test: after API resolves, `data-testid="today-order-count"` shows `2`
  - [x] Test: `data-testid="pending-orders-count"` shows `1`
  - [x] Test: `data-testid="today-revenue"` shows a `₹` prefixed value
  - [x] Test: low stock alert section renders when `lowStockItems.length > 0` — shows product name, variant label, `stockQty`
  - [x] Test: weekly revenue chart (Recharts `BarChart`) is rendered with 7 data points
  - [x] Test: if API returns HTTP 500, error message "Unable to load dashboard" is shown
  - [x] **Run — confirm RED (component does not exist)**

- [x] **GREEN — Frontend:**
  - [x] [Component] Create `apps/web/src/pages/store/StoreDashboardPage.tsx`
  - [x] Use `useQuery` (`GET /api/v1/store/dashboard`, staleTime 60s) for data fetching
  - [x] KPI cards: Today's Orders, Today's Revenue, Pending Orders, Active Ads, Active Offers — each with `data-testid` attribute
  - [x] Low stock alert section: visible only when `lowStockItems.length > 0`, each row shows product name + variant + qty + inline "Restock" button (navigates to inventory management)
  - [x] Weekly revenue bar chart: Recharts `BarChart` with `todayRevenue` highlighted in gorola-saffron, others in gorola-pine
  - [x] Top 5 products list with rank number, name, and units sold count
  - [x] Run unit tests — **confirm GREEN**

- [x] **Verification chain:**
  - [x] Store owner logs in → navigates to `/store/dashboard` → KPI cards show correct counts → low stock items visible if any → bar chart renders 7 bars → ✅ Done.

---

### 3.3 — Incoming Order Management

**Root Cause / Goal:**
No store-facing order endpoints exist. Store owners need to see all incoming orders for their store, filter by status, update order status (PLACED → PREPARING → OUT_FOR_DELIVERY → DELIVERED), and be notified of new orders in real-time via Socket.IO. All operations must be strictly scoped to the authenticated store owner's `storeId`.

**Fix / Approach:**
1. [Backend] Create `GET /api/v1/store/orders` (paginated, filterable by status) and `PUT /api/v1/store/orders/:orderId/status` in `store-owner.controller.ts`. Status updates must follow the strict state machine: PLACED→PREPARING→OUT_FOR_DELIVERY→DELIVERED; PLACED/PREPARING→CANCELLED. Any invalid transition returns HTTP 422.
2. [Frontend] Create `StoreOrdersPage.tsx` → `/store/orders`. Order detail modal with status update button.

---

- [x] **RED — Integration (`store-owner.orders.test.ts` — new file):**
  - [x] Test setup: create store A + store B, each with 2 orders (different statuses)
  - [x] Test: `GET /api/v1/store/orders` with store A STORE_OWNER JWT → returns only store A orders (count = 2), store B orders absent
  - [x] Test: `GET /api/v1/store/orders?status=PLACED` → returns only PLACED orders for this store
  - [x] Test: `GET /api/v1/store/orders?page=1&limit=10` → returns `{ data: [...], meta: { total, page, limit, hasMore } }`
  - [x] Test: `PUT /api/v1/store/orders/<storeAOrderId>/status` with body `{ status: 'PREPARING' }` → HTTP 200, order status in DB is now PREPARING, `OrderStatusHistory` has new PREPARING entry
  - [x] Test: `PUT /api/v1/store/orders/<orderId>/status` with body `{ status: 'PLACED' }` (backward transition) → HTTP 422 with `INVALID_STATUS_TRANSITION` code
  - [x] Test: `PUT /api/v1/store/orders/<storeBOrderId>/status` using store A JWT → HTTP 403 with `FORBIDDEN` code (cannot touch other store's orders)
  - [x] Test: `GET /api/v1/store/orders` with no JWT → HTTP 401
  - [x] **Run — confirm RED (404 — endpoints do not exist)**

- [x] **GREEN — Backend (Service → Controller → Routes):**
  - [x] [Service] Add to `store-owner.service.ts`:
    - `getOrders(storeId, { status?, page, limit })`: calls `OrderRepository.findManyByStore(storeId, filters)` — returns paginated list with `OrderItem[]`, buyer masked phone, total, status, `statusHistory`
    - `updateOrderStatus(storeId, orderId, newStatus)`: validates order belongs to this store (throws `ForbiddenError` if not), validates state machine transition (throws `ValidationError` if invalid), calls `OrderRepository.updateStatus(orderId, newStatus)`
  - [x] [Controller] Add to `store-owner.controller.ts`:
    - `GET /api/v1/store/orders`: parse `status?`, `page`, `limit` from query using Zod schema; call service; return paginated envelope
    - `PUT /api/v1/store/orders/:orderId/status`: parse `{ status }` body using Zod enum (only valid statuses); call service; return updated order
  - [x] [Routes] Register both routes with `requireAuth` + `requireRole('STORE_OWNER')` in `routes.ts`
  - [x] Run integration tests — **confirm GREEN**

- [x] **RED — Unit/Component (`StoreOrdersPage.test.tsx`):**
  - [x] Test: renders table with columns "Order ID", "Items", "Total", "Status", "Time", "Action"
  - [x] Test: status filter dropdown (All / PLACED / PREPARING / OUT_FOR_DELIVERY / DELIVERED) updates query param and re-fetches
  - [x] Test: clicking an order row opens detail modal showing full items list with names, quantities, unit prices
  - [x] Test: "Update Status" dropdown in modal shows only valid next states (e.g. if current = PLACED, shows PREPARING and CANCELLED; not DELIVERED)
  - [x] Test: confirming a status update calls `PUT /api/v1/store/orders/:id/status` and shows success toast
  - [x] Test: while status update is pending, the confirm button shows a spinner and is disabled
  - [x] **Run — confirm RED (component does not exist)**

- [x] **GREEN — Frontend:**
  - [x] [Component] Create `apps/web/src/pages/store/StoreOrdersPage.tsx`
  - [x] Use `useQuery` for order list with `status` filter from URL param; `staleTime: 30000`; `refetchInterval: 60000` (auto-refresh every minute)
  - [x] Table rows: Order ID (masked, first 8 chars + "..."), items count, total `₹`, status badge (color-coded), elapsed time ("2m ago")
  - [x] Order detail modal (shadcn `Dialog`): full items list, buyer masked phone, delivery address landmark, status history timeline
  - [x] Status update: dropdown shows only valid transitions; `useMutation` calls `PUT`; invalidates order list query on success
  - [x] Run unit tests — **confirm GREEN**

- [x] **Verification chain:**
  - [x] Store orders page loads → shows pending orders → click order → modal with full details → select "PREPARING" from status dropdown → confirm → order status updates in DB → order list refreshes → status badge changes → ✅ Done.

---

### 3.4 — Product Management (CRUD + Variants)

**Root Cause / Goal:**
No store-owner-facing product endpoints exist. Store owners need to create, read, update, and soft-delete products with multiple variants (each with SKU, price, stock quantity). Products must only be manageable for the authenticated owner's store.

**Fix / Approach:**
1. [Backend] Create `GET /api/v1/store/products`, `POST /api/v1/store/products`, `PUT /api/v1/store/products/:id`, `DELETE /api/v1/store/products/:id` (soft delete), and `PUT /api/v1/store/products/:id/variants/:variantId` in `store-owner.controller.ts`.
2. [Frontend] `StoreProductsPage.tsx` (list + search), `StoreProductFormPage.tsx` (create/edit).

---

- [ ] **RED — Integration (`store-owner.products.test.ts` — new file):**
  - [ ] Test setup: create 2 stores (A and B) with products
  - [ ] Test: `GET /api/v1/store/products` with store A JWT → returns only store A products; store B products absent
  - [ ] Test: `POST /api/v1/store/products` with body `{ name: 'Fresh Milk', subCategoryId: '<id>', description: '...', variants: [{ label: '500ml', price: 35, stockQty: 100, sku: 'MILK-500' }] }` → HTTP 201 with `{ id, name, variants: [{ id, label, price, stockQty, isInStock: true }] }`
  - [ ] Test: `POST /api/v1/store/products` with duplicate SKU across variants → HTTP 409 with `CONFLICT` code
  - [ ] Test: `POST /api/v1/store/products` with `subCategoryId` that doesn't exist → HTTP 404 with `NOT_FOUND` code
  - [ ] Test: `PUT /api/v1/store/products/<storeAProductId>` with body `{ name: 'Updated Name' }` → HTTP 200; product name updated in DB
  - [ ] Test: `PUT /api/v1/store/products/<storeBProductId>` using store A JWT → HTTP 403 `FORBIDDEN`
  - [ ] Test: `DELETE /api/v1/store/products/<storeAProductId>` → HTTP 200; `product.isDeleted = true` in DB; product absent from `GET /api/v1/products` buyer endpoint
  - [ ] Test: `PUT /api/v1/store/products/:id/variants/:variantId` with body `{ price: 40, stockQty: 50 }` → HTTP 200; variant price and stock updated in DB; `StockMovement` with type `ADJUSTMENT` created
  - [ ] **Run — confirm RED (404 — endpoints do not exist)**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add to `store-owner.service.ts`:
    - `getProducts(storeId, { search?, subCategoryId?, page, limit })`: calls `ProductRepository.findManyByStore(storeId, filters)`
    - `createProduct(storeId, dto)`: validates `subCategoryId` exists; calls `ProductRepository.create` with `{ storeId, ...dto, variants: { create: dto.variants } }`; creates `StockMovement` with type `INITIAL` for each variant in a transaction
    - `updateProduct(storeId, productId, dto)`: validates product belongs to storeId; calls `ProductRepository.update`
    - `softDeleteProduct(storeId, productId)`: validates ownership; sets `isDeleted: true`
    - `updateVariant(storeId, productId, variantId, dto)`: validates product belongs to store; if `stockQty` changes, creates `ADJUSTMENT` StockMovement and updates flags atomically in a transaction
  - [ ] [Controller] Add all 5 routes to `store-owner.controller.ts` with Zod validation for each body/query
  - [ ] [Routes] Register all 5 with `requireAuth` + `requireRole('STORE_OWNER')` in `routes.ts`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`StoreProductsPage.test.tsx`):**
  - [ ] Test: renders product list with columns "Image", "Name", "Sub-Category", "Variants Count", "Status"
  - [ ] Test: search input filters list (updates `?search=` query param, re-fetches)
  - [ ] Test: "Add Product" button navigates to `/store/products/new`
  - [ ] Test: "Edit" button on a product row navigates to `/store/products/:id/edit`
  - [ ] Test: "Delete" button shows confirmation modal before calling DELETE endpoint
  - [ ] **Run — confirm RED**

- [ ] **RED — Unit/Component (`StoreProductFormPage.test.tsx`):**
  - [ ] Test: form renders name, description, sub-category dropdown, and "Add Variant" section
  - [ ] Test: each variant row has label, price, stockQty, sku inputs
  - [ ] Test: "Add Variant" button appends a new empty variant row
  - [ ] Test: submitting with empty name shows validation error "Product name is required"
  - [ ] Test: submitting valid form calls `POST /api/v1/store/products` and navigates to `/store/products` on success
  - [ ] Test: in edit mode, form is pre-filled with existing product data; submitting calls `PUT /api/v1/store/products/:id`
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:**
  - [ ] Create `StoreProductsPage.tsx`, `StoreProductFormPage.tsx` with all required fields
  - [ ] Use `react-hook-form` + Zod for client-side validation matching backend rules
  - [ ] Variant rows use `useFieldArray` from react-hook-form
  - [ ] Sub-category dropdown populated from `GET /api/v1/categories` (nested)
  - [ ] Run all unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Store owner → Products page → Add Product → fill name + 2 variants → submit → product appears in list → click Edit → change price → save → buyer API returns updated price → ✅ Done.

---

### 3.5 — Advertisement Management

**Root Cause / Goal:**
No store-owner-facing advertisement endpoints exist. Store owners need to submit advertisements (image URL + date range) for admin approval, view their own advertisements and their approval status, and delete pending or rejected ones.

**Fix / Approach:**
Create `GET /api/v1/store/advertisements`, `POST /api/v1/store/advertisements`, `DELETE /api/v1/store/advertisements/:id` in `store-owner.controller.ts`. Newly created ads have `isApproved: false` by default — admin approval (Phase 4.8) sets this to true.

---

- [ ] **RED — Integration (`store-owner.ads.test.ts`):**
  - [ ] Test: `POST /api/v1/store/advertisements` with body `{ imageUrl: 'https://...', title: 'Summer Sale', startsAt: '<iso>', endsAt: '<iso>' }` → HTTP 201 with `{ id, isApproved: false, isActive: true }`
  - [ ] Test: `GET /api/v1/store/advertisements` → returns only ads for this store; store B ads absent; each ad includes `isApproved`, `isActive`, `startsAt`, `endsAt`
  - [ ] Test: `DELETE /api/v1/store/advertisements/<adId>` for an ad with `isApproved: false` → HTTP 200; ad deleted from DB
  - [ ] Test: `DELETE /api/v1/store/advertisements/<adId>` for an ad with `isApproved: true` → HTTP 422 with `CANNOT_DELETE_APPROVED_AD` code (approved ads must be deactivated by admin, not deleted)
  - [ ] Test: `POST` with `endsAt` before `startsAt` → HTTP 400 with `VALIDATION_ERROR`
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getAds(storeId)`, `createAd(storeId, dto)`, `deleteAd(storeId, adId)` to `store-owner.service.ts`
  - [ ] [Controller + Routes] Add 3 routes with `requireAuth` + `requireRole('STORE_OWNER')` in `store-owner.controller.ts` and `routes.ts`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`StoreAdvertisementsPage.test.tsx`):**
  - [ ] Test: renders ads list with columns "Image Preview", "Title", "Date Range", "Status" (Pending / Approved / Rejected)
  - [ ] Test: "Submit New Ad" form shows imageUrl input, title input, date range pickers
  - [ ] Test: pending/rejected ads show "Delete" button; approved ads show no delete button
  - [ ] Test: deleting a pending ad calls `DELETE` and removes it from the list
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `StoreAdvertisementsPage.tsx` with list + form; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Store owner → Ads → submit new ad with image URL + date range → appears in list as "Pending" → admin approves (Phase 4.8) → appears on buyer home page → ✅ Done.

---

### 3.6 — Offers Management

**Root Cause / Goal:**
No store-owner-facing offer endpoints exist. Store owners need to create time-limited offers (e.g. "10% off Dairy this weekend") with a date range and optional product/sub-category scope, view active and past offers, and deactivate them.

**Fix / Approach:**
Create `GET /api/v1/store/offers`, `POST /api/v1/store/offers`, `PUT /api/v1/store/offers/:id/deactivate` in `store-owner.controller.ts`.

---

- [ ] **RED — Integration (`store-owner.offers.test.ts`):**
  - [ ] Test: `POST /api/v1/store/offers` with body `{ title: 'Weekend Dairy Deal', discountType: 'PERCENTAGE', discountValue: 10, startsAt: '<iso>', endsAt: '<iso>' }` → HTTP 201 with `{ id, isActive: true }`
  - [ ] Test: `GET /api/v1/store/offers` → returns only this store's offers; each with `title`, `discountType`, `discountValue`, `isActive`, `startsAt`, `endsAt`
  - [ ] Test: `PUT /api/v1/store/offers/<offerId>/deactivate` → HTTP 200; `offer.isActive = false` in DB; offer absent from buyer-facing active offers API
  - [ ] Test: `POST` with `discountValue > 100` when `discountType = 'PERCENTAGE'` → HTTP 400 `VALIDATION_ERROR`
  - [ ] Test: accessing another store's offer → HTTP 403 `FORBIDDEN`
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getOffers(storeId)`, `createOffer(storeId, dto)`, `deactivateOffer(storeId, offerId)` to `store-owner.service.ts`
  - [ ] [Controller + Routes] Add 3 routes with `requireAuth` + `requireRole('STORE_OWNER')` in `store-owner.controller.ts` and `routes.ts`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`StoreOffersPage.test.tsx`):**
  - [ ] Test: renders offers list with "Title", "Discount", "Date Range", "Status" columns
  - [ ] Test: "Create Offer" form renders title, discountType select (PERCENTAGE / FIXED), discountValue, date range inputs
  - [ ] Test: active offers have "Deactivate" button; inactive offers show "Expired" badge with no action buttons
  - [ ] Test: deactivating an offer calls `PUT .../deactivate` and updates the row status
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `StoreOffersPage.tsx`; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Create offer → appears in list as active → buyer sees discounted prices where applicable → store owner deactivates → buyer prices revert → ✅ Done.

---

### 3.7 — Discount/Coupon Code Management

**Root Cause / Goal:**
No store-owner-facing discount code endpoints exist. Store owners need to create coupon codes (e.g. `SUMMER20`) with a type (PERCENTAGE or FIXED), value, optional usage limit, and validity dates. Buyers apply these codes in the cart drawer via `POST /api/v1/promotions/discounts/validate` which already exists. This phase adds the creation/management side.

**Fix / Approach:**
Create `GET /api/v1/store/discounts`, `POST /api/v1/store/discounts`, `PUT /api/v1/store/discounts/:id/deactivate` in `store-owner.controller.ts`.

---

- [ ] **RED — Integration (`store-owner.discounts.test.ts`):**
  - [ ] Test: `POST /api/v1/store/discounts` with body `{ code: 'SAVE10', discountType: 'PERCENTAGE', discountValue: 10, maxUsageCount: 100, startsAt: '<iso>', endsAt: '<iso>' }` → HTTP 201 with `{ id, code: 'SAVE10', isActive: true, usedCount: 0 }`
  - [ ] Test: `POST /api/v1/store/discounts` with duplicate code for the same store → HTTP 409 `CONFLICT`
  - [ ] Test: `GET /api/v1/store/discounts` → returns this store's codes; each with `code`, `discountType`, `discountValue`, `usedCount`, `maxUsageCount`, `isActive`, `startsAt`, `endsAt`
  - [ ] Test: `PUT /api/v1/store/discounts/<id>/deactivate` → HTTP 200; `discount.isActive = false` in DB; `POST /api/v1/promotions/discounts/validate` with this code → HTTP 422 `DISCOUNT_INACTIVE`
  - [ ] Test: `discountValue > 100` when `discountType = 'PERCENTAGE'` → HTTP 400
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getDiscounts(storeId)`, `createDiscount(storeId, dto)`, `deactivateDiscount(storeId, discountId)` to `store-owner.service.ts`
  - [ ] [Controller + Routes] Add 3 routes with `requireAuth` + `requireRole('STORE_OWNER')` in `routes.ts`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`StoreDiscountsPage.test.tsx`):**
  - [ ] Test: renders discount list with "Code", "Type", "Value", "Used / Max", "Valid Until", "Status" columns
  - [ ] Test: "Create Code" form renders code input (uppercase enforced), type select, value, max usage, date range
  - [ ] Test: code input converts to uppercase automatically on change
  - [ ] Test: active codes show "Deactivate" button; inactive show "Deactivated" badge
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `StoreDiscountsPage.tsx`; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Store owner creates code `SAVE10` → buyer applies `SAVE10` in cart → discount applied → order recorded with discount amount → store discount `usedCount` increments to 1 → ✅ Done.

---

### 3.8 — Store Settings & Security

**Root Cause / Goal:**
Store owners need to update their store profile (name, description, phone, landmark address, weather mode delivery windows) and change their account password. 2FA management (setup + disable) must also be accessible from a settings page.

**Fix / Approach:**
Create `GET /api/v1/store/settings` and `PUT /api/v1/store/settings` for store profile updates. Reuse existing `POST /api/v1/auth/store-owner/setup-2fa` and `POST /api/v1/auth/store-owner/verify-2fa` for 2FA management. Add `PUT /api/v1/auth/store-owner/change-password`.

---

- [ ] **RED — Integration (`store-owner.settings.test.ts`):**
  - [ ] Test: `GET /api/v1/store/settings` → returns `{ name, description, phone, landmarkAddress, weatherModeDeliveryWindowStart, weatherModeDeliveryWindowEnd }`
  - [ ] Test: `PUT /api/v1/store/settings` with body `{ name: 'New Store Name', phone: '+919876543210' }` → HTTP 200; `store.name` updated in DB
  - [ ] Test: `PUT /api/v1/store/settings` with `name: ''` (empty string) → HTTP 400 `VALIDATION_ERROR`
  - [ ] Test: `PUT /api/v1/auth/store-owner/change-password` with body `{ currentPassword: '...', newPassword: '...' }` → HTTP 200 on correct current password
  - [ ] Test: `PUT /api/v1/auth/store-owner/change-password` with wrong `currentPassword` → HTTP 401 `AUTH_FAILED`
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getSettings(storeId)`, `updateSettings(storeId, dto)`, `changePassword(storeOwnerId, currentPassword, newPassword)` to `store-owner.service.ts`
  - [ ] [Controller + Routes] Add `GET /api/v1/store/settings`, `PUT /api/v1/store/settings`, `PUT /api/v1/auth/store-owner/change-password` with `requireAuth` + `requireRole('STORE_OWNER')`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`StoreSettingsPage.test.tsx`):**
  - [ ] Test: form pre-filled with current store name, description, phone, address
  - [ ] Test: submitting valid changes calls `PUT /api/v1/store/settings` and shows success toast
  - [ ] Test: change password section has currentPassword, newPassword, confirmNewPassword fields
  - [ ] Test: submitting password change with mismatched newPassword vs confirmNewPassword shows client-side error "Passwords do not match" (no API call)
  - [ ] Test: 2FA section shows "Enabled" status if `twoFactorEnabled = true` in auth store; shows "Setup 2FA" button if false
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `StoreSettingsPage.tsx` with 3 sections: Store Info, Change Password, Two-Factor Auth; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Store owner → Settings → update store name → save → buyer home page shows new store name → Change Password → enter correct current password → update → old password no longer works at login → ✅ Done.

---

### 3.8a — Store & Service Availability Toggles

**Root Cause / Goal:**
Phase 7 introduces `BOOKING_COMMERCE` stores (Medical Tests, Repairs). Unlike quick commerce stores, a booking store or individual service can be turned off temporarily (e.g. lab technician on leave, equipment under maintenance). Buyers must not see unavailable stores or services in the UI. This applies to ALL store types — even a Groceries store may need to close for the day. This is the "on/off buttons" requirement.

Two levels of control:
1. **Store-level toggle** — `isAcceptingOrders` on `Store`. When `false`, the store's products are hidden from the buyer catalog entirely.
2. **Variant-level toggle** — `isAvailableForBooking` on `ProductVariant` (booking stores only). When `false`, that specific service/test is hidden from buyers but the store remains visible.

**Fix / Approach:**
1. [Schema] Add `isAcceptingOrders Boolean @default(true)` to `Store`. Add `isAvailableForBooking Boolean @default(true)` to `ProductVariant`. Migration named `add_availability_toggles`.
2. [Backend] Add `PUT /api/v1/store/availability` (store-level) and `PUT /api/v1/store/products/:id/variants/:variantId/availability` (variant-level). Update buyer `GET /api/v1/products` to filter `store.isAcceptingOrders = true` and `variant.isAvailableForBooking = true`.
3. [Frontend] Add an "Availability" card to `StoreDashboardPage` with a prominent toggle switch.

---

- [ ] **RED — Integration (`store-owner.availability.test.ts` — new file):**
  - [ ] Test setup: store with `isAcceptingOrders: true`, 2 active products each with 1 variant (`isAvailableForBooking: true`)
  - [ ] Test: `PUT /api/v1/store/availability` with body `{ isAcceptingOrders: false }` with STORE_OWNER JWT → HTTP 200; `store.isAcceptingOrders = false` in DB
  - [ ] Test: after toggling store off, `GET /api/v1/products?categoryId=<id>` (buyer endpoint) → returns **0 products** for this store (store is hidden from buyers)
  - [ ] Test: `PUT /api/v1/store/availability` with body `{ isAcceptingOrders: true }` → HTTP 200; products visible again in buyer catalog
  - [ ] Test: `PUT /api/v1/store/products/<id>/variants/<variantId>/availability` with body `{ isAvailableForBooking: false }` → HTTP 200; `variant.isAvailableForBooking = false` in DB
  - [ ] Test: after toggling variant off, `GET /api/v1/products/:productId` (buyer endpoint) → that specific variant **absent** from the `variants` array in the response
  - [ ] Test: `PUT /api/v1/store/availability` with BUYER JWT → HTTP 403 `FORBIDDEN`
  - [ ] Test: `PUT .../variants/<variantId>/availability` for a variant belonging to a different store → HTTP 403 `FORBIDDEN`
  - [ ] **Run — confirm RED (endpoints do not exist; 404).**

- [ ] **GREEN — Backend (Schema → Repository → Service → Controller):**
  - [ ] [Schema] Add `isAcceptingOrders Boolean @default(true)` to `Store` model in `schema.prisma`
  - [ ] [Schema] Add `isAvailableForBooking Boolean @default(true)` to `ProductVariant` model in `schema.prisma`
  - [ ] [Migration] Run `pnpm --filter @gorola/api prisma migrate dev --name add_availability_toggles`. Apply to test DB: `pnpm --filter @gorola/api prisma:migrate:test-db`
  - [ ] [Repository] In `store.repository.ts`, add `setAcceptingOrders(storeId: string, value: boolean): Promise<Store>` — simple `prisma.store.update`
  - [ ] [Repository] In `variant.repository.ts` (or `product.repository.ts`), add `setVariantAvailability(variantId: string, value: boolean): Promise<ProductVariant>`
  - [ ] [Repository] In `product.repository.ts`, update `listForBuyer()` to add `store: { isAcceptingOrders: true }` filter in the Prisma `where` clause
  - [ ] [Repository] In `product.repository.ts`, update `getDetailForBuyer()` to filter `variants` to only those where `isAvailableForBooking: true AND isActive: true`
  - [ ] [Service] Add `setStoreAvailability(storeId: string, value: boolean)` to `store-owner.service.ts` — calls `StoreRepository.setAcceptingOrders`
  - [ ] [Service] Add `setVariantAvailability(storeId: string, productId: string, variantId: string, value: boolean)` to `store-owner.service.ts` — validates product ownership, calls repository
  - [ ] [Controller] Add handler for `PUT /api/v1/store/availability` in `store-owner.controller.ts` — Zod body: `{ isAcceptingOrders: z.boolean() }`; calls service; returns updated store
  - [ ] [Controller] Add handler for `PUT /api/v1/store/products/:productId/variants/:variantId/availability` — Zod body: `{ isAvailableForBooking: z.boolean() }`; calls service
  - [ ] [Routes] Register both routes with `requireAuth` + `requireRole('STORE_OWNER')` in `routes.ts`
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **RED — Unit/Component (`StoreDashboardPage.test.tsx` — additional tests):**
  - [ ] Test: renders an "Availability" card with `data-testid="store-availability-toggle"` — a toggle switch showing current `isAcceptingOrders` state (ON = green, OFF = red)
  - [ ] Test: toggling the switch to OFF opens a confirmation modal with text "Hiding your store will remove all your products from the buyer app. Are you sure?"
  - [ ] Test: confirming the modal calls `PUT /api/v1/store/availability` with `{ isAcceptingOrders: false }` and shows a toast "Store is now hidden from buyers"
  - [ ] Test: while the API call is pending, the toggle is disabled (prevents double-click)
  - [ ] **Run — confirm RED (no availability card exists in dashboard yet).**

- [ ] **RED — Unit/Component (`StoreProductsPage.test.tsx` — additional tests):**
  - [ ] Test: each variant row in the product list has an "Available" toggle switch (`data-testid="variant-availability-toggle-<variantId>"`)
  - [ ] Test: toggling a variant to unavailable calls `PUT /api/v1/store/products/:id/variants/:variantId/availability` with `{ isAvailableForBooking: false }`
  - [ ] Test: an unavailable variant row shows a "Hidden from buyers" pill badge in amber/orange color
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend:**
  - [ ] [Component] In `StoreDashboardPage.tsx`, add an "Availability" card above the KPI cards: large toggle switch, store name, current status text ("Accepting orders" / "Hidden from buyers"), last-toggled timestamp
  - [ ] [Component] In `StoreProductsPage.tsx`, add an "Available" toggle per variant row. Booking-commerce stores show this prominently; quick-commerce stores show it as a smaller secondary control
  - [ ] Run all unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Store owner opens dashboard → sees green "Accepting Orders" toggle → taps it → confirmation modal → confirms → toggle turns red → buyer app immediately shows 0 products for this store → store owner taps again → toggle turns green → products reappear for buyers → ✅ Done.

---

### 3.9 — Inventory Management (Stock Movements)

**Root Cause / Goal:**
The `StockMovement` infrastructure (REFILL, ADJUSTMENT, INITIAL types) was built in Phase 2.19 (W-016, W-017). No store-owner HTTP endpoints exist to trigger restocks or manual adjustments, view stock history, or configure low-stock thresholds per variant.

**Fix / Approach:**
Create `PUT /api/v1/store/products/:id/variants/:variantId/stock` (REFILL), `PUT /api/v1/store/products/:id/variants/:variantId/stock/adjust` (ADJUSTMENT), `GET /api/v1/store/products/:id/stock-history`, and `PUT /api/v1/store/products/:id/variants/:variantId/threshold`.

---

- [ ] **RED — Integration (`store-owner.inventory.test.ts`):**
  - [ ] Test setup: product with variant, current `stockQty = 10`, `lowStockThreshold = 5`
  - [ ] Test: `PUT /api/v1/store/products/<id>/variants/<variantId>/stock` with body `{ addQty: 20, note: 'Weekly restock' }` → HTTP 200; variant `stockQty = 30`; new `StockMovement` with `type: 'REFILL'`, `before: 10`, `after: 30`, `qty: 20`
  - [ ] Test: `PUT /api/v1/store/products/<id>/variants/<variantId>/stock/adjust` with body `{ setQty: 5, reason: 'Physical count' }` → HTTP 200; `stockQty = 5`; new `StockMovement` with `type: 'ADJUSTMENT'`, `before: 10`, `after: 5`
  - [ ] Test: `PUT .../stock/adjust` with missing `reason` → HTTP 400 `VALIDATION_ERROR` (reason is required for adjustments)
  - [ ] Test: `GET /api/v1/store/products/<id>/stock-history` → returns array with `{ type, before, after, qty, createdAt, orderId?, note?, reason? }` in descending date order
  - [ ] Test: `GET .../stock-history?type=REFILL` → returns only REFILL movements
  - [ ] Test: `PUT .../stock/adjust` for another store's product → HTTP 403 `FORBIDDEN`
  - [ ] Test: restock of a variant with `isInStock = false` to `addQty = 10` → `isInStock = true` after the operation
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `restockVariant(storeId, productId, variantId, { addQty, note? })`: validates ownership; calls `ProductVariantRepository.incrementStock(variantId, addQty)` in a transaction with `StockMovementRepository.create(type: 'REFILL', ...)`
  - [ ] Add `adjustVariantStock(storeId, productId, variantId, { setQty, reason })`: validates ownership; computes delta; calls `ProductVariantRepository.setStock(variantId, setQty)` in a transaction with `StockMovementRepository.create(type: 'ADJUSTMENT', ...)`
  - [ ] Add `getStockHistory(storeId, productId, { type?, variantId? })`: validates product ownership; calls `StockMovementRepository.findByProductVariant`
  - [ ] Add `updateLowStockThreshold(storeId, productId, variantId, threshold)`: validates ownership; updates `ProductVariant.lowStockThreshold`
  - [ ] [Controller + Routes] Register all 4 endpoints with `requireAuth` + `requireRole('STORE_OWNER')`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`StoreInventoryPage.test.tsx` and inline tests in `StoreProductsPage.test.tsx`):**
  - [ ] Test (dashboard): low stock alert card lists variants with `isLowStock = true`; each row has "Restock" button
  - [ ] Test (restock modal): quantity input defaults to 1, accepts positive integers only; note field optional; submit calls `PUT .../stock`; success toast shows "Stock updated: +20 units"
  - [ ] Test (adjust modal): "Set stock to" input required; reason textarea required; submit calls `PUT .../stock/adjust`
  - [ ] Test (stock history page): table shows type column with color-coded badges (SALE=red, REFILL=green, ADJUSTMENT=yellow, CANCELLATION_RESTORE=blue)
  - [ ] Test: filter by type dropdown updates the visible rows
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:**
  - [ ] Create `StoreStockHistoryPage.tsx` → route `/store/products/:id/stock-history`
  - [ ] Add restock modal and adjust modal to `StoreProductsPage.tsx` (inline buttons per variant row)
  - [ ] Low stock alert section on `StoreDashboardPage.tsx` already defined in 3.2; wire "Restock" button to open restock modal
  - [ ] Low stock threshold field added to `StoreProductFormPage.tsx` variant rows (per variant)
  - [ ] Run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Dashboard shows low stock alert → click Restock → enter qty 20 → confirm → stock history shows REFILL +20 → `isLowStock` flag clears → alert disappears from dashboard → ✅ Done.

---

### 3.10 — Store Owner E2E Tests (Playwright)

- [ ] `tests/e2e/store-owner-journey.spec.ts`:
  - [ ] Login → 2FA → dashboard loads with correct KPI counts
  - [ ] Create product with 2 variants → appears in product list → visible in buyer catalog
  - [ ] Update order status: PLACED → PREPARING → OUT_FOR_DELIVERY → DELIVERED
  - [ ] Restock a low-stock variant → stock history shows REFILL entry → dashboard low stock alert clears
  - [ ] Create discount code `E2EDEAL` → buyer applies it in cart → discount applied correctly
  - [ ] Submit advertisement → appears as "Pending" → admin approves (via direct DB update in test) → appears on buyer home page

---
## Phase 4 — Admin Panel Checklist

---

### 4.1 — Admin Auth (Email + Mandatory TOTP 2FA)

**Root Cause / Goal:**
Admin auth services exist from Phase 1.5. HTTP routes (`POST /api/v1/auth/admin/login`, `POST /api/v1/auth/admin/setup-2fa`, `POST /api/v1/auth/admin/verify-2fa`) were wired in Session 19. Goal: verify runtime registration, build `AdminLoginPage`, `AdminTwoFactorPage`, `AdminSetup2FAPage`, `AdminLayout`, and `AdminRoute` guard. 2FA is mandatory — admins cannot skip it. Account locks after 10 failed password attempts; no self-service unlock.

**Fix / Approach:**
Same pattern as 3.1 (store auth) but stricter: `AdminRoute` checks ADMIN role AND `twoFactorVerified = true`. If admin has no TOTP set up, force through setup flow before any admin page is accessible.

---

- [ ] **RED — Integration (`admin-auth.routes.test.ts`):**
  - [ ] Test: `POST /api/v1/auth/admin/login` with correct email + password → HTTP 200 `{ requiresTwoFactor: true }`
  - [ ] Test: `POST /api/v1/auth/admin/login` with wrong password → HTTP 401 `AUTH_FAILED`
  - [ ] Test: `POST /api/v1/auth/admin/login` after 10 failed attempts → HTTP 429 `RATE_LIMITED`
  - [ ] Test: `POST /api/v1/auth/admin/verify-2fa` with valid TOTP → HTTP 200 with `accessToken` and `refreshToken`
  - [ ] Test: `POST /api/v1/auth/admin/verify-2fa` with invalid TOTP → HTTP 401 `INVALID_TOTP`
  - [ ] Test: `POST /api/v1/auth/admin/setup-2fa` authenticated as admin → HTTP 200 `{ secret, qrUri }`
  - [ ] **Run — confirm RED if any route is missing or wrong shape**

- [ ] **GREEN — Backend Verification:**
  - [ ] Confirm `registerAdminAuthRoutes(app)` is called in `routes.ts`; if missing, add it
  - [ ] Verify all 3 routes appear in dev route graph
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminLoginPage.test.tsx`):**
  - [ ] Test: renders email + password inputs with correct `id` attributes and submit button
  - [ ] Test: on success response, `navigate` called with `/admin/2fa`
  - [ ] Test: on 401, shows "Invalid credentials" error message

- [ ] **RED — Unit/Component (`AdminRoute.test.tsx`):**
  - [ ] Test: non-ADMIN role → `<Navigate to="/admin/login" />`
  - [ ] Test: ADMIN role with `twoFactorVerified = false` → `<Navigate to="/admin/2fa" />`
  - [ ] Test: ADMIN role with `twoFactorVerified = true` AND `twoFactorEnabled = false` → `<Navigate to="/admin/setup-2fa" />`
  - [ ] Test: ADMIN + `twoFactorVerified = true` + `twoFactorEnabled = true` → renders children
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:**
  - [ ] Create `AdminLoginPage.tsx`, `AdminTwoFactorPage.tsx`, `AdminSetup2FAPage.tsx`
  - [ ] Create `AdminRoute.tsx` guard with all 4 cases above
  - [ ] Create `AdminLayout.tsx`: top nav + sidebar with links to Dashboard, Orders, Users, Stores, Categories, Feature Flags, Ads, Audit Logs
  - [ ] Register all `/admin/*` routes in `App.tsx` wrapped in `<AdminRoute>` and `<AdminLayout>`
  - [ ] Run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] `/admin/dashboard` → redirect to `/admin/login` → correct credentials → `/admin/2fa` → valid TOTP → admin dashboard loads → ✅

---

### 4.2 — Admin Dashboard (All-Stores Overview)

**Root Cause / Goal:**
No admin dashboard endpoint exists. Admin needs a platform-wide view: total orders and revenue today across ALL stores, per-store breakdown, weekly revenue stacked bar chart, low stock count platform-wide, total active buyers, total products, pending ad approvals badge, and current feature flags status.

**Fix / Approach:**
Create `GET /api/v1/admin/dashboard` in a new `admin.controller.ts`. Aggregates data across all stores.

---

- [ ] **RED — Integration (`admin.dashboard.test.ts`):**
  - [ ] Test: `GET /api/v1/admin/dashboard` with ADMIN JWT → HTTP 200 with shape `{ totalOrdersToday, totalRevenueToday, perStoreBreakdown: [{ storeId, storeName, ordersToday, revenueToday, pendingOrdersCount }], weeklyRevenue: [{ date, revenue }], lowStockAlertCount, totalActiveBuyers, totalProducts, pendingAdApprovalsCount, featureFlags: [{ key, value }] }`
  - [ ] Test: `GET /api/v1/admin/dashboard` with STORE_OWNER JWT → HTTP 403 `FORBIDDEN`
  - [ ] Test: `GET /api/v1/admin/dashboard` with no JWT → HTTP 401
  - [ ] Test: `pendingAdApprovalsCount` = count of ads with `isApproved: false` and `isActive: true` across all stores
  - [ ] **Run — confirm RED (404)**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Create `apps/api/src/modules/admin/admin.service.ts` with `getDashboard()` aggregating all stores
  - [ ] [Controller] Create `apps/api/src/modules/admin/admin.controller.ts` with `GET /api/v1/admin/dashboard`
  - [ ] [Routes] Create `registerAdminRoutes(app)` in `routes.ts` with `requireAuth` + `requireRole('ADMIN')` for all admin endpoints
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminDashboardPage.test.tsx`):**
  - [ ] Test: renders KPI cards: "Total Orders Today", "Total Revenue Today", "Active Buyers", "Total Products", "Pending Approvals" badge
  - [ ] Test: per-store breakdown table with columns "Store", "Orders Today", "Revenue Today", "Pending"
  - [ ] Test: pending approvals count > 0 shows red badge on "Advertisements" sidebar link
  - [ ] Test: weather mode feature flag shows current on/off status with a quick-toggle button (confirmation modal first)
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `AdminDashboardPage.tsx`; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Admin logs in → dashboard shows real data across all stores → pending ad count badge visible → ✅

---

### 4.3 — All-Orders View

**Root Cause / Goal:**
No admin order list endpoint exists. Admin needs to see ALL orders across ALL stores with filtering (by store, status, date range, payment method), order detail modal, ability to force-update order status with audit note, and CSV export.

---

- [ ] **RED — Integration (`admin.orders.test.ts`):**
  - [ ] Test: `GET /api/v1/admin/orders` with ADMIN JWT → returns orders from ALL stores (not scoped)
  - [ ] Test: `GET /api/v1/admin/orders?storeId=<id>` → returns only orders for that store
  - [ ] Test: `GET /api/v1/admin/orders?status=PLACED` → returns only PLACED orders
  - [ ] Test: response each order has `{ id, buyerMaskedPhone, storeName, itemsCount, total, status, createdAt, paymentMethod }`
  - [ ] Test: `PUT /api/v1/admin/orders/<id>/status` with body `{ status: 'CANCELLED', auditNote: 'Fraud detected' }` → HTTP 200; order status = CANCELLED in DB; `AuditLog` created with `action: 'ADMIN_FORCE_STATUS_UPDATE'`, `entityId: orderId`, `newValue: { status: 'CANCELLED', note: 'Fraud detected' }`
  - [ ] Test: `PUT /api/v1/admin/orders/<id>/status` with missing `auditNote` → HTTP 400 `VALIDATION_ERROR`
  - [ ] Test: `GET /api/v1/admin/orders/export?format=csv` → HTTP 200 with `Content-Type: text/csv` header
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getOrders(filters)`, `forceUpdateOrderStatus(orderId, status, auditNote, adminId)` to `admin.service.ts`. Force-update must call `AuditRepository.create` in the same transaction as `OrderRepository.updateStatus`. If status = CANCELLED, trigger stock restoration via `OrderService.cancelAndRestoreStock`.
  - [ ] [Controller] Add `GET /api/v1/admin/orders` (cursor-based pagination, 50/page), `PUT /api/v1/admin/orders/:id/status`, `GET /api/v1/admin/orders/export` to `admin.controller.ts`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminOrdersPage.test.tsx`):**
  - [ ] Test: table renders with all 8 columns; clicking row opens detail modal
  - [ ] Test: filter bar: store dropdown, status dropdown, date pickers — each updates URL param and re-fetches
  - [ ] Test: force-status modal requires auditNote text before "Confirm" button is enabled
  - [ ] Test: "Export CSV" button triggers file download with correct MIME type
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `AdminOrdersPage.tsx` with filters, table, detail modal, force-status modal, CSV export; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Admin → All Orders → filter by store → click order → force cancel with audit note → stock restored → audit log records action → ✅

---

### 4.4 — User Management (Buyers)

**Root Cause / Goal:**
No admin user management endpoints exist. Admin needs to search buyers by phone (partial match, masked), view their order history and addresses, suspend/unsuspend accounts. Suspended users receive HTTP 403 on login attempt.

---

- [ ] **RED — Integration (`admin.users.test.ts`):**
  - [ ] Test: `GET /api/v1/admin/users` → returns buyers with `{ id, maskedPhone, name, orderCount, totalSpent, createdAt, isActive }`
  - [ ] Test: `GET /api/v1/admin/users?phone=9876` → returns only buyers whose phone contains "9876" (masked in response)
  - [ ] Test: `PUT /api/v1/admin/users/<userId>/suspend` → HTTP 200; `user.isActive = false`; subsequent `POST /api/v1/auth/buyer/verify-otp` for this user → HTTP 403 `ACCOUNT_SUSPENDED`
  - [ ] Test: `PUT /api/v1/admin/users/<userId>/unsuspend` → HTTP 200; `user.isActive = true`; login works again
  - [ ] Test: all suspend/unsuspend actions create `AuditLog` with `action: 'ADMIN_USER_SUSPEND'` or `'ADMIN_USER_UNSUSPEND'`
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getUsers(filters)`, `suspendUser(userId, adminId)`, `unsuspendUser(userId, adminId)` to `admin.service.ts`. Each creates an audit log entry. Ensure `AuthService.verifyOtp` checks `user.isActive` and throws `ForbiddenError` if false.
  - [ ] [Controller] Add `GET /api/v1/admin/users`, `PUT /api/v1/admin/users/:id/suspend`, `PUT /api/v1/admin/users/:id/unsuspend` with `requireAuth` + `requireRole('ADMIN')`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminUsersPage.test.tsx`):**
  - [ ] Test: table shows masked phone, name, order count, total spent, status badge (Active/Suspended)
  - [ ] Test: search by phone input debounces 300ms before re-fetching
  - [ ] Test: clicking user row opens drawer with order history list and masked address list
  - [ ] Test: "Suspend" button shows confirmation modal before calling API
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `AdminUsersPage.tsx`; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Admin searches buyer → opens drawer → clicks Suspend → confirm → buyer login returns 403 → admin unsuspends → buyer can log in again → ✅

---

### 4.5 — Store Management

**Root Cause / Goal:**
Admin needs to create new stores (with an auto-created store owner account), view all stores, see a per-store detail page, and suspend/unsuspend stores. Suspending a store hides all its products from the buyer catalog and blocks new orders.

> **Phase 7 impact:** Every store must have a `storeType` — either `QUICK_COMMERCE` (groceries, medical store, electronics) or `BOOKING_COMMERCE` (medical tests, repairs). This is set at creation time by the admin and cannot be changed later without a data migration. `storeType` controls the entire order flow for that store. The `storeType` field **must be included in the create-store form and API** even though Phase 7 is not built yet — it future-proofs the schema.

---

- [ ] **RED — Integration (`admin.stores.test.ts`):**
  - [ ] Test: `POST /api/v1/admin/stores` with body `{ storeName: 'New Store', description: '...', phone: '+919000000000', landmarkAddress: '...', storeType: 'QUICK_COMMERCE', ownerEmail: 'owner@test.com', ownerTempPassword: 'TempPass123!' }` → HTTP 201 with `{ storeId, storeType: 'QUICK_COMMERCE', ownerId }`; both `Store` and `StoreOwner` rows created in DB atomically; `store.storeType = 'QUICK_COMMERCE'` confirmed in DB
  - [ ] Test: `POST /api/v1/admin/stores` with body containing `storeType: 'BOOKING_COMMERCE'` → HTTP 201; `store.storeType = 'BOOKING_COMMERCE'` in DB
  - [ ] Test: `POST /api/v1/admin/stores` with `storeType` omitted → HTTP 400 `VALIDATION_ERROR` (storeType is required — no guessing)
  - [ ] Test: `POST /api/v1/admin/stores` with `storeType: 'INVALID_TYPE'` → HTTP 400 `VALIDATION_ERROR`
  - [ ] Test: `POST /api/v1/admin/stores` with duplicate `ownerEmail` → HTTP 409 `CONFLICT`
  - [ ] Test: `GET /api/v1/admin/stores` → returns ALL stores with `{ id, name, storeType, ownerEmail, orderCount, revenue, productCount, status }`
  - [ ] Test: `GET /api/v1/admin/stores/<storeId>` → returns store detail including `storeType` field
  - [ ] Test: `PUT /api/v1/admin/stores/<storeId>/suspend` → HTTP 200; `store.isActive = false`; `GET /api/v1/products?categoryId=<id>` (buyer endpoint) returns 0 products for this store
  - [ ] Test: `PUT /api/v1/admin/stores/<storeId>/unsuspend` → HTTP 200; `store.isActive = true`; products visible again in buyer catalog
  - [ ] Test: all store create/suspend/unsuspend actions create `AuditLog` entries
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [x] [Schema] Confirm `storeType StoreType @default(QUICK_COMMERCE)` exists on `Store` model and `enum StoreType { QUICK_COMMERCE BOOKING_COMMERCE }` exists in `schema.prisma`. **This is added in Phase 7.1.** If working on Phase 4.5 before Phase 7.1: add the enum and field now with a migration named `add_store_type`. Do not wait for Phase 7.
  - [ ] [Service] Add `createStore(dto, adminId)` to `admin.service.ts`: Zod-validated `dto` includes `storeType: z.enum(['QUICK_COMMERCE', 'BOOKING_COMMERCE'])`. Transaction creates `Store` (with `storeType`) + `StoreOwner` (with hashed temp password) + `AuditLog`. Add `getStores()`, `getStoreDetail(storeId)`, `suspendStore(storeId, adminId)`, `unsuspendStore(storeId, adminId)`.
  - [ ] [Controller] Add `POST /api/v1/admin/stores` — Zod body schema includes `storeType` as required enum field. Add `GET /api/v1/admin/stores`, `GET /api/v1/admin/stores/:id`, `PUT /api/v1/admin/stores/:id/suspend`, `PUT /api/v1/admin/stores/:id/unsuspend` with `requireAuth` + `requireRole('ADMIN')`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminStoresPage.test.tsx`):**
  - [ ] Test: table with "Store Name", "Type" (Quick / Booking badge), "Owner Email", "Orders", "Revenue", "Products", "Status" columns
  - [ ] Test: "Add Store" form has a required `storeType` radio group with two options: "Quick Commerce (groceries, medicines, electronics)" and "Booking Commerce (tests, repairs)"; submitting without selecting one shows validation error "Store type is required"
  - [ ] Test: submitting a valid form with `storeType: 'BOOKING_COMMERCE'` calls `POST /api/v1/admin/stores` with `{ storeType: 'BOOKING_COMMERCE', ... }` in the request body
  - [ ] Test: the store type badge in the table shows "Quick" in pine-green and "Booking" in amber so admins can distinguish at a glance
  - [ ] Test: clicking store row navigates to `/admin/stores/:id`
  - [ ] Test: store detail page shows `storeType` prominently so admins know which order flow applies
  - [ ] Test: suspend button shows confirmation modal before calling API; after suspend, status badge changes to "Suspended"
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `AdminStoresPage.tsx` and `AdminStoreDetailPage.tsx` — both include `storeType` field. Add `storeType` to the `AdminStore` TypeScript type. Run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Admin opens Add Store form → selects "Booking Commerce" for Medical Tests store → fills details → submits → new store appears in table with amber "Booking" type badge → new store owner logs in with temp password → store owner dashboard shows same UI as quick commerce (Phase 7 adds booking-specific panels later) → admin suspends store → buyer catalog shows 0 products from that store → admin unsuspends → products reappear → ✅

---

### 4.6 — Category Management

**Root Cause / Goal:**
No admin category management endpoints exist. Admin needs to create, edit, toggle active status, and reorder categories and sub-categories. Cannot delete a category that has products (enforced at API level).

---

- [ ] **RED — Integration (`admin.categories.test.ts`):**
  - [ ] Test: `POST /api/v1/admin/categories` with body `{ name: 'Electronics', slug: 'electronics', imageUrl: 'https://...', displayOrder: 3 }` → HTTP 201 with `{ id, name, slug, isActive: true }`
  - [ ] Test: `POST /api/v1/admin/categories` with duplicate slug → HTTP 409 `CONFLICT`
  - [ ] Test: `GET /api/v1/admin/categories` → returns ALL categories (including inactive) with product count per category
  - [ ] Test: `PUT /api/v1/admin/categories/<id>` with `{ isActive: false }` → HTTP 200; category hidden from buyer `GET /api/v1/categories` endpoint
  - [ ] Test: `DELETE /api/v1/admin/categories/<id>` where category has 1+ products → HTTP 409 `CANNOT_DELETE_CATEGORY_WITH_PRODUCTS`
  - [ ] Test: `PUT /api/v1/admin/categories/reorder` with body `[{ id: 'cat1', displayOrder: 1 }, { id: 'cat2', displayOrder: 2 }]` → HTTP 200; orders updated in DB
  - [ ] Test: same endpoints for sub-categories: `POST /api/v1/admin/categories/:slug/sub-categories`, `PUT /api/v1/admin/sub-categories/:id`, `PUT /api/v1/admin/sub-categories/reorder`
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `createCategory`, `updateCategory`, `deleteCategory` (checks for products first), `reorderCategories`, and sub-category equivalents to `admin.service.ts`
  - [ ] [Controller + Routes] Add all category and sub-category endpoints with `requireAuth` + `requireRole('ADMIN')`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminCategoriesPage.test.tsx`):**
  - [ ] Test: table with "Name", "Emoji/Image", "Slug", "Display Order", "Products Count", "Active" columns
  - [ ] Test: active/inactive toggle switch per row calls `PUT /api/v1/admin/categories/:id`
  - [ ] Test: drag-to-reorder rows (dnd-kit) updates `displayOrder` and calls `PUT .../reorder`
  - [ ] Test: "Add Category" form requires name, slug (auto-generated from name but editable), imageUrl
  - [ ] Test: attempting to delete a category with products shows error "Cannot delete: category has products"
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `AdminCategoriesPage.tsx` with dnd-kit drag-to-reorder; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Admin adds category → appears in buyer catalog → admin deactivates → hidden from buyer → reorder drag-drop → buyer catalog reflects new order → ✅

---

### 4.7 — Feature Flag Management

**Root Cause / Goal:**
No admin feature flag management endpoints exist. Admin needs to view all feature flags and toggle them. High-impact flags (`WEATHER_MODE_ACTIVE`, `RIDER_INTERFACE_ENABLED`) require a confirmation modal. Each toggle creates an audit log. Changes propagate to Redis cache within 60 seconds.

---

- [ ] **RED — Integration (`admin.feature-flags.test.ts`):**
  - [ ] Test: `GET /api/v1/admin/feature-flags` → returns ALL flags with `{ key, value, description, updatedAt }`
  - [ ] Test: `PUT /api/v1/admin/feature-flags/WEATHER_MODE_ACTIVE` with body `{ value: true }` → HTTP 200; flag updated in DB; Redis cache for `feature_flag:WEATHER_MODE_ACTIVE` invalidated (key deleted or set to new value)
  - [ ] Test: `PUT /api/v1/admin/feature-flags/WEATHER_MODE_ACTIVE` with body `{ value: true }` → `AuditLog` created with `action: 'ADMIN_FEATURE_FLAG_UPDATE'`, `entityId: 'WEATHER_MODE_ACTIVE'`, `newValue: { value: true }`
  - [ ] Test: `PUT /api/v1/admin/feature-flags/NONEXISTENT_KEY` → HTTP 404 `NOT_FOUND`
  - [ ] Test: `PUT /api/v1/admin/feature-flags/<key>` with STORE_OWNER JWT → HTTP 403 `FORBIDDEN`
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getFlags()`, `updateFlag(key, value, adminId)` to `admin.service.ts`. `updateFlag` calls `FeatureFlagRepository.update(key, value)` and `AuditRepository.create(...)` in a transaction, then invalidates Redis key `feature_flag:<key>`
  - [ ] [Controller + Routes] Add `GET /api/v1/admin/feature-flags`, `PUT /api/v1/admin/feature-flags/:key` with `requireAuth` + `requireRole('ADMIN')`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminFeatureFlagsPage.test.tsx`):**
  - [ ] Test: table lists all flags with description text and current on/off toggle switch
  - [ ] Test: toggling a non-high-impact flag directly calls `PUT` without modal
  - [ ] Test: toggling `WEATHER_MODE_ACTIVE` opens confirmation modal showing impact summary text before calling API
  - [ ] Test: after toggle success, toggle switch updates visually and toast shows "Flag updated"
  - [ ] Test: note text "Changes reflected in 60 seconds" is visible on the page
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `AdminFeatureFlagsPage.tsx`; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Admin toggles WEATHER_MODE_ACTIVE → confirmation modal → confirm → audit log created → within 60s buyer home page shifts to weather mode → ✅

---

### 4.8 — Advertisement Approval Queue

**Root Cause / Goal:**
No admin ad approval endpoints exist. Ads submitted by store owners have `isApproved: false` by default. Admin needs to review pending ads (with image preview), approve or reject (rejection requires a reason), and deactivate previously approved ads.

---

- [ ] **RED — Integration (`admin.ads.test.ts`):**
  - [ ] Test setup: create 2 pending ads from 2 different stores
  - [ ] Test: `GET /api/v1/admin/advertisements?status=PENDING` → returns both pending ads with `{ id, imageUrl, title, storeName, startsAt, endsAt, submittedAt }`
  - [ ] Test: `PUT /api/v1/admin/advertisements/<id>/approve` → HTTP 200; `ad.isApproved = true`; ad now appears in buyer `GET /api/v1/promotions/advertisements` response; `AuditLog` created
  - [ ] Test: `PUT /api/v1/admin/advertisements/<id>/reject` with body `{ reason: 'Image too small' }` → HTTP 200; `ad.isApproved = false`, `ad.isActive = false`; `AuditLog` created with rejection reason
  - [ ] Test: `PUT /api/v1/admin/advertisements/<id>/reject` with missing `reason` → HTTP 400 `VALIDATION_ERROR`
  - [ ] Test: `PUT /api/v1/admin/advertisements/<id>/deactivate` (for approved ad) → HTTP 200; ad no longer appears in buyer feed
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getAds(status?)`, `approveAd(adId, adminId)`, `rejectAd(adId, reason, adminId)`, `deactivateAd(adId, adminId)` to `admin.service.ts`. Each creates audit log.
  - [ ] [Controller + Routes] Add `GET /api/v1/admin/advertisements`, `PUT /api/v1/admin/advertisements/:id/approve`, `PUT /api/v1/admin/advertisements/:id/reject`, `PUT /api/v1/admin/advertisements/:id/deactivate` with `requireAuth` + `requireRole('ADMIN')`
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminAdvertisementsPage.test.tsx`):**
  - [ ] Test: 3 tabs: "Pending" | "Approved" | "All"
  - [ ] Test: pending tab shows ad image preview (`<img>` with correct src), title, store name, date range
  - [ ] Test: "Approve" button calls `PUT .../approve` and moves item to "Approved" tab
  - [ ] Test: "Reject" button opens modal requiring rejection reason text before enabling "Confirm Rejection"
  - [ ] Test: approved tab shows "Deactivate" button; clicking calls `PUT .../deactivate`
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `AdminAdvertisementsPage.tsx`; run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Store owner submits ad → admin opens Pending tab → image preview visible → approve → ad appears on buyer home carousel → admin deactivates → ad removed from buyer carousel → ✅

---

### 4.9 — Audit Log Viewer

**Root Cause / Goal:**
No admin audit log endpoint exists. Admin needs read-only access to all system audit logs with filtering by role, action, entity type, date range, and expandable rows showing JSON diff of old vs new values.

---

- [ ] **RED — Integration (`admin.audit-logs.test.ts`):**
  - [ ] Test: `GET /api/v1/admin/audit-logs` → returns logs with `{ id, timestamp, actorMasked, actorRole, action, entityType, entityId, ipMasked, oldValue, newValue }`
  - [ ] Test: `GET /api/v1/admin/audit-logs?action=ADMIN_USER_SUSPEND` → returns only suspension logs
  - [ ] Test: `GET /api/v1/admin/audit-logs?role=ADMIN&from=<iso>&to=<iso>` → filtered results
  - [ ] Test: `GET /api/v1/admin/audit-logs?format=csv` → HTTP 200 with `Content-Type: text/csv`
  - [ ] Test: no DELETE or PUT endpoints exist for audit logs (read-only; any attempt returns 405 `Method Not Allowed`)
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Backend:**
  - [ ] [Service] Add `getAuditLogs(filters, pagination)` to `admin.service.ts`. Calls `AuditRepository.findMany` with filters.
  - [ ] [Controller + Routes] Add `GET /api/v1/admin/audit-logs` and `GET /api/v1/admin/audit-logs/export` (CSV) with `requireAuth` + `requireRole('ADMIN')`. NO PUT or DELETE routes registered.
  - [ ] Run integration tests — **confirm GREEN**

- [ ] **RED — Unit/Component (`AdminAuditLogsPage.test.tsx`):**
  - [ ] Test: table with "Timestamp", "Actor (masked)", "Role", "Action", "Entity", "Entity ID", "IP (masked)" columns
  - [ ] Test: expanding a row shows `oldValue` and `newValue` as formatted JSON diff viewer
  - [ ] Test: no edit or delete buttons exist anywhere on this page
  - [ ] Test: "Export CSV" triggers download
  - [ ] **Run — confirm RED**

- [ ] **GREEN — Frontend:** Create `AdminAuditLogsPage.tsx` (read-only, no mutations anywhere); run unit tests — **confirm GREEN**

- [ ] **Verification chain:**
  - [ ] Admin performs any action (suspend user, approve ad, toggle flag) → audit log page shows new entry → expand row → old/new values visible as JSON diff → no edit/delete options anywhere → ✅

---

### 4.10 — Admin E2E Tests (Playwright)

- [ ] `tests/e2e/admin-journey.spec.ts`:
  - [ ] Login → mandatory 2FA → dashboard loads with platform-wide metrics
  - [ ] Toggle `WEATHER_MODE_ACTIVE` → confirmation modal → confirm → buyer home page shifts to weather mode
  - [ ] Approve a pending advertisement → ad appears on buyer home page carousel
  - [ ] Create a new store + owner → new store owner logs in with provided temp credentials
  - [ ] Suspend a buyer account → buyer login returns 403 → unsuspend → buyer login works
  - [ ] Audit log shows all above actions with correct actor, action, and entity ID

---

## Session Notes (Phase 3 & 4)

_(Append new entries here — never delete old entries.)_

### Session 1 — 2026-05-19 — Schema Prep via Phase 7.1
- **Section 4.5 Schema Confirmation:** Marked the `StoreType` database schema check as completed under Phase 4.5. The database migration `add_booking_commerce_schema` has successfully deployed `storeType StoreType @default(QUICK_COMMERCE)` and the `StoreType` enum. The developer working on Phase 4.5 can immediately proceed with service, controller, and UI creation, bypassing DB schema changes.

### Session 2 — 2026-05-19 — Completed Store Owner Login & 2FA Flow
- **Completed Phase 3.1:** Built the entire frontend workflow for Store Owner Login, Two-Factor Authentication, and Security Setup.
- Created `StoreLoginPage`, `StoreTwoFactorPage`, `StoreSetup2FAPage` and the `StoreLayout` sidebar layout wrapper.
- Implemented and reinforced the `StoreRoute` guard in `guards.tsx` to handle authentication, authorization, and mandatory multi-factor verification checks dynamically.
- Registered all `/store/*` routing trees in `App.tsx` and validated all front-end/back-end changes with fully green test runs.

### Session 3 — 2026-05-19 — Completed Store Owner Dashboard
- **Completed Phase 3.2**: Built and fully wired the complete Store Owner Dashboard performance KPI page.
- Implemented the backend service, controller, routes, and integration tests under `store-owner.dashboard.test.ts`.
- Developed `StoreDashboardPage.tsx` under React featuring loading skeleton states (`kpi-skeleton-orders`, `kpi-skeleton-revenue`, `chart-skeleton`), Top Products ranks, and low stock alert triggers.
- Integrated a custom dynamic SVG weekly trend bar chart that highlights today's revenue, featuring clear tooltip information to avoid duplicate test elements.
- Wired `/store/dashboard` correctly under the router while maintaining `/store` as the fallback placeholder path, and verified 100% green tests, lint rules, and production bundle compilation.

### Session 4 — 2026-05-20 — Real-Time WebSocket Store Notifications & Order Sync
- **Wired Store Owner Room Subscriptions**: Integrated a `"join_store"` room subscriber hook in `socket.ts` allowing store owners to register for updates on their specific `storeId` room.
- **Implemented Instant Real-Time Order Placement Broadcaster**: Embedded a broadcast emitter in `order.controller.ts` triggering a `"store:new_order"` event immediately to the respective store's channel when any buyer places an order.
- **Implemented Interactive Order Status Update Broadcaster**: Wired the shared `orderEmitter` inside `routes.ts` to trigger a `"store:order_updated"` notification to the merchant's room when any order progresses along the state machine.
- **Developed Store-Side WebSocket Listener & Sound Alert System**: Custom-integrated a reactive Socket.io listener inside `StoreOrdersPage.tsx` that triggers auto-refreshes for TanStack Query keys, launches alerts, and plays an interactive audio attention chime upon receiving a brand new order.
- Verified 100% type safety and successful TypeScript compilation for the entire workspace repository.

### Session 5 — 2026-05-20 — Cookie Isolation, Dynamic CORS & Buyer History Live Updates
- **Isolated Portal Cookie Spaces**: Separated store owner and buyer cookies into distinct namespaces (`"storeOwnerRefreshToken"` vs `"refreshToken"`), resolving concurrent session overwrite bugs and preventing unexpected logouts on reload.
- **Dynamic CORS & Socket.IO Mirroring**: Configured both HTTP Fastify and Socket.IO servers to dynamically mirror origins in development mode. This robustly resolves cross-origin request blocks when Vite shifts ports or local addresses switch between `127.0.0.1` and `localhost`.
- **Wired Real-Time Buyer Order History Sync**: Built Socket.IO active-order room subscriptions inside `OrderHistoryPage.tsx`. Buyer orders automatically join their respective socket rooms, receiving immediate `"order_status_changed"` updates from the merchant with elegant Sonner notifications and zero-latency UI status updates.
- **Crafted Premium Manual Refresh Mechanisms**: Upgraded manual refresh triggers on both client and merchant panels to include `animate-spin` micro-animations, button disabled states during execution, and multi-stage Sonner status toasts (Syncing -> Sync Complete!), creating an extremely satisfying and premium feel.


