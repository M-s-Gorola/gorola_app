# GoRola — Phase 6 State (Additional Features & Maintenance)

> **This file covers Phase 6: Additional Features, UX Optimizations, and Technical Debt.**
> Phase 6 is an ongoing phase for enhancements that fall outside the core business logic of previous phases.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name                      | Status   | Notes |
| ------- | ------------------------- | -------- | ----- |
| Phase 6.1 | Smart Redirect Navigation | COMPLETE | Logic implemented, E2E passing, and 75 medical tests seeded for manual verification. |

---

## 📍 Last Updated

- **Date:** 2026-05-16
- **Session Summary:** Implemented the "Smart Redirect" logic in the catalog to improve UX for the "Medical tests" category. Hardened the E2E test suite by resolving persistent shutdown hangs and resource leaks (OTEL/Redis).
- **Next Session Must Start With:** Phase 6.2 — [TBD by User].
- **In Progress Right Now:** None.
- **Current Blocker:** None.

---

## Phase 6.1 Checklist — Smart Redirect Navigation

**Root Cause / Goal:**
When a category contains only one sub-category (e.g., "Medical tests" -> "All Tests"), forcing the user to click through a sub-category grid with a single item is redundant and adds friction. Clicking the category should lead directly to the product list for that single sub-category.

**Fix / Approach:**
Implemented a `useEffect` hook in `SubCategoryGrid` that detects when only one sub-category is returned and triggers a programmatic redirect (`replace: true`).

- [x] **RED — Unit Test (`SubCategoryGrid.test.tsx`):**
  - [x] Test: When `subCategories.length === 1`, `navigate` is called with the correct path and `{ replace: true }`.
- [x] **GREEN — Frontend Implementation:**
  - [x] [Component] Update `SubCategoryGrid.tsx`: Add redirect logic in a `useEffect` hook.
  - [x] [Component] Update `CategoryGrid.tsx`: Remove hardcoded filters to allow "Medical tests" to appear.
- [x] **RED — E2E Test (`catalog.spec.ts`):**
  - [x] Test: Click "Medical tests" card → verify URL skips sub-category grid and lands on `/categories/medical-tests/all-tests`.
- [x] **GREEN — Data & Stabilization:**
  - [x] [Seeding] Update `dummy-data.ts`: Add "Medical tests" category and "All Tests" sub-category.
  - [x] [Tests] Update `home.spec.ts`: Update category count assertion from 2 to 3.
  - [x] [Tests] Resolve E2E Shutdown Hang: Disable OTEL in E2E and switch Redis `quit()` to `disconnect()`.
  - [x] [Tests] Add shutdown failsafe in `app.ts` to prevent worker timeouts.

---

## Session Notes (Phase 6)

### 2026-05-16: E2E Stabilization & Smart Redirect
- **Problem:** E2E tests were hanging for 5 minutes after passing (36/36) because of OpenTelemetry trying to flush traces to a non-existent collector.
- **Solution:** Added `OTEL_ENABLED: 'false'` to `playwright.config.ts` and added a 10s failsafe to `app.ts` shutdown.
- **Problem:** "Medical tests" category was hidden in UI.
- **Solution:** Removed hardcoded filter list in `CategoryGrid.tsx`.
- **Problem:** Seeding to Railway (staging) was slow and caused `Timed out fetching a new connection from the connection pool` (P2024).
- **Solution:** Refactored `seed-medical-tests.ts` and `dummy-data.ts` to use **Chunked Parallel Seeding** (batches of 5). This bypasses network latency without exceeding the database connection limit.
- **Result:** E2E suite is stable, and remote seeding is now fast and reliable.

### 2026-05-18: Staging Deployment Mismatch Fix
- **Problem:** The staging API was successfully updated and seeded with 3 active categories (including "Medical tests"), but the live staging website (`gorola-staging.vercel.app`) was still rendering only 2 categories (Groceries and Medical).
- **Investigation:** 
  1. Verified that the staging database successfully holds the new "Medical tests" category and all 77 products, and that the staging API is returning all 3 categories in the browser network panel.
  2. Inspected `.github/workflows/deploy-vercel.yml` and found a configuration mismatch: for the `staging` environment, Vercel was deploying without the `--prod` flag (`vercel deploy --yes`).
  3. In a multi-project Vercel setup (where staging and production are separate Vercel projects), deploying without `--prod` only creates a Preview deployment and does not update the project's production domain (`gorola-staging.vercel.app`).
- **Solution:** Modified `deploy-vercel.yml` to always use the `--prod` flag (`vercel deploy --prod --yes`) since staging and production are isolated by their respective `VERCEL_PROJECT_ID` environment variables.
- **Result:** Pushing/merging to `develop` branch will now correctly promote the staging Vercel deployment to production for that project, updating the staging link (`gorola-staging.vercel.app`) immediately.
