# GoRola — Phase 7 State (Booking Commerce)

> **This file covers Phase 7 (Booking Commerce).**
> Phase 7 implements booking-based commerce alongside standard quick-commerce, introducing schedule-based orders (medical tests, repairs), approval gates, date/timeslot picker UIs, and merchant dashboard management.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name             | Status       | Notes |
| ------- | ---------------- | ------------ | ----- |
| Phase 7 | Booking Commerce | NOT STARTED  | Add medical tests, repairs, and custom booking order flow |

---

## 📍 Last Updated

- **Date:** 2026-05-19
- **Session Summary:** Successfully completed Phase 7.1 — Schema Migration. Wrote RED integration test, added StoreType, OrderType, BookingApprovalStatus, and RiderType enums/fields to the database schema, ran migrations on dev/test DB, and confirmed GREEN test execution.
- **Next Session Must Start With:** Phase 7.2 — Booking Order Service (Backend Core). Implement placeBookingRequest, approveBooking, rejectBooking, and cancelBookingByBuyer methods in repository and service.
- **In Progress Right Now:** Ready for Phase 7.2.
- **Current Blocker:** None.

> ⚠️ **Update THIS block at the end of every session** (not `current_state.md`). Also mark completed checklist items `[x]` and append to the Session Notes section at the bottom. Update `current_state.md` ONLY when Phase 7 changes status (NOT STARTED → IN PROGRESS → COMPLETE).

---

## Mandatory API Contract Gate (applies to every section in Phase 7)

Before marking any checklist item complete:
- [ ] Required backend endpoint(s) implemented and returning correct envelope
- [ ] Backend integration tests verify: endpoint contract, HTTP status codes, auth/role guards, and business logic validation
- [ ] Endpoint routes registered in `registerAppRoutes` in `routes.ts`
- [ ] Frontend tests verify: expected API response shape, loading state, empty state, error state

---

## Phase 7 — Booking Commerce Checklist

---

### 7.1 — Schema Migration

**Root cause / Goal:**
The current database schema only supports standard quick commerce where products are instantly fulfilled physical goods. It lacks representation for service appointments, scheduling dates, booking timeslots, fasting regulations, approval states, distinct store types, and field technicians. New tables, fields, and enums must be introduced to enable booking order flows without breaking the existing quick-commerce models.

**Fix / Approach:**
Extend the Prisma schema (`apps/api/prisma/schema.prisma`) with the required enums and fields, and create the `BookingOrder` model. Execute a schema migration to apply these changes to the PostgreSQL database.

---

- [x] **RED — Integration (`apps/api/src/modules/booking/booking-schema.integration.test.ts`):**
  - [x] Test: DB client can successfully insert a `BookingOrder` row with scheduledDate, timeslot, and `requiresFasting`.
  - [x] Test: `OrderStatus.PENDING_APPROVAL` and `OrderStatus.APPROVED` are successfully saved and queried as valid `OrderStatus` values.
  - [x] Test: A `ProductVariant` record with `requiresFasting: true` and `allowedTimeslots: ["06:00-09:00"]` is successfully stored and retrieved.
  - [x] Test: `StoreType.BOOKING_COMMERCE` is successfully saved on a `Store` record.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend (Schema):**
  - [x] [Schema] Add `StoreType` enum to `schema.prisma`:
    ```prisma
    enum StoreType {
      QUICK_COMMERCE
      BOOKING_COMMERCE
    }
    ```
  - [x] [Schema] Add `OrderType` enum to `schema.prisma`:
    ```prisma
    enum OrderType {
      QUICK
      BOOKING
    }
    ```
  - [x] [Schema] Add `BookingApprovalStatus` enum to `schema.prisma`:
    ```prisma
    enum BookingApprovalStatus {
      PENDING_APPROVAL
      APPROVED
      REJECTED
      COMPLETED
      CANCELLED
    }
    ```
  - [x] [Schema] Add `RiderType` enum to `schema.prisma`:
    ```prisma
    enum RiderType {
      DELIVERY
      FIELD_TECHNICIAN
    }
    ```
  - [x] [Schema] Add `PENDING_APPROVAL` and `APPROVED` to the `OrderStatus` enum.
  - [x] [Schema] Add fields to `Store` model:
    - `storeType` `StoreType` `@default(QUICK_COMMERCE)`
    - `bookingLeadDays` `Int` `@default(1)`
    - `isAcceptingBookings` `Boolean` `@default(true)`
  - [x] [Schema] Add fields to `ProductVariant` model:
    - `allowedTimeslots` `String[]` (e.g. `["06:00-09:00","10:00-12:00"]`)
    - `requiresFasting` `Boolean` `@default(false)`
  - [x] [Schema] Add field to `DeliveryRider` model:
    - `riderType` `RiderType` `@default(DELIVERY)`
  - [x] [Schema] Add `BookingOrder` model with relations:
    ```prisma
    model BookingOrder {
      id                   String                @id @default(cuid())
      orderId              String                @unique
      scheduledDate        DateTime
      timeslot             String
      requiresFasting      Boolean               @default(false)
      approvalStatus       BookingApprovalStatus @default(PENDING_APPROVAL)
      approvedAt           DateTime?
      approvedByOwnerId    String?
      rejectionReason      String?
      assignedTechnicianId String?
      createdAt            DateTime              @default(now())
      updatedAt            DateTime              @updatedAt
      order                Order                 @relation(fields: [orderId], references: [id], onDelete: Cascade)
    }
    ```
  - [x] [Schema] Add relation `bookingOrder BookingOrder?` on the `Order` model.
  - [x] [Migration] Run `pnpm --filter @gorola/api prisma migrate dev --name add_booking_commerce_schema`. Apply to the test database.
  - [x] Run integration tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] Run seed verification script → verify new models can be queried and have all specified fields → ✅ Done.

> **✅ After completing 7.1, mark these items as done in `phase3_4_state.md` section 4.5:**
> - [x] `[Schema] Confirm storeType StoreType @default(QUICK_COMMERCE) exists on Store model` — done by migration `add_booking_commerce_schema`
> - [x] `[Schema] Confirm enum StoreType { QUICK_COMMERCE BOOKING_COMMERCE } exists in schema.prisma` — done by migration `add_booking_commerce_schema`
> They are already in the DB. Whoever does Phase 4.5 skips straight to the `[Service]` step.

---

### 7.2 — Booking Order Service (Backend Core)

**Root cause / Goal:**
There is no business logic layer to handle placing, approving, rejecting, or buyer cancellation of booking requests. We need to implement validating rules (e.g. store capability, lead days, fasting restrictions, slot validity) and persist booking details inside a database transaction without triggering the quick commerce stock movements.

**Fix / Approach:**
Create `BookingOrderService` in `apps/api/src/modules/booking/booking-order.service.ts` and `BookingOrderRepository` in `apps/api/src/modules/booking/booking-order.repository.ts`.
- `placeBookingRequest(userId, storeId, items, { scheduledDate, timeslot, addressId })`: Validates store is `BOOKING_COMMERCE` and accepts bookings, validates date is tomorrow or later (respecting `bookingLeadDays = 1`), validates timeslot matches the product allowedTimeslots, validates fasting timeslot if `requiresFasting` is true, performs a transaction to create `Order` (status: `PENDING_APPROVAL`, orderType: `BOOKING`) and `BookingOrder` row, and skips stock deduction entirely.
- `approveBooking(storeId, orderId, ownerId)`: Validates ownership, checks status is `PENDING_APPROVAL`, updates status of `BookingOrder` to `APPROVED` and `Order` to `APPROVED`, records `OrderStatusHistory`.
- `rejectBooking(storeId, orderId, ownerId, reason)`: Validates ownership, checks status is `PENDING_APPROVAL`, updates to `REJECTED`, stores rejection reason.
- `cancelBookingByBuyer(userId, orderId)`: Validates buyer ownership, checks status is `PENDING_APPROVAL` (cannot cancel after approval), updates to `CANCELLED`.

---

- [ ] **RED — Integration (`apps/api/src/modules/booking/booking-order.service.integration.test.ts`):**
  - [ ] Test setup: seed a BOOKING_COMMERCE store with `bookingLeadDays: 1`, one product variant with `requiresFasting: true` and `allowedTimeslots: ["06:00-09:00"]`; seed a buyer user
  - [ ] Test: `placeBookingRequest` with `scheduledDate = today` (when `bookingLeadDays = 1`) throws validation error with code `INVALID_BOOKING_DATE`
  - [ ] Test: `placeBookingRequest` with `requiresFasting = true` and `timeslot = '12:00-15:00'` throws validation error with code `INVALID_TIMESLOT_FOR_FASTING`
  - [ ] Test: `placeBookingRequest` with `timeslot = '12:00-15:00'` on a non-fasting variant where `'12:00-15:00'` is NOT in `allowedTimeslots` throws `TIMESLOT_NOT_ALLOWED`
  - [ ] Test: `placeBookingRequest` with a store that has `storeType = QUICK_COMMERCE` throws `INVALID_STORE_TYPE`
  - [ ] Test: `placeBookingRequest` with a store that has `isAcceptingBookings = false` throws `STORE_NOT_ACCEPTING_BOOKINGS`
  - [ ] Test: `placeBookingRequest` with valid input (scheduledDate = tomorrow, timeslot = '06:00-09:00', fasting variant) → creates exactly ONE `Order` row with `status = PENDING_APPROVAL` and `orderType = BOOKING` in DB; creates exactly ONE `BookingOrder` row linked to that orderId; `StockMovement` table has ZERO new rows
  - [ ] Test: `approveBooking` by the store owner → `Order.status = APPROVED` in DB; `BookingOrder.approvalStatus = APPROVED` in DB; `BookingOrder.approvedAt` is not null; new `OrderStatusHistory` row with `status = APPROVED` recorded
  - [ ] Test: `approveBooking` called by a store owner whose `storeId` does NOT match the order's `storeId` → throws `ForbiddenException`
  - [ ] Test: `rejectBooking` with `reason = 'Slot fully booked'` → `BookingOrder.approvalStatus = REJECTED`; `BookingOrder.rejectionReason = 'Slot fully booked'` in DB
  - [ ] Test: `cancelBookingByBuyer` on a `PENDING_APPROVAL` order → `BookingOrder.approvalStatus = CANCELLED`; `Order.status = CANCELLED` in DB
  - [ ] Test: `cancelBookingByBuyer` on an `APPROVED` order → throws `ValidationException` with code `CANNOT_CANCEL_APPROVED_BOOKING`
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Repository → Service):**
  - [ ] [Repository] Create `apps/api/src/modules/booking/booking-order.repository.ts` with `findById`, `findByStoreId` (paginated), `create`, and `updateApprovalStatus` methods.
  - [ ] [Service] Create `apps/api/src/modules/booking/booking-order.service.ts` with Zod validation rules and database transactions.
  - [ ] Run integration tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Call `placeBookingRequest` with correct params → query DB and assert both `Order` and `BookingOrder` exist and `stockQty` remains untouched → call `approveBooking` → assert statuses update to `APPROVED` → ✅ Done.

---

### 7.3 — Booking HTTP Routes (Controller)

**Root cause / Goal:**
There are no HTTP endpoints to expose booking operations to buyers and store owners. We need REST endpoints to place a booking request, fetch bookings by store, approve, reject, cancel, and read booking details.

**Fix / Approach:**
Create `BookingController` in `apps/api/src/modules/booking/booking.controller.ts` and register routes in `apps/api/src/routes.ts` via `registerBookingRoutes(app)`.
- `POST /api/v1/bookings`: Buyer places request. Requires role `BUYER`.
- `GET /api/v1/store/bookings`: Store owner reviews bookings. Query `?status=PENDING_APPROVAL|APPROVED|REJECTED|ALL`. Requires role `STORE_OWNER`.
- `PUT /api/v1/store/bookings/:orderId/approve`: Store owner approves. Requires role `STORE_OWNER`.
- `PUT /api/v1/store/bookings/:orderId/reject`: Store owner rejects (body requires `reason`). Requires role `STORE_OWNER`.
- `DELETE /api/v1/bookings/:orderId`: Buyer cancels. Requires role `BUYER`.
- `GET /api/v1/bookings/:orderId`: Buyer reads status. Requires role `BUYER`.

---

- [ ] **RED — Integration (`apps/api/src/modules/booking/booking.controller.integration.test.ts`):**
  - [ ] Test setup: seed BOOKING_COMMERCE store with `bookingLeadDays: 1`; seed a buyer; seed a store owner JWT; seed a product variant with `requiresFasting: true` and `allowedTimeslots: ["06:00-09:00"]`
  - [ ] Test: `POST /api/v1/bookings` with valid payload `{ storeId, items: [{productId, variantId}], scheduledDate: <tomorrow ISO>, timeslot: '06:00-09:00', addressId }` with BUYER JWT → HTTP 201 with body `{ success: true, data: { orderId, status: 'PENDING_APPROVAL', bookingOrder: { scheduledDate, timeslot, requiresFasting } } }`; `Order` row in DB has `orderType = BOOKING`
  - [ ] Test: `POST /api/v1/bookings` with STORE_OWNER JWT → HTTP 403 `FORBIDDEN`
  - [ ] Test: `POST /api/v1/bookings` with `scheduledDate = today` when `bookingLeadDays = 1` → HTTP 400 with `{ error: { code: 'INVALID_BOOKING_DATE' } }`
  - [ ] Test: `POST /api/v1/bookings` with `requiresFasting = true` variant and `timeslot = '12:00-15:00'` → HTTP 400 with `{ error: { code: 'INVALID_TIMESLOT_FOR_FASTING' } }`
  - [ ] Test: `POST /api/v1/bookings` with a `timeslot` value that is not in the variant's `allowedTimeslots` → HTTP 400 `TIMESLOT_NOT_ALLOWED`
  - [ ] Test: `GET /api/v1/store/bookings?status=PENDING_APPROVAL` with STORE_OWNER JWT → HTTP 200 with paginated results; only orders for that store owner's store are returned
  - [ ] Test: `GET /api/v1/store/bookings` with BUYER JWT → HTTP 403 `FORBIDDEN`
  - [ ] Test: `PUT /api/v1/store/bookings/:orderId/approve` with correct STORE_OWNER JWT → HTTP 200; `Order.status = APPROVED` and `BookingOrder.approvalStatus = APPROVED` confirmed in DB
  - [ ] Test: `PUT /api/v1/store/bookings/:orderId/approve` with a different store owner's JWT → HTTP 403 `FORBIDDEN`
  - [ ] Test: `PUT /api/v1/store/bookings/:orderId/reject` with body `{ reason: 'Slot fully booked' }` → HTTP 200; `BookingOrder.rejectionReason = 'Slot fully booked'` in DB
  - [ ] Test: `PUT /api/v1/store/bookings/:orderId/reject` with empty `reason` (`{ reason: '' }`) → HTTP 400 `VALIDATION_ERROR`
  - [ ] Test: `DELETE /api/v1/bookings/:orderId` on a `PENDING_APPROVAL` order with correct BUYER JWT → HTTP 200; `Order.status = CANCELLED` in DB
  - [ ] Test: `DELETE /api/v1/bookings/:orderId` on an `APPROVED` order → HTTP 422 with `{ error: { code: 'CANNOT_CANCEL_APPROVED_BOOKING' } }`
  - [ ] Test: `GET /api/v1/bookings/:orderId` with the buyer's JWT → HTTP 200 with `{ orderId, orderType: 'BOOKING', status, bookingOrder: { scheduledDate, timeslot, requiresFasting, approvalStatus } }`
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Controller → Routes wiring):**
  - [ ] [Controller] Create `apps/api/src/modules/booking/booking.controller.ts` with Fastify handlers and Zod body/query validators.
  - [ ] [Routes] Register all routes under `registerBookingRoutes(app)` in `apps/api/src/routes.ts` with `requireAuth` and role guards.
  - [ ] Run integration tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] POST request to `/api/v1/bookings` → returns 201 with booking details → PUT request to `/api/v1/store/bookings/:id/approve` → returns 200 with approved state → ✅ Done.

---

### 7.4 — Buyer Timeslot Picker UI

**Root cause / Goal:**
There is no scheduling or timeslot booking interface on the frontend. The standard checkout flow only permits adding goods to a cart. We need a direct product-to-booking path where buyers select an allowed date and timeslot, select an address, and confirm their booking request.

**Fix / Approach:**
Create two new pages in the buyer React app:
- `BookingTimeslotPage.tsx` under `/bookings/new?productId=&variantId=&storeId=`:
  - Fetches product detail to parse `allowedTimeslots` and `requiresFasting` values.
  - Calendar picker: Disables today and past dates if `bookingLeadDays = 1`.
  - Timeslot picker: Displays pill buttons. If `requiresFasting` is true, only displays `"06:00-09:00"` and shows a fasting warning banner.
  - Address Selector: Reuses standard user checkout addresses.
  - "Confirm Booking" button: Calls `POST /api/v1/bookings`, navigates to `/bookings/:orderId` on success.
- `BookingConfirmationPage.tsx` under `/bookings/:orderId`:
  - Renders order details and current status (PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED).
  - Listens to Socket.IO room `order:<orderId>` on event `order_status_changed` to auto-refresh the UI.

---

- [ ] **RED — Unit / Component (`apps/web/src/pages/buyer/BookingTimeslotPage.test.tsx`):**
  - [ ] Test: timeslot pill button is disabled when `requiresFasting` is true and timeslot is not `"06:00-09:00"`.
  - [ ] Test: dates before tomorrow are disabled when `bookingLeadDays = 1`.
  - [ ] Test: fasting warning banner "⚠️ This test requires fasting. Please schedule for early morning." is visible when `requiresFasting` is true.
  - [ ] Test: "Confirm Booking" button is disabled until a date, timeslot, and address are all selected.
  - [ ] **Run — confirm RED.**

- [ ] **RED — Unit / Component (`apps/web/src/pages/buyer/BookingConfirmationPage.test.tsx`):**
  - [ ] Test: Renders status label "Booking request sent. Waiting for store confirmation." under PENDING_APPROVAL.
  - [ ] Test: Renders success status text and schedule date/time when status transitions to APPROVED.
  - [ ] Test: Renders rejection reason banner when status transitions to REJECTED.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Types → Component):**
  - [ ] [Types] Add booking order types and fields to `apps/web/src/types/index.ts`.
  - [ ] [Component] Build `apps/web/src/pages/buyer/BookingTimeslotPage.tsx` with date-picker and timeslot validation pills.
  - [ ] [Component] Build `apps/web/src/pages/buyer/BookingConfirmationPage.tsx` with Socket.IO subscription logic.
  - [ ] [Router] Add routes in `apps/web/src/App.tsx`.
  - [ ] Run unit tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Navigate to `/bookings/new` → calendar disables today → select fasting product → check that fasting banner renders and only "06:00-09:00" is selectable → click Confirm → confirmation screen loads showing pending state → ✅ Done.

---

### 7.5 — Store Owner Booking Dashboard

**Root cause / Goal:**
Store owners of `BOOKING_COMMERCE` stores have no way to view incoming service requests, check daily appointments schedules, or approve/reject pending bookings from their dashboard.

**Fix / Approach:**
Build `StoreBookingsPage.tsx` under `/store/bookings` (gated by `StoreRoute` and `StoreLayout` guards).
- Tabs layout:
  - "Pending": Renders all PENDING_APPROVAL requests. Each card has "Approve" (calls PUT `/api/v1/store/bookings/:id/approve`) and "Reject" buttons.
  - "Upcoming": Renders APPROVED bookings sorted by scheduledDate ascending (the daily itinerary).
  - "History": Renders COMPLETED, REJECTED, and CANCELLED bookings.
- Cards show: Masked buyer phone, service name, selected slot, fasting badge, elapsed request time.
- Rejection flow: "Reject" button triggers a modal requiring a non-empty text reason before confirming.
- Auto-refresh: Query refetchInterval configured to 60000ms.
- Sidebar: Add a "Bookings" navigation link to `StoreLayout.tsx`, visible only when `store.storeType === 'BOOKING_COMMERCE'`.

---

- [ ] **RED — Unit / Component (`apps/web/src/pages/store/StoreBookingsPage.test.tsx`):**
  - [ ] Test: "Pending" tab displays both "Approve" and "Reject" action buttons.
  - [ ] Test: Rejection modal's confirm button is disabled until a rejection reason is entered.
  - [ ] Test: "Upcoming" tab displays approved appointments sorted chronologically by scheduled date.
  - [ ] Test: Navigation link "Bookings" in `StoreLayout` is hidden when the store type is `QUICK_COMMERCE`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Component):**
  - [ ] [Component] Create `apps/web/src/pages/store/StoreBookingsPage.tsx` with tabs, modals, and mutation query states.
  - [ ] [Layout] Update `apps/web/src/components/store/StoreLayout.tsx` to conditionally render the "Bookings" link.
  - [ ] [Router] Add `/store/bookings` page under `apps/web/src/App.tsx`.
  - [ ] Run unit tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Log in as booking store owner → navigate to bookings dashboard → click "Reject" on a card → type reason → submit → card vanishes and transitions to History tab → ✅ Done.

---

### 7.6 — Medical Tests Store Migration

**Root cause / Goal:**
Currently, medical tests reside under the standard `QUICK_COMMERCE` store format which uses immediate delivery and stock mechanics. These need to be separated into a distinct `BOOKING_COMMERCE` store with booking slots and fasting rules to enforce the proper TDD order flow.

**Fix / Approach:**
Update `apps/api/prisma/seed.ts` (and `apps/api/prisma/dummy-data.ts`) to create a dedicated booking store, add 5 typical test products, assign allowed timeslots and fasting rules, and write a validation script for Vercel/Railway.

---

- [ ] **RED — Integration (`apps/api/src/modules/booking/medical-tests-migration.integration.test.ts`):**
  - [ ] Test: Query database and assert a store named "GoRola Medical Tests" exists with `storeType = BOOKING_COMMERCE` and `bookingLeadDays = 1`.
  - [ ] Test: Assert 5 medical test products exist in that store under the "Medical tests" category.
  - [ ] Test: Assert "Blood Sugar (Fasting)" product variant has `requiresFasting = true` and `allowedTimeslots = ["06:00-09:00"]`.
  - [ ] Test: Assert "Thyroid (TSH)" product variant has `requiresFasting = false` and allowedTimeslots contains all 4 standard day slots.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Migration & Seeds):**
  - [ ] [Seed] Update `apps/api/prisma/seed.ts` (and `dummy-data.ts`) to seed:
    - Store: "GoRola Medical Tests", `storeType: BOOKING_COMMERCE`, `bookingLeadDays: 1`
    - Products/Variants:
      - Blood Sugar (Fasting) [Price: ₹80, requiresFasting: true, allowedTimeslots: ["06:00-09:00"]]
      - CBC Panel (Fasting) [Price: ₹350, requiresFasting: true, allowedTimeslots: ["06:00-09:00"]]
      - Lipid Profile (Fasting) [Price: ₹650, requiresFasting: true, allowedTimeslots: ["06:00-09:00"]]
      - Thyroid (TSH) [Price: ₹450, requiresFasting: false, allowedTimeslots: ["06:00-09:00","09:00-12:00","12:00-15:00","15:00-18:00"]]
      - Urine Routine [Price: ₹120, requiresFasting: false, allowedTimeslots: ["06:00-09:00","09:00-12:00","12:00-15:00","15:00-18:00"]]
  - [ ] [Script] Write one-time data migration script to apply these changes to live Staging/Production database.
  - [ ] Run integration tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Run `pnpm db:seed` → query PostgreSQL database → verify the store and 5 test variants are successfully inserted with all schedules → ✅ Done.

---

### 7.7 — Electronics Store (Quick Commerce)

**Root cause / Goal:**
GoRola needs to provide an Electronics store using the standard quick-commerce flow to expand catalog coverage.

**Fix / Approach:**
Seed a `QUICK_COMMERCE` Electronics store and products in `seed.ts`, ensuring it maintains standard quick-commerce checkout logic and integrates with existing category specs.

---

- [ ] **RED — Integration (`apps/api/src/modules/booking/electronics-seed.integration.test.ts`):**
  - [ ] Test: Assert a store named "GoRola Electronics" exists with `storeType = QUICK_COMMERCE`.
  - [ ] Test: Assert 5 electronics products exist in that store, each with active variants and stock amounts.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Seed):**
  - [ ] [Seed] Update `apps/api/prisma/seed.ts` to add:
    - Store: "GoRola Electronics", `storeType: QUICK_COMMERCE`
    - Products:
      - Phone Charger [Price: ₹499, stockQty: 50]
      - USB Cable [Price: ₹199, stockQty: 100]
      - Power Bank [Price: ₹1299, stockQty: 30]
      - Earphones [Price: ₹799, stockQty: 40]
      - Screen Protector [Price: ₹149, stockQty: 150]
  - [ ] Run integration tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Verify buyer home page displays Electronics products → adding screen protector to cart successfully triggers standard quick commerce checkout → ✅ Done.

---

### 7.8 — Repairs Store (Booking Commerce)

**Root cause / Goal:**
Physical hardware repairs cannot be instantly delivered like standard products. They require a field technician to schedule a home visit.

**Fix / Approach:**
Seed a `BOOKING_COMMERCE` repairs store, listing 4 home repair services and allocating technician schedules.

---

- [ ] **RED — Integration (`apps/api/src/modules/booking/repairs-seed.integration.test.ts`):**
  - [ ] Test: Assert store "GoRola Repairs" exists with `storeType = BOOKING_COMMERCE`.
  - [ ] Test: Assert 4 repairs products exist under that store, each with `requiresFasting = false` and allowed scheduling timeslots.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Seed):**
  - [ ] [Seed] Update `apps/api/prisma/seed.ts` to add:
    - Store: "GoRola Repairs", `storeType: BOOKING_COMMERCE`, `bookingLeadDays: 1`
    - Products/Variants:
      - Phone Screen Repair [Price: ₹999, requiresFasting: false, allowedTimeslots: ["09:00-12:00","12:00-15:00","15:00-18:00"]]
      - Phone Battery Replacement [Price: ₹599, requiresFasting: false, allowedTimeslots: ["09:00-12:00","12:00-15:00","15:00-18:00"]]
      - Laptop Keyboard Repair [Price: ₹1499, requiresFasting: false, allowedTimeslots: ["09:00-12:00","12:00-15:00","15:00-18:00"]]
      - AC Service [Price: ₹799, requiresFasting: false, allowedTimeslots: ["09:00-12:00","12:00-15:00","15:00-18:00"]]
  - [ ] Run integration tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Run seed verification → verify Repairs store has AC Service variant with all timeslot fields populated correctly → ✅ Done.

---

### 7.9 — CategoryGrid and ProductDetailPage Booking Awareness

**Root cause / Goal:**
The product details and list page currently assume all items are physical inventory which is added to a local shopping cart. Booking store products should bypass the cart completely, prompting users to book now rather than add to cart.

**Fix / Approach:**
- Include `store.storeType` in product API serializers (`GET /api/v1/products` and `GET /api/v1/products/:id`).
- `ProductDetailPage.tsx`: If `storeType === 'BOOKING_COMMERCE'`, replace the "Add to Cart" button with a primary "Book Now" button navigating to `/bookings/new?productId=&variantId=&storeId=`.
- `ProductGrid.tsx` / `ProductCard.tsx`: Replace the "Add" card button pill with a "Book" button pill navigating directly to the scheduling flow.

---

- [ ] **RED — Integration (`apps/api/src/modules/catalog/catalog-serializer.integration.test.ts`):**
  - [ ] Test: `GET /api/v1/products/:id` responds with an envelope that includes `store.storeType`.
  - [ ] **Run — confirm RED.**

- [ ] **RED — Unit / Component (`apps/web/src/pages/buyer/ProductDetailPage.test.tsx`):**
  - [ ] Test: Renders "Book Now" button and hides the quantity selector when the product store type is `BOOKING_COMMERCE`.
  - [ ] Test: Clicking "Book Now" navigates the browser to `/bookings/new` with variant and store query parameters.
  - [ ] Test: Renders standard "Add to Cart" button when store type is `QUICK_COMMERCE`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend & Frontend:**
  - [ ] [Controller] Update product serializer in `apps/api/src/modules/catalog/catalog.controller.ts` to fetch and append `store.storeType`.
  - [ ] [Component] Modify `apps/web/src/pages/buyer/ProductDetailPage.tsx` to handle conditional rendering.
  - [ ] [Component] Modify `apps/web/src/components/buyer/ProductCard.tsx` to display "Book" pill for booking store products.
  - [ ] Run unit and integration tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Navigate to AC Service details → check that button says "Book Now" and quantity selector is absent → click button → redirected to booking timeslot picker → ✅ Done.

---

### 7.10 — Booking Order Buyer History Integration

**Root cause / Goal:**
The buyer Order History page displays all orders under a quick-commerce format, lacking display states for scheduled dates, timeslots, and approval tracking.

**Fix / Approach:**
- Include `bookingOrder` relation details (`scheduledDate`, `timeslot`, `approvalStatus`) and `orderType` in `GET /api/v1/account/orders` response.
- `OrderHistoryPage.tsx`: Render a custom schedule card for booking orders. Show a color-coded approval status badge (PENDING_APPROVAL = yellow, APPROVED = green, REJECTED = red, COMPLETED = gray). Replace the standard "Reorder" button with a "Book Again" button which redirects to `/bookings/new`.

---

- [ ] **RED — Integration (`apps/api/src/modules/user/account-orders.integration.test.ts`):**
  - [ ] Test: `GET /api/v1/account/orders` returns `orderType` and a nested `bookingOrder` object containing `scheduledDate`, `timeslot`, and `approvalStatus` for booking orders.
  - [ ] **Run — confirm RED.**

- [ ] **RED — Unit / Component (`apps/web/src/pages/buyer/OrderHistoryPage.test.tsx`):**
  - [ ] Test: Card renders scheduling timeslot and date for a booking order.
  - [ ] Test: Renders a yellow "PENDING_APPROVAL" badge for pending booking orders.
  - [ ] Test: Renders a "Book Again" button which replaces the "Reorder" button.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend & Frontend:**
  - [ ] [Controller] Update `GET /api/v1/account/orders` handler to include `bookingOrder` relation and `orderType` fields.
  - [ ] [Component] Update `apps/web/src/pages/buyer/OrderHistoryPage.tsx` to conditionally render booking cards.
  - [ ] Run unit and integration tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Open buyer Order History page → verify booking order displays "Blood Sugar (Fasting)", scheduled time, yellow "PENDING_APPROVAL" badge, and "Book Again" button → ✅ Done.

---

### 7.11 — E2E Tests (Playwright)

**Root cause / Goal:**
We must write a comprehensive end-to-end integration test to verify the complete multi-actor booking checkout, approval, and rejection journeys, ensuring that standard quick-commerce flows remain completely unaffected by these changes.

**Fix / Approach:**
Write E2E test file `tests/e2e/booking-journey.spec.ts` using Playwright.

---

- [ ] **RED — E2E (`tests/e2e/booking-journey.spec.ts`):**
  - [ ] Test: Buyer navigates to Medical Tests category → selects Blood Sugar (Fasting) → verifies "Book Now" renders → clicks and lands on picker → asserts only morning timeslot "06:00-09:00" is selectable and fasting banner is visible → selects date and slot → confirms address → clicks confirm → lands on confirmation screen showing PENDING_APPROVAL.
  - [ ] Test: Store owner logs in → navigates to `/store/bookings` → clicks "Approve" on pending card → asserts card shifts to Upcoming → verifies buyer's screen changes to APPROVED via Socket.IO.
  - [ ] Test: Store owner rejects booking with reason "Equipment failure" → verifies buyer receives REJECTED state displaying the reason.
  - [ ] Test: Buyer tries to book on today's date when `leadDays = 1` → asserts calendar date is disabled and throws client-side validation error.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — E2E (Playwright Run):**
  - [ ] Run the complete E2E test suite — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Run `pnpm exec playwright test tests/e2e/booking-journey.spec.ts` → all test blocks resolve with passing logs → ✅ Done.

---

## Session Notes (Phase 7)

_(Append new entries here — never delete old entries.)_

### Session 1 — 2026-05-19 — Phase 7.1 Schema Migration
- **Test File Location:** Located the integration tests at [booking-schema.integration.test.ts](file:///c:/Users/Administrator/Desktop/GoRola/GoRola_app/apps/api/src/__tests__/integration/booking/booking-schema.integration.test.ts) because the Vitest configuration only matches patterns under `src/__tests__/**/*.test.ts`.
- **Database Unique Constraints:** Handled parallel test race conditions by using hyper-unique phone numbers and entity slugs (e.g. `+9199999971xx` and `*-71`), ensuring zero test failures from shared DB state.
- **Migration & Bootstrapping:** Successfully deployed `add_booking_commerce_schema` to the development DB, and synced the test DB via `pnpm --filter @gorola/api prisma:bootstrap:test`.
- **Type Safety Polish:** Removed all initial `@ts-ignore` directives once the database client was generated with the new schema, achieving zero ESLint and TypeScript compilation errors.
