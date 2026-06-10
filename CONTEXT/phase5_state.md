# GoRola — Phase 5 State (Rider Interface)

> **This file covers Phase 5: the Rider Interface.**
> Phase 5 can start independently of Phase 3 and 4 — it only requires Phase 2 backend infrastructure.
> The 4 HTTP stubs (W-015) and the `/rider` Socket.IO namespace stub are already registered.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name              | Status      | Notes |
| ------- | ----------------- | ----------- | ----- |
| Phase 5 | Rider Interface   | IN PROGRESS | Phase 5.1 to 5.5 are complete. Field technician mode, earnings page, and E2E journeys remaining. |

---

## 📍 Last Updated

- **Date:** 2026-06-11
- **Session Summary:** Completed Phase 5.5 — Rider Frontend (Mobile-First UI). Added a sticky top header bar with the official logo/brand style matching Store/Admin layouts (`Logo` + `GoRola Rider`). Ensured all mobile interactive elements conform to the $\ge$ 44px height tap target guidelines. Verified all unit/integration tests, eslint lints, and tsc typecheck quality gates are 100% green.
- **Next Session Must Start With:** Phase 5.5.1 — Implement Store status confirmation dialogs, Rider compact order lists (click to open detail modals), and top status filtering tab menus (Ready for Pickup | Out for Delivery).
- **In Progress Right Now:** None.
- **Current Blocker:** None.

> ⚠️ **Update THIS block at the end of every session** (not `current_state.md`). Also mark completed checklist items `[x]` and append to the Session Notes section at the bottom. Update `current_state.md` ONLY when Phase 5 changes status (NOT STARTED → IN PROGRESS → COMPLETE).


## ⚠️ Booking Commerce Awareness (READ BEFORE STARTING PHASE 5)

Phase 7 introduces `BOOKING_COMMERCE` stores (Medical Tests, Repairs). For these stores, a **field technician** visits the buyer's home at a scheduled timeslot — they do NOT carry goods from a store. The rider app becomes a **dual-mode app**:

| Mode | Triggered by | What they do |
|---|---|---|
| **Delivery mode** | Order has `orderType: QUICK` | Rider picks up goods from store, delivers to buyer |
| **Field visit mode** | Order has `orderType: BOOKING` | Technician goes directly to buyer's address at scheduled time; no pickup from store |

**Implementation approach (Recommended — simpler):**
- One app (`apps/web/src/pages/rider/`), one JWT role (`RIDER`), one login page.
- `DeliveryRider` model already exists. Add `riderType: RiderType` enum (`DELIVERY | FIELD_TECHNICIAN`).
- The `RiderOrdersPage` detects `order.orderType` and renders different UI: delivery orders show pickup address + drop address; booking orders show only the buyer's address and the scheduled timeslot.
- **Section 5.1–5.6** build the core delivery rider app as planned. **Section 5.7** (new) adds the field technician mode on top.
- **Do not build a separate app.** The cost is not worth it for v1.

---

## ⚠️ Subdomain Routing Awareness (READ BEFORE STARTING PHASE 5 — DECISION-038)

Phase 6.2 introduced `getScopedPath()` in `apps/web/src/lib/subdomain-resolver.ts`. All `navigate()` calls inside rider pages and the `RiderRoute` guard **must** use `getScopedPath()` instead of hardcoded `/rider/...` strings, so that navigation works correctly under `rider.gorola.com` (subdomain mode) as well as `/rider/...` fallback mode.

**Pattern to follow in every rider page and RiderRoute:**
```typescript
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";
const { isSubdomainMode } = resolveSubdomain(window.location.hostname);
navigate(getScopedPath("/rider/orders", "rider", isSubdomainMode));
```

**Note:** Phase 6.3 must be complete (resolver updated to recognise `'rider'` subdomain) before `getScopedPath` works correctly for rider paths. If Phase 6.3 is not yet done, complete it first before starting Phase 5 frontend work.

---

## Architecture

- Rider frontend lives in **`apps/web/src/pages/rider/`** — same single Vite SPA, same Vercel deployment.
- Access gated by **`RiderRoute`** component (requires `RIDER` role in JWT) — matching store/admin pattern.
- Backend controllers in **`apps/api/src/modules/delivery/`** (replace the 501 stub implementations).
- Real-time location tracking via **Socket.IO `/rider` namespace** (currently stubs disconnecting).
- Rider accounts are created by the Admin panel (Phase 4 can add rider creation, or seed via script in Phase 5).

---

## Mandatory API Contract Gate (all Phase 5 items)

- [ ] Required backend endpoint(s) fully implemented (not 501)
- [ ] Backend integration tests verify: endpoint contract, HTTP status codes, auth/role guards, real-time behavior
- [ ] Endpoint routes registered and returning correct responses (not `NOT_IMPLEMENTED`)
- [ ] Frontend/client tests verify: expected API/socket envelope, loading state, empty state, error state

---

## Phase 5 Checklist

---

### 5.1 — Rider Auth

**Root Cause / Goal:**
`POST /api/v1/rider/auth/login` currently returns 501. Rider accounts need to be created (by admin or seed) and riders need to authenticate with email + password (no OTP, no 2FA required — riders need fast login on mobile). Authentication returns a JWT with `role: 'RIDER'` and a `storeId` scoping the rider to one store.

**Fix / Approach:**
1. [Schema] Add `DeliveryRider` model fields if not complete: `id`, `email`, `passwordHash`, `storeId` (FK), `isActive`, `createdAt`. Run migration.
2. [Backend] Replace the 501 stub with real implementation: `RiderAuthService.login(email, password)` → validates credentials → returns `{ accessToken, refreshToken }`.
3. [Frontend] Create `RiderLoginPage.tsx` → `/rider/login`. Create `RiderRoute` guard.

---

- [x] **RED — Integration (`rider.auth.test.ts`):**
  - [x] Test setup: seed 1 `DeliveryRider` row with email `rider@test.com`, hashed password, `storeId`
  - [x] Test: `POST /api/v1/rider/auth/login` with `{ email: 'rider@test.com', password: 'correct' }` → HTTP 200 (not 501) with `{ success: true, data: { accessToken, refreshToken } }`; JWT payload contains `{ role: 'RIDER', riderId, storeId }`
  - [x] Test: `POST /api/v1/rider/auth/login` with wrong password → HTTP 401 `AUTH_FAILED`
  - [x] Test: `POST /api/v1/rider/auth/login` for inactive rider (`isActive: false`) → HTTP 403 `ACCOUNT_SUSPENDED`
  - [x] **Run — confirm RED (currently returns 501)**

- [x] **GREEN — Backend:**
  - [x] [Schema] Verify `DeliveryRider` model in `schema.prisma` has all required fields; run migration if needed
  - [x] [Service] Create `RiderAuthService.login(email, password)` in `delivery/rider-auth.service.ts`: find rider by email, compare password hash (`bcryptjs`), check `isActive`, issue JWT with `role: 'RIDER'`
  - [x] [Controller] Replace stub in `delivery/rider.controller.ts`: `POST /api/v1/rider/auth/login` calls `RiderAuthService.login`
  - [x] [Routes] Update `registerRiderRoutes` in `routes.ts` — remove the 501 stub handler, wire real controller
  - [x] Run integration tests — **confirm GREEN**

- [x] **RED — Unit/Component (`RiderLoginPage.test.tsx`):**
  - [x] Test: renders email + password inputs with `id="rider-email"` and `id="rider-password"`
  - [x] Test: on success, `setRiderSession` called with `{ accessToken, refreshToken, riderId, storeId }` and `navigate` goes to `/rider/orders`
  - [x] Test: on 401, shows "Invalid credentials" error

- [x] **RED — Unit/Component (`RiderRoute.test.tsx`):**
  - [x] Test: no RIDER role → `<Navigate to="/rider/login" />`
  - [x] Test: RIDER role → children rendered

- [x] **GREEN — Frontend:**
  - [x] Create `apps/web/src/pages/rider/RiderLoginPage.tsx`
  - [x] Create `apps/web/src/components/rider/RiderRoute.tsx`
  - [x] Add `/rider/login` and `/rider/*` routes in `App.tsx`
  - [x] [Routing] All `navigate()` calls use `getScopedPath()` from `@/lib/subdomain-resolver` (see DECISION-038). No hardcoded `/rider/...` strings.
  - [x] Run unit tests — **confirm GREEN**

- [x] **Verification chain:**
  - [x] Seeded rider navigates to `/rider/login` → enters credentials → JWT issued with RIDER role → redirected to `/rider/orders` → ✅

---

### 5.2 — Active Orders Feed

**Root Cause / Goal:**
`GET /api/v1/rider/orders/active` currently returns 501. Riders need to see all orders assigned to their store that are in state `OUT_FOR_DELIVERY` (assigned to this rider) or `PREPARING` (ready for pickup from store).

**Fix / Approach:**
Replace the 501 stub. Return orders filtered by `storeId` from JWT and status in `['PREPARING', 'OUT_FOR_DELIVERY']`.

---

- [x] **RED — Integration (`rider.orders.test.ts`):**
  - [x] Test setup: store with 3 orders: 1 PLACED, 1 PREPARING, 1 OUT_FOR_DELIVERY
  - [x] Test: `GET /api/v1/rider/orders/active` with RIDER JWT (`storeId` = that store) → HTTP 200 (not 501); returns 2 orders (PREPARING + OUT_FOR_DELIVERY); PLACED order absent
  - [x] Test: response each order has `{ id, status, items: [{ productName, variantLabel, quantity }], deliveryAddress: { landmark }, buyerMaskedPhone, createdAt }`
  - [x] Test: `GET /api/v1/rider/orders/active` with BUYER JWT → HTTP 403
  - [x] Test: `GET /api/v1/rider/orders/active` with RIDER JWT from a different store → returns 0 orders (strict store scope)
  - [x] **Run — confirm RED (501)**

- [x] **GREEN — Backend:**
  - [x] [Service] Create `RiderOrderService.getActiveOrders(storeId)` in `delivery/rider-order.service.ts`: calls `OrderRepository.findManyByStore(storeId, { status: ['PREPARING', 'OUT_FOR_DELIVERY'] })`
  - [x] [Controller] Replace stub: `GET /api/v1/rider/orders/active` with `requireAuth` + `requireRole('RIDER')`; extracts `storeId` from JWT; calls service
  - [x] Run integration tests — **confirm GREEN**

- [x] **RED — Unit/Component (`RiderOrdersPage.test.tsx`):**
  - [x] Test: renders list of active orders grouped by status (PREPARING section, OUT_FOR_DELIVERY section)
  - [x] Test: each order card shows buyer masked phone, delivery landmark, items list, time elapsed since PLACED
  - [x] Test: empty state shows "No active orders right now" when list is empty
  - [x] Test: page auto-refreshes every 30 seconds (`refetchInterval: 30000`)
  - [x] **Run — confirm RED**

- [x] **GREEN — Frontend:**
  - [x] Create `apps/web/src/pages/rider/RiderOrdersPage.tsx`
  - [x] [Routing] All `navigate()` calls use `getScopedPath()` from `@/lib/subdomain-resolver` (see DECISION-038). No hardcoded `/rider/...` strings.
  - [x] Run unit tests — **confirm GREEN**

- [x] **Verification chain:**
  - [x] Rider logs in → `/rider/orders` shows PREPARING orders ready for pickup → ✅

---

### 5.3 — Order Status Update

**Root Cause / Goal:**
`PUT /api/v1/rider/orders/:id/status` currently returns 501. Riders need to update order status with restricted transitions: PREPARING→OUT_FOR_DELIVERY, OUT_FOR_DELIVERY→DELIVERED. Riders cannot cancel orders.

---

- [x] **RED — Integration (`rider.status.test.ts`):**
  - [x] Test: `PUT /api/v1/rider/orders/<orderId>/status` with body `{ status: 'OUT_FOR_DELIVERY' }` (order currently PREPARING) → HTTP 200; DB status = OUT_FOR_DELIVERY; `OrderStatusHistory` has new entry; buyer's Socket.IO `order:{orderId}` room receives `order_status_changed` event
  - [x] Test: `PUT .../status` with body `{ status: 'DELIVERED' }` (currently OUT_FOR_DELIVERY) → HTTP 200; DB status = DELIVERED
  - [x] Test: `PUT .../status` with body `{ status: 'PLACED' }` → HTTP 422 `INVALID_STATUS_TRANSITION` (backward transition forbidden)
  - [x] Test: `PUT .../status` with body `{ status: 'CANCELLED' }` → HTTP 403 `FORBIDDEN` (riders cannot cancel)
  - [x] Test: updating an order from a different store → HTTP 403 `FORBIDDEN`
  - [x] **Run — confirm RED (501)**

- [x] **GREEN — Backend:**
  - [x] [Service] Add `updateOrderStatus(storeId, orderId, newStatus)` to `rider-order.service.ts`: validates order belongs to `storeId`; validates transition (only PREPARING→OUT_FOR_DELIVERY or OUT_FOR_DELIVERY→DELIVERED allowed); calls `OrderRepository.updateStatus`; emits `order_status_changed` to `order:{orderId}` Socket.IO room
  - [x] [Controller] Replace stub: `PUT /api/v1/rider/orders/:id/status` with `requireAuth` + `requireRole('RIDER')`
  - [x] Run integration tests — **confirm GREEN**

- [x] **RED — Unit/Component (`RiderOrdersPage.test.tsx` — additional tests):**
  - [x] Test: PREPARING order card shows "Mark as Out for Delivery" button; clicking opens confirmation modal
  - [x] Test: OUT_FOR_DELIVERY card shows "Mark as Delivered" button
  - [x] Test: after status update, card moves to correct section or disappears from active list
  - [x] **Run — confirm RED**

- [x] **GREEN — Frontend:** Update `RiderOrdersPage.tsx` with status action buttons; run unit tests — **confirm GREEN**

- [x] **Verification chain:**
  - [x] Rider clicks "Mark as Out for Delivery" → confirm → order moves to delivery section → buyer `/orders/:id` page updates status in real-time via Socket.IO → ✅

---

### 5.4 — Real-Time Location Tracking

**Root Cause / Goal:**
`PUT /api/v1/rider/location` currently returns 501. The `/rider` Socket.IO namespace stubs disconnect on connect. Riders need to push GPS coordinates periodically; buyers tracking their order see the rider's location update in real-time.

**Fix / Approach:**
Replace HTTP stub with real implementation. Activate the `/rider` Socket.IO namespace to accept connections, authenticate via JWT, and broadcast location to the buyer's `order:{orderId}` room.

---

- [x] **RED — Integration (`rider.location.test.ts`):**
  - [x] Test: `PUT /api/v1/rider/location` with body `{ lat: 30.4593, lng: 78.0677, orderId: '<id>' }` with RIDER JWT → HTTP 200 (not 501); `RiderLocation` row upserted in DB with `{ riderId, lat, lng, updatedAt }`
  - [x] Test: `PUT /api/v1/rider/location` with invalid lat (> 90) → HTTP 400 `VALIDATION_ERROR`
  - [x] Test: Socket.IO `/rider` namespace: connect with valid RIDER JWT → connection accepted (no immediate disconnect)
  - [x] Test: after `PUT /api/v1/rider/location`, Socket.IO room `order:<orderId>` receives event `rider_location_update` with payload `{ lat, lng, updatedAt }`
  - [x] **Run — confirm RED (501 + Socket.IO disconnect)**

- [x] **GREEN — Backend:**
  - [x] [Schema] Verify `RiderLocation` model: `{ riderId (unique FK), lat Decimal, lng Decimal, updatedAt }`; run migration if needed
  - [x] [Service] Create `RiderLocationService.updateLocation(riderId, { lat, lng, orderId })`: upserts `RiderLocation`; emits `rider_location_update` to `order:{orderId}` Socket.IO room via `io.to(room).emit(...)`
  - [x] [Controller] Replace 501 stub: `PUT /api/v1/rider/location` with `requireAuth` + `requireRole('RIDER')`
  - [x] [Socket.IO] Update `/rider` namespace in `socket.ts`: authenticate connection via JWT cookie/header; on `rider_location` event from client, call `RiderLocationService.updateLocation`; on disconnect, log rider offline
  - [x] Run integration tests — **confirm GREEN**

- [x] **RED — Unit/Component (new `useRiderLocation.test.ts` hook):**
  - [x] Test: hook calls `navigator.geolocation.watchPosition` on mount and stops watching on unmount
  - [x] Test: on each position update, calls `PUT /api/v1/rider/location` with `{ lat, lng, orderId }`
  - [x] Test: if geolocation is denied, hook sets `error: 'LOCATION_DENIED'` state
  - [x] **Run — confirm RED**

- [x] **GREEN — Frontend:**
  - [x] Create `apps/web/src/hooks/useRiderLocation.ts`: wraps `navigator.geolocation.watchPosition`, calls PUT on each update, cleans up on unmount
  - [x] Use hook in `RiderOrdersPage.tsx` — active only when rider has an OUT_FOR_DELIVERY order
  - [x] Run unit tests — **confirm GREEN**

- [x] **Verification chain:**
  - [x] Rider marks order OUT_FOR_DELIVERY → browser requests location permission → rider moves → buyer `/orders/:id` page receives `rider_location_update` → map/placeholder updates → ✅

---

### 5.4.1 — Modular Geolocation Map Fix

**Root cause / Goal:**
The buyer's order confirmation page map is currently hardcoded to Mussoorie Town Center (`buyerHomeCoords = { lat: 30.4598, lng: 78.0664 }`) because the `Order` table doesn't persist the coordinates of the delivery address. Additionally, riders have no visual map to see where the delivery destination is. We need a modular solution where we capture the checkout address coordinates and display a Leaflet map with store, buyer, and active rider location markers, keeping it ready for future Google/Ola Maps Directions integrations.

**Fix / Approach:**
1. **Schema:** Add `deliveryLat` and `deliveryLng` Decimal fields to the `Order` model in Prisma.
2. **Backend Services:**
   - Update `BuyerCheckoutService` to copy `lat`/`lng` from the selected `Address` into `Order.deliveryLat`/`Order.deliveryLng` at checkout.
3. **Frontend Components:**
   - Create a reusable, modular `<OrderRouteMap />` component in `apps/web/src/components/shared/OrderRouteMap.tsx` that displays location markers.
   - Update `OrderConfirmationPage.tsx` to use `<OrderRouteMap />`, displaying the real destination coordinate markers.
   - Update `RiderOrdersPage.tsx` to show the `<OrderRouteMap />` inside an expandable details panel or modal on each order card.

---

- [x] **RED — Integration (`routing.test.ts`):**
  - [x] Test setup: Seed an address with lat/lng. Execute checkout to create an order, verify the returned order contains the exact `deliveryLat` and `deliveryLng` matching the address.
  - [x] Run integration test — **confirm GREEN**.

- [x] **GREEN — Backend (Schema → Repository → Service):**
  - [x] [Schema] Add `deliveryLat Decimal? @db.Decimal(10, 7)` and `deliveryLng Decimal? @db.Decimal(10, 7)` to `Order` model in `schema.prisma`. Run migrations and apply to test DB.
  - [x] [Repository] Update `OrderRepository.create` in `order.repository.ts` to persist `deliveryLat` and `deliveryLng`.
  - [x] [Service] Update `BuyerCheckoutService` to extract `lat`/`lng` from the database address or checkout request and pass them to order creation.
  - [x] Run integration test — **confirm GREEN**.

- [x] **RED — Unit / Component (`OrderRouteMap.test.tsx`):**
  - [x] Test: renders Leaflet map container and places markers (Store, Rider, Destination) using coordinates passed via props.
  - [x] Run unit test — **confirm GREEN**.

- [x] **GREEN — Frontend (Types → Component):**
  - [x] [Types] Update `BuyerOrderDetail` and `RiderOrder` types to include `deliveryLat` and `deliveryLng`.
  - [x] [Component] Implement `<OrderRouteMap />` in `apps/web/src/components/shared/OrderRouteMap.tsx`.
  - [x] [Component] Integrate `<OrderRouteMap />` into `OrderConfirmationPage.tsx`, replacing the hardcoded coordinate logic.
  - [x] [Component] Integrate `<OrderRouteMap />` into `RiderOrdersPage.tsx` as a collapsible drawer/panel on the active order card.
  - [x] Run unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] User selects delivery location outside Mussoorie ➔ Places order ➔ Buyer confirmation page displays the map centered on their actual address, with store and buyer markers.
  - [x] Rider logs in ➔ Opens active order card details ➔ Sees a map displaying their live location marker and the delivery address marker.

---

### 5.5 — Rider Frontend (Mobile-First UI)

**Root Cause / Goal:**
Rider interface needs to be mobile-first (riders use smartphones). The layout must be simple, large-tap-target, and work well on iPhone SE (375px). No complex tables or sidebars — a bottom navigation tab bar instead.

---

- [x] **RED — Unit/Component (`RiderLayout.test.tsx`):**
  - [x] Test: renders bottom tab bar with "Orders" and "Account" tabs
  - [x] Test: "Orders" tab is active on `/rider/orders`; "Account" tab active on `/rider/account`
  - [x] Test: on mobile viewport (375px), all tap targets are >= 44px height
  - [x] **Run — confirm RED**

- [x] **GREEN — Frontend:**
  - [x] Create `apps/web/src/components/rider/RiderLayout.tsx`: bottom tab bar (Orders | Account); no sidebar
  - [x] Create `apps/web/src/pages/rider/RiderAccountPage.tsx` → `/rider/account`: shows rider name, store name, logout button
  - [x] All rider pages use `min-h-screen` mobile layout, large font sizes (`text-xl`+), large buttons (`py-4`)
  - [x] [Routing] All `navigate()` calls use `getScopedPath()` from `@/lib/subdomain-resolver` (see DECISION-038). No hardcoded `/rider/...` strings.
  - [x] Run unit tests — **confirm GREEN**

- [x] **Verification chain:**
  - [x] Open rider app on 375px viewport → bottom tab bar visible → all buttons easily tappable → ✅

### 5.5.1 — Rider Active Orders Layout Refactoring & Store Status Confirmations

**Root cause / Goal:**
Riders need a space-efficient mobile view to scan orders on smartphones (like iPhone SE). Rendering full cards with maps, items, contacts, and status buttons directly on the scrollable feed takes too much space. We want a compact list layout showing only items and address landmark. Tapping an order will open a details modal (similar to the store panel) displaying the full card details and tracking. Additionally, riders need top-level navigation filter tabs to easily switch between "Ready for Pickup" and "Out for Delivery" queues.
Furthermore, store owners can accidentally update status buttons in the dashboard. To prevent accidental pocket or desktop misclicks, we must require confirmation dialogs for Store status transitions, matching the Rider flow.

**Fix / Approach:**
1. [Store Panel] In `StoreOrdersPage.tsx`, wrap status mutations in a confirmation dialog/modal.
2. [Rider Feed] In `RiderOrdersPage.tsx`, replace the stacked layout with a top status filtering tab bar (Ready for Pickup | Out for Delivery).
3. [Rider Cards] Refactor order cards in `RiderOrdersPage.tsx` to render compact cards (displaying only the items list and landmark address description).
4. [Rider Modals] Implement a detail overlay modal in `RiderOrdersPage.tsx` that opens upon clicking any compact order card, presenting the full tracking map, actions, and contact info.

---

- [ ] **RED — Integration & Backend (N/A):**
  - *N/A: No database schema, repository, or service logic changes are required. The REST endpoints and socket payloads remain exactly the same.*

- [ ] **RED — Unit / Component Tests (`StoreOrdersPage.test.tsx` & `RiderOrdersPage.test.tsx`):**
  - [ ] Test (`StoreOrdersPage.test.tsx`): Click a status button (e.g. "Mark Preparing"), assert that the PUT status endpoint is NOT immediately called, and verify that the confirmation dialog appears in the DOM.
  - [ ] Test (`StoreOrdersPage.test.tsx`): Assert that clicking "Confirm" inside the modal triggers the API PUT endpoint.
  - [ ] Test (`RiderOrdersPage.test.tsx`): Verify that the active orders page displays top-level filter tabs ("Ready for Pickup" and "Out for Delivery") instead of grouped vertical sections.
  - [ ] Test (`RiderOrdersPage.test.tsx`): Assert that the active order list renders compact card containers containing items and address landmark, but NOT displaying the full map, contact phone, or action buttons.
  - [ ] Test (`RiderOrdersPage.test.tsx`): Assert that clicking a compact card opens a detailed overlay modal displaying the full card components (including map and action button).
  - [ ] **Run — confirm RED (the tests fail because the confirmation modals, filter tabs, and compact lists do not exist yet).**

- [ ] **GREEN — Frontend (Types → Component):**
  - [ ] [Store Component] In `StoreOrdersPage.tsx`, add a `confirmingOrderUpdate` state. Wrap the mutation execution in a Radix-based `Dialog` confirmation modal.
  - [ ] [Rider Component] In `RiderOrdersPage.tsx`, add `selectedFilterTab` state (`"PICKUP" | "DELIVERY"`). Render status filtering tabs at the top of the content pane.
  - [ ] [Rider Component] Refactor the card renderer in `RiderOrdersPage.tsx` to display a compact list item showing only `items` and `deliveryAddress.landmark`.
  - [ ] [Rider Component] Implement a modal details overlay that opens on selection, rendering the full active order information (masked phone, collapsible map, status transition actions, close button).
  - [ ] Run unit tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Store Owner clicks "Mark Preparing" on an order ➔ Confirmation modal pops up ➔ Click "Confirm" ➔ Order moves to preparing status.
  - [ ] Rider logs in ➔ Sees top filter tabs "Ready for Pickup" and "Out for Delivery" ➔ Feed shows a clean compact list of items + address ➔ Taps an order card ➔ Full card details pop up in a modal ➔ Rider updates status or views location map ➔ ✅ Done.

### 5.6 — Dual-Mode: Field Technician (BOOKING_COMMERCE Orders)

> ⚠️ **Prerequisite: Phase 7.1 (Schema Migration) must be complete before starting 5.6.**
> The `BookingOrder` table, `OrderType` enum, and `riderType` field on `DeliveryRider` must exist in the DB.

**Root Cause / Goal:**
When Phase 7 goes live, booking orders (`orderType: BOOKING`) will be assigned to `FIELD_TECHNICIAN` type riders. These riders do not pick up from a store — they go directly to the buyer's home at a scheduled timeslot. The current `RiderOrdersPage` only handles delivery orders. It must detect `order.orderType` and render the correct UI for each.

**Fix / Approach:**
1. [Schema] `DeliveryRider` already has `storeId`. Add `riderType RiderType @default(DELIVERY)` where `RiderType` is a new enum `{ DELIVERY, FIELD_TECHNICIAN }`. Migration in Phase 7.1.
2. [Backend] Update `GET /api/v1/rider/orders/active` to also return `APPROVED` booking orders (not just `PREPARING`/`OUT_FOR_DELIVERY`) when rider is a `FIELD_TECHNICIAN`.
3. [Backend] Booking order status transitions for field technicians: `APPROVED → OUT_FOR_DELIVERY` (technician departed) → `DELIVERED` (visit complete). Same `PUT /api/v1/rider/orders/:id/status` endpoint; just different valid transitions.
4. [Frontend] In `RiderOrdersPage`, check `order.orderType`. If `BOOKING`, render field-visit card; if `QUICK`, render delivery card.

---

- [ ] **RED — Integration (`rider.field-technician.test.ts` — new file):**
  - [ ] Test setup: `FIELD_TECHNICIAN` type rider seeded. A `BookingOrder` with `approvalStatus: APPROVED`, `scheduledDate: tomorrow`, `timeslot: '09:00-11:00'` attached to an `Order` with `orderType: BOOKING` and `status: APPROVED`
  - [ ] Test: `GET /api/v1/rider/orders/active` with `FIELD_TECHNICIAN` JWT → HTTP 200; response includes the APPROVED booking order with fields `{ id, orderType: 'BOOKING', bookingOrder: { scheduledDate, timeslot, requiresFasting }, deliveryAddress: { landmark, lat, lng } }`
  - [ ] Test: `GET /api/v1/rider/orders/active` with a `DELIVERY` type rider JWT → booking orders are **absent** (delivery riders only see QUICK orders)
  - [ ] Test: `PUT /api/v1/rider/orders/<bookingOrderId>/status` with body `{ status: 'OUT_FOR_DELIVERY' }` (technician departed) → HTTP 200; `Order.status = OUT_FOR_DELIVERY` in DB; buyer receives `order_status_changed` Socket.IO event
  - [ ] Test: `PUT /api/v1/rider/orders/<bookingOrderId>/status` with body `{ status: 'DELIVERED' }` (visit complete) → HTTP 200; `Order.status = DELIVERED`; `BookingOrder.approvalStatus = COMPLETED` in DB
  - [ ] Test: `PUT /api/v1/rider/orders/<bookingOrderId>/status` with body `{ status: 'CANCELLED' }` → HTTP 403 `FORBIDDEN` (technicians cannot cancel)
  - [ ] **Run — confirm RED (endpoint returns 404 or ignores booking orders).**

- [ ] **GREEN — Backend (Schema → Service → Controller):**
  - [ ] [Schema] Confirm `riderType RiderType @default(DELIVERY)` exists on `DeliveryRider` (added in Phase 7.1 migration). If Phase 7.1 is not yet done, **stop here and complete 7.1 first**.
  - [ ] [Service] Update `RiderOrderService.getActiveOrders(storeId, riderId)` in `rider-order.service.ts`:
    - Fetch the rider row to get `riderType`
    - If `DELIVERY`: filter `Order` where `orderType = QUICK` AND `status IN [PREPARING, OUT_FOR_DELIVERY]` — unchanged behaviour
    - If `FIELD_TECHNICIAN`: filter `Order` where `orderType = BOOKING` AND `status IN [APPROVED, OUT_FOR_DELIVERY]`; include `bookingOrder { scheduledDate, timeslot, requiresFasting }` in the response
  - [ ] [Service] Update `RiderOrderService.updateOrderStatus` to allow `APPROVED → OUT_FOR_DELIVERY → DELIVERED` transitions for booking orders (in addition to existing PREPARING → OUT_FOR_DELIVERY → DELIVERED for quick orders). When a booking order reaches `DELIVERED`, also update `BookingOrder.approvalStatus = COMPLETED` in the same DB transaction.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **RED — Unit/Component (`RiderOrdersPage.test.tsx` — additional tests for booking cards):**
  - [ ] Test: when `order.orderType === 'BOOKING'`, the order card renders `data-testid="booking-order-card"` (not `data-testid="delivery-order-card"`)
  - [ ] Test: booking card shows `scheduledDate` formatted as `"Mon, 19 May"`, `timeslot` as `"09:00 – 11:00"`, and a fasting banner `"⚠️ Patient must be fasting"` when `requiresFasting: true`
  - [ ] Test: booking card shows only the buyer's delivery address (no "Pick up from store" section)
  - [ ] Test: booking card in `APPROVED` status shows "Mark as Departed" button (not "Mark as Out for Delivery")
  - [ ] Test: clicking "Mark as Departed" calls `PUT /api/v1/rider/orders/:id/status` with `{ status: 'OUT_FOR_DELIVERY' }`
  - [ ] Test: booking card in `OUT_FOR_DELIVERY` status shows "Mark Visit Complete" button
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend:**
  - [ ] [Types] Add `orderType: 'QUICK' | 'BOOKING'` and `bookingOrder?: { scheduledDate: string; timeslot: string; requiresFasting: boolean }` to the `RiderOrder` type in `RiderOrdersPage.tsx`
  - [ ] [Component] In `RiderOrdersPage.tsx`, replace the single card renderer with a conditional: `order.orderType === 'BOOKING' ? <BookingVisitCard> : <DeliveryOrderCard>`
  - [ ] [Component] Create `BookingVisitCard` sub-component (inline or separate file): shows scheduled date + timeslot + fasting banner + buyer address + action button based on current status
  - [ ] [Component] `DeliveryOrderCard` is the existing card renamed — no logic changes
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Field technician logs into rider app → `/rider/orders` shows a booking visit card with scheduled time "09:00–11:00 tomorrow" and a fasting warning → taps "Mark as Departed" → buyer's order page updates to "Technician is on the way" → technician arrives, taps "Mark Visit Complete" → buyer's order page shows "Visit Completed" → `BookingOrder.approvalStatus = COMPLETED` in DB → ✅ Done.

---

### 5.7 — Rider Earnings Page

**Root cause / Goal:**
Riders have no way to see how much they have earned — either for a single delivery, for today, or historically. The `Order` table already holds the `deliveryFee` field (the amount charged to the buyer for delivery), which is the source of truth for a rider's per-delivery earning. There is no `RiderEarning` model in the schema, no backend service to aggregate earnings by period, no API endpoint, and no frontend page. Riders need this to trust the platform and track their income without calling the store owner.

**Fix / Approach:**
1. [Schema] Add a `RiderEarning` model that creates one row per `DELIVERED` order, storing `riderId`, `orderId`, `amount` (copied from `Order.deliveryFee` at the moment of delivery), and `createdAt`. This row is created by the order status update flow (5.3) when status transitions to `DELIVERED`.
2. [Backend] Create `RiderEarningsService` with two methods: `getSummary(riderId)` → aggregated totals for today / this week / this month; `getHistory(riderId, cursor?)` → paginated list of per-delivery records newest-first.
3. [Backend] Expose two new authenticated endpoints: `GET /api/v1/rider/earnings/summary` and `GET /api/v1/rider/earnings/history`.
4. [Frontend] Create `RiderEarningsPage.tsx` at `/rider/earnings`. The tab bar introduced in 5.5's `RiderLayout` gets an "Earnings" tab added alongside "Orders" and "Account".

---

- [ ] **RED — Integration (`rider.earnings.test.ts`):**
  - [ ] Test setup: seed 1 `DeliveryRider` (`riderId`). Seed 3 `Order` rows all with `status: DELIVERED` and `deliveryFee: 40.00`, linked to this rider via `RiderEarning` rows (create rows directly in the test seed, do not rely on 5.3 being implemented yet).
  - [ ] Test: `GET /api/v1/rider/earnings/summary` with a valid RIDER JWT for that rider → HTTP 200; response shape `{ success: true, data: { today: { count: number, total: string }, thisWeek: { count: number, total: string }, thisMonth: { count: number, total: string } } }`. With 3 deliveries all created today, all three period totals must equal `"120.00"` and count `3`.
  - [ ] Test: `GET /api/v1/rider/earnings/summary` with a BUYER JWT → HTTP 403.
  - [ ] Test: `GET /api/v1/rider/earnings/summary` with a RIDER JWT for a **different** rider who has no earnings → HTTP 200; all totals `"0.00"` and counts `0` (strict rider scope — no cross-rider data leakage).
  - [ ] Test: `GET /api/v1/rider/earnings/history` with a valid RIDER JWT → HTTP 200; response shape `{ success: true, data: { items: [{ id, orderId, amount, createdAt }], nextCursor: string | null } }`; `items` length is `3`; `amount` on each item is `"40.00"`; items ordered newest-first.
  - [ ] Test: `GET /api/v1/rider/earnings/history?cursor=<cursorFromPreviousResponse>` → returns the next page (empty array if no more records); `nextCursor` is `null`.
  - [ ] Test: `GET /api/v1/rider/earnings/history` with a RIDER JWT for a different rider → returns `items: []` (no cross-rider leakage).
  - [ ] **Run — confirm RED (both endpoints return 404 today).**

- [ ] **GREEN — Backend (Schema → Repository → Service → Controller):**
  - [ ] [Schema] Add `RiderEarning` model to `schema.prisma`:
    ```prisma
    model RiderEarning {
      id        String        @id @default(cuid())
      riderId   String
      orderId   String        @unique
      amount    Decimal       @db.Decimal(10, 2)
      createdAt DateTime      @default(now())
      rider     DeliveryRider @relation(fields: [riderId], references: [id], onDelete: Restrict)
      order     Order         @relation(fields: [orderId], references: [id], onDelete: Restrict)

      @@index([riderId, createdAt])
    }
    ```
    Also add `earnings RiderEarning[]` back-relation to the `DeliveryRider` model, and `earning RiderEarning?` to the `Order` model.
    Run: `pnpm --filter @gorola/api prisma migrate dev --name add_rider_earning`.
  - [ ] [Repository] Create `apps/api/src/modules/delivery/rider-earnings.repository.ts` with:
    - `createEarning(data: { riderId: string; orderId: string; amount: Decimal }): Promise<RiderEarning>` — simple `prisma.riderEarning.create`.
    - `getSummary(riderId: string): Promise<{ today: { count: number; total: Decimal }; thisWeek: { count: number; total: Decimal }; thisMonth: { count: number; total: Decimal } }>` — three separate `prisma.riderEarning.aggregate` calls filtered by `riderId` and `createdAt >= startOfDay/startOfWeek/startOfMonth`.
    - `getHistory(riderId: string, cursor?: string, take = 20): Promise<{ items: RiderEarning[]; nextCursor: string | null }>` — `prisma.riderEarning.findMany` with `where: { riderId }`, `orderBy: { createdAt: 'desc' }`, cursor-based pagination using `id` as the cursor key.
  - [ ] [Service] Create `apps/api/src/modules/delivery/rider-earnings.service.ts` with:
    - `getSummary(riderId: string)` — calls `RiderEarningsRepository.getSummary`; formats `Decimal` totals as fixed-2 strings (`total.toFixed(2)`).
    - `getHistory(riderId: string, cursor?: string)` — calls `RiderEarningsRepository.getHistory`; formats each `amount` as a fixed-2 string.
  - [ ] [Controller] In `rider.controller.ts`, add two new routes inside `registerRiderRoutes` (both behind the existing `preHandler = [requireAuth, requireRole(['RIDER'])]`):
    - `GET /api/v1/rider/earnings/summary`: extracts `riderId` from `request.user.riderId`; calls `deps.riderEarningsService.getSummary(riderId)`; returns standard envelope.
    - `GET /api/v1/rider/earnings/history`: reads optional query param `cursor`; extracts `riderId`; calls `deps.riderEarningsService.getHistory(riderId, cursor)`; returns standard envelope.
  - [ ] [Routes wiring] Add `riderEarningsService: RiderEarningsService` to the `deps` object passed to `registerRiderRoutes` in `routes.ts`. Instantiate `RiderEarningsRepository` and `RiderEarningsService` in the server bootstrap alongside the existing rider deps.
  - [ ] Run integration tests — **confirm GREEN**.

- [ ] **RED — Unit / Component (`RiderEarningsPage.test.tsx`):**
  - [ ] Test: component fetches `GET /api/v1/rider/earnings/summary`; while loading, renders a skeleton or spinner with `data-testid="earnings-summary-loading"`.
  - [ ] Test: on success, renders three summary cards — today, this week, this month — each with `data-testid="summary-today"`, `data-testid="summary-week"`, `data-testid="summary-month"`; the today card displays `"₹120.00"` when the mocked response total is `"120.00"`.
  - [ ] Test: component fetches `GET /api/v1/rider/earnings/history`; renders a list where each row has `data-testid="earning-row"`; the first row displays `"₹40.00"`.
  - [ ] Test: when `nextCursor` is non-null, a "Load more" button with `id="earnings-load-more"` is rendered; clicking it calls the history endpoint with the cursor as a query param.
  - [ ] Test: when `nextCursor` is `null`, the "Load more" button is absent.
  - [ ] Test: when the history list is empty (rider has zero deliveries), renders `data-testid="earnings-empty-state"` with the text "No deliveries yet".
  - [ ] **Run — confirm RED (the page file does not exist yet).**

- [ ] **RED — Unit / Component (`RiderLayout.test.tsx` — additional tab assertion):**
  - [ ] Test: the bottom tab bar (introduced in 5.5) renders an "Earnings" tab with `data-testid="tab-earnings"` that navigates to `/rider/earnings`.
  - [ ] **Run — confirm RED (the Earnings tab is absent from the current tab bar).**

- [ ] **GREEN — Frontend (Types → Component):**
  - [ ] [Types] Create type `EarningsSummary` in `RiderEarningsPage.tsx`:
    ```typescript
    type EarningsPeriod = { count: number; total: string };
    type EarningsSummary = { today: EarningsPeriod; thisWeek: EarningsPeriod; thisMonth: EarningsPeriod };
    ```
  - [ ] [Types] Create type `EarningRecord` in `RiderEarningsPage.tsx`:
    ```typescript
    type EarningRecord = { id: string; orderId: string; amount: string; createdAt: string };
    ```
  - [ ] [Component] Create `apps/web/src/pages/rider/RiderEarningsPage.tsx`:
    - Fetch summary via `useQuery` with `queryKey: ['riderEarningsSummary']`.
    - Fetch history via `useInfiniteQuery` with `queryKey: ['riderEarningsHistory']`; pass `cursor` from `pageParam` to the API call; `getNextPageParam` returns `data.data.nextCursor ?? undefined`.
    - Render three summary cards (today / this week / this month) showing formatted rupee amount and delivery count.
    - Render a flat list of `EarningRecord` rows, each showing order short-ID, formatted amount, and relative time.
    - Render a "Load more" button (`id="earnings-load-more"`) only when `hasNextPage` is `true`.
    - Render `data-testid="earnings-empty-state"` when the flat list is empty.
    - All `navigate()` calls use `getScopedPath()` from `@/lib/subdomain-resolver` (DECISION-038).
  - [ ] [Component] In `RiderLayout.tsx` (created in 5.5), add a third tab "Earnings" that navigates to `/rider/earnings` using `getScopedPath()`; give it `data-testid="tab-earnings"`.
  - [ ] [Routes] In `App.tsx`, add `<Route path="/rider/earnings" element={<RiderRoute><RiderEarningsPage /></RiderRoute>} />`.
  - [ ] Run unit tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Rider logs in → taps the "Earnings" tab in the bottom tab bar → `RiderEarningsPage` loads at `/rider/earnings` → three summary cards display today's / this week's / this month's totals in rupees → below them, a scrollable list shows each past delivery with its earnings amount and order ID → rider taps "Load more" → next page of older deliveries loads and appends to the list → ✅ Done.

---

### 5.8 — Rider E2E Tests (Playwright)

- [ ] `tests/e2e/rider-journey.spec.ts`:
  - [ ] Rider login with seeded credentials → JWT with RIDER role → redirect to `/rider/orders`
  - [ ] Active orders page shows PREPARING orders for rider's store
  - [ ] Click "Mark as Out for Delivery" on order → confirm → order status updates in DB → buyer order page reflects DELIVERING status
  - [ ] Click "Mark as Delivered" → DB status = DELIVERED → buyer sees delivered state
  - [ ] Location update: mock `navigator.geolocation` → PUT location called with valid lat/lng → 200 response
  - [ ] Unauth access to `/rider/orders` redirects to `/rider/login`

---

## Session Notes (Phase 5)

_(Append new entries here — never delete old entries.)_

### Session 1 — 2026-06-09 — Phase 5.1 Rider Auth Completed
- Implemented core Rider authentication backend modules including `RiderAuthService` for login/refresh token operations with session rate-limiting, and `rider.controller.ts` routes.
- Fixed legacy `rider.stubs.test.ts` to include valid signed RIDER tokens for the active orders, order status, and location update routes.
- Created `RiderLoginPage` and `RiderRoute` components on the web application, wired into `App.tsx` router configuration.
- Completed full TDD flow: wrote `RiderRoute.test.tsx` and `RiderLoginPage.test.tsx` unit tests, saw them fail, implemented frontend features, and ran full vitest suite ensuring all 360+ tests are green.
- Updated `seed.ts` to add mock local accounts for both delivery rider (`rider1@gorola.in`) and field technician (`rider2@gorola.in`) with password `Rider#123`.
- Documented seeded credentials in `quick-links/store-partner-info.md` and fixed all typescript/ESLint linting issues across the workspace.

### Session 2 — 2026-06-09 — Phase 5.2 Rider Active Orders Feed Completed
- Implemented `OrderRepository.findManyByStore` supporting status filtering, and updated `orderRelationsInclude` to retrieve user information (phone, name) automatically for order query callers.
- Created `RiderOrderService` and wired it to `routes.ts` and `rider.controller.ts`, replacing the active orders feed stub with a real implementation returning masked customer phone numbers.
- Renamed `rider.stubs.test.ts` to `rider.endpoints.test.ts` and created `rider.orders.test.ts` integration test suite.
- Re-routed active rider portals and redirections from `/rider/dashboard` to `/rider/orders`.
- Built `RiderOrdersPage` with status-based order grouping sections, responsive item lists, auto-refreshing polling (30s), and a clean header.
- Wrote frontend component/unit tests in `RiderOrdersPage.test.tsx` and updated `RiderLoginPage.test.tsx`.
- Ran full lint, typecheck, integration tests, and E2E playwright stubs suite ensuring all tests are green.

### Session 3 — 2026-06-10 — Phase 5.3 Rider Order Status Update Completed
- Wired PUT endpoint `/api/v1/rider/orders/:id/status` to handle rider status transitions.
- Implemented status validation and update logic in `RiderOrderService`, restricting updates to owner store scope and valid transitions (`PREPARING -> OUT_FOR_DELIVERY -> DELIVERED`).
- Added "Mark as Out for Delivery" and "Mark as Delivered" actions to the `RiderOrdersPage` UI, gated behind standard Radix confirmation dialogs.
- Created and successfully verified `rider.status.test.ts` backend integration suite and updated `RiderOrdersPage.test.tsx` frontend suite.
- Fixed unused variable `rider2` inside `rider.status.test.ts` to clear workspace lint checks.

### Session 4 — 2026-06-10 — Phase 5.4 Rider Real-Time Location Tracking Completed
- Implemented DB location upserts in `RiderRepository.updateLocation` and coordinator validation/Socket broadcasts in `RiderLocationService`.
- Wired PUT endpoint `/api/v1/rider/location` and activated authenticated Socket.IO `/rider` namespace with JWT verifier middleware.
- Created `useRiderLocation` hook to watch HTML5 Geolocation API coordinates and publish updates.
- Integrated tracking into `RiderOrdersPage` and `OrderConfirmationPage`, rendering real-time coordinate displays.
- Wrote full unit/integration test suites and verified that all tests, eslint, and tsc checks pass successfully.

### Session 5 — 2026-06-10 — Phase 5.4.1 Modular Geolocation Map Fix Completed
- Implemented coordinate persistence (`deliveryLat`/`deliveryLng`) on orders during checkout.
- Built reusable Leaflet map component `<OrderRouteMap />` and integrated it into the buyer confirmation page and rider active orders list.
- Removed OSRM routing engine code, routes, configurations, and test cases, configuring the map to present marker pins (store, buyer, rider) without routing polylines to keep the deployment fully private, compliant with the DPDP Act, and lightweight.
- Cleaned unused imports and updated E2E stubs to align with the location endpoint implementation.
- Verified that full stack typechecks, lints, integration tests, and E2E journeys are completely green.

### Session 6 — 2026-06-11 — Phase 5.5 Rider Header & Quality Gates Completed
- Added premium top header/navbar to `RiderLayout` containing the GoRola brand logo and `Rider` tag, matching Store/Admin layouts.
- Ensured compliance with >= 44px mobile tap target accessibility guidelines and verified all vitest, eslint, and tsc quality gates are 100% green.
- Clarified and mapped architectural plans for upcoming store status confirmation modals, rider order card list-view refactoring (click to open details modal), and status filtering tab menus.

### Session 7 — 2026-06-11 — Phase 5.5.1 Rider Active Orders Refactoring & Store Status Confirmations Completed
- Implemented status change confirmation dialogs in `StoreOrdersPage.tsx` using Radix `<Dialog>`.
- Refactored `RiderOrdersPage.tsx` with filter tabs for PREPARING and OUT_FOR_DELIVERY orders, compact list-view cards (showing only items and delivery address landmark), and click-to-open overlay details modals featuring full buyer information, toggleable route maps, and status-updating action buttons.
- Ensured body scroll locks when overlay detailed modals are active.
- Completed full TDD cycle: verified RED state, implemented modifications, and ran full suite of web unit tests, typechecks, and lints (ensuring GREEN state).
