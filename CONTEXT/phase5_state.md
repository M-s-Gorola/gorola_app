# GoRola — Phase 5 State (Rider Interface)

> **This file covers Phase 5: the Rider Interface.**
> Phase 5 can start independently of Phase 3 and 4 — it only requires Phase 2 backend infrastructure.
> The 4 HTTP stubs (W-015) and the `/rider` Socket.IO namespace stub are already registered.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name              | Status      | Notes |
| ------- | ----------------- | ----------- | ----- |
| Phase 5 | Rider Interface   | IN PROGRESS | Phase 5.1 to 5.6.3-D are complete. Earnings page, and E2E journeys remaining. |

---

## 📍 Last Updated

- **Date:** 2026-06-18
- **Session Summary:** Implemented key branding and UI polish changes: integrated the favicon, configured a global blurred topographic background image, styled the buyer Hero section with a dark overlay and white text, made the hero section responsive by decreasing its mobile height and padding, left-aligned the mobile "Shop Now" button to prevent stretching, and copied the navbar's blue-white gradient style to the footer.
- **Next Session Must Start With:** Phase 5.7 (Rider Earnings Page)
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

> [!NOTE]
> **Development Geolocation Mock & Latency Mechanics:**
> - **Production Safety:** All mock geolocation fallbacks, warnings, and mock coordinate injection are strictly guarded by `import.meta.env.DEV && import.meta.env.MODE !== 'test'`. In production builds (`npm run build`), Vite statically evaluates `import.meta.env.DEV` to `false`, causing the bundler/minifier to perform dead-code elimination (tree-shaking) and completely remove the mock logic, coordinates, and console warnings from the production bundle.
> - **Initial Mock Coordinates:** On developer environments lacking dedicated hardware GPS (like desktop browsers or virtualized environments), high-accuracy geolocation requests (`enableHighAccuracy: true`) can take 5–10+ seconds to resolve (depending on IP/Wi-Fi positioning databases). To prevent blocking local testing, a 2-second timeout (`devTimeout` of `2000ms`) is set in development mode. If the browser does not return real coordinates within this 2-second window, the hook falls back to mock coordinates to render the map markers immediately.
> - **Delayed Update to Real Coordinates:** Once the browser's background high-accuracy query successfully resolves, the real success callback fires, updating the hook's coordinates with the user's actual location. This causes the map to correctly re-center and update after the initial mock coordinates are rendered.

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
    - [x] Documented development geolocation mock guard (safety in production) and the reason for 2s latency behavior.
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

- [x] **RED — Integration & Backend (N/A):**
  - *N/A: No database schema, repository, or service logic changes are required. The REST endpoints and socket payloads remain exactly the same.*

- [x] **RED — Unit / Component Tests (`StoreOrdersPage.test.tsx` & `RiderOrdersPage.test.tsx`):**
  - [x] Test (`StoreOrdersPage.test.tsx`): Click a status button (e.g. "Mark Preparing"), assert that the PUT status endpoint is NOT immediately called, and verify that the confirmation dialog appears in the DOM.
  - [x] Test (`StoreOrdersPage.test.tsx`): Assert that clicking "Confirm" inside the modal triggers the API PUT endpoint.
  - [x] Test (`RiderOrdersPage.test.tsx`): Verify that the active orders page displays top-level filter tabs ("Ready for Pickup" and "Out for Delivery") instead of grouped vertical sections.
  - [x] Test (`RiderOrdersPage.test.tsx`): Assert that the active order list renders compact card containers containing items and address landmark, but NOT displaying the full map, contact phone, or action buttons.
  - [x] Test (`RiderOrdersPage.test.tsx`): Assert that clicking a compact card opens a detailed overlay modal displaying the full card components (including map and action button).
  - [x] **Run — confirm RED (the tests fail because the confirmation modals, filter tabs, and compact lists do not exist yet).**

- [x] **GREEN — Frontend (Types → Component):**
  - [x] [Store Component] In `StoreOrdersPage.tsx`, add a `confirmingOrderUpdate` state. Wrap the mutation execution in a Radix-based `Dialog` confirmation modal.
  - [x] [Rider Component] In `RiderOrdersPage.tsx`, add `selectedFilterTab` state (`"PICKUP" | "DELIVERY"`). Render status filtering tabs at the top of the content pane.
  - [x] [Rider Component] Refactor the card renderer in `RiderOrdersPage.tsx` to display a compact list item showing only `items` and `deliveryAddress.landmark`.
  - [x] [Rider Component] Implement a modal details overlay that opens on selection, rendering the full active order information (masked phone, collapsible map, status transition actions, close button).
  - [x] Run unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] Store Owner clicks "Mark Preparing" on an order ➔ Confirmation modal pops up ➔ Click "Confirm" ➔ Order moves to preparing status.
  - [x] Rider logs in ➔ Sees top filter tabs "Ready for Pickup" and "Out for Delivery" ➔ Feed shows a clean compact list of items + address ➔ Taps an order card ➔ Full card details pop up in a modal ➔ Rider updates status or views location map ➔ ✅ Done.

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

---

- [x] **RED — Integration (`rider.field-technician.test.ts` — new file):**
  - [x] Test setup: `FIELD_TECHNICIAN` type rider seeded. A `BookingOrder` with `approvalStatus: APPROVED`, `scheduledDate: tomorrow`, `timeslot: '09:00-11:00'` attached to an `Order` with `orderType: BOOKING` and `status: APPROVED`
  - [x] Test: `GET /api/v1/rider/orders/active` with `FIELD_TECHNICIAN` JWT → HTTP 200; response includes the APPROVED booking order with fields `{ id, orderType: 'BOOKING', bookingOrder: { scheduledDate, timeslot, requiresFasting }, deliveryAddress: { landmark, lat, lng } }`
  - [x] Test: `GET /api/v1/rider/orders/active` with a `DELIVERY` type rider JWT → booking orders are **absent** (delivery riders only see QUICK orders)
  - [x] Test: `PUT /api/v1/rider/orders/<bookingOrderId>/status` with body `{ status: 'OUT_FOR_DELIVERY' }` (technician departed) → HTTP 200; `Order.status = OUT_FOR_DELIVERY` in DB; buyer receives `order_status_changed` Socket.IO event
  - [x] Test: `PUT /api/v1/rider/orders/<bookingOrderId>/status` with body `{ status: 'DELIVERED' }` (visit complete) → HTTP 200; `Order.status = DELIVERED`; `BookingOrder.approvalStatus = COMPLETED` in DB
  - [x] Test: `PUT /api/v1/rider/orders/<bookingOrderId>/status` with body `{ status: 'CANCELLED' }` → HTTP 403 `FORBIDDEN` (technicians cannot cancel)
  - [x] **Run — confirm RED (endpoint returns 404 or ignores booking orders).**

- [x] **GREEN — Backend (Schema → Service → Controller):**
  - [x] [Schema] Confirm `riderType RiderType @default(DELIVERY)` exists on `DeliveryRider` (added in Phase 7.1 migration). If Phase 7.1 is not yet done, **stop here and complete 7.1 first**.
  - [x] [Service] Update `RiderOrderService.getActiveOrders(storeId, riderId)` in `rider-order.service.ts`:
    - Fetch the rider row to get `riderType`
    - If `DELIVERY`: filter `Order` where `orderType = QUICK` AND `status IN [PREPARING, OUT_FOR_DELIVERY]` — unchanged behaviour
    - If `FIELD_TECHNICIAN`: filter `Order` where `orderType = BOOKING` AND `status IN [APPROVED, OUT_FOR_DELIVERY]`; include `bookingOrder { scheduledDate, timeslot, requiresFasting }` in the response
  - [x] [Service] Update `RiderOrderService.updateOrderStatus` to allow `APPROVED → OUT_FOR_DELIVERY → DELIVERED` transitions for booking orders (in addition to existing PREPARING → OUT_FOR_DELIVERY → DELIVERED for quick orders). When a booking order reaches `DELIVERED`, also update `BookingOrder.approvalStatus = COMPLETED` in the same DB transaction.
  - [x] Run integration tests — **confirm GREEN.**

- [x] **RED — Unit/Component (`RiderOrdersPage.test.tsx` — additional tests for booking cards):**
  - [x] Test: when `order.orderType === 'BOOKING'`, the order card renders `data-testid="booking-order-card"` (not `data-testid="delivery-order-card"`)
  - [x] Test: booking card shows `scheduledDate` formatted as `"Mon, 19 May"`, `timeslot` as `"09:00 – 11:00"`, and a fasting banner `"⚠️ Patient must be fasting"` when `requiresFasting: true`
  - [x] Test: booking card shows only the buyer's delivery address (no "Pick up from store" section)
  - [x] Test: booking card in `APPROVED` status shows "Mark as Departed" button (not "Mark as Out for Delivery")
  - [x] Test: clicking "Mark as Departed" calls `PUT /api/v1/rider/orders/:id/status` with `{ status: 'OUT_FOR_DELIVERY' }`
  - [x] Test: booking card in `OUT_FOR_DELIVERY` status shows "Mark Visit Complete" button
  - [x] **Run — confirm RED.**

- [x] **GREEN — Frontend:**
  - [x] [Types] Add `orderType: 'QUICK' | 'BOOKING'` and `bookingOrder?: { scheduledDate: string; timeslot: string; requiresFasting: boolean }` to the `RiderOrder` type in `RiderOrdersPage.tsx`
  - [x] [Component] In `RiderOrdersPage.tsx`, replace the single card renderer with a conditional: `order.orderType === 'BOOKING' ? <BookingVisitCard> : <DeliveryOrderCard>`
  - [x] [Component] Create `BookingVisitCard` sub-component (inline or separate file): shows scheduled date + timeslot + fasting banner + buyer address + action button based on current status
  - [x] [Component] `DeliveryOrderCard` is the existing card renamed — no logic changes
  - [x] Run unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Field technician logs into rider app → `/rider/orders` shows a booking visit card with scheduled time "09:00–11:00 tomorrow" and a fasting warning → taps "Mark as Departed" → buyer's order page updates to "Technician is on the way" → technician arrives, taps "Mark Visit Complete" → buyer's order page shows "Visit Completed" → `BookingOrder.approvalStatus = COMPLETED` in DB → ✅ Done.

---

### 5.6.1 — Platform Improvements: Rider Feed, Booking Filters, Admin Riders Page, Dashboard KPI Navigation

**Root cause / Goal:**
Five distinct but related UX improvements are needed, all identified after Phase 5.6:

1. **Rider feed shows all future approved bookings** — a field technician sees bookings scheduled for next week on today's shift, creating noise and confusion. The feed should only show bookings scheduled for *today*.
2. **Store Bookings page has no date filter** — a store owner managing 50+ bookings has no way to narrow the list to "just today" or "this week." The status tabs exist, but no time dimension filter does.
3. **Admin cannot create Rider accounts from the UI** — riders are seeded via scripts. No Admin Riders page exists. Additionally, the current schema hard-codes one `storeId` per rider; to support multi-store assignment in the future, the model must be migrated to a `RiderStore` junction table now, while the Admin Riders page is being built.
4. **Store Dashboard KPI cards are not clickable** — the "Pending Orders" and "Today's Orders / Today's Bookings" cards display numbers but navigating to the relevant filtered list requires the user to manually find the tab. Clicking a card should deep-link to the correct page with the correct filter pre-applied.
5. **"Today's Bookings" counts bookings *placed* today, not bookings *scheduled* for today** — the dashboard metric is semantically wrong for a booking-commerce store; it should count `approvalStatus = APPROVED` bookings whose `scheduledDate` falls on today's calendar date.

**Fix / Approach (high-level per improvement):**

1. **Rider feed date filter (backend + frontend):** Update `RiderOrderService.getActiveOrders` to additionally filter `bookingOrder.scheduledDate` to `[startOfToday, endOfToday)` for `FIELD_TECHNICIAN` riders. Update `RiderOrdersPage` header title to "Today's Bookings."
2. **Booking date filter (frontend only):** Add a `scheduledDateFilter` state to `StoreBookingsPage`. Render a dropdown/date control on the right of the tab bar. All existing data is already in memory — apply a second client-side filter on top of the status tab filter. No backend change required.
3. **Admin Riders page (schema + backend + frontend):**
   - Migrate `DeliveryRider.storeId String` to a new `RiderStore` junction model (`riderId`, `storeId`, `isPrimary`). Remove the direct `storeId` FK from `DeliveryRider`. The rider JWT `storeId` becomes the **primary** store from the junction table.
   - Add three backend endpoints to `admin.controller.ts`: `GET /api/v1/admin/riders`, `POST /api/v1/admin/riders`, `PUT /api/v1/admin/riders/:id`.
   - Create `AdminRidersPage.tsx` with a rider table and a "Create Rider" modal (name, email, phone, password, multi-store picker filtered by `riderType`, rider type select).
   - Add "Riders" nav item to `AdminLayout.tsx` and a route to `admin.tsx`.
4. **Dashboard KPI click-through (frontend only):** Wrap each KPI card `<div>` in a `<button onClick={() => navigate(...)}>`. `StoreOrdersPage` and `StoreBookingsPage` read `useSearchParams()` on mount to pre-select the correct tab and date filter.
5. **Fix "Today's Bookings" metric (backend):** In `StoreOwnerService.getDashboard`, for `BOOKING_COMMERCE` stores, change `todayOrderCount` to count `BookingOrder` rows where `scheduledDate >= startOfToday AND scheduledDate < startOfTomorrow AND approvalStatus = 'APPROVED'`.

> ⚠️ **Schema migration note:** The `RiderStore` junction table migration (step 3) will break `rider.auth.test.ts`, `rider.orders.test.ts`, `rider.field-technician.test.ts`, `rider.status.test.ts`, and `rider.location.test.ts` because they all seed a `DeliveryRider` with a direct `storeId`. **Update all those test seed helpers first (mark them RED), then do the migration, then fix the service to query via the junction table.**

---

#### A. Rider Feed — Today-Only Scheduled Bookings

- [x] **RED — Integration (`rider.field-technician.test.ts` — update existing tests):**
  - [x] Add a new seed: a `BookingOrder` with `scheduledDate = 3 days from now`, `approvalStatus: APPROVED`, attached to an `Order` with `status: APPROVED`. Seed it alongside the existing "tomorrow" booking already in the file.
  - [x] Test: `GET /api/v1/rider/orders/active` with a `FIELD_TECHNICIAN` JWT → the response array contains **only** the booking with `scheduledDate = today`; the booking scheduled 3 days from now is **absent**.
  - [x] Test: `GET /api/v1/rider/orders/active` with a `DELIVERY` type rider JWT → response still contains only `QUICK` orders in `PREPARING` or `OUT_FOR_DELIVERY` status — behaviour unchanged.
  - [x] **Run — confirm RED (currently all APPROVED booking orders appear regardless of date).**

- [x] **GREEN — Backend (Service only):**
  - [x] [Service] In `rider-order.service.ts`, inside the `getActiveOrders` method, in the `FIELD_TECHNICIAN` branch: compute `startOfToday` and `startOfTomorrow` as UTC midnight boundaries. Pass them as `scheduledDateFrom` and `scheduledDateTo` options to `this.orders.findManyByStore`.
  - [x] [Repository] In `order.repository.ts`, update `findManyByStore` to accept optional `scheduledDateFrom?: Date` and `scheduledDateTo?: Date` parameters. When provided, add a Prisma `where: { bookingOrder: { scheduledDate: { gte: scheduledDateFrom, lt: scheduledDateTo } } }` clause.
  - [x] Run integration tests — **confirm GREEN.**

- [x] **RED — Unit / Component (`RiderOrdersPage.test.tsx` — update existing):**
  - [x] Test: When `profileData.riderType === 'FIELD_TECHNICIAN'`, the page `<h1>` element contains the text `"Today's Bookings"` (not `"Shift Services"`).
  - [x] Test: When `profileData.riderType === 'DELIVERY'`, the `<h1>` still contains `"Shift Orders"`.
  - [x] **Run — confirm RED (header currently reads "Shift Services" for FIELD_TECHNICIAN).**

- [x] **GREEN — Frontend (Component):**
  - [x] [Component] In `RiderOrdersPage.tsx`, change the `<h1>` text: when `isFieldTechnician === true` render `"Today's Bookings"` instead of `"Shift Services"`. Add a `<p>` subtitle: `"Scheduled for today"`.
  - [x] Run unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Field technician logs into rider app → `/rider/orders` header reads **"Today's Bookings — Scheduled for today"** → feed shows only bookings whose `scheduledDate` is today's calendar date → a booking scheduled for next week is not visible → ✅ Done.

---

#### B. Store Bookings Page — Scheduled Date Filter

- [x] **RED — Integration (N/A):**
  - N/A: No backend change required. The existing `GET /api/v1/store/bookings?status=ALL` endpoint already returns all bookings including `bookingOrder.scheduledDate`. The filter is client-side only.

- [x] **RED — Unit / Component (`StoreBookingsPage.test.tsx` — update existing):**
  - [x] Test: The bookings page renders a date filter control with `data-testid="booking-date-filter"` in the tab bar row.
  - [x] Test: The date filter dropdown contains options: `"All Dates"`, `"Today"`, `"Tomorrow"`, `"This Week"`, `"This Month"`, `"Custom Range"`.
  - [x] Test: When `dateFilter = "Today"` is selected and two bookings are present — one with `scheduledDate = today`, one with `scheduledDate = tomorrow` — `getActiveList()` returns only the booking scheduled for today.
  - [x] Test: When `dateFilter = "Custom Range"` is selected, two date inputs appear with `data-testid="date-from-input"` and `data-testid="date-to-input"`.
  - [x] Test: When `dateFilter = "All Dates"` (default), `getActiveList()` returns all bookings unfiltered.
  - [x] **Run — confirm RED (no date filter control exists today).**

- [x] **GREEN — Frontend (Types → Component):**
  - [x] [Types] Add `type DateFilter = "ALL" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM"` in `StoreBookingsPage.tsx`.
  - [x] [Component] Add `const [dateFilter, setDateFilter] = useState<DateFilter>("ALL")` and `const [customFrom, setCustomFrom] = useState("")` and `const [customTo, setCustomTo] = useState("")` to `StoreBookingsPage`.
  - [x] [Component] Add a `filterByDate(bookings: Booking[]): Booking[]` helper that compares `booking.bookingOrder.scheduledDate` against the selected filter range using `new Date()` for today/tomorrow/week/month boundaries.
  - [x] [Component] Update `getActiveList()` to pipe its result through `filterByDate(...)` before returning.
  - [x] [Component] Render a `<select data-testid="booking-date-filter">` dropdown to the right of the tab bar (inside the same flex row). When `dateFilter === "CUSTOM"`, render two `<input type="date">` elements (`data-testid="date-from-input"` and `data-testid="date-to-input"`).
  - [x] Run unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Store owner opens Bookings page → sees date filter dropdown on the right of the tabs → selects **"Today"** → only bookings whose `scheduledDate` is today's date remain in the grid → selects **"This Week"** → this week's bookings appear → selects **"Custom Range"** → two date inputs appear → enters a range → list narrows accordingly → ✅ Done.

---

#### C. Admin Riders Page — Multi-Store Junction Table + Full CRUD

> ⚠️ **This section has two sub-steps. Complete C.1 (schema migration) fully before starting C.2 (admin endpoints) and C.3 (frontend). The migration will break multiple existing rider test files — fix them as part of C.1's RED step.**

---

##### C.1 — Schema Migration: RiderStore Junction Table

- [x] **RED — Integration (update ALL existing rider test files before migrating):**
  - [x] In `rider.auth.test.ts`: find every `prisma.deliveryRider.create({ data: { storeId: ... } })` seed call. Add a comment `// TODO-C1: update after junction migration` — do NOT change the code yet. Run the file and confirm it still passes GREEN (baseline).
  - [x] In `rider.orders.test.ts`, `rider.field-technician.test.ts`, `rider.status.test.ts`, `rider.location.test.ts`: same — locate every `prisma.deliveryRider.create` seed and add `// TODO-C1` comments.
  - [x] Now update every `// TODO-C1` seed: remove the `storeId` field from `prisma.deliveryRider.create` and instead add a `prisma.riderStore.create({ data: { riderId: <id>, storeId: <id>, isPrimary: true } })` call immediately after.
  - [x] **Run all five rider integration test files — confirm RED (schema does not have `RiderStore` yet; `prisma.riderStore` is undefined).**

- [x] **GREEN — Backend (Schema → Repository → Service → Controller):**
  - [x] [Schema] In `schema.prisma`:
    - Remove `storeId String` and `store Store @relation(...)` from `DeliveryRider`.
    - Remove `deliveryRiders DeliveryRider[]` from `Store`.
    - Add new model:
      ```prisma
      model RiderStore {
        id        String        @id @default(cuid())
        riderId   String
        storeId   String
        isPrimary Boolean       @default(false)
        createdAt DateTime      @default(now())
        rider     DeliveryRider @relation(fields: [riderId], references: [id], onDelete: Cascade)
        store     Store         @relation(fields: [storeId], references: [id], onDelete: Restrict)

        @@unique([riderId, storeId])
        @@index([riderId])
        @@index([storeId])
      }
      ```
    - Add `stores RiderStore[]` back-relation to `DeliveryRider`.
    - Add `riders RiderStore[]` back-relation to `Store`.
    - Run: `pnpm --filter @gorola/api prisma migrate dev --name add_rider_store_junction`. Apply to test DB.
  - [x] [Repository] In `rider.repository.ts`, update `findById` to include `stores: { include: { store: true } }`. Add helper `getPrimaryStoreId(riderId: string): Promise<string | null>` that queries `prisma.riderStore.findFirst({ where: { riderId, isPrimary: true } })`.
  - [x] [Service] In `rider-auth.service.ts`, update login to call `riderRepository.getPrimaryStoreId(rider.id)` to resolve `storeId` for JWT payload instead of reading `rider.storeId`.
  - [x] [Service] In `rider-order.service.ts`, update `getActiveOrders(storeIds: string[], riderId: string)` — change first argument from a single `storeId` to `storeIds: string[]`. Update the `findManyByStore` call to use `storeId: { in: storeIds }`.
  - [x] [Controller] In `rider.controller.ts`, update the `GET /api/v1/rider/orders/active` handler: after verifying the rider, call `riderRepository.getAllStoreIds(riderId)` (new method returning all `storeId[]` from junction) and pass the array to `riderOrderService.getActiveOrders`.
  - [x] [Repository] Add `getAllStoreIds(riderId: string): Promise<string[]>` to `rider.repository.ts` that returns all `storeId` values from `RiderStore` where `riderId` matches.
  - [x] Run all five rider integration test files — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] A rider seeded with 2 `RiderStore` rows (storeA + storeB, storeA = primary) logs in → JWT contains `storeId = storeA.id` → `GET /api/v1/rider/orders/active` returns orders from **both** storeA and storeB → a rider with only one `RiderStore` row sees orders from that one store only → ✅ Done.

---

##### C.2 — Admin Backend Endpoints for Riders

- [x] **RED — Integration (`admin.riders.test.ts` — new file):**
  - [x] Test setup: seed 1 Admin, 2 Stores (one `QUICK_COMMERCE`, one `BOOKING_COMMERCE`), 1 existing `DeliveryRider` with a `RiderStore` linking to the QUICK_COMMERCE store.
  - [x] Test: `GET /api/v1/admin/riders` with valid ADMIN JWT → HTTP 200; response shape `{ success: true, data: [{ id, name, email, phone, riderType, isActive, stores: [{ storeId, storeName, isPrimary }] }] }`; array contains exactly 1 rider.
  - [x] Test: `GET /api/v1/admin/riders` with STORE_OWNER JWT → HTTP 403.
  - [x] Test: `POST /api/v1/admin/riders` with body `{ name: "Raju", email: "raju@gorola.in", phone: "9876543210", password: "Rider#456", riderType: "DELIVERY", storeIds: [<quickStoreId>], primaryStoreId: <quickStoreId> }` with ADMIN JWT → HTTP 201; response contains `{ id, name, email, riderType, stores: [{ storeId, isPrimary: true }] }`; `DeliveryRider` row exists in DB; one `RiderStore` row exists in DB with `isPrimary: true`.
  - [x] Test: `POST /api/v1/admin/riders` with `email` already in use → HTTP 409 with `error.code = "CONFLICT"`.
  - [x] Test: `POST /api/v1/admin/riders` with `storeIds` containing a `BOOKING_COMMERCE` storeId but `riderType: "DELIVERY"` → HTTP 400 with `error.code = "VALIDATION_ERROR"` (type-store mismatch).
  - [x] Test: `PUT /api/v1/admin/riders/:id` with body `{ isActive: false, storeIds: [<quickStoreId>], primaryStoreId: <quickStoreId> }` → HTTP 200; `DeliveryRider.isActive = false` in DB.
  - [x] Test: `PUT /api/v1/admin/riders/:id` for a non-existent rider id → HTTP 404.
  - [x] **Run — confirm RED (routes do not exist; all return 404).**

- [x] **GREEN — Backend (Service → Controller → Routes):**
  - [x] [Service] In `admin.service.ts`, add three methods:
    - `listRiders(): Promise<RiderWithStores[]>` — `prisma.deliveryRider.findMany({ where: { isDeleted: false }, include: { stores: { include: { store: { select: { id: true, name: true } } } } } })`.
    - `createRider(data: { name, email, phone, password, riderType, storeIds, primaryStoreId }): Promise<RiderWithStores>` — hash password with `bcryptjs`, create `DeliveryRider`, then create `RiderStore` rows in a Prisma transaction; validate that each `storeId` store type matches `riderType` (DELIVERY → QUICK_COMMERCE, FIELD_TECHNICIAN → BOOKING_COMMERCE). Throw 409 on duplicate email, 400 on type mismatch.
    - `updateRider(riderId, data: { isActive?, storeIds?, primaryStoreId? }): Promise<RiderWithStores>` — update `DeliveryRider.isActive`; if `storeIds` provided, delete all existing `RiderStore` rows for this rider and re-create them in a transaction.
  - [x] [Controller] In `admin.controller.ts`, add three routes inside `registerAdminRoutes`:
    - `GET /api/v1/admin/riders` — calls `adminService.listRiders()`.
    - `POST /api/v1/admin/riders` — Zod validates body (`name` min 1, `email` valid email, `phone` 10-digit string, `password` min 8 chars, `riderType` enum, `storeIds` array min 1, `primaryStoreId` string). Calls `adminService.createRider(...)`. Returns HTTP 201.
    - `PUT /api/v1/admin/riders/:id` — Zod validates body (all fields optional). Calls `adminService.updateRider(params.id, ...)`. Returns HTTP 200.
  - [x] All three routes use `preHandler: [requireAuth(deps.tokenVerifier), requireRole(['ADMIN'])]`.
  - [x] Run integration tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Admin hits `POST /api/v1/admin/riders` with two `storeIds` → 201 response → `DeliveryRider` row exists → two `RiderStore` rows exist, one with `isPrimary: true` → `GET /api/v1/admin/riders` lists the new rider with both stores → ✅ Done.

---

##### C.3 — AdminRidersPage Frontend

- [x] **RED — Unit / Component (`AdminRidersPage.test.tsx` — new file):**
  - [x] Test: component renders a table with columns Name, Email, Phone, Type, Stores, Status, Actions (assert header cells by text).
  - [x] Test: when API returns 2 riders, 2 `<tr>` rows with `data-testid="rider-row-<id>"` are rendered.
  - [x] Test: a "Create Rider" button with `id="create-rider-btn"` is visible; clicking it opens a modal with `data-testid="create-rider-modal"`.
  - [x] Test: the create modal contains fields with `id="rider-name"`, `id="rider-email"`, `id="rider-phone"`, `id="rider-password"`, `id="rider-type-select"`, and a multi-store picker with `data-testid="store-picker"`.
  - [x] Test: submitting the create form calls `POST /api/v1/admin/riders` with `{ name, email, phone, password, riderType, storeIds, primaryStoreId }`.
  - [x] Test: when `riderType = "DELIVERY"`, the store picker only shows stores with `storeType = "QUICK_COMMERCE"`.
  - [x] Test: when `riderType = "FIELD_TECHNICIAN"`, the store picker only shows stores with `storeType = "BOOKING_COMMERCE"`.
  - [x] Test: clicking the "Suspend" action button on an active rider calls `PUT /api/v1/admin/riders/:id` with `{ isActive: false }`.
  - [x] Test: clicking "Edit Stores" for a rider opens the edit modal pre-populated with the rider's current stores.
  - [x] **Run — confirm RED (file does not exist).**

- [x] **GREEN — Frontend (Types → Component → Routes → Nav):**
  - [x] [Types] In `AdminRidersPage.tsx`, define:
    ```typescript
    type RiderStore = { storeId: string; storeName: string; isPrimary: boolean };
    type AdminRider = { id: string; name: string; email: string; phone: string; riderType: "DELIVERY" | "FIELD_TECHNICIAN"; isActive: boolean; stores: RiderStore[] };
    type StoreOption = { id: string; name: string; storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE" };
    ```
  - [x] [Component] Create `apps/web/src/pages/admin/AdminRidersPage.tsx`:
    - Fetch `GET /api/v1/admin/riders` with `useQuery(['admin', 'riders'])`.
    - Fetch `GET /api/v1/admin/stores` with `useQuery(['admin', 'stores'])` to populate the store picker (reuse existing endpoint).
    - Render a table (same style as `AdminUsersPage`) with one row per rider.
    - "Create Rider" button opens a `Dialog` modal. The modal has a `riderType` select that drives which stores appear in the multi-checkbox store picker. On submit, call `POST /api/v1/admin/riders` via `useMutation`; on success, invalidate `['admin', 'riders']` and close modal.
    - Each row has a "Suspend/Unsuspend" button (`data-testid="rider-toggle-<id>"`) that calls `PUT /api/v1/admin/riders/:id` with `{ isActive: !current }`, and an "Edit Stores" button that opens the same modal pre-populated.
    - Use `toast.success` / `toast.error` for feedback (matching other Admin pages).
  - [x] [Routes] In `apps/web/src/app/routes/admin.tsx`: add `import { AdminRidersPage }` and a new `<Route key="admin-riders" path={\`${prefix}/riders\`} element={<AdminRoute><AdminLayout><AdminRidersPage /></AdminLayout></AdminRoute>} />`.
  - [x] [Nav] In `apps/web/src/components/admin/AdminLayout.tsx`: add `{ label: "Riders", path: getScopedPath("/admin/riders", "admin", isSubdomainMode) }` to `navItems` array (after "Stores").
  - [x] Run unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Admin logs in → sidebar shows "Riders" nav item → navigates to `/admin/riders` → table lists all existing riders with their store assignments → clicks "Create Rider" → fills form, selects type "DELIVERY", picks a QUICK_COMMERCE store as primary → submits → new rider appears in the table → Admin clicks "Edit Stores" on that rider → changes to two stores → saves → rider row now shows two store names → Admin clicks "Suspend" → rider `isActive` flips to false → rider can no longer log in → ✅ Done.

---

#### D. Store Dashboard — Clickable KPI Cards, Split Active Offers/Discounts, and Quick Commerce Date Filters

**Root cause / Goal:**
Store owners need a seamless way to navigate from high-level dashboard metrics to itemized lists with corresponding filters pre-applied. The current dashboard cards are passive, requiring manual navigation.
Additionally:
1. "Today's Bookings" metric counts bookings placed today, not scheduled for today (incorrect semantics).
2. "Active Offers" merges offers (campaigns) and discount codes into one card. They need to be separate cards navigating to their respective pages.
3. Quick commerce store owner needs to filter incoming orders by date range (Today, Tomorrow, This Week, This Month, Custom Range) just like bookings, and the "Today's Orders" dashboard card should link directly to the Today-filtered orders list.

**Fix / Approach:**
1. [Backend - KPI Metrics] Update `StoreOwnerService.getDashboard` to:
   - For `BOOKING_COMMERCE` stores, calculate `todayOrderCount` by counting `BookingOrder` rows where `scheduledDate` is today's calendar date and `approvalStatus` is `APPROVED`.
   - Return both `activeOffersCount` (from `offer` table) and a new `activeDiscountsCount` (from `discount` table) to separate them.
2. [Backend - Orders Query] Update `StoreOwnerService.getOrders` and `store-owner.controller.ts` to support optional query parameters: `dateFilter`, `customFrom`, `customTo`.
   - Compute start/end date ranges on the backend based on `dateFilter` and apply a `createdAt` Prisma filter.
3. [Frontend - Dashboard] Wrap each KPI card in a button/clickable container (with subtle hover shadow and cursor-pointer transitions) and wire to navigation:
   - Today's Orders card -> `/store/orders?dateFilter=TODAY`
   - Today's Bookings card -> `/store/bookings?tab=APPROVED&dateFilter=TODAY`
   - Today's Revenue / Today's Booking Revenue -> Smooth scroll to `#revenue-chart` on the dashboard page.
   - Pending Orders card -> `/store/orders?status=PLACED`
   - Pending Approvals card -> `/store/bookings?tab=PENDING`
   - Active Ads card -> `/store/advertisements`
   - Active Offers card -> `/store/offers`
   - Active Discount Codes card -> `/store/discounts` (The new split card, making 6 KPI cards total. Change grid style to `lg:grid-cols-6`).
4. [Frontend - Orders Page] In `StoreOrdersPage.tsx`:
   - Initialize selected tab and date filter states from `useSearchParams()`.
   - Add a `<select data-testid="order-date-filter">` dropdown for date filtering on the right of the tab bar, and custom date inputs when `"CUSTOM"` range is selected (matching bookings filter layout).
   - Invalidate/re-fetch orders by adding these params to the `useQuery` query key and endpoint URL.
5. [Frontend - Bookings Page] In `StoreBookingsPage.tsx`:
   - Read `useSearchParams()` on mount to pre-fill the selected status tab and date filter parameters.

---

- [x] **RED — Integration (`store-owner.dashboard.test.ts`):**
  - [x] Setup: Seed 1 `BOOKING_COMMERCE` store, 1 store owner, 1 user buyer. Seed 2 `BookingOrder` rows with `scheduledDate = today` and `approvalStatus = APPROVED`. Seed 1 `BookingOrder` with `scheduledDate = tomorrow` and `approvalStatus = APPROVED`.
  - [x] Test: `GET /api/v1/store/dashboard` -> response contains `{success: true, data: { todayOrderCount: 2, activeOffersCount: number, activeDiscountsCount: number }}`.
  - [x] Test: Seed 2 active `Discount` rows and 1 active `Offer` row. `GET /api/v1/store/dashboard` returns `activeOffersCount = 1` and `activeDiscountsCount = 2`.
  - [x] **Run — confirm RED (todayOrderCount is incorrect, activeDiscountsCount is missing/undefined).**

- [x] **RED — Integration (`store-owner.orders.test.ts`):**
  - [x] Setup: Seed 1 store, 1 store owner, 1 user buyer. Seed 3 orders: one placed today, one placed yesterday, one placed 3 days ago.
  - [x] Test: `GET /api/v1/store/orders?dateFilter=TODAY` -> returns exactly 1 order (the one created today).
  - [x] Test: `GET /api/v1/store/orders?dateFilter=CUSTOM&customFrom=<yesterday>&customTo=<today>` -> returns exactly 2 orders.
  - [x] **Run — confirm RED (dateFilter query params are ignored, all orders returned).**

- [x] **GREEN — Backend (Service → Controller):**
  - [x] [Service] In `store-owner.service.ts`, update `DashboardKpiSummary` type and `getDashboard` method:
    - Add `activeDiscountsCount` to `DashboardKpiSummary`.
    - If `storeType === "BOOKING_COMMERCE"`, query `todayOrderCount` using `this.db.bookingOrder.count` with `scheduledDate` between start of today and end of today, and `approvalStatus: "APPROVED"`.
    - Query `activeDiscountsCount` count from `this.db.discount.count` where `storeId` matches and `isActive: true`.
  - [x] [Service] In `store-owner.service.ts`, update `getOrders(storeId, filters)` signature to support `dateFilter?: string; customFrom?: string; customTo?: string`.
    - Compute `createdAt` range:
      - `TODAY`: start of today to end of today.
      - `TOMORROW`: start of tomorrow to end of tomorrow.
      - `THIS_WEEK`: start of current week to end of current week.
      - `THIS_MONTH`: start of current month to end of current month.
      - `CUSTOM`: `customFrom` (start of day) to `customTo` (end of day).
    - Add `createdAt` range condition to Prisma `where` object inside `getOrders`.
  - [x] [Controller] In `store-owner.controller.ts`, inside the `GET /api/v1/store/orders` handler:
    - Parse `dateFilter`, `customFrom`, `customTo` from query parameters and pass to `storeOwnerService.getOrders`.
  - [x] Run integration tests — **confirm GREEN.**

- [x] **RED — Unit / Component (`StoreDashboardPage.test.tsx`):**
  - [x] Test: Renders 6 KPI cards for QUICK_COMMERCE, including a new card with text `"Active Discount Codes"`.
  - [x] Test: clicking the card with `data-testid="kpi-pending-orders"` navigates to `/store/orders?status=PLACED`.
  - [x] Test: clicking the card with `data-testid="kpi-today-orders"` navigates to `/store/orders?dateFilter=TODAY`.
  - [x] Test: clicking the card with `data-testid="kpi-revenue"` calls smooth scroll to element `#revenue-chart`.
  - [x] Test: clicking the card with `data-testid="kpi-active-offers"` navigates to `/store/offers`.
  - [x] Test: clicking the card with `data-testid="kpi-active-discounts"` navigates to `/store/discounts`.
  - [x] Test: clicking the card with `data-testid="kpi-active-ads"` navigates to `/store/advertisements`.
  - [x] **Run — confirm RED (missing click handlers, missing discount card, assertions fail).**

- [x] **RED — Unit / Component (`StoreOrdersPage.test.tsx`):**
  - [x] Test: Orders page renders a date filter dropdown with `data-testid="order-date-filter"`.
  - [x] Test: Changing date filter to TODAY calls `api.get` with `/api/v1/store/orders?dateFilter=TODAY`.
  - [x] Test: Changing date filter to CUSTOM renders `data-testid="date-from-input"` and `data-testid="date-to-input"`.
  - [x] Test: Initializing route with `?dateFilter=TODAY` automatically sets the default select value to `"TODAY"`.
  - [x] **Run — confirm RED (date filter UI controls and query wiring are absent).**

- [x] **GREEN — Frontend (Types → Component):**
  - [x] [Types] In `StoreDashboardPage.tsx`, update `DashboardData` type to include `activeDiscountsCount: number`.
  - [x] [Component] In `StoreDashboardPage.tsx`:
    - Add `id="revenue-chart"` to the Weekly Revenue Trend Chart container `div`.
    - Change KPI grid columns to `lg:grid-cols-6` and add the sixth card: `"Active Discount Codes"` displaying `dashboard.activeDiscountsCount`.
    - Change KPI cards `div` structures to `<button>` elements (or add `role="button"` and tabIndex) with hover shadow/cursor-pointer transition styles and navigation click handlers.
  - [x] [Component] In `StoreOrdersPage.tsx`:
    - Import `useSearchParams` from `react-router-dom`.
    - Add state variables for `dateFilter`, `customFrom`, `customTo`. Read them from search parameters on mount.
    - Render a `<select data-testid="order-date-filter">` on the right side of the tab bar row. When `dateFilter === "CUSTOM"`, render start and end `<input type="date">` elements.
    - Wire `useQuery` queryKey and api request URL to pass `dateFilter`, `customFrom`, and `customTo` query parameters.
  - [x] [Component] In `StoreBookingsPage.tsx`:
    - Import `useSearchParams` from `react-router-dom`.
    - Initialize `activeTab` from `searchParams.get("tab")` and `dateFilter` from `searchParams.get("dateFilter")` on component mount.
  - [x] Run unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Store owner (QUICK_COMMERCE) goes to dashboard → clicks "Today's Orders" card → navigates to `/store/orders?dateFilter=TODAY` → orders page loads showing only today's orders, and date filter dropdown pre-selects "Today" → ✅.
  - [x] Store owner clicks "Active Discount Codes" card → navigates to `/store/discounts` → ✅.
  - [x] Store owner clicks "Today's Revenue" card → page scrolls smoothly down to the revenue chart → ✅ Done.

---

### 5.6.2 — Ola Maps Provider Integration (Swappable Map Abstraction)

**Root cause / Goal:**
`OrderRouteMap.tsx` is currently a direct, hard-coded consumer of the Leaflet library and OpenStreetMap tile server. There is no abstraction layer between the component's props contract (`buyerCoords`, `riderCoords`) and the underlying map SDK. This means switching to Ola Maps (or Google Maps) in future would require touching every consumer page — `OrderConfirmationPage.tsx`, `BookingConfirmationPage.tsx`, and `RiderOrdersPage.tsx`. The modular design set up in Phase 5.4.1 intentionally separated props from rendering logic, but the adapter layer it anticipated was never built. This phase introduces a formal provider abstraction (`MapProvider`) so that Ola Maps can be wired in as a runtime-selectable option with zero changes to any consumer.

> **Prerequisites:** Phase 5.4.1 complete (✅). An Ola Maps API key obtained from the Ola Maps Developer Console (https://maps.olakarto.com/) stored in `VITE_OLA_MAPS_API_KEY` env var.

**Fix / Approach:**
1. **[Types]** Define a `MapProvider` union type (`'leaflet' | 'ola'`) and a `MapAdapter` interface in a new file `apps/web/src/lib/map-provider.ts`. The interface contracts three methods: `init(container, center, zoom)`, `addMarker(coords, icon)`, `destroy()`.
2. **[Adapter — Leaflet]** Extract the existing Leaflet imperative code from `OrderRouteMap.tsx` into `apps/web/src/lib/adapters/leaflet-map-adapter.ts` that implements `MapAdapter`. The public API of `OrderRouteMap` is unchanged; internally it delegates to this adapter.
3. **[Adapter — Ola Maps]** Create `apps/web/src/lib/adapters/ola-map-adapter.ts` implementing `MapAdapter` using the Ola Maps JavaScript SDK (`@mappls/map-react` or the Ola Maps JS SDK script-tag approach). The adapter loads the SDK dynamically (script injection) so the SDK is only fetched when Ola is the active provider and the component mounts.
4. **[Factory]** Create `apps/web/src/lib/map-adapter-factory.ts`: a `createMapAdapter(provider: MapProvider): MapAdapter` factory function. When `provider === 'ola'` it returns an `OlaMapAdapter`; when `provider === 'leaflet'` it returns a `LeafletMapAdapter`.
5. **[Config]** Read `VITE_MAP_PROVIDER` (values: `'leaflet'` | `'ola'`) from `import.meta.env` with a default of `'leaflet'`. This single env var switches the active provider at build/runtime.
6. **[Component]** Update `OrderRouteMap.tsx` to call `createMapAdapter(import.meta.env.VITE_MAP_PROVIDER ?? 'leaflet')` inside `useEffect` instead of calling Leaflet directly. The props interface (`OrderRouteMapProps`) is **unchanged** — all consumer pages continue to work without modification.
7. **[Env]** Document `VITE_MAP_PROVIDER` and `VITE_OLA_MAPS_API_KEY` in `.env.example` and `current_state.md` Environment table.

> ⚠️ **No consumer page changes required.** `OrderConfirmationPage`, `BookingConfirmationPage`, and `RiderOrdersPage` import `OrderRouteMap` and pass the same props. The switch is entirely internal to the shared component and the new adapter files.

---

- [x] **RED — Unit / Component (`map-adapter-factory.test.ts` — new file):**

  **Root cause:** The factory function does not exist yet. Any import of it will fail, and both adapter classes are unimplemented.

  - [x] File: `apps/web/src/__tests__/unit/map-adapter-factory.test.ts`
  - [x] Test: `createMapAdapter('leaflet')` returns an object that has methods `init`, `addMarker`, and `destroy`.
  - [x] Test: `createMapAdapter('ola')` returns an object that has methods `init`, `addMarker`, and `destroy`.
  - [x] Test: calling `createMapAdapter` with an unknown string (e.g. `'google'`) throws a `TypeError` with the message `"Unknown map provider: google"`.
  - [x] **Run — confirm RED (module does not exist, all tests throw `Cannot find module`).**

- [x] **RED — Unit / Component (`leaflet-map-adapter.test.ts` — new file):**

  **Root cause:** The extracted Leaflet adapter does not exist; the test proves the existing functionality must migrate to the adapter without regression.

  - [x] File: `apps/web/src/__tests__/unit/leaflet-map-adapter.test.ts`
  - [x] Setup: mock `leaflet` module using the same `vi.mock` setup already proven in `OrderRouteMap.test.tsx`.
  - [x] Test: `adapter.init(container, { lat: 30.45, lng: 78.06 }, 14)` calls `L.map(container, ...)` and `L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', ...).addTo(map)`.
  - [x] Test: `adapter.addMarker({ lat: 30.45, lng: 78.06 }, 'buyer')` calls `L.marker([30.45, 78.06], { icon: expect.any(Object) }).addTo(map)`.
  - [x] Test: `adapter.addMarker({ lat: 30.455, lng: 78.068 }, 'rider')` calls `L.marker` a second time with rider coordinates.
  - [x] Test: `adapter.destroy()` calls `map.off()` and `map.remove()`.
  - [x] **Run — confirm RED (adapter file does not exist).**

- [x] **RED — Unit / Component (`ola-map-adapter.test.ts` — new file):**

  **Root cause:** The Ola Maps adapter does not exist; no Ola SDK calls are made today.

  - [x] File: `apps/web/src/__tests__/unit/ola-map-adapter.test.ts`
  - [x] Setup: mock `window` to intercept the dynamic `<script>` injection; mock the `OlaMaps` global that the script would attach to `window`.
  - [x] Test: `adapter.init(container, { lat: 30.45, lng: 78.06 }, 14)` injects a `<script src="https://api.olamaps.io/libs/latest/olamaps.js">` tag into `document.head` (or equivalent SDK bootstrap call).
  - [x] Test: after the script load resolves (simulate by calling `script.onload()`), `new window.OlaMaps({ apiKey: 'test-key', ... })` is called and a map is initialized on `container` centered at `[30.45, 78.06]`.
  - [x] Test: `adapter.addMarker({ lat: 30.45, lng: 78.06 }, 'buyer')` calls `olaMap.addMarker(...)` (or the Ola SDK equivalent) with the correct coordinates.
  - [x] Test: `adapter.destroy()` calls `olaMap.remove()` (or the Ola SDK teardown method) and removes the injected `<script>` tag from `document.head`.
  - [x] Test: if `VITE_OLA_MAPS_API_KEY` is not set, `adapter.init(...)` throws an `Error` with the message `"VITE_OLA_MAPS_API_KEY is not configured"`.
  - [x] **Run — confirm RED (adapter file does not exist).**

- [x] **RED — Unit / Component (`OrderRouteMap.test.tsx` — update existing tests):**

  **Root cause:** The component currently calls Leaflet directly. After the refactor, it will delegate to the factory; the unit test must verify the delegation, not the Leaflet implementation detail.

  - [x] Test (existing — update): mock `../../../lib/map-adapter-factory` so `createMapAdapter` returns a mock `MapAdapter` object with spied `init`, `addMarker`, and `destroy` methods.
  - [x] Test: rendering `<OrderRouteMap buyerCoords={...} />` calls `createMapAdapter(import.meta.env.VITE_MAP_PROVIDER ?? 'leaflet')` exactly once.
  - [x] Test: after mount, `mockAdapter.init` is called once with the map container `div`, `buyerCoords`, and zoom `14`.
  - [x] Test: `mockAdapter.addMarker` is called once with `buyerCoords` and `'buyer'` when only `buyerCoords` is provided.
  - [x] Test: `mockAdapter.addMarker` is called twice — once for `'buyer'`, once for `'rider'` — when both `buyerCoords` and `riderCoords` are provided.
  - [x] Test: on unmount, `mockAdapter.destroy` is called exactly once.
  - [x] Test: when `riderCoords` prop changes (re-render), `mockAdapter.destroy` is called to tear down the old map instance and a fresh `init` + `addMarker` cycle begins.
  - [x] **Run — confirm RED (component still calls Leaflet directly; `createMapAdapter` is never imported).**

- [x] **GREEN — Frontend (Types → Adapters → Factory → Component):**

  - [x] **[Types]** Create `apps/web/src/lib/map-provider.ts`:
    ```typescript
    export type MapProvider = 'leaflet' | 'ola';
    export type MarkerIconType = 'buyer' | 'rider';

    export interface MapAdapter {
      /** Mount and initialise the map into `container`. */
      init(container: HTMLDivElement, center: { lat: number; lng: number }, zoom: number): Promise<void>;
      /** Place a named marker on the map. */
      addMarker(coords: { lat: number; lng: number }, icon: MarkerIconType): void;
      /** Destroy all map resources (markers, map instance, injected scripts). */
      destroy(): void;
    }
    ```
  - [x] **[Adapter — Leaflet]** Create `apps/web/src/lib/adapters/leaflet-map-adapter.ts`:
    - Implements `MapAdapter`.
    - `init`: calls `L.map(container, ...)`, adds OSM tile layer, stores map reference on `this`.
    - `addMarker`: calls `L.marker([coords.lat, coords.lng], { icon: iconFor(type) }).addTo(this._map)`, stores marker reference.
    - `destroy`: calls `this._map.off(); this._map.remove();` — removes all markers first.
    - Move the `buyerIcon` and `riderIcon` `L.divIcon` definitions from `OrderRouteMap.tsx` into this adapter file.
  - [x] **[Adapter — Ola Maps]** Create `apps/web/src/lib/adapters/ola-map-adapter.ts`:
    - Implements `MapAdapter`.
    - `init`: reads `import.meta.env.VITE_OLA_MAPS_API_KEY` — throws if missing. Injects `<script src="https://api.olamaps.io/libs/latest/olamaps.js">` into `document.head` if not already present (idempotent). Waits for `script.onload`. Calls `new window.OlaMaps({ apiKey })` to obtain SDK instance. Calls `olaMapsInstance.init({ container, center: [center.lat, center.lng], zoom, style: '...' })` (exact method signature from Ola Maps JS SDK docs). Stores `this._map` reference.
    - [x] `addMarker`: calls the Ola Maps marker API to add a marker at `[coords.lat, coords.lng]` with a custom div icon matching the design system (same rose / blue color scheme as Leaflet icons).
    - [x] `destroy`: calls `this._map.remove()` (or SDK equivalent); removes the injected `<script>` tag.
  - [x] **[Factory]** Create `apps/web/src/lib/map-adapter-factory.ts`:
    ```typescript
    import type { MapAdapter, MapProvider } from './map-provider';
    import { LeafletMapAdapter } from './adapters/leaflet-map-adapter';
    import { OlaMapAdapter } from './adapters/ola-map-adapter';

    export function createMapAdapter(provider: MapProvider): MapAdapter {
      switch (provider) {
        case 'leaflet': return new LeafletMapAdapter();
        case 'ola':     return new OlaMapAdapter();
        default:        throw new TypeError(`Unknown map provider: ${provider as string}`);
      }
    }
    ```
  - [x] **[Component — refactor]** Update `apps/web/src/components/shared/OrderRouteMap.tsx`:
    - Remove all direct `import L from 'leaflet'` and related Leaflet calls.
    - Remove `buyerIcon` and `riderIcon` `L.divIcon` definitions (moved to `LeafletMapAdapter`).
    - Inside `useEffect`, call `const adapter = createMapAdapter(import.meta.env.VITE_MAP_PROVIDER ?? 'leaflet')`.
    - Call `await adapter.init(node, buyerCoords, 14)`.
    - Call `adapter.addMarker(buyerCoords, 'buyer')`.
    - If `riderCoords` is provided, call `adapter.addMarker(riderCoords, 'rider')`.
    - Return cleanup: `adapter.destroy()`.
    - The `OrderRouteMapProps` type, the `aria-label`, `role="region"`, and all className props are **unchanged**.
  - [x] **[Env]** Add to `.env.example`:
    ```
    VITE_MAP_PROVIDER=leaflet        # 'leaflet' or 'ola'
    VITE_OLA_MAPS_API_KEY=           # Required when VITE_MAP_PROVIDER=ola
    ```
  - [x] Run all updated and new unit tests — **confirm GREEN**.
  - [x] Run `pnpm typecheck` — confirm 0 errors.
  - [x] Run `pnpm lint` — confirm 0 errors.

- [x] **Verification chain:**
  - [x] **Leaflet path (default):** Developer sets `VITE_MAP_PROVIDER=leaflet` (or leaves it unset) and runs `pnpm dev` → `OrderConfirmationPage`, `BookingConfirmationPage`, and `RiderOrdersPage` all render maps using OpenStreetMap tiles exactly as before — zero visual regression, zero consumer code change → ✅.
  - [x] **Ola Maps path:** Developer sets `VITE_MAP_PROVIDER=ola` and `VITE_OLA_MAPS_API_KEY=<key>` and runs `pnpm dev` → the same three pages now render Ola Maps tiles and markers instead of Leaflet/OSM, without any change to the consumer components → ✅.
  - [x] **Missing key guard:** Developer sets `VITE_MAP_PROVIDER=ola` but leaves `VITE_OLA_MAPS_API_KEY` empty → the map container renders an error message `"Map could not be loaded — API key missing"` (non-fatal, no crash) → ✅.

---

### 5.6.3 — Map UX Fixes & Ola Maps Address Picker

**Root cause / Goal:**
Four distinct issues were identified after Sessions 16–20:

1. **Scroll propagation bug:** On the buyer's order-confirmation page and the checkout address step, scrolling the mouse wheel over the map also scrolls the underlying page. The map container has a `wheel` event listener with `e.preventDefault()`, but when the Ola Maps SDK is active its own internal scroll handlers do not always stop the event from bubbling to the page scroll container, so both zoom and page scroll happen simultaneously.

2. **Rider icon missing for OUT_FOR_DELIVERY orders:** On `OrderConfirmationPage`, `riderLocation` is initialised to `null` and is only populated when a live `rider_location_update` Socket.IO event arrives. If a buyer opens the page mid-delivery (after the rider has been out for a while), no socket event fires for the current position and the map shows "Waiting for rider GPS updates…" indefinitely. The `RiderLocation` table in the database holds the most-recent GPS fix, but there is no `GET /api/v1/rider/location/:orderId` endpoint to fetch it on page load.

3. **Lag before route line appears:** When an order is `OUT_FOR_DELIVERY`, the map mounts and immediately fires `_drawRoute()`. This makes a network call to `https://api.olamaps.io/routing/v1/directions`, which can take 1–3 seconds. Nothing is drawn during that wait — the map shows two markers on a blank tile background. Both the buyer and rider see an empty map with no route indicator. The fix is to draw a curved dotted placeholder arrow immediately, then replace it with the real road route once the API responds.

4. **Leaflet-only address picker:** `AddressMapPicker.tsx` is built on Leaflet/OpenStreetMap. It is used in three places: `CheckoutPage.tsx`, `SavedAddressesPage.tsx`, and `BookingTimeslotPage.tsx`. All three must be migrated to an Ola Maps–powered picker that: (a) defaults to Mussoorie/Dehradun, (b) shows the custom `buyer.png` marker, (c) lets the buyer search by POI name via a small Ola Maps Autocomplete input above the map, and (d) continues to save the same `lat`/`lng` data to the backend.

**Fix / Approach (one subsection per issue):**

#### A — Scroll Propagation Fix
- In `OrderRouteMap.tsx`, replace the unconditional `e.preventDefault()` wheel handler with hover-state `mouseenter`/`mouseleave` listeners that call the adapter's `enableScrollZoom()` and `disableScrollZoom()` methods.
- Add `enableScrollZoom()` and `disableScrollZoom()` to the `MapAdapter` interface in `map-provider.ts`.
- Implement them in `LeafletMapAdapter` using `this._map.scrollWheelZoom.enable()` / `.disable()`.
- Implement them in `OlaMapAdapter` by toggling the Ola Maps SDK's scroll-zoom option (or intercepting the wheel event only when hover state is active).
- Apply the same fix to the new `OlaAddressMapPicker` component (section D).

#### B — Rider Icon / Last-Known Location Fix
- Add `GET /api/v1/rider/location/:orderId` as a **buyer-authenticated** endpoint that reads the `RiderLocation` row associated with the rider assigned to that order.
- On `OrderConfirmationPage`, if `order.status === 'OUT_FOR_DELIVERY'`, make an initial REST fetch to this endpoint on mount to seed `riderLocation` before any Socket.IO events arrive.

#### C — Route Lag: Curved Dotted Placeholder
- In both `LeafletMapAdapter._drawRoute()` and `OlaMapAdapter._drawRoute()`, draw a **curved dotted line with an arrowhead** between rider and buyer coordinates immediately (no API call needed — this is computed purely from the two coordinate points using a bezier midpoint offset).
- Add a `data-testid="route-calculating-note"` element below the map container in `OrderRouteMap.tsx` with the text "Calculating route…" while the API call is in-flight.
- Once `fetchOlaRoute()` resolves successfully, replace the dotted line with the solid green road-aligned polyline and remove the note.
- If `fetchOlaRoute()` rejects, keep the dotted line as the permanent fallback (no note).

#### D — Ola Maps Address Picker
- Create a new component `OlaAddressMapPicker.tsx` in `apps/web/src/components/buyer/` with the same props interface as the existing `AddressMapPicker` (`center`, `onCoordinatesChange`, `className`, `zoom`).
- The component renders: (1) a small search `<input>` above the map that calls the Ola Maps Autocomplete API (`https://api.olamaps.io/places/v1/autocomplete?input=<term>&api_key=<key>&location=30.4598,78.0664&radius=80000`) debounced at 600ms; (2) a dropdown of up to 5 suggestions; (3) an Ola Maps map container defaulted to `{ lat: 30.4598, lng: 78.0664 }` (Mussoorie town centre) at zoom 13; (4) a draggable `buyer.png` marker at the selected position.
- When a suggestion is selected, call the Ola Maps Geocode API (`https://api.olamaps.io/places/v1/geocode?address=<place_id>&api_key=<key>`) to resolve exact coordinates, then pan the map and move the marker.
- When the user drags the marker, fire `onCoordinatesChange` with the new position.
- On mount, fire `onCoordinatesChange` with the default center so the parent always has a valid coordinate even before the user interacts.
- Map bounds are not hard-locked (Ola Maps doesn't offer a simple maxBounds API), but the default center and zoom 13 ensure the user starts in Mussoorie/Dehradun. The search autocomplete is biased to a 80 km radius around Mussoorie so irrelevant results from other cities are ranked below local results.
- Replace the `AddressMapPicker` import with `OlaAddressMapPicker` in `CheckoutPage.tsx`, `SavedAddressesPage.tsx`, and `BookingTimeslotPage.tsx`. The `MUSSOORIE_AREA_CENTER` constant is re-exported from the new file so callers need no change beyond the import path.

---

#### A — Scroll Propagation Fix

- [x] **RED — Integration (N/A):**
  - *N/A: Scroll propagation is a pure browser-event / frontend concern. No backend endpoint changes are required.*

- [x] **RED — Unit / Component (`OrderRouteMap.test.tsx` — update existing):**
  - [x] Test: render `<OrderRouteMap buyerCoords={...} />` in a JSDOM environment; dispatch a `wheel` event on the map container div **before** a `mouseenter` event — assert that `e.defaultPrevented` is `false` (page scroll is allowed when cursor is outside the map).
  - [x] Test: dispatch `mouseenter` on the map container, then dispatch a `wheel` event — assert that `e.defaultPrevented` is `true` (scroll zoom is captured; page does not scroll).
  - [x] Test: dispatch `mouseleave` followed by a `wheel` event — assert that `e.defaultPrevented` is `false` again.
  - [x] **Run — confirm RED (current implementation always calls `e.preventDefault()` regardless of hover state, so the first test will fail).**

- [x] **GREEN — Frontend (MapAdapter interface → both Adapters → OrderRouteMap component):**
  - [x] [Types] In `map-provider.ts`, add `enableScrollZoom(): void` and `disableScrollZoom(): void` to the `MapAdapter` interface.
  - [x] [Adapter] In `leaflet-map-adapter.ts`, implement `enableScrollZoom()` as `this._map?.scrollWheelZoom.enable()` and `disableScrollZoom()` as `this._map?.scrollWheelZoom.disable()`. Set `scrollWheelZoom: false` in the Leaflet map constructor options (scroll zoom starts disabled; only enabled on hover).
  - [x] [Adapter] In `ola-map-adapter.ts`, implement `enableScrollZoom()` and `disableScrollZoom()` by maintaining a private `_scrollEnabled` boolean and conditionally calling `e.preventDefault()` inside the adapter's internal wheel listener.
  - [x] [Component] In `OrderRouteMap.tsx`, remove the current unconditional `handleWheel` listener. Replace with `mouseenter` → `adapter.enableScrollZoom()` and `mouseleave` → `adapter.disableScrollZoom()` listeners on the container node. Clean up both listeners in the return cleanup function.
  - [x] Run unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] Buyer opens the order confirmation page → scrolls with the mouse wheel anywhere on the page (cursor outside map) → page scrolls normally, map does not zoom → buyer moves cursor onto the map → scrolls wheel → map zooms in/out, page does not scroll → buyer moves cursor off the map → scrolls → page scrolls again → ✅ Done.

---

#### B — Rider Icon / Last-Known Location Fix

- [x] **RED — Integration (`rider.location.test.ts` — add new test cases to existing file):**
  - [x] Test setup: seed a `DeliveryRider`, an `Order` with `status: OUT_FOR_DELIVERY` and `riderId` set to the seeded rider, and a `RiderLocation` row `{ riderId, lat: 30.4600, lng: 78.0680, updatedAt: now }`.
  - [x] Test: `GET /api/v1/orders/:orderId/rider-location` with a valid BUYER JWT (the buyer who owns that order) → HTTP 200; response shape `{ success: true, data: { lat: "30.46", lng: "78.068", updatedAt: "<iso-string>" } }`.
  - [x] Test: `GET /api/v1/orders/:orderId/rider-location` where the order status is `PREPARING` (rider not yet dispatched) → HTTP 200; response `{ success: true, data: null }` (null means no location available yet — not a 404).
  - [x] Test: `GET /api/v1/orders/:orderId/rider-location` with a BUYER JWT for a different buyer (not the owner of the order) → HTTP 403 `FORBIDDEN`.
  - [x] Test: `GET /api/v1/orders/:orderId/rider-location` with no JWT → HTTP 401 `UNAUTHORIZED`.
  - [x] **Run — confirm RED (the endpoint does not exist; returns 404 today).**

- [x] **GREEN — Backend (Repository → Service → Controller):**
  - [x] [Repository] In `rider.repository.ts`, add `getLocationByOrderId(orderId: string): Promise<{ lat: string; lng: string; updatedAt: Date } | null>`. Implementation: `prisma.riderLocation.findFirst({ where: { rider: { orders: { some: { id: orderId } } } }, select: { lat: true, lng: true, updatedAt: true } })`. Convert `Decimal` lat/lng to string in the return value.
  - [x] [Service] In `rider-location.service.ts`, add `getLastKnownLocationForOrder(orderId: string): Promise<{ lat: string; lng: string; updatedAt: string } | null>`. Calls `riderRepository.getLocationByOrderId(orderId)` and formats `updatedAt` to ISO string.
  - [x] [Controller] In `rider.controller.ts`, add route `GET /api/v1/orders/:orderId/rider-location` behind `requireAuth` + `requireRole(['BUYER'])`. Handler: verifies the order belongs to the requesting buyer (query `prisma.order.findFirst({ where: { id: orderId, userId: request.user.userId } })`), then calls `deps.riderLocationService.getLastKnownLocationForOrder(orderId)`. Returns `{ success: true, data: result }` where `result` is `null` or the location object.
  - [x] [Routes] Register the new route in `routes.ts` alongside existing rider routes. No new deps object changes needed — `riderLocationService` is already injected.
  - [x] Run integration tests — **confirm GREEN**.

- [x] **RED — Unit / Component (`OrderConfirmationPage.state.test.tsx` — add new test cases):**
  - [x] Test: when `order.status === 'OUT_FOR_DELIVERY'` and the component mounts, it calls `GET /api/v1/orders/:orderId/rider-location`; mock returns `{ lat: "30.46", lng: "78.068", updatedAt: "..." }` → assert that `data-testid="rider-location-display"` appears in the DOM with text containing `"30.46"` (not "Waiting for rider GPS updates…").
  - [x] Test: when `GET /api/v1/orders/:orderId/rider-location` returns `{ data: null }`, the component still shows "Waiting for rider GPS updates…" and does NOT show `data-testid="rider-location-display"`.
  - [x] Test: when `order.status === 'PREPARING'`, `GET /api/v1/orders/:orderId/rider-location` is NOT called (no unnecessary requests when order is not yet out for delivery).
  - [x] **Run — confirm RED (no initial fetch is made today; component relies solely on socket events).**

- [x] **GREEN — Frontend (Types → Component):**
  - [x] [Component] In `OrderConfirmationPage.tsx`, add a `useEffect` that fires only when `order.status === 'OUT_FOR_DELIVERY'` and `riderLocation === null`. Inside the effect, call `api.get<{ success: boolean; data: { lat: string; lng: string } | null }>('/api/v1/orders/${id}/rider-location')`. If `data` is non-null, call `setRiderLocation({ lat: Number(data.lat), lng: Number(data.lng) })`. The effect runs once on mount when status is OUT_FOR_DELIVERY.
  - [x] Run unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] Rider marks order OUT_FOR_DELIVERY and GPS updates are pushed → Rider moves 2 km → Buyer opens the order page 5 minutes later → On mount, the page fetches last-known location from the DB → Rider's `buyer.png` marker appears on the map immediately without waiting for the next GPS push → New GPS updates continue to move the marker via Socket.IO → ✅ Done.

---

#### C — Route Lag: Curved Dotted Placeholder Line

- [x] **RED — Integration (N/A):**
  - *N/A: The dotted placeholder line is a pure frontend rendering concern. No backend endpoint or schema changes are required.*

- [x] **RED — Unit / Component (`leaflet-map-adapter.test.ts` and `ola-map-adapter.test.ts` — update existing):**
  - [x] Test (`leaflet-map-adapter.test.ts`): after calling `adapter.addMarker(riderCoords, 'rider')` when a buyer marker already exists, assert that a **dotted polyline** is added to the map immediately (before `fetchOlaRoute` resolves). The dotted polyline must have `dashArray` property set (e.g. `"6 8"`) and `color` set to `"#1d3d2f"`.
  - [x] Test (`leaflet-map-adapter.test.ts`): after `fetchOlaRoute` mock resolves, assert the dotted polyline is removed and a **solid polyline** is added with `dashArray` undefined/null.
  - [x] Test (`ola-map-adapter.test.ts`): after both markers are added, assert the map's `addLayer` has been called with a layer whose `paint["line-dasharray"]` is defined (dotted placeholder) before the routing API resolves.
  - [x] Test (`ola-map-adapter.test.ts`): after `fetchOlaRoute` mock resolves, assert `addLayer` is called a second time (or `setData` is called on the existing source) with a `paint` that has NO `line-dasharray` (solid line).
  - [x] Test (`OrderRouteMap.test.tsx`): when `riderCoords` prop is provided and the routing fetch is pending, the component renders an element with `data-testid="route-calculating-note"` containing the text `"Calculating route…"`.
  - [x] Test (`OrderRouteMap.test.tsx`): once the mock routing fetch resolves, `data-testid="route-calculating-note"` is removed from the DOM.
  - [x] **Run — confirm RED (no placeholder line exists today; `data-testid="route-calculating-note"` does not exist in the component).**

- [x] **GREEN — Frontend (Adapters → Component):**
  - [x] [MapAdapter interface] In `map-provider.ts`, add `isRouteCalculating: boolean` as a readable property on the `MapAdapter` interface (or expose via a callback `onRouteStatusChange(calculating: boolean): void`). Use the callback approach: add `setRouteStatusCallback(cb: (calculating: boolean) => void): void` to the interface.
  - [x] [LeafletMapAdapter] In `_drawRoute()`:
    - **Before** calling `fetchOlaRoute`, draw a dotted curved polyline as a placeholder: compute a bezier midpoint `mid = { lat: (rider.lat + buyer.lat)/2 + offsetFactor, lng: (rider.lng + buyer.lng)/2 }` where `offsetFactor` is `Math.abs(rider.lat - buyer.lat) * 0.3` (creates curvature perpendicular to the line). Draw `L.polyline([riderCoords, mid, buyerCoords], { color: '#1d3d2f', weight: 3, opacity: 0.7, dashArray: '6 8' })` and store it as `this._placeholderLine`. Fire `this._routeStatusCallback?.(true)`.
    - **After** `fetchOlaRoute` resolves: remove `this._placeholderLine`, draw the solid route, and fire `this._routeStatusCallback?.(false)`.
    - **If** `fetchOlaRoute` rejects: keep `this._placeholderLine` (no solid route), fire `this._routeStatusCallback?.(false)`.
  - [x] [OlaMapAdapter] Apply the same pattern in `_drawRoute()` using a GeoJSON LineString with `"line-dasharray": [2, 4]` paint property for the placeholder, and replacing it with a solid layer once the route resolves.
  - [x] [OrderRouteMap.tsx] Call `adapter.setRouteStatusCallback((calculating) => setIsRouteCalculating(calculating))`. Add `const [isRouteCalculating, setIsRouteCalculating] = useState(false)`. Below the map container div (inside the outer wrapper), render `{isRouteCalculating && riderCoords && <p data-testid="route-calculating-note" className="text-xs text-center text-gorola-slate/70 mt-1 italic animate-pulse">Calculating route…</p>}`.
  - [x] Run unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] Order goes OUT_FOR_DELIVERY → Buyer opens order confirmation page → Map appears with buyer marker and rider marker → A **curved dotted green line** is visible between them immediately, with "Calculating route…" text below the map → 1–3 seconds later, the dotted line is replaced by a solid road-aligned green polyline and the note disappears → Rider opens the detail modal and taps "Show Map" → Same dotted-line-then-solid-route sequence plays → ✅ Done.

---

#### D — Ola Maps Address Picker (Checkout + Saved Addresses + Booking)

- [x] **RED — Integration (N/A):**
  - *N/A: The address picker is a frontend map widget. The backend endpoints (`POST /api/v1/addresses`, `PUT /api/v1/addresses/:id`, `POST /api/v1/orders`) already accept `lat`/`lng` in the request body and their contracts do not change.*

- [x] **RED — Unit / Component (`OlaAddressMapPicker.test.tsx` — new file at `apps/web/src/components/buyer/OlaAddressMapPicker.test.tsx`):**
  - [x] Test: renders a `<input data-testid="location-search-input">` element and a map container `<div aria-label="Delivery location map">`.
  - [x] Test: on mount, calls `onCoordinatesChange` immediately with the default center `{ lat: 30.4598, lng: 78.0664 }`.
  - [x] Test: when the user types `"hotel pad"` into `data-testid="location-search-input"` and waits 600ms (fake timers), calls `fetch` with a URL containing `"https://api.olamaps.io/places/v1/autocomplete"` and the query param `input=hotel+pad`.
  - [x] Test: when the autocomplete mock returns `[{ description: "Hotel Padmini, Mussoorie", place_id: "abc123" }]`, a dropdown renders with `data-testid="suggestion-0"` containing the text `"Hotel Padmini, Mussoorie"`.
  - [x] Test: clicking `data-testid="suggestion-0"` calls `fetch` with a URL containing `"https://api.olamaps.io/places/v1/geocode"` and `"abc123"`. When the geocode mock returns `{ lat: 30.4610, lng: 78.0690 }`, calls `onCoordinatesChange({ lat: 30.4610, lng: 78.0690 })` and clears the dropdown.
  - [x] Test: when `VITE_OLA_MAPS_API_KEY` is not set, renders an error state with `data-testid="map-api-key-missing"` and the text `"Map could not be loaded — API key missing"` (mirrors `OrderRouteMap` error handling).
  - [x] **Run — confirm RED (the `OlaAddressMapPicker.tsx` file does not exist yet).**

- [x] **GREEN — Frontend (New Component → Update three consumer pages → Update existing tests):**
  - [x] [New Component] Create `apps/web/src/components/buyer/OlaAddressMapPicker.tsx`:
    - Props: `center: MapCoordinates`, `onCoordinatesChange: (coords: MapCoordinates) => void`, `className?: string`, `zoom?: number`.
    - Re-export `MUSSOORIE_AREA_CENTER = { lat: 30.4598, lng: 78.0664 }` and `MapCoordinates` type from this file (so existing consumer import paths only need the filename changed).
    - Internal state: `searchQuery: string`, `suggestions: { description: string; place_id: string }[]`, `isSearching: boolean`, `mapError: string | null`.
    - Autocomplete: debounce `searchQuery` changes by 600ms, then `GET https://api.olamaps.io/places/v1/autocomplete?input=<term>&api_key=<key>&location=30.4598,78.0664&radius=80000`. Populate `suggestions` from `response.predictions`.
    - Geocode on suggestion click: `GET https://api.olamaps.io/places/v1/geocode?address=<place_id>&api_key=<key>`. Extract `lat`/`lng` from `response.geocodingResults[0].geometry.location`. Call `onCoordinatesChange({ lat, lng })`, update marker position, pan map.
    - Ola Maps map init: use the same `OlaMapAdapter` class to init the map, OR inline the SDK call directly since this component has a simpler requirement (single draggable marker, no route drawing). Use inline SDK call for simplicity to avoid coupling to the route-drawing adapter.
    - Draggable marker: Use `buyer.png` image (import from `../../assets/buyer.png`). On `dragend`, read new coords and call `onCoordinatesChange`.
    - Scroll zoom: Apply the same `mouseenter`/`mouseleave` hover-activation pattern from Fix A.
    - On mount: call `onCoordinatesChange(center)` immediately so parent always has valid coords.
    - Error state: if `VITE_OLA_MAPS_API_KEY` is not set, render `<div data-testid="map-api-key-missing">Map could not be loaded — API key missing</div>`.
  - [x] [CheckoutPage.tsx] Replace `import { AddressMapPicker, type MapCoordinates, MUSSOORIE_AREA_CENTER } from "@/components/buyer/AddressMapPicker"` with `import { OlaAddressMapPicker as AddressMapPicker, type MapCoordinates, MUSSOORIE_AREA_CENTER } from "@/components/buyer/OlaAddressMapPicker"`. Also remove the `<p>Tiles © OpenStreetMap</p>` attribution text block that appears after the map.
  - [x] [SavedAddressesPage.tsx] Same import alias swap. The component usage `<AddressMapPicker center={...} onCoordinatesChange={...} />` is unchanged — the alias handles it.
  - [x] [BookingTimeslotPage.tsx] Same import alias swap.
  - [x] [CheckoutPage.test.tsx] Update the `vi.mock("@/components/buyer/AddressMapPicker", ...)` block to mock `"@/components/buyer/OlaAddressMapPicker"` instead, keeping the same mock component shape.
  - [x] [SavedAddressesPage.test.tsx] Same mock path update.
  - [x] [BookingTimeslotPage.test.tsx] Same mock path update if `AddressMapPicker` is mocked there (grep to confirm).
  - [x] [AddressMapPicker.tsx] Keep the old file intact — do NOT delete it. Add a JSDoc deprecation comment: `/** @deprecated Use OlaAddressMapPicker instead. Retained for Leaflet fallback if needed. */`.
  - [x] Run `pnpm lint && pnpm typecheck` — confirm 0 errors.
  - [x] Run all unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] **Checkout (quick commerce):** Buyer selects "Deliver to new location" → sees Ola Maps centred on Mussoorie with buyer marker → types "hotel pad" in the search box → dropdown shows "Hotel Padmini, Mussoorie" → clicks it → map zooms to Hotel Padmini, marker moves → buyer drags marker to exact door → `lat`/`lng` captured → places order → order is created in DB with correct `deliveryLat` / `deliveryLng` → ✅ Done.
  - [x] **Saved Addresses:** Buyer opens Profile → Saved Addresses → Add New → dialog opens with Ola Maps picker → searches "Library Bazaar" → map zooms there → marker placed → buyer saves → address stored in DB with `lat`/`lng` → ✅ Done.
  - [x] **Booking commerce:** Buyer enters booking timeslot page → location section shows Ola Maps picker → searches landmark → selects → coordinates captured → booking placed with delivery coordinates → ✅ Done.

---

### 5.7 — Rider Earnings Page

**Root cause / Goal:**
Riders have no way to see how much they have earned — either for a single delivery, for today, or historically. The `Order` table already holds the `deliveryFee` field (the amount charged to the buyer for delivery), which is the source of truth for a rider's per-delivery earning. There is no `RiderEarning` model in the schema, no backend service to aggregate earnings by period, no API endpoint, and no frontend page. Riders need this to trust the platform and track their income without calling the store owner.

**Fix / Approach:**
1. [Schema] Add a `RiderEarning` model that creates one row per `DELIVERED` order, storing `riderId`, `orderId`, `amount` (the rider's actual payout), `createdAt`. This row is created by the order status update flow (5.3) when status transitions to `DELIVERED`.
2. [Backend] Create `RiderEarningsService` with two methods: `getSummary(riderId)` → aggregated totals for today / this week / this month; `getHistory(riderId, cursor?)` → paginated list of per-delivery records newest-first.
3. [Backend] Expose two new authenticated endpoints: `GET /api/v1/rider/earnings/summary` and `GET /api/v1/rider/earnings/history`.
4. [Frontend] Create `RiderEarningsPage.tsx` at `/rider/earnings`. The tab bar introduced in 5.5's `RiderLayout` gets an "Earnings" tab added alongside "Orders" and "Account".

---

### ⚙️ Earnings Architecture — Design Decisions (READ BEFORE BUILDING)

> These decisions ensure the current per-order model can migrate to a per-KM model without any structural changes to the DB or service layer. They also support configuring what percentage of the delivery charge a rider actually receives.

#### Decision A — Earning Rate Config (per-store override + global fallback)

Riders do **not necessarily receive the full delivery fee** charged to the buyer. The platform operator takes a cut. The percentage of `deliveryFee` passed to the rider is configurable at two levels:

- **Global default** — stored as system setting `RIDER_EARNING_RATE_PCT` (e.g. `"80"` = 80%). Admin sets this in the Admin Panel. Defaults to `"100"` if never set (rider gets full delivery charge).
- **Per-store override** — `Store.riderEarningRatePct Decimal? @db.Decimal(5, 2)`. When set, overrides the global default for that specific store. When `null`, the global setting is used.
- **Who can change it:** Only Admins can set either value. Store owners can **view** their store's effective rate (read-only) but cannot change it.
- **100% = rider gets full delivery fee.** No hard cap is enforced — admin is trusted to set appropriate values.

**Calculation (Phase 5.7 — PER_ORDER model):**
```
effectiveRate = Store.riderEarningRatePct ?? systemSetting(RIDER_EARNING_RATE_PCT) ?? 100
riderAmount   = Order.deliveryFee × (effectiveRate / 100)
```

**Future (Phase X — PER_KM model):**
```
riderAmount = basePay + (distanceKm × ratePerKm)
```

> [!IMPORTANT]
> The `EarningType` flag on every `RiderEarning` row is the audit trail. When you switch models mid-flight, old rows remain labelled `PER_ORDER` and new rows are `PER_KM`. Historical reporting stays accurate regardless of which model is currently active.

#### Decision B — Migration-Safe Schema Fields (add NOW, use later)

Add `distanceKm Decimal?` and `earningType EarningType @default(PER_ORDER)` to `RiderEarning` in this migration. Cost: 0 extra work now. Benefit: zero schema migration needed when switching to per-KM later.

- `distanceKm` = `null` today. When switching to PER_KM: computed from `Order.deliveryLat/Lng` vs store coordinates (both already in DB from Phase 5.4.1).
- `earningType` = `PER_ORDER` today. Change the default to `PER_KM` when the time comes and update the calculator.

#### Decision C — `RiderEarningCalculator` (single swap point for future model change)

All earning computation lives in **one pure function** `calculateRiderEarning(input)` in `rider-earning-calculator.ts`. The rest of the system (service, controller, tests) never knows which model is active — they just call this function and record the output.

```typescript
// apps/api/src/modules/delivery/rider-earning-calculator.ts

import { Decimal } from '@prisma/client/runtime/library';

export type EarningModel = 'PER_ORDER' | 'PER_KM';

export interface EarningInput {
  deliveryFee: Decimal;        // what the buyer was charged
  earningRatePct: Decimal;     // e.g. 80.00 for 80% — resolved by service before calling
  distanceKm?: Decimal;        // null/undefined for PER_ORDER; populated for PER_KM
  model: EarningModel;         // which formula to use
}

export interface EarningOutput {
  amount: Decimal;             // rider's payout (rounded to 2dp)
  earningType: EarningModel;   // recorded verbatim on the RiderEarning row
}

export function calculateRiderEarning(input: EarningInput): EarningOutput {
  if (input.model === 'PER_ORDER') {
    return {
      amount: input.deliveryFee.mul(input.earningRatePct.div(new Decimal(100))).toDecimalPlaces(2),
      earningType: 'PER_ORDER',
    };
  }
  // ── PER_KM model (Phase X — implement when switching) ──────────────────
  // const BASE_PAY = new Decimal(20);
  // const PER_KM_RATE = new Decimal(3);
  // return {
  //   amount: BASE_PAY.add((input.distanceKm ?? new Decimal(0)).mul(PER_KM_RATE)).toDecimalPlaces(2),
  //   earningType: 'PER_KM',
  // };
  throw new Error(`EarningModel '${input.model}' is not yet implemented`);
}
```

---

- [ ] **RED — Integration (`rider.earnings.test.ts`):**
  - [ ] Test setup: seed 1 store with `riderEarningRatePct: null` (uses global default). Seed system setting `RIDER_EARNING_RATE_PCT = "80"`. Seed 1 `DeliveryRider`. Seed 3 `Order` rows all `status: DELIVERED`, `deliveryFee: 50.00`. Seed 3 `RiderEarning` rows with `amount: 40.00` (= 50 × 80%), `earningType: PER_ORDER`, `distanceKm: null` (create rows directly in test seed — do not rely on 5.3 trigger yet).
  - [ ] Test: `GET /api/v1/rider/earnings/summary` with a valid RIDER JWT for that rider → HTTP 200; response shape `{ success: true, data: { today: { count: number, total: string }, thisWeek: { count: number, total: string }, thisMonth: { count: number, total: string } } }`. With 3 deliveries all created today, all three period totals must equal `"120.00"` (3 × ₹40) and count `3`.
  - [ ] Test: `GET /api/v1/rider/earnings/summary` with a BUYER JWT → HTTP 403.
  - [ ] Test: `GET /api/v1/rider/earnings/summary` with a RIDER JWT for a **different** rider who has no earnings → HTTP 200; all totals `"0.00"` and counts `0` (strict rider scope — no cross-rider data leakage).
  - [ ] Test: `GET /api/v1/rider/earnings/history` with a valid RIDER JWT → HTTP 200; response shape `{ success: true, data: { items: [{ id, orderId, amount, earningType, distanceKm, createdAt }], nextCursor: string | null } }`; `items` length is `3`; `amount` on each item is `"40.00"`; `earningType` is `"PER_ORDER"`; `distanceKm` is `null`; items ordered newest-first.
  - [ ] Test: `GET /api/v1/rider/earnings/history?cursor=<cursorFromPreviousResponse>` → returns next page (empty array if no more records); `nextCursor` is `null`.
  - [ ] Test: `GET /api/v1/rider/earnings/history` with a RIDER JWT for a different rider → returns `items: []` (no cross-rider leakage).
  - [ ] **Test — Per-store override:** Seed a second store with `riderEarningRatePct: 100.00`. Seed a `RiderEarning` row for a rider in that store with `amount: 50.00` (= 50 × 100%). Assert that `GET /api/v1/rider/earnings/history` for that rider returns `amount: "50.00"` — not `"40.00"`.
  - [ ] **Run — confirm RED (both endpoints return 404 today).**

- [ ] **RED — Integration (`rider.earnings.trigger.test.ts` — new file):**
  > Verifies that the 5.3 status-update endpoint **automatically** creates a `RiderEarning` row when transitioning to `DELIVERED`, using the correct earning rate.
  - [ ] Test setup: seed store with `riderEarningRatePct: null`. Seed system setting `RIDER_EARNING_RATE_PCT = "75"`. Seed rider + order with `status: OUT_FOR_DELIVERY`, `deliveryFee: 60.00`.
  - [ ] Test: `PUT /api/v1/rider/orders/:id/status` with `{ status: 'DELIVERED' }` (RIDER JWT) → HTTP 200; a `RiderEarning` row now exists in DB with `riderId`, `orderId`, `amount = "45.00"` (= 60 × 75%), `earningType = "PER_ORDER"`, `distanceKm = null`.
  - [ ] Test: repeat `PUT .../status` with `{ status: 'DELIVERED' }` → HTTP 422 `INVALID_STATUS_TRANSITION` (idempotency — no duplicate `RiderEarning` row created; `orderId @unique` enforces this at DB level).
  - [ ] Test: store with `riderEarningRatePct: 90.00` → delivering a ₹60 order creates `RiderEarning.amount = "54.00"` (= 60 × 90%).
  - [ ] Test: if `RiderEarning.createEarning` throws (e.g. simulate DB error), `PUT .../status` still returns HTTP 200 (earning write failure is non-fatal — logged, not surfaced to rider).
  - [ ] **Run — confirm RED (no `RiderEarning` is created by 5.3 today).**

- [ ] **RED — Integration (`admin.rider-earning-config.test.ts` — new file):**
  - [ ] Test: `PUT /api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT` with body `{ value: "85" }` (ADMIN JWT) → HTTP 200; persisted in DB.
  - [ ] Test: `PUT /api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT` with body `{ value: "150" }` → HTTP 200 (no hard cap — admin is trusted).
  - [ ] Test: `PUT /api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT` with body `{ value: "abc" }` → HTTP 400 `VALIDATION_ERROR`.
  - [ ] Test: `PUT /api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT` with STORE_OWNER JWT → HTTP 403.
  - [ ] Test: `PUT /api/v1/admin/stores/:storeId/rider-earning-rate` with body `{ riderEarningRatePct: 100 }` (ADMIN JWT) → HTTP 200; `Store.riderEarningRatePct = 100.00` in DB.
  - [ ] Test: `PUT /api/v1/admin/stores/:storeId/rider-earning-rate` with body `{ riderEarningRatePct: null }` → HTTP 200; `Store.riderEarningRatePct = null` in DB (reverts to global default).
  - [ ] Test: `PUT /api/v1/admin/stores/:storeId/rider-earning-rate` with STORE_OWNER JWT → HTTP 403.
  - [ ] Test: `GET /api/v1/store/settings` (STORE_OWNER JWT) → HTTP 200; response includes `riderEarningRatePct: <number or null>` (read-only field — no write endpoint exposed to store owners).
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Schema → Calculator → Repository → Service → Controller):**

  **Step 1 — Schema**
  - [ ] [Schema] Add `EarningType` enum to `schema.prisma`:
    ```prisma
    enum EarningType {
      PER_ORDER
      PER_KM
    }
    ```
  - [ ] [Schema] Add `RiderEarning` model to `schema.prisma`:
    ```prisma
    model RiderEarning {
      id          String        @id @default(cuid())
      riderId     String
      orderId     String        @unique
      amount      Decimal       @db.Decimal(10, 2)
      earningType EarningType   @default(PER_ORDER)
      distanceKm  Decimal?      @db.Decimal(8, 3)   // null for PER_ORDER; km for PER_KM (future)
      createdAt   DateTime      @default(now())
      rider       DeliveryRider @relation(fields: [riderId], references: [id], onDelete: Restrict)
      order       Order         @relation(fields: [orderId], references: [id], onDelete: Restrict)

      @@index([riderId, createdAt])
    }
    ```
    Also add `earnings RiderEarning[]` back-relation to `DeliveryRider` and `earning RiderEarning?` to `Order`.
  - [ ] [Schema] Add `riderEarningRatePct Decimal? @db.Decimal(5, 2)` to the `Store` model. `null` = use global system setting.
  - [ ] Run: `pnpm --filter @gorola/api prisma migrate dev --name add_rider_earning_and_rate`.

  **Step 2 — Calculator (pure logic, no DB)**
  - [ ] [Calculator] Create `apps/api/src/modules/delivery/rider-earning-calculator.ts` (full spec in Decision C above).
  - [ ] [Unit Tests] Create `src/__tests__/unit/delivery/rider-earning-calculator.test.ts` — write these FIRST (RED), then implement the function:
    - Test: `PER_ORDER`, `deliveryFee=50`, `earningRatePct=80` → `amount="40.00"`.
    - Test: `PER_ORDER`, `deliveryFee=50`, `earningRatePct=100` → `amount="50.00"`.
    - Test: `PER_ORDER`, `deliveryFee=50`, `earningRatePct=0` → `amount="0.00"`.
    - Test: `PER_ORDER`, `deliveryFee=33.33`, `earningRatePct=80` → `amount="26.66"` (rounds to 2dp).
    - Test: unknown `model` value → throws `Error`.

  **Step 3 — Repository**
  - [ ] [Repository] Create `apps/api/src/modules/delivery/rider-earnings.repository.ts`:
    - `createEarning(data: { riderId, orderId, amount: Decimal, earningType: EarningType, distanceKm?: Decimal })` — `prisma.riderEarning.create`.
    - `getSummary(riderId)` — three `prisma.riderEarning.aggregate` calls with `_sum` and `_count`, filtered by `riderId` + `createdAt >= startOfDay/Week/Month` UTC boundaries.
    - `getHistory(riderId, cursor?, take = 20)` — `findMany` with `orderBy: { createdAt: 'desc' }`, cursor-based pagination on `id` field.

  **Step 4 — Service**
  - [ ] [Service] Create `apps/api/src/modules/delivery/rider-earnings.service.ts`:
    - `getSummary(riderId)` — calls repository; formats all `Decimal` totals to `.toFixed(2)` strings.
    - `getHistory(riderId, cursor?)` — calls repository; formats `amount` to string, passes `distanceKm` as string or `null`.
    - `createEarningForDelivery(riderId, orderId, deliveryFee: Decimal, storeId)`:
      1. Fetch `store.riderEarningRatePct` via `StoreRepository.findById(storeId)`.
      2. If `null`, call `systemSettingService.getSettingValue("RIDER_EARNING_RATE_PCT", "100")`.
      3. Call `calculateRiderEarning({ deliveryFee, earningRatePct: new Decimal(resolvedRate), model: 'PER_ORDER' })`.
      4. Call `riderEarningsRepository.createEarning({ riderId, orderId, amount: output.amount, earningType: output.earningType })`.

  **Step 5 — Wire into Status Update (5.3 integration point)**
  - [ ] [Service] In `rider-order.service.ts`, `updateOrderStatus` method: after persisting `DELIVERED` status, call `riderEarningsService.createEarningForDelivery(riderId, orderId, order.deliveryFee, order.storeId)` inside a `try/catch`. A failed earning write must NOT roll back the order status update — log the error and continue.

  **Step 6 — Earnings Endpoints**
  - [ ] [Controller] In `rider.controller.ts`, add behind `requireAuth + requireRole(['RIDER'])`:
    - `GET /api/v1/rider/earnings/summary` → `deps.riderEarningsService.getSummary(riderId)`.
    - `GET /api/v1/rider/earnings/history` → optional query param `cursor`; calls `deps.riderEarningsService.getHistory(riderId, cursor)`.
  - [ ] [Routes] Add `riderEarningsService` to the `deps` object in `routes.ts`. Instantiate repository + service in server bootstrap.

  **Step 7 — Admin Config Endpoints**
  - [ ] [Controller] In `admin.controller.ts`, add (ADMIN role only):
    - `PUT /api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT` — validate body `{ value: string }` is parseable as a non-negative number (Zod: `z.string().regex(/^\d+(\.\d+)?$/)`); calls `systemSettingService.setSetting("RIDER_EARNING_RATE_PCT", value)`.
    - `PUT /api/v1/admin/stores/:storeId/rider-earning-rate` — validate body `{ riderEarningRatePct: z.number().nullable() }`; calls `StoreRepository.updateRiderEarningRate(storeId, pct)`.
  - [ ] [Repository] Add `updateRiderEarningRate(storeId, pct: Decimal | null)` to `store.repository.ts`.
  - [ ] [Controller] In store owner settings endpoint (`GET /api/v1/store/settings`): include `riderEarningRatePct` (number or null) in the response — read-only.
  - [ ] Run all integration tests — **confirm GREEN.**

- [ ] **RED — Unit / Component (`RiderEarningsPage.test.tsx`):**
  - [ ] Test: fetches `GET /api/v1/rider/earnings/summary`; while loading, renders skeleton with `data-testid="earnings-summary-loading"`.
  - [ ] Test: on success, renders three summary cards with `data-testid="summary-today"`, `data-testid="summary-week"`, `data-testid="summary-month"`; today card shows `"₹120.00"` when mocked total is `"120.00"`.
  - [ ] Test: fetches `GET /api/v1/rider/earnings/history`; renders list where each row has `data-testid="earning-row"`; first row shows `"₹40.00"`.
  - [ ] Test: each earning row shows earning type label — `"Per Order"` for `PER_ORDER`, `"Per KM"` for `PER_KM`.
  - [ ] Test: when `nextCursor` is non-null, a "Load more" button with `id="earnings-load-more"` is rendered; clicking calls history endpoint with cursor as query param.
  - [ ] Test: when `nextCursor` is `null`, "Load more" button is absent.
  - [ ] Test: when history list is empty, renders `data-testid="earnings-empty-state"` with text "No deliveries yet".
  - [ ] **Run — confirm RED (page file does not exist yet).**

- [ ] **RED — Unit / Component (`RiderLayout.test.tsx` — additional tab assertion):**
  - [ ] Test: bottom tab bar renders "Earnings" tab with `data-testid="tab-earnings"` navigating to `/rider/earnings`.
  - [ ] **Run — confirm RED.**

- [ ] **RED — Unit / Component (Admin earning config UI tests):**
  - [ ] Test: admin system settings page has `data-testid="rider-earning-rate-global"` input showing current `RIDER_EARNING_RATE_PCT` value.
  - [ ] Test: editing and submitting calls `PUT /api/v1/admin/system-settings/RIDER_EARNING_RATE_PCT` with new value.
  - [ ] Test: admin store edit page has `data-testid="store-rider-earning-rate-input"`; saving a number calls `PUT /api/v1/admin/stores/:storeId/rider-earning-rate` with `{ riderEarningRatePct: <number> }`; clearing and saving sends `{ riderEarningRatePct: null }`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Types → Components → Routes):**
  - [ ] [Types] In `RiderEarningsPage.tsx`:
    ```typescript
    type EarningsPeriod = { count: number; total: string };
    type EarningsSummary = { today: EarningsPeriod; thisWeek: EarningsPeriod; thisMonth: EarningsPeriod };
    type EarningRecord = { id: string; orderId: string; amount: string; earningType: 'PER_ORDER' | 'PER_KM'; distanceKm: string | null; createdAt: string };
    ```
  - [ ] [Component] Create `apps/web/src/pages/rider/RiderEarningsPage.tsx`:
    - Fetch summary via `useQuery(['riderEarningsSummary'])`.
    - Fetch history via `useInfiniteQuery(['riderEarningsHistory'])` with cursor-based pagination; `getNextPageParam` returns `data.data.nextCursor ?? undefined`.
    - Render three summary cards (today / this week / this month) with rupee amounts and delivery counts.
    - Render flat list of `EarningRecord` rows: order short-ID, formatted `"₹<amount>"`, `earningType` label (`"Per Order"` / `"Per KM"`), and relative time.
    - Render `id="earnings-load-more"` button only when `hasNextPage`.
- [ ] [Admin UI] In the admin system settings page, add a "Default Rider Earning Rate (%)" input with `data-testid="rider-earning-rate-global"`, wired to `RIDER_EARNING_RATE_PCT` setting. Display note: "Applied when a store has no override. 100 = rider receives full delivery charge."
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Admin sets global `RIDER_EARNING_RATE_PCT = 80`. Store A has no override (`riderEarningRatePct = null`). Store B has `riderEarningRatePct = 100`.
  - [ ] Rider in Store A delivers order with `deliveryFee = ₹50` → `RiderEarning.amount = ₹40.00`, `earningType = PER_ORDER`, `distanceKm = null` → ✅.
  - [ ] Rider in Store B delivers order with `deliveryFee = ₹50` → `RiderEarning.amount = ₹50.00` (full charge, 100% rate) → ✅.
  - [ ] Rider logs in → taps "Earnings" tab → three summary cards show correct period totals → scrollable history list shows each delivery with ₹ amount and "Per Order" label → taps "Load more" → next page appends → ✅.
  - [ ] Admin opens Store A's edit page → sets `riderEarningRatePct = 100` → next delivery from Store A earns full ₹50 → ✅.
  - [ ] Admin clears Store A's override (sets to null/blank) → delivery reverts to 80% global rate → `RiderEarning.amount = ₹40.00` → ✅.

---

### 5.7.5 — Order Lifecycle Refactoring (Rider Acceptance, Store Dispatch, Map, Names & Logs)

**Root cause / Goal:**
The previous order lifecycle allowed overlapping operations and exposed security/operational loopholes:
1. Both store owners and riders had the option to mark an order as `DELIVERED`. This could lead to premature completions from the store dashboard, leaving riders without actual delivery control.
2. Riders could directly mark an order as `OUT_FOR_DELIVERY` (dispatched) without confirmation that the store owner had handed them the items.
3. Multiple riders in the same store could view and attempt to fulfill the same order at the same time, leading to coordination chaos.
4. Store owners had no live tracking view to see where the rider was once the order was dispatched.
5. Store owners and riders saw only masked phone numbers on cards, with no customer names, showing generic placeholders even when the user had provided a profile name.

**Fix / Approach:**
1. [Schema] Add a nullable `riderId String?` to the `Order` model in the database schema.
2. [Backend - Accept] Create `PUT /api/v1/rider/orders/:id/accept` endpoint (RIDER only). Sets `order.riderId = currentRiderId` and creates an audit entry in `OrderStatusHistory` with `status = PREPARING` and `note = "Order accepted by rider: <Rider Name>"`.
3. [Backend - Lockouts] Block riders from dispatching (`PREPARING -> OUT_FOR_DELIVERY` is forbidden for RIDER). Block store owners from delivering (`OUT_FOR_DELIVERY -> DELIVERED` is forbidden for STORE_OWNER). Store owners can only dispatch if `riderId !== null`.
4. [Backend - Map & Name] Allow `STORE_OWNER` role to access `GET /api/v1/orders/:orderId/rider-location` and to join `order:${orderId}` socket rooms. Expose `buyerName` (`user.name`) to both store and rider order lists.
5. [Frontend - Store Map] In `StoreOrdersPage.tsx`, when an order is `OUT_FOR_DELIVERY`, fetch the rider's initial location and use `useOrderSocket` to update the `<OrderRouteMap />` in the order details drawer.
6. [Frontend - Rider Accept] In `RiderOrdersPage.tsx`, replace the dispatch button with an "Accept Order" action for `PREPARING` orders. Filter the active orders feed so riders only see preparing orders where `riderId === null` or `riderId === currentRiderId`.

---

- [ ] **RED — Integration (`rider.lifecycle.test.ts` — new file):**
  - [ ] Test: `PUT /api/v1/rider/orders/:orderId/accept` (RIDER JWT) updates `Order.riderId` to the current rider ID and adds a history entry with `status: PREPARING`, `changedBy: "rider:<id>"`, and `note: "Order accepted by rider: Test Rider"`.
  - [ ] Test: `PUT /api/v1/rider/orders/:orderId/accept` when order already has an assigned rider (`riderId !== null`) → HTTP 422 `RIDER_ALREADY_ASSIGNED`.
  - [ ] Test: `PUT /api/v1/rider/orders/:orderId/status` with payload `{ status: 'OUT_FOR_DELIVERY' }` (RIDER JWT) → HTTP 422 `INVALID_STATUS_TRANSITION` (riders cannot dispatch).
  - [ ] Test: `PUT /api/v1/store/orders/:orderId/status` with payload `{ status: 'OUT_FOR_DELIVERY' }` (STORE_OWNER JWT) when `order.riderId === null` → HTTP 422 `NO_RIDER_ASSIGNED`.
  - [ ] Test: `PUT /api/v1/store/orders/:orderId/status` with payload `{ status: 'DELIVERED' }` (STORE_OWNER JWT) → HTTP 422 `INVALID_STATUS_TRANSITION` (store owners cannot deliver).
  - [ ] Test: `GET /api/v1/orders/:orderId/rider-location` with STORE_OWNER JWT for the owner of that store → HTTP 200 (returns last-known location).
  - [ ] Test: `GET /api/v1/orders/:orderId/rider-location` with STORE_OWNER JWT from a different store → HTTP 403 `FORBIDDEN`.
  - [ ] **Run — confirm RED (accept endpoint returns 404, status validations don't exist yet, location endpoint returns 403).**

- [ ] **RED — Integration & E2E Test Review (Update existing tests that are affected):**
  - [ ] **Rider Status Integration Tests (`rider.status.test.ts`):** Update `rider.status.test.ts` tests that call `PUT /api/v1/rider/orders/:id/status` with `OUT_FOR_DELIVERY`. Change the test sequence to first call `PUT .../accept` (RIDER), then call the store owner endpoint `PUT /api/v1/store/orders/:id/status` with `OUT_FOR_DELIVERY` (using a seeded store owner token), and finally call the rider endpoint with `DELIVERED`.
  - [ ] **Store Owner Status Integration Tests (`store-owner.orders.test.ts`):** If any tests transition `OUT_FOR_DELIVERY -> DELIVERED` as store owner, delete them or update them to assert a `422` error.
  - [ ] **Run tests — confirm affected integration tests are failing (RED).**

- [ ] **GREEN — Backend (Schema → Repository → Service → Controller → Socket):**
  - [ ] [Schema] Add `riderId String?` and `rider DeliveryRider? @relation(...)` to the `Order` model in `schema.prisma`. Run `pnpm --filter @gorola/api prisma migrate dev --name add_rider_to_order`. Apply to test DB.
  - [ ] [Repository] In `order.repository.ts`, include `rider` in `orderRelationsInclude` to automatically retrieve the rider details. Update `OrderRepository.updateStatus` to allow setting `riderId` or passing it during status updates.
  - [ ] [Service] In `StoreOwnerService.updateOrderStatus` (in `store-owner.service.ts`), update `VALID_TRANSITIONS` to remove `DELIVERED` from `OUT_FOR_DELIVERY`. Add validation: if `newStatus === "OUT_FOR_DELIVERY"`, assert that `order.riderId !== null`, otherwise throw an `AppError` with code `NO_RIDER_ASSIGNED` (422).
  - [ ] [Service] In `RiderOrderService.updateOrderStatus` (in `rider-order.service.ts`), update `VALID_TRANSITIONS` to remove `OUT_FOR_DELIVERY` from `PREPARING` and `APPROVED`. Riders can now only transition `OUT_FOR_DELIVERY -> DELIVERED`.
  - [ ] [Service] In `RiderOrderService`, implement `acceptOrder(storeIds: string[], orderId: string, riderId: string, riderName: string)`:
    - Verifies order is in `PREPARING` status and belongs to `storeIds`.
    - Throws if `order.riderId !== null`.
    - Updates order in DB setting `order.riderId = riderId`.
    - Creates an entry in `OrderStatusHistory` with `status: "PREPARING"`, `changedBy: "rider:${riderId}"`, and `note: "Order accepted by rider: ${riderName}"`.
    - Emits `order_accepted` Socket.IO event to all riders in the store room.
  - [ ] [Controller] In `rider.controller.ts`, add route `PUT /api/v1/rider/orders/:orderId/accept` behind `requireAuth` + `requireRole(['RIDER'])`. Calls `deps.riderOrderService.acceptOrder(...)`.
  - [ ] [Controller] Update `GET /api/v1/store/orders` in `store-owner.controller.ts` and `GET /api/v1/rider/orders/active` in `rider.controller.ts` to include `buyerName: user?.name || null` in their serialized order payloads.
  - [ ] [Controller] In `rider.controller.ts`, update `GET /api/v1/orders/:orderId/rider-location` pre-handler to `requireRole(['BUYER', 'STORE_OWNER'])`. In the handler, if `role === 'STORE_OWNER'`, verify `order.storeId === userStoreId`, otherwise throw `403`.
  - [ ] [Socket] In `socket.ts`, update the `join_order` listener to authorize `STORE_OWNER` users if `order.storeId === user.storeId`.
  - [ ] Run all integration tests — **confirm GREEN**.

- [ ] **RED — Unit / Component (`StoreOrdersPage.test.tsx` & `RiderOrdersPage.test.tsx`):**
  - [ ] **`StoreOrdersPage.test.tsx`:**
    - Test: select an order in `OUT_FOR_DELIVERY` status, assert that the "Mark Delivered" button is **absent** from the details modal.
    - Test: select an order in `OUT_FOR_DELIVERY` status, assert that `<OrderRouteMap />` is rendered in the drawer showing the live rider tracking map.
    - Mock `<OrderRouteMap />` using `vi.mock("@/components/shared/OrderRouteMap", ...)` returning a simple div `<div data-testid="mock-order-route-map" />` to prevent Leaflet errors in JSDOM.
  - [ ] **`RiderOrdersPage.test.tsx`:**
    - Test: an active order in `PREPARING` status with `riderId = null` renders an "Accept Order" button (not "Mark as Out for Delivery"). Clicking it triggers the accept API call.
    - Test: active orders feed excludes orders where `riderId !== null` and does not match the logged-in rider.
    - Test: card displays the customer's name (e.g. `"John Doe"`), or `"Registered User"` if `buyerName` is missing/null.
  - [ ] **Run unit tests — confirm RED.**

- [ ] **GREEN — Frontend (Types → Components → Routes):**
  - [ ] [Types] In `StoreOrdersPage.tsx` and `RiderOrdersPage.tsx`, update types: add `riderId?: string | null` and `buyerName?: string | null` to the `Order` type interfaces.
  - [ ] [Rider Component] In `RiderOrdersPage.tsx`:
    - Add `acceptOrder` mutation calling `PUT /api/v1/rider/orders/:id/accept`.
    - Change button for `PREPARING` status to "Accept Order". When clicked, trigger the mutation.
    - Remove the "Mark as Out for Delivery" option from the rider's UI.
    - Update feed filtering: only render orders in the feed where `order.riderId === null` or `order.riderId === currentRiderId`.
    - Display `order.buyerName?.trim() || "Registered User"` on the order card.
  - [ ] [Store Component] In `StoreOrdersPage.tsx`:
    - Remove `DELIVERED` from allowed status transitions inside `allowedTransitions` function (prevents "Mark Delivered" button from rendering).
    - If `selectedOrder.status === "OUT_FOR_DELIVERY"`, call `api.get(...)` to fetch last-known rider location on mount. Use `useOrderSocket(selectedOrder.id, onStatusChanged, onLocationUpdated)` to listen to live coordinates.
    - Render `<OrderRouteMap />` inside the order detail drawer when status is `OUT_FOR_DELIVERY` and coordinates are resolved.
    - Display `order.buyerName?.trim() || "Registered User"` in the customer info section of the details panel.
  - [ ] Run all unit tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Buyer places order ➔ Store Owner changes status to `PREPARING`.
  - [ ] Rider logs in ➔ Sees the order under "Ready for Pickup" queue with customer name "John Doe" ➔ Click "Accept Order" ➔ Order is assigned to this rider in the DB.
  - [ ] Other riders in the store immediately see this order vanish from their feeds.
  - [ ] Store Owner sees the order details update in their panel, showing the status log `"Order accepted by rider: Test Rider"`.
  - [ ] Rider arrives at store ➔ Store Owner hands over items ➔ Store Owner clicks "Dispatch Order" ➔ Order status changes to `OUT_FOR_DELIVERY`.
  - [ ] Store Owner detail modal immediately displays the live tracking map showing the buyer's house marker and the rider's live marker.
  - [ ] Rider navigates to destination ➔ Rider clicks "Mark as Delivered" in the rider app ➔ Order status becomes `DELIVERED` ➔ Rider earning is logged ➔ ✅ Done.

---

### 5.8 — Rider E2E Tests (Playwright)

- [ ] `apps/web/tests/e2e/rider-journey.spec.ts` (Refactored for multi-actor flow):
  - [ ] Setup: Seed one store, one store owner, one rider, and one buyer. Place an order and change status to `PREPARING` via API.
  - [ ] **Rider Acceptance:** Log in as Rider ➔ Navigate to `/rider/orders` ➔ Expect order to be visible under "Ready for Pickup" ➔ Click "Accept Order" and confirm ➔ Order is assigned in DB.
  - [ ] **Other Rider Isolation:** Log in as a different Rider ➔ Navigate to `/rider/orders` ➔ Expect the accepted order to NOT be visible in their feed.
  - [ ] **Store Dispatch:** Log in as Store Owner ➔ Navigate to `/store/orders` ➔ Open order details ➔ Confirm status log shows "Order accepted by rider: <Name>" ➔ Click "Dispatch Order" and confirm ➔ Order status updates to `OUT_FOR_DELIVERY`.
  - [ ] **Store Owner Map View:** Open order details on Store panel ➔ Verify that the live tracking map container is visible showing both buyer and rider markers.
  - [ ] **Rider Delivery:** Log in as Rider ➔ Navigate to `/rider/orders` ➔ Open the active order details modal ➔ Click "Mark as Delivered" and confirm ➔ Order status updates to `DELIVERED`.
  - [ ] **Earnings Logging:** Navigate to `/rider/earnings` ➔ Verify that the completed order details and payout amount are listed.
  - [ ] **Unauth Guard:** Try to access `/rider/orders` without RIDER JWT ➔ Verify redirect to `/rider/login`.

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

### Session 11 — 2026-06-11 — Tab Renaming and E2E Selector Collision Fixes Completed
- Renamed the booking store dashboard's `"departed"` tab and status badge to `"on the way"` to align with quick commerce terminology and buyer confirmation screen configurations.
- Resolved a critical E2E selector collision in `booking-journey.spec.ts` where `hasText: 'Approve'` was matching the `"approved"` tab button instead of the `"Approve Booking"` action button inside the modal. Updated selector to use exact getByRole query.
- Aligned Vitest unit tests in `StoreBookingsPage.test.tsx` to search for `/on the way/i` tab instead of `/departed/i`.
- Verified that all unit tests, eslint rules, and typescript compilations are completely green.

### Session 8 — 2026-06-11 — Phase 5.6 Dual-Mode: Field Technician Completed
- Implemented Dual-Mode capability for Delivery Riders and Field Technicians based on the store types and order configurations.
- Integrated the database schema for `riderType` field on `DeliveryRider`.
- Updated active orders feed controller (`GET /api/v1/rider/orders/active`) to return approved booking orders for `FIELD_TECHNICIAN` riders, while strictly filtering them out for normal `DELIVERY` riders.
- Supported state transition flow for bookings (`APPROVED -> OUT_FOR_DELIVERY -> DELIVERED`) in the status updater service and emitted Socket.IO events to trigger real-time updates for buyers.
- Created `BookingVisitCard` view in frontend to show scheduled date/timeslot, fasting warning, and buyer location map.
- Verified backend and frontend test suites are passing with green results.

### Session 9 — 2026-06-11 — Terminology Adjustments & Booking Flow Refinements
- Modified Rider side bottom tab navigation, heading, lists, empty states, toasts, and dialogs to display "Services" instead of "Orders" when a rider is configured as a `FIELD_TECHNICIAN`.
- Replaced "Out for Delivery" and "Ready for Pickup" terminology with "Departed" and "Ready for Visit" for field visits.
- Updated the Store Bookings timeline log component to map raw `OUT_FOR_DELIVERY` status history events to `"DEPARTED"` label, matching the booking commerce vocabulary.
- Configured dialog confirmations for both rider status transitions and store booking updates.
- Updated unit test assertions in `RiderOrdersPage.test.tsx` to accommodate the revised text.
- Re-run and confirmed all vitest suites, ESLint rules, and TypeScript compilation gates are 100% green.

### Session 10 — 2026-06-11 — Status Capitalization Formatting & Receipt Page Adjustments
- Implemented Title Case formatting (e.g. converting PENDING_APPROVAL to Pending Approval) for order/booking statuses displayed in the UI (Buyer's Order History page, Store Incoming Orders, and Bookings dashboards) by using the formatStatusLabel helper.
- Removed the uppercase styling classes (uppercase, tracking-wider) from badges and order text across pages.
- Removed the status badge entirely from the Booking Confirmation receipt page (`BookingConfirmationPage.tsx`), matching the layout of the quick commerce receipts (`OrderConfirmationPage.tsx`).
- Removed the `uppercase` CSS class from the stepper step labels ("Placed", "Preparing", "On the way", "Delivered") and status badges on `OrderConfirmationPage.tsx` so they render in Title Case.
- Updated failing vitest assertions in `StoreBookingsPage.test.tsx` and `StoreOrdersPage.test.tsx` to expect the correctly formatted status labels instead of the raw uppercase enums.
- Successfully verified that all 383 frontend unit tests, TypeScript typechecks, and ESLint rule checks are fully passing.

### Session 12 — 2026-06-11 — Phase 5.6.1-A Today-Only Bookings Completed
- Completed Phase 5.6.1-A platform improvements for today-only bookings filtering on the rider feed.
- Updated `findManyByStore` in `order.repository.ts` to support `scheduledDate` filters, and modified `rider-order.service.ts` to compute and pass UTC midnight range limits for the current day.
- Updated `RiderOrdersPage.tsx` to show "Today's Bookings" heading and "Scheduled for today" subtitle for field technician riders.
- Wrote new integration tests in `rider.field-technician.test.ts` and updated unit tests in `RiderOrdersPage.test.tsx`.
- Confirmed full test suites (619 backend + 385 frontend) build, typecheck, lint, and execute completely green.

### Session 13 — 2026-06-11 — Phase 5.6.1-B Store Bookings Date Filter Completed
- Completed Phase 5.6.1-B store bookings schedule date dropdown filtering.
- Implemented state management, local-timezone based string comparisons for robustness, client-side list filtering, and tab counts.
- Rendered UI dropdown options along with dynamic custom date input fields.
- Verified test suite executes completely green (389 passing in web workspace) and production builds pass cleanly.

### Session 14 — 2026-06-11 — Phase 5.6.1-C Admin Riders Page & Multi-Store Junction Table Completed
- Migrated database model to replace the single `storeId` on `DeliveryRider` with a modern `RiderStore` junction table.
- Updated backend services, auth logic, and repositories to query stores via the junction table.
- Added comprehensive Admin Riders CRUD endpoints (`GET /api/v1/admin/riders`, `POST /api/v1/admin/riders`, `PUT /api/v1/admin/riders/:id`) with validation and type checks.
- Implemented the frontend `AdminRidersPage` with Add/Edit modals, type-scoped store checkbox pickers, and suspension toggles.
- Fixed all ESLint imports and TypeScript compilation errors. Verified that the typecheck and lint tasks run completely clean across the entire repository workspace.

### Session 15 — 2026-06-11 — Phase 5.6.1-D Store Dashboard & Orders/Bookings Date Filters Completed
- Implemented clickable KPI cards on the store dashboard and wired deep-links to correspond with orders, bookings, active ads, offers, and discounts.
- Split Active Offers and Active Discounts into two separate KPI cards, expanding the layout to 6 columns.
- Implemented smooth scrolling on Today's Revenue card clicks down to the Weekly Revenue trend chart.
- Wired Store Orders and Store Bookings pages to initialize active tabs, date filters, and custom ranges from URL search parameters on mount, invalidating and refetching data reactively.
- Clarified dashboard card headings for booking commerce: `"Appointments Scheduled Today"` and `"Revenue from Bookings Made Today"` (with subtext `"From bookings made today"`) to clearly distinguish scheduling vs booking-creation dates.
- Verified all Vitest frontend unit tests, integration test suites, TypeScript type compilation, and ESLint check tasks run completely green.

### Session 16 — 2026-06-16 — Map Zoom and Custom Icons Completed
- Resolved a critical bug in `ola-map-adapter.ts` where the map would initialize with zoom level 0 and display the entire world when the detailed modal opened.
- Registered a listener for the map "load" event in `OlaMapInstance.init` to ensure that `_fitBounds` runs only after the map style has loaded and the DOM layout of the container has finished rendering.
- Handled cases where the buyer's and rider's coordinates are identical or extremely close (distance < 0.0001) by centering on the buyer and setting an explicit zoom level of 14, preventing `fitBounds` from collapsing to zoom level 0 or throwing.
- Manually calculated and verified bounding boxes to ensure valid southwest/northeast coordinates are passed to `fitBounds` with a `maxZoom: 14` option.
- Updated both `LeafletMapAdapter` and `OlaMapAdapter` to render the buyer marker as the Leaflet default blue pinpoint icon (the same icon used when adding/saving addresses) and the rider location as a circular marker with a custom Rider on a Bike SVG icon.
- Verified that all unit tests in `ola-map-adapter.test.ts`, `leaflet-map-adapter.test.ts`, and `OrderRouteMap.test.tsx` pass successfully.

### Session 17 — 2026-06-16 — Custom Marker Icons & Route Line Drawing Completed
- Copied user-requested marker images (`buyer.png` and `rider.png`) from the Desktop folder into `apps/web/public/`.
- Configured both `LeafletMapAdapter` and `OlaMapAdapter` to render these custom image markers dynamically using Vite public path mappings.
- Implemented automatic route line (polyline) drawing in both adapters when coordinates for both buyer and rider are active, rendering a solid GoRola brand Pine green line (`#1d3d2f`) connecting the two locations.
- Handled route line cleanup dynamically on adapter destruction and map state resets.
- Added comprehensive unit tests in `leaflet-map-adapter.test.ts` and `ola-map-adapter.test.ts` to assert on route line creation, coordinates ordering, styles, and cleanup.
- Verified all vitest suites (20/20 passing) and TypeScript compilation (`tsc --noEmit`) pass 100% clean.

### Session 18 — 2026-06-16 — Road-Based Routing & High-Contrast Saturated Markers Completed
- Created a shared [map-route-helper.ts](file:///C:/Users/Administrator/Desktop/GoRola/GoRola_app/apps/web/src/lib/map-route-helper.ts) containing a polyline decoder and fetcher for the Ola Maps Directions/Routing API.
- Integrated the Directions API request flow inside `LeafletMapAdapter` and `OlaMapAdapter` to fetch the actual shortest road route between rider and buyer, dynamically rendering the road-aligned path on the map.
- Implemented a seamless straight-line fallback mechanism if the Directions API is rate-limited, offline, or has expired keys.
- Scaled map icons to a larger `40px` size and applied dynamic drop-shadows, saturation (`saturate(2)`), and contrast (`contrast(1.2)`) CSS styling to make markers stand out prominently.
- Added comprehensive unit tests in `map-route-helper.test.ts`, `leaflet-map-adapter.test.ts`, and `ola-map-adapter.test.ts` checking polyline decoding accuracy, POST params, road routing render states, filter application, and fallback behavior.
- Verified all vitest suites (25/25 passing) and TypeScript compiler validations (`tsc --noEmit`) run 100% clean.

### Session 19 — 2026-06-16 — Strict TDD Map Routing & Reload Marker Asset Fix
- Corrected the Ola Maps Directions API response schema parsing in `map-route-helper.ts`. Instead of accessing `.points` (Google Maps style), the code now dynamically handles `overview_polyline` directly as an encoded string.
- Resolved marker rendering issues on page reloads/subdomain setups by importing custom buyer and rider marker PNG assets from `src/assets` and passing them directly to Leaflet and Ola Map adapters, enabling compile-time Vite static asset resolution.
- Updated Vitest unit tests in `map-route-helper.test.ts`, `ola-map-adapter.test.ts`, and `leaflet-map-adapter.test.ts` following strict TDD guidelines to assert on the correct Ola Maps payload formats and compiled asset paths.
- Confirmed all vitest test suites, TypeScript type compilation, and ESLint check tasks run completely green.

### Session 20 — 2026-06-16 — Map Zoom, Scroll Propagation & Geolocation Analysis
- Checked and documented the development geolocation mock and latency behavior. Verified that:
  - High-accuracy geolocation calls on devices/browsers without true hardware GPS take 5–10+ seconds, causing the 2-second development mock fallback timeout to trigger initially.
  - The fallback warning and mock coordinate injection is strictly guarded by dev environment flags (`import.meta.env.DEV`), meaning it is fully tree-shaken and will never run in production.
  - Once the browser's background high-accuracy query completes, the success callback is invoked, correctly updating the coordinates from mock to real on the maps.
- Cleaned up container-level scroll event bubbling listeners (`node.addEventListener("wheel", ...)`) for both `OrderRouteMap.tsx` and `AddressMapPicker.tsx` to handle maps correctly and prevent full-page body scrolling.
- Integrated a delayed boundary resize call to correct initial marker layouts after page transitions.
- Confirmed all quality gates (lints, typecheck, vitest tests) are fully passing.

### Session 21 — 2026-06-17 — Phase 5.6.3-A Scroll Propagation Completed
- Implemented the hover-activated scroll propagation fix (Phase 5.6.3-A) for the map component under strict TDD guidelines.
- Modified the `MapAdapter` interface to define `enableScrollZoom` and `disableScrollZoom` methods, and implemented them in both Leaflet and Ola Maps adapters.
- Configured `OrderRouteMap.tsx` with `mouseenter`/`mouseleave` event listeners to dynamically activate/deactivate scroll-zoom capabilities.
- Added comprehensive unit tests in `OrderRouteMap.test.tsx` verifying that scroll zoom defaults are blocked unless the container is hovered, allowing normal page scrolling outside map bounds.
- Documented data minimization and private map rendering architecture in `CONTEXT/DPDP Act/1_geolocation_privacy.md` for DPDP Act compliance (scoping coordinates to our own secure backend APIs, using local Vite asset bundling for markers, performing routing polyline decoding strictly in-memory, and fallback straight-line vectors).
- Checked and confirmed that all vitest unit tests (429 passing), TypeScript type check, and ESLint checks are 100% green.
- Confirmed that stopping propagation of wheel events inside the map container does not impact Lenis smooth scrolling for the rest of the application, as the behavior is strictly scoped to the active map hover state.

### Session 22 — 2026-06-17 — Phase 5.6.3-B Rider Last-Known Location Completed
- Added integration test cases to `rider.location.test.ts` verifying that `GET /api/v1/orders/:orderId/rider-location` returns the correct coordinates when a location exists, handles `null` values for preparing orders, checks buyer ownership limits (403), and handles unauthenticated access (401).
- Implemented `getRiderIdByOrderId` and `getLocationByOrderId` in `RiderRepository` to correctly resolve the assigned rider from either a booking technician mapping or the status history transition logs.
- Integrated `getLastKnownLocationForOrder` in `RiderLocationService` and registered the REST endpoint in `rider.controller.ts`.
- Updated `OrderConfirmationPage.tsx` with a `useEffect` hook to fetch and seed the initial `riderLocation` coordinates on mount, resolving map loading stub issues.
- Added unit test assertions to `OrderConfirmationPage.state.test.tsx` checking correct mount-time querying and display behavior.
- Verified that all unit tests, integration tests, TypeScript type compilations, and ESLint checks are 100% green.
- **Architectural Polish (Socket.IO + REST Integration)**: Documented and implemented a hybrid location tracking design. While Socket.IO handles real-time "pushes" of live GPS updates as they happen, it is a stateless broadcast mechanism. To prevent the buyer's map from hanging on mount (waiting indefinitely for the next socket broadcast), we introduced a REST fetch on page load to "pull" the rider's last-known location from the database. Once loaded, the UI seamlessly transitions to listening for Socket.IO coordinate updates.

### Session 23 — 2026-06-17 — Phase 5.6.3-C Route Lag Curved Dotted Placeholder Completed
- Implemented Phase 5.6.3-C route lag curved dotted placeholder line with arrowhead drawing under strict TDD guidelines.
- Modified Leaflet and Ola map adapters to draw curved dotted line immediately on route initialization, showing it while route fetching is active.
- Added `setRouteStatusCallback` to `MapAdapter` interface to update `isRouteCalculating` component state.
- Integrated calculating state below map rendering in `OrderRouteMap.tsx` via `route-calculating-note` ("Calculating route…").
- Optimized map render cycles to prevent recreation: separated base map container initialization (depending on buyerCoords) from rider marker updates (depending on riderCoords) via React refs and `isInitialized` check hooks.
- Used `lastRiderCoordsRef` to guard against duplicate marker update calls and suppressed recreating the dotted line when a solid road route line is already displayed (only displaying dotted lines on initial load when route is null).
- Verified that all unit tests (leaflet adapter, ola adapter, component), global compiles (`tsc --noEmit`), and lints run completely green with 0 errors.

### Session 24 — 2026-06-17 — Phase 5.6.3-D Ola Maps Address Picker Completed
- Implemented and refined the modular `OlaAddressMapPicker.tsx` component to replace the Leaflet-based address map picker across Checkout, Saved Addresses, and Booking Timeslot selection pages.
- Configured autocomplete input to retain and preserve the selected location text query inside the search field, avoiding redundant search triggers by managing a lookup ref.
- Handled geocoding and coordinates resolution using the Ola Places Details API to fetch location data dynamically and center the map.
- Implemented hover-state scroll zoom toggle to prevent scroll propagation outside the map bounds on mouse wheel actions.
- Fully removed the "OLA MAPS" watermark text, logo, and attributions from the map container globally by overriding styles targeting MapLibre controls, specifically hiding dynamically injected elements inside the `.maplibregl-ctrl-bottom-left` container.
- Verified that all unit tests (leaflet/ola adapters, component tests, web page tests) compile and pass cleanly.

### Session 25 — 2026-06-17 — Rider Active Order Modal In-Place Status Transformation Completed
- Refactored `RiderOrdersPage.tsx` to support in-place status transformations for the detailed overlay modal instead of closing it when updating the status to Out for Delivery.
- Updated local `selectedOrder` state on transition success and automatically switched the active tab to "DELIVERY" (Out for Delivery/Departed).
- Allowed the final transition (marking an order as DELIVERED/Visit Complete) to close the modal as expected.
- Resolved TypeScript and ESLint lint/typecheck errors in `OlaAddressMapPicker.test.tsx` by replacing dynamic `any` object references with strict properties and removing generic `Function` typecasts.
- Verified that all unit tests, integration tests, lint checks, and typechecks pass completely green.

### Session 26 — 2026-06-17 — Store Panel Logs Updates & Role Display Formatting Completed
- Wired `StoreOrdersPage.tsx` and `StoreBookingsPage.tsx` with a reactive `useEffect` hook to keep the detailed modal details in sync with query updates, ensuring status and status transition logs update automatically in real-time when the rider updates the order status.
- Implemented `formatChangedBy` helper in both pages to present human-readable role designations ("Buyer", "Store Owner", "Rider", "System") instead of displaying raw entity IDs in the Status Transition Log UI.

### Session 27 — 2026-06-17 — Temporal Dead Zone Fix and Real-time Log Updates Completed
- Moved the `useEffect` blocks in both `StoreOrdersPage.tsx` and `StoreBookingsPage.tsx` below their respective `useQuery` hooks to resolve the Temporal Dead Zone (TDZ) ReferenceError crashes that caused a white screen on mounting.
- Added support for the `ADMIN` role formatting in the `formatChangedBy` helper function in both pages.
- Modified the backend socket emitter to include the full `statusHistory` in the `store:order_updated` event payload.
- Updated the socket listener callbacks in `StoreOrdersPage.tsx` and `StoreBookingsPage.tsx` to handle the new `statusHistory` payload and update the modal's state in real-time.
- Confirmed that all typechecks, linting, and build tasks are completely clean and successful.

### Session 28 — 2026-06-17 — Standardizing Status Log Actor Formats & Datetime Displays Completed
- Standardized DB storage of status change actors by saving Rider updates as `rider:${riderId}`, Store Owner updates as `store-owner:${ownerId}`, and Admin updates as `admin:${adminId}` in the database.
- Updated both `StoreOrdersPage.tsx` and `StoreBookingsPage.tsx` `formatChangedBy` helpers to gracefully handle new standardized prefixes and maintain backward compatibility with raw legacy strings (like `"BUYER"` and `"RIDER"`).
- Modified the status history timelines on Store Orders, Store Bookings, Admin Orders, and Buyer Order Confirmation screens to display both local date and time (using `.toLocaleString("en-IN")` with options) rather than just the time.
- Updated API integration tests and web unit tests to match formatting and prefix standards, confirming that the full test suites (81/81 web test files, 446/446 tests) and backend tests run completely green.

### Session 29 — 2026-06-18 — UI Visual Adjustments, Favicon, Blurred Background, and Responsive Hero Layout Completed
- Set the cropped small logo (`logo_small_screen_new_cropped.png`) as the application-wide favicon for all subdomains.
- Configured a fixed, centered, and blurred global topographic background image (`Gorola_background.png`) using body stylesheet overlays, and updated page wrappers (`BuyerLayout`) to support background transparency.
- Applied `hero_final.png` as the background of the buyer landing page's Hero section, darkening it with an overlay for readability, and updated all typography within it to high-contrast white.
- Decreased the Hero section box size on mobile phones by setting the height to `min-h-[30vh]` and reducing vertical padding to `py-8` to save viewport estate.
- Constrained the mobile "Shop Now" button to occupy only its natural text width with padding (`items-start`) rather than stretching to the full width of the container, and left-aligned it.
- Copied the current navbar's blue-white gradient layout background (`.bg-gorola-pine\/95`) to the footer background styling (`.bg-gorola-footer-gradient`).


