# Current Project State: GoRola

## Active Milestone: Phase 6 — Core Operations & Enterprise Architecture
- **Current Phase:** Phase 6.20 — Universal Pagination (20/page), Merchant Card/Table View Toggles, Promotional Breakdown Unification & Admin Modal Parity — **COMPLETED ✅**
- **Next Phase:** Phase 6.21 — Tax Calculation Logic, GST Rules & Advanced Invoice Formatting — **QUEUED 🔮 (Pending Client Approval)**
- **Last Updated:** 2026-10-16

## Quality Gates Status (Phase 8.9 Complete)
- `pnpm typecheck`: 0 errors (clean across `packages/shared`, `packages/ui`, `apps/api`, `apps/web`)
- `pnpm lint`: 0 errors, 0 warnings across monorepo
- `apps/web test`: 111 test files, 709 tests passing (100% green)
- `packages/shared test`: 5/5 tests passing (100% green)
- Production Build: `apps/web` and `apps/api` build cleanly

## Session 99 Notes: Phase 8.9 Complete (Universal DRY DPDP Consent Forms, Canonical Shared Notice Registry & Component Consolidation)
- **Search Debounce Race Condition Fix (`AdminUsersPage.tsx`):**
  - Resolved race condition where an unconditional mount-time 300ms search debounce timer fired `setPage(1)` during user page transitions.
  - Guarded `setPage(1)` to trigger only when the trimmed query actually differs from the previous value.
- **Single Source of Truth Notice Registry (`packages/shared/src/consent-notices.ts`):**
  - Defined `CANONICAL_CONSENT_NOTICES` for all 5 statutory purposes (`OTP_AUTH`, `AGE_DECLARATION`, `ORDER_PROCESSING`, `MARKETING_COMMS`, `ANALYTICS`).
  - Standardized all titles, summaries, transparency prompts, modal trigger labels, checkbox labels, and 5-tier legal disclosures across the platform.
  - Zero text drift; pure helpers `getCanonicalNoticeText` and `isPurposeEssential` exported.
- **Universal Component & Hook (`apps/web`):**
  - Created `<ConsentOptInCard>` (`apps/web/src/components/consent/ConsentOptInCard.tsx`) with 3 display modes (`essential-gate`, `optional-opt-in`, `informational`), active consent indicators, error alerts, and disabled states.
  - Created `useRecordConsent` (`apps/web/src/hooks/useRecordConsent.ts`) hook with non-blocking error handling and query cache invalidation.
- **Consolidated All Platform Touchpoints (0 Duplicate Cards / 0 Hardcoded Text):**
  - Refactored `SavedAddressesPage.tsx`, `CheckoutPage.tsx`, `BookingTimeslotPage.tsx`, `LoginPage.tsx`, `AgeStep.tsx`, `PrivacySettingsSection.tsx`, `PrivacyPolicyPage.tsx`, `ConsentNoticeModal.tsx`, and `AnalyticsConsentBanner.tsx`.
- **Quality Gates:**
  - Strict TDD adhered to throughout: RED unit/component stubs written and failure confirmed before implementation.
  - 100% clean typecheck (`pnpm typecheck` 0 errors), 100% clean lint (`pnpm lint` 0 errors, 0 warnings), all test suites green.
- **Dedicated Pagination Card Containers:**
  - Upgraded pagination footers in `StoreBookingsPage.tsx`, `StoreOrdersPage.tsx`, and `OrderHistoryPage.tsx` into standalone floating cards (`bg-white border border-gorola-mint/20 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4`).
  - Solved visibility issues over background patterns with high-contrast text and clean button borders.
- **Admin Detail Sub-lists Card/Table Toggles & Persistent Pagination:**
  - Added Table vs Cards view mode toggles (`LayoutGrid` and `Table2` icons) to `AdminUserDetailPage.tsx`, `AdminStoreDetailPage.tsx`, and `AdminRiderDetailPage.tsx`.
  - Added persistent pagination bars across all detail sub-tables, remaining visible even when records $\le 20$ (showing "Page 1 of 1 (X total)" with disabled navigation).
- **Store Envelope Normalization:**
  - Fixed store picker crash in Admin Riders and Dashboard modals (`(stores ?? []).filter is not a function`) by safely handling `{ items, total }` envelopes alongside raw arrays.

## Session 97 Notes: Phase 6.20 Complete Implementation
- **Item 6.20.1 — Universal Promotional Breakdown Unification:**
  - Integrated `<PromotionalBreakdown>` into `BookingTimeslotPage.tsx` and all receipt views, replacing ad-hoc inline text with standardized collapsible breakdowns (`Store Offer (<title>)`, `Discount Code (<code>)`).
  - Added robust wrap/overflow handling (`break-words text-wrap max-w-full`) preventing container clipping on mobile.
  - Verified edge cases: zero discount, null discount, coupon only, store offer only, and long offer title (90+ chars).
- **Item 6.20.2 — Admin Order Details Modal Parity & Socket Thrashing Elimination:**
  - Replaced duplicate legacy inline modals in `AdminStoreDetailPage.tsx` and `AdminRiderDetailPage.tsx` with high-fidelity `<AdminOrderDetailModal>`.
  - Fixed socket thrashing by removing `orderDetail?.store?.id` from the socket connection effect dependency array in `AdminOrderDetailModal.tsx` and decoupling `join_store` room emission into a dedicated secondary effect.
- **Item 6.20.3 — Admin Orders Status Filter Dropdown Booking Parity & Status Badges:**
  - Renamed status filter options in `AdminOrdersPage.tsx`: `OUT_FOR_DELIVERY` -> `"Out for Delivery / On The Way"`, `DELIVERED` -> `"Delivered / Completed"`.
  - Harmonized status badge styling and formatting using `getStatusBadgeClasses(order.status)` and `formatStatusLabel(order.status, order.orderType)` across all admin and merchant tables.
- **Item 6.20.4 — Backend Pagination Engine (20 records/page default):**
  - Updated `OrderRepository.findByUserId` to accept `page` and `limit` (default: 20) with scoped Prisma count queries.
  - Updated `/api/v1/orders/history` query schema with `page` and `limit`.
  - Updated Admin endpoints `/api/v1/admin/users`, `/api/v1/admin/stores`, `/api/v1/admin/riders`, `/api/v1/admin/advertisements` with 20/page pagination and metadata envelopes (`{ items, total, page, limit, totalPages }`).
  - Updated default `limit` in `/api/v1/admin/orders` from 50 to 20.
  - Integration suites `order.history.test.ts`, `admin.pagination.test.ts`, and `admin.ads.test.ts` pass cleanly with exact boundary testing (20 vs 21 vs 22 items).
- **Item 6.20.5 — Merchant Store Portal: Card / Table View Toggles & 20/page Pagination:**
  - Added view toggle buttons (`LayoutGrid` and `Table2` icons) to `StoreOrdersPage.tsx` and `StoreBookingsPage.tsx` allowing instant switching between Card grid view and compact Table view without re-fetching.
  - Implemented 20/page pagination footers (`data-testid="store-orders-pagination"`, `data-testid="store-bookings-pagination"`) with previous/next controls and automatic page reset on filter change.
- **Item 6.20.6 — Universal Frontend Pagination (20 records/page):**
  - Implemented 20/page pagination across Buyer Order History (`OrderHistoryPage.tsx`) and Admin Portals (`AdminUsersPage.tsx`, `AdminStoresPage.tsx`, `AdminRidersPage.tsx`, `AdminAdvertisementsPage.tsx`, `AdminOrdersPage.tsx`, and detail sub-tables).
  - All views support page transitions, boundaries (disabling previous on page 1, disabling next on last page), and filter-triggered cursor resets.
- **Item 6.20.7 — Quality Gate Validation:**
  - Both `apps/api` and `apps/web` typecheck cleanly with 0 TypeScript errors.
  - Full lint across monorepo passed with 0 errors and 0 warnings.
  - 100% green across all 145 API test files (860 passing) and 109 Web test files (681 passing).
