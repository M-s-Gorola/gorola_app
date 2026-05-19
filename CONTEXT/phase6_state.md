# GoRola — Phase 6 State (Additional Features & Maintenance)

> **This file covers Phase 6: Additional Features, UX Optimizations, and Technical Debt.**
> Phase 6 is an ongoing phase for enhancements that fall outside the core business logic of previous phases.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name                      | Status   | Notes |
| ------- | ------------------------- | -------- | ----- |
| Phase 6.1 | Smart Redirect Navigation | COMPLETE | Logic implemented, E2E passing, and 75 medical tests seeded for manual verification. |
| Phase 6.2 | Subdomain Routing (Opt A) | NOT STARTED | Evolutionary plan drafted. Unlocked for implementation. |

---

## 📍 Last Updated

- **Date:** 2026-05-20
- **Session Summary:** Drafted Phase 6.2 — Subdomain Routing & Multi-Domain Integration plan using the standard TDD Instruction Guide format.
- **Next Session Must Start With:** Phase 6.2 — Hostname Context Detection & Routing Fallback (TDD setup).
- **In Progress Right Now:** Planning.
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

## Phase 6.2 Checklist — Subdomain Routing & Fallback

**Root Cause / Goal:**
Currently, `App.tsx` mounts a single unified router where all store routes are hardcoded behind `/store/*` and admin routes behind `/admin/*`. In production, store owners want to use `store.gorola.com/login` and admins `admin.gorola.com/login` directly without prefixing subpaths, while local automated tests (Vitest + Playwright) still require standard `/store` and `/admin` subpath routing on `localhost:5180`. We need a hostname detector that isolates the subdomain scope in production but provides a seamless unified path-based fallback in dev/test.

**Fix / Approach:**
Create a domain extraction helper (`subdomain-resolver.ts`) that returns `{ isSubdomainMode: boolean, subdomain: 'store' | 'admin' | null }`. 
Update `App.tsx` to conditionally select the routing configuration:
* If in subdomain mode (e.g. `store.gorola.com`), map `/` to the merchant login/dashboard tree.
* If in standard/fallback mode (e.g. `localhost` or `gorola.com`), keep the current unified route tree.

---

- [ ] **RED — Unit / Integration (`apps/web/src/app/router.subdomain.test.tsx`):**
  - [ ] Test: Mock `window.location.hostname` as `"store.gorola.com"`. Verify that rendering `<App />` on initial entry `/` directly renders the `StoreLoginPage` heading ("Store Partner Portal").
  - [ ] Test: Mock `window.location.hostname` as `"admin.gorola.com"`. Verify that rendering `<App />` on initial entry `/` directly renders the `AdminLoginPage` heading ("System Admin Sign In"). *Note: The `AdminLoginPage` must be created as part of this phase, as it doesn't exist yet (currently `/admin` renders a `PlaceholderPage`).*
  - [ ] Test: Mock `window.location.hostname` as `"localhost"`. Verify that rendering `<App />` on initial entry `/store` still renders the `StoreLoginPage` (retaining full path-based backwards compatibility).
  - [ ] **Run — confirm RED (subdomain options do not exist, and `/` always mounts `HomePage` regardless of hostname).**

- [ ] **GREEN — Frontend (Resolver → Router Mapping):**
  - [ ] [Resolver] Create `apps/web/src/lib/subdomain-resolver.ts`:
    ```typescript
    export function resolveSubdomain(hostname: string) {
      const isLocal = hostname.includes("localhost") || hostname.includes("127.0.0.1");
      if (isLocal) {
        return { isSubdomainMode: false, subdomain: null };
      }
      if (hostname.startsWith("store.")) {
        return { isSubdomainMode: true, subdomain: "store" as const };
      }
      if (hostname.startsWith("admin.")) {
        return { isSubdomainMode: true, subdomain: "admin" as const };
      }
      return { isSubdomainMode: false, subdomain: null };
    }
    ```
  - [ ] [Router] Separate routes in `apps/web/src/app/routes/` into modular files:
    * `buyer.tsx` (all standard shopper pages)
    * `store.tsx` (merchant dashboard and auth pages, supporting both relative and fallback `/store` roots)
    * `admin.tsx` (admin management pages, supporting both relative and fallback `/admin` roots)
  - [ ] [Component] Update `apps/web/src/App.tsx` to select the router dynamically based on `resolveSubdomain(window.location.hostname)` results.
  - [ ] [App] Update the bootstrap `useEffect` in `App.tsx` to also trigger `bootstrapStoreOwnerAuthSession()` when `resolveSubdomain(window.location.hostname).subdomain === 'store'`, not just when `pathname.startsWith('/store')`
  - [ ] Run router integration test — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Simulate browsing to `store.gorola.com` → router resolves to `store` subdomain context → user sees the Store Owner login form directly at the root `/` path → ✅ Done.

---

### Path and Redirect Namespace Alignment

**Root Cause / Goal:**
Currently, `StoreRoute.tsx` (the route guard) and components like `StoreLoginPage.tsx` contain hardcoded absolute path redirects (e.g. `navigate('/store/2fa')` or `navigate('/store/dashboard')`). When using the subdomain `store.gorola.com`, `/store/dashboard` does not exist; the merchant dashboard is mounted directly at `/dashboard`. Hardcoded path prefixes will break navigation, logging out, or 2FA setup screens under the subdomain.

**Fix / Approach:**
Introduce a helper function `resolveInternalPath(path: string, subdomainMode: boolean)` or make route guards namespace-relative, replacing hardcoded strings with dynamically built route paths based on whether the app is running in Subdomain mode or Fallback mode.

---

- [ ] **RED — Unit (`apps/web/src/app/route-guards.subdomain.test.tsx`):**
  - [ ] Test: Under `store.gorola.com` (subdomain mode), rendering `StoreRoute` with an unverified 2FA session redirects to `/2fa` instead of `/store/2fa`.
  - [ ] Test: Under `localhost` (fallback mode), rendering `StoreRoute` with an unverified 2FA session redirects to `/store/2fa`.
  - [ ] Test: Under `admin.gorola.com` (subdomain mode), `AdminRoute` redirects an unauthenticated user to `/login` instead of a namespaced admin login. Confirm this is a known gap to address.
  - [ ] **Run — confirm RED (guards are currently hardcoded to `/store/2fa` and `/admin/2fa`).**

- [ ] **GREEN — Frontend (Guards → Path Helper):**
  - [ ] [Resolver] Expand `apps/web/src/lib/subdomain-resolver.ts` to add a dynamic path utility:
    ```typescript
    export function getScopedPath(target: string, scope: 'store' | 'admin' | 'buyer', isSubdomain: boolean): string {
      if (isSubdomain) {
        // e.g. '/store/2fa' -> '/2fa' when browsing store.gorola.com
        return target.replace(/^\/(store|admin)/, '') || '/';
      }
      return target;
    }
    ```
  - [ ] [Guard] Refactor `StoreRoute.tsx` and `AdminRoute.tsx` to use `getScopedPath` for their auth and 2FA redirection paths.
  - [ ] [Component] Refactor `StoreLoginPage.tsx`, `StoreTwoFactorPage.tsx`, and standard merchant layouts to construct dynamic navigate targets instead of absolute static strings.
  - [ ] Run guard unit tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Log in on `store.gorola.com` with 2FA unconfigured → guard intercepts and safely redirects to `store.gorola.com/2fa` (no `/store` subpath visible) → completing 2FA routes straight to `store.gorola.com/dashboard` → ✅ Done.

---

### End-to-End Subdomain Smoke Test (Playwright)

**Goal:**
Validate that both standard subpath layouts (`http://localhost:5180/store/login`) and mocked subdomain headers function without regression across Playwright pipelines.

*Note:* For the subdomain E2E test to work, `store.gorola.com` must resolve to `127.0.0.1` — either via an OS-level `/etc/hosts` entry OR by using Playwright's `extraHTTPHeaders: { Host: 'store.gorola.com' }` to spoof the `Host` header without real DNS. The Playwright `extraHTTPHeaders` spoofing approach will be used to ensure portability and automated execution without requiring local host file adjustments.

---

- [ ] **RED — E2E (`tests/e2e/subdomain.spec.ts`):**
  - [ ] E2E Test: Visit `http://localhost:5180/store/login`. Assert store login page displays correctly. (Ensures standard backwards compatibility has not regressed).
  - [ ] E2E Test: Configure browser context with a custom hostname header `store.gorola.com` pointing to the dev port. Visit `http://store.gorola.com:5180/login`. Assert the page resolves and displays the store owner login form.
  - [ ] **Run — confirm RED (subdomain requests fail or return buyer homepage).**

- [ ] **GREEN — Playwright / Dev Server:**
  - [ ] [Server] Verify Vite dev server configuration (`vite.config.ts`) allows virtual host matching if needed (set `server.host: true` or custom headers).
  - [ ] [E2E] Implement `tests/e2e/subdomain.spec.ts` matching the TDD requirements.
  - [ ] Run Playwright suite — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Playwright visits `store.gorola.com/login` → page loads merchant forms → playwright logs in → merchant panel loads successfully at `/dashboard` → ✅ Done.

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
