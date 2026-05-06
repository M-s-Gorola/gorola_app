# GoRola — Current State

> **ALWAYS read this file first at the start of every session.**
> Update this file at the END of every session before closing Cursor.
> This is the single source of truth for where the project is right now.

---

## 📍 Last Updated

- **Date:** 2026-05-06
- **Session Summary:** **Session 101 — Schema Hardening (OTPLog Removal).** Completed **W-018** (OTPLog Removal). Removed redundant Prisma model to align with Redis-only architecture. Verified with 507 tests green.
- **Next Session Must Start With:** Phase 2.19 — Wiring Hardening (W-019: Cart Sync Stale authority logic refinement / Phase 2.20 Profile Page).


---

## 🚦 Overall Phase Status

| Phase   | Name                 | Status         | Notes                                                                                                                                                                                                                                            |
| ------- | -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 1 | NFR Foundation       | ✅ COMPLETE    | 1.8 **CI+CD** in **`ci-cd.yml`** (Vercel + Railway on `main`, path-gated), 1.9 hosting config, **1.10** smoke + secrets. Optional: 1.8 coverage / branch rules in GitHub                                                                         |
| Phase 2 | Buyer Web Experience | 🔄 IN PROGRESS | **2.1–2.18 complete**. **Phase 2.19 (Wiring Hardening)** in progress — W-011 to W-018 complete. Full quality gate GREEN. |
| Phase 3 | Store Owner Panel    | 🔴 NOT STARTED | After Phase 2 complete                                                                                                                                                                                                                           |
| Phase 4 | Admin Panel          | 🔴 NOT STARTED | After Phase 3 complete                                                                                                                                                                                                                           |
| Phase 5 | Rider Interface      | ⏸️ DEFERRED    | Stubs only in Phase 1                                                                                                                                                                                                                            |

---

## ✅ Completed Tasks (Append only — never delete)

- **Session 1 (Phase 1.1 Setup):** Initialized `GoRola_app` monorepo structure and base tooling (pnpm workspace, strict TypeScript, ESLint flat config, Prettier, `.env.example`, dotenv-safe startup config, package scaffolding, local git init with `main`/`develop` branches).
- **Session 3 (Phase 1.3 User repository):** Vitest + Prisma integration tests for `UserRepository`; `getPrismaClient` singleton; `DATABASE_URL_TEST` documented in `.env.example`.
- **Session 4 (Phase 1.3 Store repository):** `StoreRepository` + `store.repository.test.ts` with full-store graph cleanup for isolated integration runs.
- **Session 5 (Phase 1.3 Store owner repository):** `StoreOwnerRepository` + `store-owner.repository.test.ts`; maps `P2003` to `NotFoundError` for invalid `storeId`.
- **Session 6 (Phase 1.3 Admin repository):** `AdminRepository` + `admin.repository.test.ts`; TDD RED (`TDD_RED` throws) then GREEN.
- **Session 7 (Phase 1.3 Catalog repositories):** `category.repository.ts`, `product.repository.ts`, `variant.repository.ts` (`ProductVariantRepository`) + matching integration tests; each preceded by RED run.
- **Session 8 (Phase 1.3 Cart repository):** `cart.repository.ts` + `cart.repository.test.ts`; TDD RED (`TDD_RED` throws) then GREEN with quantity validation and cart-item merge semantics.
- **Session 9 (Phase 1.3 Order repository):** `order.repository.ts` + `order.repository.test.ts`; TDD RED (`TDD_RED` throws) then GREEN with order-status history coverage.
- **Session 10 (Phase 1.3 Address repository):** `address.repository.ts` + `address.repository.test.ts`; TDD RED (`TDD_RED` throws) then GREEN with default-address switching.
- **Session 11 (Phase 1.3 Advertisement repository):** `advertisement.repository.ts` + `advertisement.repository.test.ts`; TDD RED (`TDD_RED` throws) then GREEN with time-window filtering.
- **Session 12 (Phase 1.3 Remaining repositories):** `offer.repository.ts`, `discount.repository.ts`, `feature-flag.repository.ts`, `audit.repository.ts`, and `delivery/rider.repository.ts` + integration tests; each followed RED-stub -> GREEN.
- **Session 13 (Phase 1.4 Bootstrap foundation):** Added strict-TDD integration tests for server bootstrap and implemented `server.ts` / `app.ts` + `lib/redis.ts`; health and error-envelope integration coverage now included.
- **Session 14 (Phase 1.4 completion hardening):** Added startup/listen and secure-cookie tests, implemented bootstrap hardening (`app.start.test.ts`, `server.bootstrap.test.ts`), and completed Phase 1.4 checklist items.
- **Session 15 (Phase 1.5 Buyer auth service):** Added tests-first buyer auth service suite, then implemented `auth.service.ts` (`sendOtp`, `verifyOtp`, `refreshToken`, `logout`) with Redis + token service flow.
- **Session 16 (Phase 1.5 Buyer auth controller + middleware):** Added tests-first auth controller/middleware suites, then implemented `auth.controller.ts`, `auth.middleware.ts`, and strict Zod parsing in `auth.schema.ts`.
- **Session 17 (Phase 1.5 Store owner auth service):** Added tests-first store-owner auth service suite, then implemented `store-owner-auth.service.ts` including login rate limit + optional 2FA flow.
- **Session 18 (Phase 1.5 Admin auth service):** Added tests-first admin auth service suite, then implemented `admin-auth.service.ts` with mandatory 2FA + rate limiting.
- **Session 19 (Phase 1.5 auth integration closure):** Added tests-first Store Owner/Admin auth route coverage in `auth.controller.test.ts`, then implemented matching route/schema wiring in `auth.controller.ts` and `auth.schema.ts`; full API suite now at 215 passing tests.
- **Session 20 (Phase 1.6 observability):** TDD: `lib/logger.ts`, `lib/telemetry.ts`, `server` request log hook + `pinoTestStream` test option, `server.request-logging.test.ts` + `telemetry.test.ts`, `app.ts` telemetry bootstrap; 224 API tests.
- **Session 21 (Phase 1.7 health check):** TDD: `lib/health.ts`, `lib/api-version.ts`, `CreateServerOptions.healthProbes` / `nowIso`, `health.scenarios.test.ts` + `health.test.ts`; 238 API tests.
- **Session 22 (Phase 1.8 CI, no deploy):** `.github/workflows/ci.yml` with service containers and full quality gate; deploy not added.
- **Session 23 (CI follow-up, no git):** Root scripts `ci:quality` and `ci:prisma`, workflow: `permissions`, `timeout-minutes`, stricter `pg_isready -U postgres`; local lint/typecheck/test/build verified.
- **Session 24 (1.8 checklist reconciliation):** Documented that **1.8 core CI is complete**; unchecked = deploy/optional coverage/branch settings; 1.10 “CI green” ticked; next focus 1.9.
- **Session 25 (1.9 Railway config, TDD):** `lib/entrypoint.ts` + `app.ts` main guard, `GoRola_app/railway.toml` + `Procfile`, `prisma` in API `dependencies`, build runs `prisma generate`; `railway.config.test.ts` + `entrypoint.test.ts` (248 API tests); manual Railway/Vercel still required.
- **Session 26 (1.10 production smoke):** Deployed API on Railway; fixed Redis `REDIS_URL` reference; public `/api/health` returns `status: "ok"` with DB + Redis ok; checklist **1.10** primary smoke row marked complete.
- **Session 27 (Phase 1.3 stock + order orchestration, TDD):** Added `StockMovement` model, CHECK `stockQty >= 0`, `stock-movement.repository.ts`, `ProductVariantRepository` stock helpers, `OrderService` placement/cancel with movements; `UnprocessableEntityError` in shared; `pnpm --filter @gorola/api prisma:migrate:test-db` for test DB; **277** API tests green.
- **Session 28 (1.9 Vercel live + API smoke from browser):** Vercel project deploys `apps/web` per `vercel.json`; production **`VITE_API_BASE_URL`** → Railway API; frontend calls **`GET /api/health`** — **`data.status: "ok"`**, HTTP 200 — confirms **CORS** and connectivity. `current_state` Important URLs updated.
- **Session 29 (Phase 1.10 + status text sync):** **1.10** was already complete in the checklist (all items [x]); **Overall Phase Status** and **In Progress** updated so Phase 1 reads **complete** and focus moves to **Phase 2**.
- **Session 30 (1.8 + monorepo doc — unified CI+CD):** `current_state` updated to match **`.github/workflows/ci-cd.yml`**: one workflow for **CI** + **path filters** + **Vercel** + **Railway** deploys; removed stale **`ci.yml` / `deploy.yml`** references in this file.
- **Session 31 (Phase 2.1 shadcn):** `pnpm dlx shadcn@latest init -t vite -y -b radix -p nova` in `apps/web` + add component set; lockfile updated (removed unused `@fontsource-variable/geist`); strict TS/ESLint fixes in generated `ui` files.
- **Session 32 (Phase 2.1 stack, TDD):** Router, Query, Zustand, `api.ts`, RHF+Zod, Vitest/RTL, `HomePage` + `App` routes; colocated `*.test.ts` / `*.test.tsx`.
- **Session 33 (Phase 2.2 design tokens + shared UI):** Split CSS into `tokens` / `fonts` / `globals`; keyframes + utility classes; `TopographicBg`, `WeatherBanner`, `ETABanner` + tests; `HomePage` preview strip.
- **Session 34 (Phase 2.3 Lenis + GSAP):** `lib/gsap.ts`, `lib/lenis.ts`, `useGorolaMotion`, `App` init; `gsap-context-cleanup` + `useGorolaMotion` tests; jsdom `matchMedia` / `ResizeObserver` in `test/setup`.
- **Session 35 (Phase 2.4 shell + routing, strict TDD):** RED tests first for guards/nav/layout; added `GorolaMountainMark` (separate SVG component), `BuyerNav`, `BuyerLayout`, `BuyerFooter`, and `app/routes/guards.tsx`; moved QueryClientProvider + Toaster into `App`; added route stubs and RBAC role in `auth.store`; GREEN with `ci:quality`.
- **Session 36 (Phase 2.5 hero section, strict TDD):** Added RED tests in `HeroSection.test.tsx`, then stubbed `HeroSection` and confirmed RED functional failures before GREEN implementation. Implemented `HeroSection` with `TopographicBg` + `.noise-overlay`, `gsap.context()` timeline for logo/wordmark/tagline/CTA/ETA, cleanup revert, weather-mode slate copy, and saffron pill CTA scrolling to categories. Added `pages/buyer/HomePage.tsx` and switched `App.tsx` to use it; retained compatibility re-export in `pages/HomePage.tsx`.
- **Session 37 (Phase 2.6 category grid, strict TDD):** Added RED tests in `CategoryGrid.test.tsx` for loading, success, empty, error, and navigation behavior; created `CategoryGrid` stub and confirmed RED failures; then implemented GREEN with `useQuery` categories fetch, state UIs, and `/categories/:slug` navigation. Added GSAP stagger entry animation for cards with conditional ScrollTrigger (avoids test-env plugin warning), wired `CategoryGrid` into `pages/buyer/HomePage.tsx`, and updated `router.test.tsx` to wrap `HomePage` in `QueryClientProvider`.
- **Session 38 (Backend/frontend API alignment, strict TDD):** Added RED integration tests: `server.cors-credentials.test.ts` (expects `Access-Control-Allow-Credentials: true`) and `category.controller.test.ts` (`GET /api/v1/categories` success envelope, active-only ordering). Added `modules/catalog/category.controller.ts` stub and confirmed RED failures, then implemented GREEN route handler using `CategoryRepository.findAll()`, enabled Fastify CORS `credentials: true` in `server.ts`, and added `src/routes.ts` with `registerAppRoutes` wired into `app.ts` `createServer({ registerRoutes })`. Verification: `pnpm --filter @gorola/api lint`, `typecheck`, targeted new tests, and full API tests all green (279 passing).
- **Session 39 (Docs hardening: Phase 2.61 + API Contract Gates):** Added **Phase 2.61** to Phase 2 checklist for contract alignment and drift-prevention, including categories/CORS closure and explicit auth runtime wiring validation. Added **API Contract Gate** bullets to Phase 2.7+ sections so future work is tracked as vertical slices (UI + backend endpoint + backend tests + runtime route registration + frontend tests).
- **Session 40 (Docs hardening: universal API Contract Gate):** Extended API Contract Gate policy beyond buyer phases by adding explicit gate blocks at the top of **Phase 3** and **Phase 4** checklists in `current_state.md`. Also added a global rule in `rules_and_spec.md` (“Universal Phase Completion Gate”) so all future phases must satisfy UI + backend endpoint + integration tests + runtime route registration + frontend test validation before being marked complete.
- **Session 41 (Docs hardening: include Phase 5 in universal gate):** Updated global API Contract Gate language to explicitly include **rider/Phase 5** and added a Phase 5 checklist placeholder section with mandatory gate bullets for future rider implementation.
- **Session 42 (Phase 2.61 auth runtime wiring, strict TDD):** Added RED integration test `auth.runtime-routes.test.ts` asserting `/api/v1/auth/buyer/send-otp` is reachable via runtime `registerAppRoutes`; confirmed RED (404). Then wired `registerAuthRoutes` in `src/routes.ts` with runtime auth deps (buyer flow operational for route reachability) and confirmed GREEN. Verification: `pnpm --filter @gorola/api lint`, `typecheck`, and integration runs for `auth.runtime-routes`, `auth.controller`, and `category.controller`.
- **Session 43 (Phase 2.61 local dummy-data bootstrap):** Added `apps/api/scripts/bootstrap-local-db.cjs` to load root `.env` and run `prisma migrate deploy && prisma db seed`; added `apps/api/scripts/verify-local-seed.cjs` to assert required active category slugs (`groceries`, `medical`) and active product count for buyer pages. Added workspace scripts: `db:local:bootstrap`, `db:local:seed`, `db:local:verify-seed`. Local verification run succeeded on `gorola_dev` with expected seeded categories/products.
- **Session 44 (Phase 2.7 product listing slice, strict TDD):** Added RED integration tests for `GET /api/v1/products` in `product.controller.test.ts`, added stub product route, then implemented GREEN via `product.controller.ts` + `ProductRepository.listForBuyer()` and runtime registration in `routes.ts`. Added frontend RED tests for product grid envelope/loading/empty/error/debounce, stubbed `ProductGrid`, then implemented GREEN baseline `ProductGrid` and `CategoryPage` route with passing web tests.
- **Session 45 (Phase 2.7 frontend continuation, strict TDD):** Added RED tests for `CategoryPage` slug->categoryId resolution and `ProductGrid` retry/pagination behavior, then implemented GREEN by resolving category IDs via `/api/v1/categories`, passing `categoryId` to product fetches, adding retry button refetch in error state, and adding next-page loading (`Load more`) wired to cursor pagination.
- **Session 46 (Phase 2.7 frontend continuation, strict TDD):** Added RED tests in `ProductGrid.test.tsx` for intersection-observer pagination trigger and optimistic cart controls (`Add` then `+/-`), confirmed RED, then implemented GREEN by replacing manual load-more interaction with a sentinel observer and adding optimistic cart mutations with background `POST /api/v1/cart/items` sync.
- **Session 47 (Phase 2.7 completion, strict TDD):** Added RED tests for `ProductGrid` loading skeleton count and variant-id cart payload plus backend `product.controller` variant-id response contract; implemented GREEN by exposing `highestPricedVariantId` from catalog API, wiring `ProductGrid` cart actions to that variant id, adding 12-card skeleton loading grid, and adding GSAP + ScrollTrigger entry animation for new cards. Verified with API/web targeted tests and package typechecks.
- **Session 48 (Phase 2.8 start, strict TDD):** Added backend RED integration tests for `GET /api/v1/products/:id` detail and not-found behavior, then implemented GREEN route in `product.controller.ts` and `ProductRepository.getDetailForBuyer()` including active variant payload. Added frontend RED tests and implemented `pages/buyer/ProductDetailPage.tsx` + `/products/:id` app route with variant pill selector, selected-price updates, quantity +/- clamped by stock, add-to-cart API call with variant+quantity, loading skeleton, and GSAP page-entry animation. Verified with targeted lint/typecheck/test on API and web packages.
- **Session 49 (Phase 2.8 hardening, strict TDD):** Added RED frontend tests for product-detail error state coverage and out-of-stock add-to-cart disable behavior, then implemented GREEN by disabling add-to-cart and quantity increment when selected variant stock is zero and guarding cart mutation path. Re-verified API/web lint + typecheck and targeted detail/controller tests.
- **Session 50 (Phase 2.9 start, strict TDD):** Added RED integration tests in `cart.controller.test.ts` for runtime cart read/mutate lifecycle and validation errors, then implemented GREEN via new `modules/cart/cart.controller.ts` and route registration in `routes.ts`. Added RED frontend tests in `CartDrawer.test.tsx`, then implemented GREEN `CartDrawer` + `BuyerLayout`/`BuyerNav` wiring with open-from-nav behavior, empty state, line item quantity/remove actions, subtotal+delivery+total summary, payment-method selector (COD default), and discount-apply API call hook.
- **Session 51 (Phase 2.9 completion, strict TDD):** Added RED frontend tests for discount invalid/expired messaging, remove-item API call, feature-flag gated UPI/Card methods, and proceed-checkout enabled/disabled states; implemented GREEN in `CartDrawer` with error handling, labeled remove actions, checkout CTA state, and responsive mobile-bottom-drawer/desktop-sidebar container behavior. Re-verified cart and nav tests plus package lint/typecheck.
- **Session 52 (Phase 2.10 OTP login flow, strict TDD):** Added RED frontend tests (`LoginPage.test.tsx`) for phone validation, send-OTP/verify payloads, countdown+resend, error envelopes (429 send, attempts remaining / lockout on verify), and post-login redirect semantics. Implemented `LoginPage` + wired `/login`; extended `verify-otp` success payload (`userId`, `phone`, `name`) and tightened `AuthService` OTP error payloads; updated `ProtectedRoute`/role guards with `location` state for safe return navigation; expanded buyer `useAuthStore` session shape. Verified web (lint, typecheck, 86 Vitest tests) + API auth tests.
- **Session 53 (Phase 2.10.1 buyer auth plumbing, strict TDD):** `ensureBuyerByPhone`, `OtpProvider` + noop provider, random OTP + test-only `GOROLA_TEST_OTP`, `BuyerTokenService` (RS256, Redis refresh rotation), runtime wiring in `routes.ts`, `auth.buyer-flow.integration.test.ts` + unit tests, `LoginPage` verify narrowing for `userId`, `.env.example` JWT/test OTP notes; §2.61 buyer auth note superseded to reference 2.10.1 wiring.
- **Session 54 (Railway OTP testing bridge, post-2.10.1):** Diagnosed browser CORS console noise as downstream from Railway `502` when API boot fails in `NODE_ENV=production` without valid JWT PEMs. Added temporary env-gated OTP fallback `GOROLA_DUMMY_OTP` (fixed six digits, e.g. `123456`) for manual login testing before SMS provider integration; retained `NODE_ENV=production` and JWT requirements. Added unit tests for override and `.env.example` production guidance.
- **Session 55 (Cross-site refresh cookie fixes on Railway/Vercel):** Updated refresh-token cookie policy in `auth.controller.ts` for cross-site browser behavior: production uses `SameSite=None` + `Secure`, follow-up hardening adds `Partitioned` for Chrome CHIPS warning, and logout clear path now mirrors the same cookie attributes. Repo scan confirms impact area is auth cookie flows (buyer/store-owner/admin), not broader app modules. Decision log DECISION-020 updated accordingly; API lint/typecheck re-verified green.
- **Session 56 (Post-login hardcoded behavior fixes, web):** Patched `BuyerNav` to render from auth state (buyer label + `Logout` when `role === "BUYER"`, `Login` otherwise) so OTP-verified users no longer see stale login CTA. Patched `CartDrawer` to replace hardcoded `MOCK_USER_ID` (`buyer-local`) with `useAuthStore().userId` for cart `PUT/DELETE` payloads/params, preventing post-login cart drift against wrong identity. Updated tests in `BuyerNav.test.tsx` and `CartDrawer.test.tsx`; web lint/typecheck + targeted tests green.
- **Session 57 (Checklist integrity + logout API connection audit):** Wired `BuyerNav` logout to backend revoke endpoint (`POST /api/v1/auth/buyer/logout`) and added regression test asserting request dispatch. Audited Phase 2.7–2.10.1 UI API calls against registered runtime routes; confirmed one mismatch: `POST /api/v1/promotions/discounts/validate` not implemented though previously marked complete in 2.9. Reopened affected 2.9 checklist items and added explicit guardrail: checklist rows must remain unchecked until runtime API connectivity is verified.
- **Session 58 (Promotion discount validate wiring closure):** Implemented `modules/promotion/discount.controller.ts` with `POST /api/v1/promotions/discounts/validate`, registered route via `registerPromotionRoutes` in runtime `registerAppRoutes`, and added integration tests (`discount.controller.test.ts`) proving valid and invalid discount paths through runtime route graph. 2.9 checklist drift resolved and items re-closed after runtime verification.
- **Session 59 (Startup refresh bootstrap + mobile nav visibility):** Added `bootstrapBuyerAuthSession()` in `apps/web/src/lib/api.ts` and invoked it at app startup (`App.tsx`) to attempt one cookie-backed buyer refresh on reload. Updated auth controller refresh/logout routes to resolve refresh token from request body or `refreshToken` cookie for bootstrap compatibility. Refactored `BuyerNav` mobile layout to keep search input visible and always show login/logout text on small screens. Verified with API lint/typecheck + `auth.controller.test.ts`, and web lint/typecheck + `BuyerNav`/`LoginPage`/`api` tests.
- **Session 60 (Phase 2.11 checkout + orders API, strict TDD):** RED integration tests (`order.controller.test.ts`) for saved/new-address placement + short-landmark 400; implemented `BuyerCheckoutService`, Zod `order.schema.ts`, `registerOrderRoutes` POST `/api/v1/orders`, buyer `GET /api/v1/addresses`; `address.repository.ts` helper `findByIdForBuyer`. RED `address.controller.test.ts` then GREEN listing. Web RED `CheckoutPage.test.tsx`, GREEN `CheckoutPage.tsx`, `/checkout` ProtectedRoute + cart proceed navigation. **`pnpm ci:quality`** green (**303** API tests, **92** web tests).
- **Session 61 (Phase 2.11 optional map pin, strict TDD):** `leaflet` + `@types/leaflet`; `AddressMapPicker` + `AddressMapPicker.test.tsx` (mocked `leaflet` map/marker/tileLayer); `CheckoutPage` integration test for `lat`/`lng` on new-address place order; `vite-env.d.ts` `*.png`; checklist 2.11 optional map row closed.
- **Session 62 (Cart/order wiring fix after Railway seed smoke):** Investigated checkout failure (`VALIDATION_ERROR: Cart is empty`) and zero subtotal bug. Root cause: cart add calls from `ProductGrid`/`ProductDetailPage` omitted `userId`, and grid decrement sent invalid cart `POST` with `quantity=0`. GREEN fix: add buyer `userId` to cart add payloads, use `PUT`/`DELETE` for qty mutations, and store `unitPrice` + `variantLabel` in `useCartStore` so subtotal reflects line prices. Added/updated tests in `ProductGrid.test.tsx`, `ProductDetailPage.test.tsx`, `cart.store.test.ts`; targeted Vitest run green (20 tests).
- **Session 63 (Phase 2.11.1 wiring audit + first fix, strict TDD):** Ran cross-app wiring audit and created explicit 2.11.1 backlog for contract and navigation consistency. Fixed category page flash-of-wrong-products by gating `ProductGrid` render until slug→categoryId resolves in `CategoryPage.tsx`; added regression test `does not request unfiltered products before category id resolves` in `CategoryPage.test.tsx`. Verified `pnpm --filter @gorola/web test -- CategoryPage.test.tsx ProductGrid.test.tsx`, web lint, and root `pnpm ci:quality` (web 97 tests, api 303 tests).
- **Session 64 (Phase 2.11.1 P0 wiring closure W-001/W-002, strict TDD):** Added RED app-route regression in `router.test.tsx` for missing `/orders/:id`, then GREEN by wiring protected runtime route in `App.tsx` and creating `OrderConfirmationPage.tsx` landing screen. Added RED backend integration assertions for category `productCount` drift in `category.controller.test.ts` (including active/not-deleted DB count semantics), then GREEN by implementing `CategoryRepository.findAllForBuyer()` aggregation and switching controller route to this contract. Verified with targeted runs: API `category.controller.test.ts`, web `router.test.tsx`, `CheckoutPage.test.tsx`, `CategoryGrid.test.tsx`, and `CategoryPage.test.tsx`.
- **Session 65 (Phase 2.11.1 final closure, strict TDD):** Added RED tests proving cart server-sync must still execute when `userId` is null but auth tokens exist (`ProductGrid.test.tsx`, `ProductDetailPage.test.tsx`, `CartDrawer.test.tsx`) and GREEN by switching cart sync guards to token presence (`accessToken`) instead of `userId`. Added RED test for order confirmation data wiring and GREEN `OrderConfirmationPage` fetch/render against `GET /api/v1/orders/:id`. Added RED API integration for discount read consistency and GREEN backend change in `order.controller.ts` to infer discount amount from persisted totals on GET responses. Stabilized `stock-movement.repository.test.ts` cleanup graph (`Advertisement`/`Offer`/`Discount` deletions before `Store`) to keep full suite deterministic. Verification: targeted web tests (31), targeted API order tests (8), targeted inventory tests (8), full `pnpm ci:quality` green.
- **Session 65 (Phase 2.11.1 P0 wiring closure W-003, strict TDD):** Added RED deep-link regression in `router.test.tsx` for auth bootstrap/guard race (protected `/profile` bounced to login before refresh bootstrap settled). Implemented GREEN by adding auth bootstrap pending state (`isBootstrapPending`) in `auth.store.ts`, wiring settle semantics in `bootstrapBuyerAuthSession()` (`api.ts`), and making guards (`ProtectedRoute`/`StoreRoute`/`AdminRoute`) wait on bootstrap before redirecting. Updated guard tests for deterministic bootstrap state. Verified targeted web suites (`router.test.tsx`, `route-guards.test.tsx`) and full repo `pnpm ci:quality` (lint/typecheck/tests/build) all green.
- **Session 66 (Production CORS preflight hardening):** Diagnosed live browser preflight failures (`CORS Method Not Found`) against cart mutation endpoints. Hardened Fastify CORS registration in `apps/api/src/server.ts` with explicit allowed methods/headers and `strictPreflight`. Added/expanded integration coverage in `apps/api/src/__tests__/integration/server/server.cors-credentials.test.ts` to assert `OPTIONS /api/v1/cart/items/:id` includes `PUT`/`DELETE` and auth/content headers. Verification: `pnpm --filter @gorola/api test -- --run src/__tests__/integration/server/server.cors-credentials.test.ts`, API lint, API typecheck.
- **Session 66 (Phase 2.11.1 P1 wiring closure W-004, strict TDD):** Added RED router regression proving footer discoverability links (`About`, `Support`) landed on unresolved routes. Implemented GREEN by registering `/about` and `/support` in runtime app route graph (`App.tsx`) with buyer-layout placeholder pages so visible footer links no longer dead-end. Verified targeted `router.test.tsx` suite green; full `pnpm ci:quality` run pending for session completion.
- **Session 67 (Phase 2.11.1 P1 wiring closure W-005, strict TDD):** Added RED router/user-journey regression for placeholder route exposure and role-gated confusion, then implemented GREEN guardrail policy in `App.tsx` placeholder pages: explicit in-progress copy (`This page is not ready yet.`) and `Back to Home` recovery action for placeholder routes (`/search`, `/cart`, `/profile`, `/store`, `/admin`, plus `/about`/`/support`). Added assertions covering non-owner `/store` redirect and owner-visible guarded placeholder behavior. Verified `router.test.tsx` green; full `pnpm ci:quality` pending for session closure.
- **Session 68 (Phase 2.11.1 P1 wiring closure W-006, strict TDD):** Added RED regression in `router.test.tsx` for `/search?q=` expectation, then implemented GREEN query-aware search placeholder in `App.tsx` (`SearchPlaceholderPage` using `useSearchParams`) so search entry no longer behaves as a generic dead-end placeholder. Updated route guardrail assertions and re-verified `router.test.tsx` + `BuyerNav.test.tsx` green. Full `pnpm ci:quality` pending for session closure.
- **Session 69 (Phase 2.11.1 P2 wiring closure W-007, strict TDD):** Added RED identity-drift integration coverage for cart and checkout ownership mismatch paths, then implemented GREEN by making cart endpoints auth-required (`requireAuth` + `requireRole("BUYER")`) and deriving cart ownership strictly from JWT subject instead of client `userId` input. Updated runtime wiring (`routes.ts`) and integration tests (`cart.controller.test.ts`, `order.controller.test.ts`) to prove stale `userId` payloads do not mutate another buyer’s cart and resulting order ownership remains on authenticated buyer. Full `pnpm ci:quality` pending for session closure.
- **Session 70 (Phase 2.11.1 P2 wiring progress W-008, strict TDD):** Added RED checkout regression proving discount visible in cart could disappear at checkout review, then implemented GREEN shared discount state in `useCartStore` and wired both `CartDrawer` and `CheckoutPage` to the same discount code/saved amount source. Checkout review now renders discount line and discounted total consistently. Targeted web tests (`CheckoutPage.test.tsx`, `CartDrawer.test.tsx`) are green; backend discount persistence contract and DB assertion remain open.
- **Session 71 (Phase 2.11.1 P2 wiring closure W-008, strict TDD):** Added RED order integration regression for checkout discount persistence semantics, then implemented GREEN backend contract by extending checkout payload schema with optional `discountCode`, validating discount applicability in `BuyerCheckoutService`, applying discount into order totals, and returning explicit order `discount` metadata. Added DB reconciliation assertion (`subtotal + deliveryFee - discount == total`) in integration tests and wired web checkout order payload to include active discount code.
- **Session 72 (Phase 2.11.1 P2 wiring closure W-009, strict TDD):** RED `ProductGrid` test with stalled `PUT` mocks proving parallel dispatch; GREEN shared `enqueueCartVariantMutation` plus repository-level per-variant enqueue for `addItem`, `updateQty`, and `removeItem`. Removed stale `userId` from buyer cart POST/PUT payloads in catalog UI. Cart repository concurrency test asserts final DB quantity follows serialized registration order (`Promise.all` updates).
- **Session 73 (Phase 2.11.1 final closure W-001 coupling, strict TDD):** Added RED integration coverage for missing `GET /api/v1/orders/:id`, then implemented GREEN buyer-owned order read route in `order.controller.ts` and runtime wiring in `routes.ts`. Integration assertions now prove runtime retrieval of just-placed order id plus DB row correspondence through this exact backend path, and enforce 404 for non-owner buyer access.
- **Session 74 (Phase 2.11.1 cart hydration + enriched cart contract, strict TDD):** Closed invisible “ghost” server-only cart lines vs Zustand-only UI. API: `CartRepository.findByUserId` / `getCartWithItems` include `productVariant.product`; all cart endpoints return serialized buyer cart envelope. Web: `replaceLines`, `BuyerCartHydration`, `CheckoutPage` mount sync; `cart.controller.test.ts` asserts `productName` on GET items. Verified `pnpm test` (**311** API, **115** web) + root `pnpm typecheck`.
- **Session 75 (Phase 2.12 Order Confirmation, strict TDD):** Implemented confirmation UX + API `store` snapshot on order reads; expanded `OrderConfirmationPage.test.tsx` (items, trust `tel:`, discount, `scheduledFor`, weather copy); fixed `order.controller.test.ts` cleanup FK order for parallel suites; `router.test.tsx` order heading regex. Full `pnpm test` green (**311** API, **117** web).
- **Session 76 (Checkout production hardening + CI type safety):** **`CheckoutPage.tsx`**: **`mutate()`** + `onSettled`, **`useRef`** place-order guard, **`aria-live`**, **`Back`** disabled while pending, **`aria-label="Place order"`**, Axios **`error.message`** / 500 hint in **`role="alert"`**. **`buyer-checkout.service.ts`**: **`incrementUsedCount`** after **`placeOrderWithStock`** + **`clearCart`**; post-success increment failure → **`getLogger().warn`**. **`order.controller.test.ts`**: **`discount.usedCount === 1`**. **`OrderConfirmationPage.test.tsx`**: GSAP mock chain typing; **`renderPage` → `void`**. **Doc clarification (chat):** **`Cart`** = per-user shell; **`CartItem`** = lines; empty cart ⇒ no items, **`Cart`** row often still exists.
- **Session 77 (Order confirmation UX + API cold-start + ScrollTrigger fix):** **`server-warmup.ts`**, **`app.ts`** startup warmup, **`server.ts`** **`unhandled_route_error`** logging; **`OrderConfirmationPage`** loading/success id + bloom gradient; **`CategoryGrid`** ScrollTrigger **`HTMLElement` trigger**; **`app.start.test.ts`** mocks warmup. Details in **Last Updated** session summary.
- **Session 78 (Quality gate stabilization + test fixes):** Resolved ESLint import sorting conflicts; fixed Leaflet `Marker.prototype` crash in `AddressMapPicker` tests; updated `ProductDetailPage` tests for async cart mutations and JWT-based payloads; fixed API integration test 401s by prioritizing `GOROLA_TEST_OTP` over dummy dev overrides in test mode. Full quality gate green for linting and testing; build pending `EPERM` resolution.
- **Session 79 (Prisma Transaction Optimization & Timeout Resolution):** Resolved `P2028: Transaction not found` errors in deployment by increasing `$transaction` timeout to 15s. Optimized `OrderService` (both `placeOrderWithStock` and `cancelOrderWithStockRestore`) to use bulk-fetching (`findMany`) and in-memory stock checks. Updated `OrderRepository.create` to include relations in a single round-trip and modified `ProductVariantRepository` to skip redundant reads. Reduced checkout database round-trips from ~40+ down to ~5. Added unit tests for cancellation and updated mocks for bulk-fetching. Full `pnpm ci:quality` is GREEN.
- **Session 81 (Phase 2.14 Saved Addresses):** Built `address.repository.ts`, `address.controller.ts`, and `SavedAddressesPage.tsx` with `AddressMapPicker` integration. Verified with backend/frontend TDD suites; full CRUD for delivery locations.
- **Session 82 (Phase 2.15 Order History + Reorder):** Implemented authenticated order listing, reorder logic with active variant validation (appending to cart), and binary rating system with optional feedback comments. Refined UI for light-mode visibility on `gorola-fog` and added GSAP right-side slide-in for `CartDrawer`. Fixed route collision bug and added API `dev` script. Re-verified all quality gates.
- **Session 83 (CI/CD Stabilization & Test Repair):** Resolved critical CI/CD failures caused by environment drift and foreign key constraints. Updated `api.ts` with a test-mode fallback to prevent `null` API instances in GitHub Actions. Repaired `cleanGraph` logic in `order.history.test.ts`, `order.rate.test.ts`, and `order.reorder.test.ts` to correctly order the deletion of `Advertisement`, `Offer`, and `Discount` records before `Store` records. Fixed "Ghost Feedback" UI bug in `order.controller.ts` by explicitly including `rating` fields in serialized responses. All quality gates are 100% green in both local and CI environments.
- **Session 84 (Phase 2.15.2 Order Hardening & Address Snapshotting):** Implemented database-backed address snapshotting for orders. Refactored `OrderConfirmationPage` into a state-aware UI with 5 states (PLACED, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED). Added dynamic delivery duration calculation and detailed address display block. Fixed flaky integration test cleanup logic in `order.history.test.ts` and `order.rate.test.ts` to include `Cart` and `CartItem` deletions. Verified with full quality gate pass.
- **Session 85 (Scoped Mutation States & Vercel SPA Fix):** Resolved UI bug in `OrderHistoryPage` where multiple orders displayed simultaneous loading/disabled states during reorder or rating. Scoped mutation states to individual orders using `reorderMutation.variables`. Merged regression tests into the permanent `OrderHistoryPage.test.tsx` suite. Fixed SPA routing 404s on Vercel by adding a catch-all rewrite rule to `vercel.json`.
- **Session 90 (Hero Section Final Polish):** Refined the Weather Mode Hero Section by shortening it to 85vh and darkening the background to Slate (matching the nav/location theme). Ensured high contrast for text and logo.
- **Session 91 (Phase 2.17 Advertisements Display):** Implemented backend `GET /api/v1/promotions/advertisements` with active/approved/time-window filtering. Built `AdvertisementBanner` frontend carousel with Embla and auto-advance. Integrated banner into `HomePage`. Verified all quality gates GREEN. Manually verified the banner renders correctly in the browser with live data from Prisma Studio.
- **Session 92 (Roadmap Restructuring):** Corrected a roadmap naming error (E2E Tests was incorrectly listed as next phase). Restructured Phase 2 roadmap: inserted new Phases 2.18 (Sub-categories & Global Search), 2.19 (Profile Page), 2.20 (UI Overhaul), 2.21 (Reserved), and moved E2E Tests to Phase 2.22. Designed and documented the full Phase 2.18 spec: new `SubCategory` DB table, nullable `subCategoryId` on `Product`, 4 new API endpoints (`GET /categories/:slug/sub-categories`, `GET /products` with `subCategoryId` filter, `GET /search?q=`), new frontend pages (`SubCategoryGrid`, `SubCategoryPage`, `SearchResultsPage`), and updated router. Identified root cause of broken search: the `/search` route currently renders a placeholder page, not a real search results component.
- **Session 93 (Hierarchy Integration and Search):** Completed backend subcategory schema updates, added SubCategory to Prisma schema, resolved all typecheck and integration test failures. Completed frontend updates with `SubCategoryGrid` and `SearchResultsPage`. Ensured seed files use required dummy data.
- **Session 94 (Sub-category Finalization & Image Fix):** Verified and fixed product image rendering in `ProductGrid.tsx` with hover-zoom and fallback logic. Documented "Constraint Hell" in `subcategory_mandatory_column.md`.
- **Session 95 (Hardening & Cart Fix):** Resolved critical "Cart Wipe" bug during checkout transition via reconciliation logic in `buyer-cart-sync.ts`. Hardened catalog grids with image assertions. Fixed API integration test cleanup logic for all modules to handle new hierarchy. Verified with full `ci:quality` green (339 API, 143 web tests). Updated production Railway database with fresh schema and your 3 custom advertisement images.
- **Session 96 (Wiring & Security Hardening):** Completed **W-011** (Product Detail Navigation reachability + Cart button consistency), **W-012** (Search Routing Fix including `categorySlug` API enrichment), **W-013** (Phone Redaction in Logs for PII compliance), and **W-014** (Order Idempotency via Redis `X-Idempotency-Key` handling). Verified with full CI quality gate (491 tests green).
- **Session 97 (Phase 2.19 W-015 Rider Stubs):** Registered mandatory Rider Interface HTTP stubs (`POST /api/v1/rider/auth/login`, `GET /api/v1/rider/orders/active`, `PUT /api/v1/rider/orders/:id/status`, `PUT /api/v1/rider/location`) returning `501 Not Implemented` with `NOT_IMPLEMENTED` code. Added `/rider` Socket.IO namespace stub in `socket.ts`. Verified with new integration tests (`rider.stubs.test.ts`) and full monorepo `ci:quality` gate (495 tests green).
- **Session 98 (Phase 2.19 W-016 Stock Movement Types):** Expanded `StockMovementType` enum in `schema.prisma` to include `REFILL`, `ADJUSTMENT`, and `INITIAL`. Made `StockMovement.orderId` optional to support non-order-related inventory changes. Implemented comprehensive validation in `StockMovementRepository` for new types. Verified with new integration tests and full CI quality gate (499 tests green).
- **Session 99 (Phase 2.19 W-017 ProductVariant Stock Flags):** Added `lowStockThreshold`, `isLowStock`, and `isInStock` fields to `ProductVariant`. Updated `decrementStock` and `incrementStock` in `ProductVariantRepository` to maintain flags atomically. Exposed flags in Buyer API (`ProductRepository`). Verified with 30 targeted tests and full CI quality gate (505 tests green).
- **Session 100 (Cart Wipe Bug Fix):** Investigated and reproduced a race condition in `syncBuyerCartFromServer` that caused the cart to zero out on checkout transition. Implemented `waitForAllCartMutations` barrier and hardened reconciliation to preserve local state on push failures. Added `buyer-cart-sync.hardening.test.ts` to main suite. Verified with 507 tests green.

---

## 🔨 In Progress Right Now

- **Session 101 (Phase 2.19 W-018 OTPLog Removal):** Removed redundant `OTPLog` model from `schema.prisma`. Generated and applied migration to drop `otp_logs` table. Verified Redis-only OTP flow consistency with integration tests and full CI quality gate (507 tests green).

---

**Current Task:** **Phase 2.19** — Wiring Hardening (**W-018 Complete**).

**Exact stopping point:** W-011 to W-018 100% complete. Full CI quality gate GREEN (507 tests).

**Current Blocker:** None.

---

## 📋 Phase 1 — NFR Foundation Checklist

### 1.1 — Monorepo Setup

- [x] `pnpm init` with workspaces
- [x] `pnpm-workspace.yaml` defining: `apps/api`, `apps/web`, `packages/shared`, `packages/ui`
- [x] Root `tsconfig.base.json` with strict settings
- [x] `apps/api/tsconfig.json` extends base
- [x] `apps/web/tsconfig.json` extends base
- [x] Root `eslint.config.ts` (flat config) with TypeScript rules + import ordering
- [x] Root `.prettierrc` with project settings
- [x] Root `.env.example` with all required variables (see project_data.json)
- [x] `dotenv-safe` configured to validate env on startup
- [x] `packages/shared/` — shared TypeScript types, Zod schemas, error classes
- [x] `packages/ui/` — shared React components (will be populated in Phase 2)
- [x] Git initialized, `.gitignore` configured (node_modules, .env, dist, coverage)
- [x] GitHub repo created, branch strategy set up (main, develop)

### 1.2 — Database Schema + Migrations

- [x] `apps/api/prisma/schema.prisma` created with ALL entities from project_data.json
- [x] Entity: User (buyer) — id, phone, name, isVerified, createdAt, updatedAt, isDeleted
- [x] Entity: Store — id, name, description, phone, address, isActive, weatherModeDeliveryWindow, createdAt, updatedAt, isDeleted
- [x] Entity: StoreOwner — id, email, passwordHash, storeId, totpSecret, totpEnabled, createdAt, updatedAt, isDeleted
- [x] Entity: Admin — id, email, passwordHash, totpSecret, createdAt, updatedAt, isDeleted
- [x] Entity: Category — id, slug, name, emoji, icon, displayOrder, isActive, createdAt, updatedAt
- [x] Entity: Product — id, storeId, categoryId, name, description, imageUrl, isActive, createdAt, updatedAt, isDeleted
- [x] Entity: ProductVariant — id, productId, label, price (Decimal), stockQty, unit, isActive, createdAt, updatedAt
- [x] Entity: Cart — id, userId, createdAt, updatedAt
- [x] Entity: CartItem — id, cartId, productVariantId, quantity, createdAt, updatedAt
- [x] Entity: Order — id, userId, storeId, status (enum), subtotal, deliveryFee, total, paymentMethod, deliveryNote, landmarkDescription, scheduledFor?, createdAt, updatedAt
- [x] Entity: OrderItem — id, orderId, productVariantId, productName, variantLabel, price, quantity
- [x] Entity: OrderStatusHistory — id, orderId, status, note, changedBy, changedAt
- [x] Entity: Address — id, userId, label, landmarkDescription, flatRoom?, lat?, lng?, isDefault, isDeleted, createdAt, updatedAt
- [x] Entity: Advertisement — id, storeId, title, imageUrl, linkUrl?, startsAt, endsAt, isApproved, isActive, createdAt, updatedAt
- [x] Entity: Offer — id, storeId, title, description, discountType (PERCENTAGE|FLAT), discountValue, minOrderAmount?, maxDiscount?, startsAt, endsAt, isActive, createdAt, updatedAt
- [x] Entity: Discount (coupon codes) — id, storeId?, code, discountType, discountValue, usageLimit?, usedCount, minOrderAmount?, startsAt, endsAt, isActive, createdAt, updatedAt
- [x] Entity: FeatureFlag — id, key, value (Boolean), description, updatedBy, updatedAt
- [x] Entity: OTPLog — id, phone, hashedOtp, attempts, expiresAt, createdAt (Redis, not DB — but schema here for reference)
- [x] Entity: AuditLog — id, actorId, actorRole, action, entityType, entityId, oldValue (Json?), newValue (Json?), ip, userAgent, createdAt (IMMUTABLE)
- [x] Entity: DeliveryRider (STUB) — id, name, phone, storeId, isActive, createdAt, updatedAt, isDeleted
- [x] Entity: RiderLocation (STUB) — id, riderId, lat, lng, updatedAt
- [x] All relations defined in Prisma schema
- [x] All indexes defined (foreign keys, search columns, compound indexes on common queries)
- [x] `prisma migrate dev --name init` — first migration created
- [x] Seed file: `prisma/seed.ts` — 2 stores, 2 store owners, categories (Groceries, Medical), sample products, feature flags
- [x] `npx prisma db seed` works successfully
- [x] Test database `gorola_test` created and migrated

### 1.3 — Repository Layer

- [x] `packages/shared/src/errors.ts` — AppError base class + all domain errors
  - [x] AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, RateLimitError, NotImplementedError
- [x] `apps/api/src/modules/user/user.repository.ts`
  - [x] TESTS FIRST: findById, findByPhone, create, update, softDelete (all cases + edge + error)
  - [x] Implementation
- [x] `apps/api/src/modules/store/store.repository.ts`
  - [x] TESTS FIRST: findById, findAll (active), create, update (all cases)
  - [x] Implementation
- [x] `apps/api/src/modules/store-owner/store-owner.repository.ts`
  - [x] TESTS FIRST: findById, findByEmail, create, update (all cases)
  - [x] Implementation
- [x] `apps/api/src/modules/admin/admin.repository.ts`
  - [x] TESTS FIRST: findById, findByEmail, create (all cases) — RED stub then implementation
  - [x] Implementation
- [x] `apps/api/src/modules/catalog/category.repository.ts` + product.repository.ts + variant.repository.ts
  - [x] TESTS FIRST for each (RED stub → GREEN)
  - [x] Implementation
- [x] `apps/api/src/modules/cart/cart.repository.ts`
  - [x] TESTS FIRST: findByUserId, addItem, removeItem, updateQty, clearCart (RED stub -> GREEN)
  - [x] Implementation
- [x] `apps/api/src/modules/order/order.repository.ts`
  - [x] TESTS FIRST: create, findById, findByUserId, findByStoreId, updateStatus, addStatusHistory (RED stub -> GREEN)
  - [x] Implementation
- [x] `apps/api/src/modules/address/address.repository.ts`
  - [x] TESTS FIRST: findAllByUserId, findDefault, create, update, softDelete (RED stub -> GREEN)
  - [x] Implementation
- [x] `apps/api/src/modules/promotion/advertisement.repository.ts`
  - [x] TESTS FIRST: findActive, create, approve, deactivate (RED stub -> GREEN)
  - [x] Implementation
- [x] `apps/api/src/modules/promotion/offer.repository.ts` + discount.repository.ts
  - [x] TESTS FIRST
  - [x] Implementation
- [x] `apps/api/src/modules/feature-flag/feature-flag.repository.ts`
  - [x] TESTS FIRST: getAll, getByKey, update (RED stub -> GREEN)
  - [x] Implementation
- [x] `apps/api/src/modules/delivery/rider.repository.ts` (STUB — tests verify 501 behavior)
- [x] `apps/api/src/modules/audit/audit.repository.ts` — create (no update, no delete)
  - [x] TESTS FIRST
  - [x] Implementation

- [x] `apps/api/src/modules/inventory/stock-movement.repository.ts`
  - [x] TESTS FIRST:
    - [x] create: records movement with correct before/after quantities
    - [x] findByVariantId: returns movements in descending order
    - [x] findByOrderId: returns all movements for an order (for cancellation restore)
    - [x] happy path, edge case (zero qty movement rejected), security (variantId not owned by store)
  - [x] Implementation
- [x] DB constraint added in migration: `CHECK ("stockQty" >= 0)` on `ProductVariant` (see `20260423120000_add_stock_movements_and_non_negative_stock`)
- [x] ProductVariant repository updated: `decrementStock(variantId, qty, storeId, tx)` and `incrementStock(variantId, qty, storeId, tx)` methods added with TESTS FIRST

- [x] `apps/api/src/modules/order/order.service.ts` — stock deduction logic TESTS FIRST:
  - [x] should deduct stock for all items atomically on order placement
  - [x] should reject order with 422 and item list when any item is out of stock
  - [x] should reject order when requested qty exceeds available stock
  - [x] should NOT deduct stock if transaction fails (atomicity test — mock transaction rollback)
  - [x] should restore stock for all items when order is cancelled
  - [x] should record a SALE stock movement for each item on placement
  - [x] should record a CANCELLATION_RESTORE movement for each item on cancel
  - [x] edge case: two concurrent orders for the last 1 unit — only one should succeed

### 1.4 — Fastify Server Bootstrap

- [x] `apps/api/src/server.ts` — Fastify instance factory (not starting server, just creating instance)
- [x] `apps/api/src/app.ts` — Application entry point (imports server, starts listen)
- [x] Plugins registered in order:
  - [x] `@fastify/helmet` with CSP configuration
  - [x] `@fastify/cors` with CORS_ALLOWED_ORIGINS whitelist
  - [x] `@fastify/rate-limit` with Redis store
  - [x] `@fastify/cookie` with HttpOnly Secure settings
  - [x] `fastify-plugin` — request-id (UUID v4 per request, set in X-Request-ID header)
  - [x] Pino logger configured on Fastify instance
  - [x] Global error handler registered (formats ALL errors into response envelope)
  - [x] Prisma client singleton registered on Fastify instance
  - [x] Redis client registered on Fastify instance
- [x] Health route registered: GET /api/health
- [x] TESTS: server starts, health endpoint returns correct shape, error handler formats correctly

### 1.5 — Authentication System

- [x] `apps/api/src/modules/auth/` complete module

**Buyer OTP Flow:**

- [x] TESTS FIRST — auth.service.test.ts:
  - [x] sendOTP: sends OTP, hashes it, stores in Redis with TTL
  - [x] sendOTP: throws RateLimitError after 5 attempts in 15min
  - [x] sendOTP: throws ValidationError for invalid phone format
  - [x] verifyOTP: succeeds with correct OTP, returns tokens
  - [x] verifyOTP: throws error on wrong OTP (increments attempt counter)
  - [x] verifyOTP: throws error after 3 failed attempts (locks out)
  - [x] verifyOTP: throws error on expired OTP
  - [x] refreshToken: issues new access token + rotated refresh token
  - [x] refreshToken: throws on revoked refresh token
  - [x] logout: revokes refresh token in Redis
- [x] Implementation: auth.service.ts
- [x] Implementation: auth.controller.ts (POST /api/v1/auth/buyer/send-otp, /verify-otp, /refresh, /logout)
- [x] requireAuth middleware (verifies JWT, attaches req.user)
- [x] requireRole middleware (checks role against allowed roles)

**Store Owner Auth Flow:**

- [x] TESTS FIRST — store-owner-auth.service.test.ts:
  - [x] login: success with correct email/password (no 2FA yet)
  - [x] login: throws on wrong password (same message as wrong email — no enumeration)
  - [x] login: throws after 10 failed attempts in 15min
  - [x] setup2FA: generates TOTP secret, returns QR code URI
  - [x] verify2FA: enables 2FA on account with correct TOTP code
  - [x] login with 2FA: requires TOTP code when 2FA enabled
  - [x] login with 2FA: throws on wrong TOTP code
- [x] Implementation

**Admin Auth Flow:**

- [x] TESTS FIRST — same structure as store owner, but 2FA is mandatory
- [x] Implementation

### 1.6 — Observability Setup

- [x] Pino logger configured: JSON format in prod, pretty in dev, log level from env
- [x] Logger singleton exported from `apps/api/src/lib/logger.ts`
- [x] Request logging middleware (logs method, url, status, duration, requestId)
- [x] OpenTelemetry SDK initialized:
  - [x] Trace exporter: OTLP HTTP (to OTEL_EXPORTER_ENDPOINT) or console in dev
  - [x] Fastify instrumentation (auto-traces all routes)
  - [x] Prisma instrumentation (auto-traces all DB queries)
- [x] TESTS: logger is called with requestId, sensitive data masking works

### 1.7 — Health Check API

- [x] GET /api/health — implemented and tested
- [x] Checks: DB connection (simple SELECT 1), Redis ping
- [x] Returns correct status codes (200 ok, 200 degraded, 503 down)
- [x] TESTS: all 3 status scenarios

### 1.8 — GitHub Actions CI and CD

**Status:** **Complete.** The repo uses **one** workflow file: **`.github/workflows/ci-cd.yml`** (in `GoRola_app/`; working in production).

| Part                 | What it does                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`ci`**             | On every `push` / `pull_request` to `main` or `develop`, and `workflow_dispatch`: install, build `@gorola/shared`, wait for Postgres/Redis, Prisma `generate` + `migrate deploy` to test DB, **lint**, **typecheck**, **test**, **build**. Node **22**; service containers: **PostgreSQL 15** + **Redis 7** on `127.0.0.1` (not hostnames from compose). |
| **`paths`**          | `dorny/paths-filter` — sets **`vercel`** / **`railway`** from changed paths (e.g. `apps/web/**` vs `apps/api/**`, plus shared root files in both so lockfile/tsconfig changes can trigger either side).                                                                                                                                                  |
| **`deploy-vercel`**  | **After** `ci` succeeds; only **`main`**, on **push** or **`workflow_dispatch`**; runs if `paths` matched **or** `workflow_dispatch` (manual runs **both** deploys). `vercel deploy --prod` with `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.                                                                                                   |
| **`deploy-railway`** | Same gating; **`railway up --ci`** with `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID`.                                                                                                                                                                                                                                                                           |

**Not deployed from Actions:** **pull requests** and **`develop`** — only `ci` (and `paths`); no production deploy. Details and secret names: **`GoRola_app/README.md`**.

- [x] **`.github/workflows/ci-cd.yml`** — full pipeline above (CI + path-filtered CD; verified working)
- [ ] Coverage report: uploaded to PR as comment _(optional enhancement)_
- [ ] Branch protection: CI must pass, 1 reviewer required _(configure in **GitHub → Settings → Branches**; not stored in this repo)_

### 1.9 — Railway Deployment

- [x] Railway project created with services: Node.js API, PostgreSQL 15, Redis 7
- [x] All environment variables set in Railway dashboard (see root `.env.example` and `project_data` — no secrets in repo)
- [x] `railway.toml` (monorepo root) + `Procfile` — Nixpacks `buildCommand` builds `@gorola/shared` then `@gorola/api`; `startCommand` = `pnpm --filter @gorola/api start` (which runs `prisma migrate deploy && node dist/app.js`; `node dist/app.js` **starts the server** via `isNodeMainModule` in `app.ts`)
- [x] **Build** (Railway) vs **start** (migrations + listen): `apps/api` `build` = `prisma generate && tsc`; `start` = migrate + `node dist/app.js` _(checklist’s old “build = migrate+node” line was split correctly to match Railway)_
- [x] Vercel project **deployed and linked** to this repo (`vercel.json` at monorepo root: install / build / `apps/web/dist`). Production **`VITE_API_BASE_URL`** = Railway API origin. **Vercel origin** added to Railway **`CORS_ALLOWED_ORIGINS`**. **Verified:** browser from Vercel URL → `GET /api/health` → `data.status: "ok"`.

### 1.10 — Smoke Test

- [x] Production `GET /api/health` (e.g. `https://gorolaapp-production.up.railway.app/api/health`) returns envelope with `data.status: "ok"` and DB + Redis checks `ok` _(verified after Railway deploy; `curl` equivalent OK)_
- [x] All CI checks passing on GitHub _(pipeline green on `main`/`develop` as of session)_
- [x] No secrets in any committed files (run: `git log --all -- '*/.env'` to verify)

---

## 📋 Phase 2 — Buyer Web Experience Checklist

_(Phase 1 is complete. Track Phase 2 items below; **2.1 is complete**.)_

### 2.1 — Vite + React Setup

- [x] `apps/web/` initialized: Vite + React + TypeScript (minimal shell; `pnpm --filter @gorola/web dev` / `build`)
- [x] Tailwind CSS v4 installed and configured (`@tailwindcss/vite` plugin)
- [x] shadcn/ui initialized (CLI: `init -t vite -y -b radix -p nova` — `components.json`, `src/components/ui/*`, `src/lib/utils.ts`, CSS vars + `shadcn/tailwind.css`)
- [x] shadcn components installed: button, card, input, dialog, drawer, sheet, skeleton, badge, sonner, scroll-area, separator, tabs, avatar, dropdown-menu
- [x] React Router v6 — `BrowserRouter` + `Routes` in `src/main.tsx` / `App.tsx` (`vitest` + `router.test.tsx`)
- [x] TanStack Query — `src/lib/query-client.ts` (`staleTime: 60_000`, `retry: 2`); `QueryClientProvider` in `main.tsx`
- [x] Zustand — `src/store/*.store.ts` + `*.store.test.ts` (auth, cart, weather, feature-flags)
- [x] React Hook Form + `@hookform/resolvers` + Zod — `form-wiring.test.tsx` (smoke)
- [x] Axios — `src/lib/api.ts` (`createApiClient`, `api` singleton from `VITE_API_BASE_URL`; bearer + 401 → buyer refresh + `clearSession` on failure) + `api.test.ts` (axios-mock-adapter)
- [x] `@gorola/shared` package linked as workspace dependency (for shared Zod schemas and types)
- [x] **Vitest** in `apps/web` — `pnpm --filter @gorola/web test` = `vitest run --config vitest.config.ts`

### 2.2 — Design Tokens + CSS

- [x] `src/styles/tokens.css` — all GoRola CSS custom properties:
  - [x] `--gorola-pine: #1D3D2F`, `--gorola-pine-dark: #162E23`, `--gorola-pine-light: #2D5A40`
  - [x] `--gorola-saffron: #E8833A`, `--gorola-fog: #F4F1EC`, `--gorola-charcoal: #1C1C1E`
  - [x] `--gorola-amber: #F5A623`, `--gorola-slate: #3A4A5C`, `--gorola-slate-mist: #E8ECF0`
- [x] `src/styles/fonts.css` — Google Fonts import: Playfair Display, DM Sans, Noto Sans Devanagari
- [x] Utility classes: `.font-playfair`, `.font-dm-sans`, `.font-devanagari`
- [x] Animation keyframes: `etaPulse`, `riderPing`, `greenBloom`, `fadeInUp`, `fogDrift`, `shimmer`
- [x] Utility classes: `.eta-pulse`, `.fade-in-up`, `.fog-drift`, `.skeleton`, `.noise-overlay`
- [x] `src/styles/globals.css` — Tailwind + shadcn + `fonts` + `tokens` (import order: fonts → tokens → tailwind) + shadcn `:root` / dark + app component classes
- [x] `TopographicBg` — `src/components/shared/TopographicBg.tsx` + `.test.tsx` — SVG curves, `opacity` prop, `aria-hidden`
- [x] `WeatherBanner` — `useWeatherStore`, pine vs slate, `data-weather` + tests
- [x] `ETABanner` — amber pulse dot + `ETA ~ {etaLabel}` (static until API; Phase 2.5+)

### 2.3 — Lenis + GSAP Setup

- [x] `gsap` + `@gsap/react` installed. `ScrollTrigger` registered globally (`initGorolaGsapOnce` in `lib/gsap.ts`).
- [x] `lenis` installed
- [x] `src/lib/lenis.ts` — Lenis singleton, exported `lenis` (nullable) + `createGorolaLenis` / `destroyGorolaLenis`
- [x] `src/lib/gsap.ts` — `gsap.defaults({ ease: 'power2.out', duration: 0.8 })`, `linkLenisToGsapTicker` (ticker + `ScrollTrigger.update` + `lagSmoothing` cleanup)
- [x] `src/hooks/useGorolaMotion.ts` — `useEffect` init once, cleanup disconnects ticker + `destroyGorolaLenis`; **`App.tsx`** calls hook at top
- [x] Lenis `destroy()` in effect cleanup
- [x] TESTS: `gsap-context-cleanup.test.tsx` + `useGorolaMotion.test.tsx` (jsdom; `test/setup` polyfills for ScrollTrigger/Lenis)

### 2.4 — App Shell + Routing

- [x] `src/App.tsx` — sets up React Router, Lenis, GSAP, QueryClientProvider, Toaster (sonner)
- [x] Route guards: `ProtectedRoute` (redirects to /login if no auth), `StoreRoute` (requires STORE_OWNER role), `AdminRoute` (requires ADMIN role)
- [x] `BuyerLayout` — shared layout for buyer pages: sticky nav, main content, footer
- [x] `BuyerNav` component:
  - [x] GoRola mountain logo (inline SVG, from design system) via `components/shared/GorolaMountainMark.tsx`
  - [x] Location pill (current delivery area — "Kulri, Mussoorie")
  - [x] Search bar (links to /search on enter)
  - [x] Cart button with item count badge
  - [x] Login/Profile button
  - [x] Weather mode: nav background shifts from `--gorola-pine` to `--gorola-slate`
- [x] `BuyerFooter` component — minimal, pine background, links
- [x] TESTS: route guard redirects unauthenticated users, role guard redirects wrong role

### 2.5 — Hero Section

- [x] `src/pages/buyer/HomePage.tsx` created
- [x] `src/components/buyer/HeroSection.tsx`:
  - [x] Full-viewport height section
  - [x] Background: `--gorola-pine` with `TopographicBg` overlay (opacity 0.12)
  - [x] Noise texture overlay (`.noise-overlay`)
  - [x] GSAP timeline on mount (use `gsap.context()` + ref):
    - [x] Logo SVG: scale from 0.8 + opacity 0 → 1 (0.6s)
    - [x] "GoRola" wordmark (Playfair Display): `y: 30` → 0 + opacity (0.5s, delay 0.3s)
    - [x] Tagline "Mussoorie, delivered." (DM Sans): `y: 20` → 0 + opacity (0.4s, delay 0.6s)
    - [x] CTA button: `y: 15` → 0 + opacity (0.3s, delay 0.8s)
    - [x] ETA banner: slide in from bottom (0.4s, delay 1.0s)
  - [x] GSAP cleanup: `return () => ctx.revert()` in useEffect
  - [x] Normal mode: amber ETA banner with pulse animation
  - [x] Weather mode: slate banner, calm copy ("Fog tonight — we're still coming")
  - [x] CTA button: pill shape, `--gorola-saffron` background, "Shop Now" → scrolls to categories
- [x] TESTS: hero renders in both normal and weather mode, GSAP cleanup runs on unmount

### 2.6 — Category Section

- [x] `src/components/buyer/CategoryGrid.tsx`:
  - [x] Fetches categories from `GET /api/v1/categories` (TanStack Query)
  - [x] V1 renders: Groceries, Medical (only these two from API)
  - [x] Card layout: emoji icon, category name, product count
  - [x] Loading state: skeleton cards matching real card dimensions
  - [x] Empty state: "No categories available" (shouldn't happen but must handle)
  - [x] Error state: "Couldn't load categories — tap to retry"
  - [x] GSAP ScrollTrigger: cards stagger-fade-up when section enters viewport
  - [x] Hover: subtle lift (translateY -4px) + shadow increase (CSS transition, not GSAP)
  - [x] Click → navigate to `/categories/:slug`
- [x] TESTS: renders correct categories, loading/empty/error states, navigation on click

### 2.61 — Contract Alignment Hardening (Post-2.6)

- [x] Categories endpoint exposed in runtime app: `GET /api/v1/categories`
- [x] Credentialed CORS contract fixed (`credentials: true`) and integration tested
- [x] Auth routes wired in runtime app registration (`/api/v1/auth/*`) so Phase 2.10 has live endpoints
- [x] TESTS: integration test proving auth endpoint reachable through runtime route registrar (not test-only registration)
- [x] BUYER AUTH RUNTIME NOTE (superseded by **2.10.1**): runtime uses `OtpProvider` (noop in dev/CI) and `BuyerTokenService` (RS256 + Redis refresh); swap noop for Fast2SMS (or other) via env while keeping the same interface. See Phase **2.10.1** checklist.
- [x] Guardrail note added: every new UI phase must ship with backend route exposure + tests before marking checklist done
- [x] Local dummy-data bootstrap script added for Postgres dev DB (`db:local:bootstrap` → migrate + seed)
- [x] Local seed verification script added (`db:local:verify-seed`) to assert required buyer data exists
- [x] TESTS / VERIFICATION: ran local bootstrap + verification and confirmed seeded `groceries`/`medical` categories and active products

### 2.7 — Product Listing Page

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend endpoint implemented and reachable at runtime: `GET /api/v1/products?categoryId=&storeId=&search=&cursor=&limit=20`
  - [x] Backend integration tests cover list/pagination/filter/search contract
  - [x] Route is registered in runtime app route graph (not only module-level test harness)
  - [x] Frontend tests validated against expected API envelope and error states

- [x] `src/pages/buyer/CategoryPage.tsx` → route: `/categories/:slug`
- [x] `src/components/buyer/ProductGrid.tsx`:
  - [x] Fetches `GET /api/v1/products?categoryId=&storeId=&search=&cursor=&limit=20`
  - [x] Product card: product name, shop name, price (largest variant), weight/unit, "Add" button
  - [x] Infinite scroll: `useInfiniteQuery` + intersection observer on last card
  - [x] Loading: skeleton cards (3 rows of 4)
  - [x] Empty state: "Nothing here yet — check back soon"
  - [x] Error state: retry button
  - [x] Search bar at top: debounced 300ms, updates query param
  - [x] "Add" button: optimistic update — immediately increments cart count, POST to API in background
  - [x] If item already in cart: show quantity +/- controls instead of "Add"
  - [x] GSAP ScrollTrigger: new cards fade-up as they enter viewport on infinite load
- [x] TESTS: renders product list, pagination loads next page, add-to-cart optimistic update, search debounce

### 2.8 — Product Detail Page

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend endpoint implemented and reachable at runtime: `GET /api/v1/products/:id`
  - [x] Backend integration tests cover not-found and variant payload shape
  - [x] Route is registered in runtime app route graph
  - [x] Frontend tests validated against expected API envelope and error states

- [x] `src/pages/buyer/ProductDetailPage.tsx` → route: `/products/:id`
- [x] Fetches `GET /api/v1/products/:id` (includes variants)
- [x] Large product name (Playfair Display), shop name with phone number
- [x] Variant selector: if multiple variants (e.g. 500ml / 1L), show pills
- [x] Price: updates based on selected variant
- [x] Quantity selector: +/- buttons, min 1, max based on stockQty
- [x] "Add to Cart" CTA: pill button, saffron, full width on mobile
- [x] Loading: skeleton matching page layout
- [x] GSAP: page entry animation — content slides up on load
- [x] TESTS: variant selection updates price, add to cart calls API with correct variantId + quantity

### 2.9 — Cart (Drawer on Mobile, Sidebar on Desktop)

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend endpoints implemented and reachable at runtime for cart read/mutate flows
  - [x] Backend integration tests cover add/update/remove/clear semantics
  - [x] Routes are registered in runtime app route graph
  - [x] Frontend tests validated against expected API envelope and cart edge states

- [x] `src/components/buyer/CartDrawer.tsx` (mobile: bottom drawer, desktop: right sidebar)
  - [x] Triggered by cart icon in nav
  - [x] Lists cart items with quantity controls
  - [x] Per-item: product name, variant, price × qty, remove button
  - [x] Subtotal calculation
  - [x] Delivery fee (fetched from store config or flat rate from API)
  - [x] Active offers/discounts section: if store has active offers, show prominently
  - [x] Discount code input field + "Apply" button → `POST /api/v1/promotions/discounts/validate`
  - [x] If discount valid: show amount saved, update total
  - [x] Payment method selector: COD (pre-selected, green checkmark animation), UPI (flag-gated), Card (flag-gated)
  - [x] "Proceed to Checkout" CTA (disabled if cart empty)
  - [x] Empty state: "Your cart is empty — go find something good"
- [x] TESTS: item removal, quantity update, discount code validation (valid/invalid/expired), payment method selection, empty state

### 2.10 — OTP Login Flow

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend auth endpoints reachable at runtime: `POST /api/v1/auth/buyer/send-otp`, `POST /api/v1/auth/buyer/verify-otp`, `POST /api/v1/auth/buyer/refresh`, `POST /api/v1/auth/buyer/logout`
  - [x] Backend integration tests cover endpoint reachability and envelope compatibility for frontend (incl. verify success payload + error codes)
  - [x] Routes are registered in runtime app route graph (`registerAuthRoutes` via `registerAppRoutes`)
  - [x] Frontend tests validated against expected API envelope and auth error states

- [x] `src/pages/buyer/LoginPage.tsx` → route: `/login`
- [x] Step 1: Phone number input (E.164 format validation, India +91 prefix)
  - [x] Zod validation: must be 10 digits after +91
  - [x] Submit → `POST /api/v1/auth/buyer/send-otp`
  - [x] Error states: invalid format, rate limit hit ("Too many attempts — try in 15 minutes")
  - [x] Loading state on button
- [x] Step 2: OTP input (6-digit, auto-focus, auto-advance between digits)
  - [x] Countdown timer showing OTP expiry (5:00 → 0:00)
  - [x] "Resend OTP" button (disabled until timer expires)
  - [x] Submit → `POST /api/v1/auth/buyer/verify-otp`
  - [x] Error: wrong OTP, attempts remaining shown ("2 attempts left")
  - [x] Error: too many failed attempts (lockout message)
  - [x] Success: redirect to previous page or `/` (via `Navigate` state from guards)
  - [x] GSAP: smooth transition between step 1 and step 2
- [x] Auth store updated on success: `{ userId, name, phone, accessToken }` (+ `refreshToken` for client refresh interceptor)
- [x] TESTS: phone validation, OTP input behavior, timer countdown, resend logic, success redirect, error states

### 2.10.1 — Buyer Auth Plumbing (DB User + OTP Provider Interface + Token Service)

> **Goal:** Replace dev-only runtime stubs with production-shaped plumbing while keeping SMS delivery swappable. **Does not require** a live SMS provider to complete; use a **dev/stub `OtpProvider`** in local/test. Real Fast2SMS (or other) wiring is a separate env-driven implementation behind the same interface.

- [x] API Contract Gate (mandatory for phase completion):
  - [x] `POST /api/v1/auth/buyer/verify-otp` success path **creates or loads** a buyer `User` row in PostgreSQL keyed by **unique phone** (normalized `+91` E.164); response `userId` / `phone` / `name` match DB (no client-synthesized ids)
  - [x] `POST /api/v1/auth/buyer/send-otp` / `verify-otp` integration tests cover: first-time verify creates user, repeat verify returns same `userId`, existing error envelopes unchanged (validation, rate limit, invalid OTP + `attemptsRemaining`, lockout)
  - [x] `POST /api/v1/auth/buyer/refresh` and `POST /api/v1/auth/buyer/logout` exercised against the **wired token service** (not placeholder random strings)
  - [x] Routes registered only through runtime `registerAppRoutes` / `registerAuthRoutes` — no drift or duplicate mounts
  - [x] Frontend tests aligned to API: `LoginPage` (or shared auth helper) persists **server-issued** `userId`, `phone`, tokens into `useAuthStore` from verify envelope mocks

- [x] Backend — OTP delivery (provider interface):
  - [x] Define `OtpProvider` interface (`sendOtp(phoneE164, otpPlain): Promise<void>` or equivalent)
  - [x] Wire **stub/dev provider** in test + local runtime (no network; may log/trace in dev only — never log full OTP in production builds)
  - [x] Reserve **production** implementation slot (Fast2SMS per DECISION-006) behind env/config; document required env keys in `.env.example` without blocking 2.10.1 GREEN

- [x] Backend — OTP generation & storage (align `rules_and_spec.md` §6):
  - [x] Generate **cryptographically random** 6-digit OTP (remove any fixed/dev-only constant OTP from production paths; tests may deterministically stub RNG **only** in unit tests)
  - [x] Store **bcrypt hash** + TTL + attempt/send counters in **Redis** (unchanged semantics vs spec)
  - [x] Unit tests (RED→GREEN): `AuthService.sendOtp` invokes provider with correct phone; hash/TTL behavior; existing rate-limit tests updated if needed

- [x] Backend — User persistence:
  - [x] On successful `verifyOtp`: **find-or-create** buyer `User` by phone (`role = BUYER`, `isActive` per product rules); return stable `userId` (+ optional `name` if schema supports null first)
  - [x] Migration / Prisma: confirm `User` model fields and unique index on phone satisfy above; additive migration if gaps
  - [x] Repository method(s) covered by integration tests (or service-level tests with DB) for idempotent create

- [x] Backend — Token service:
  - [x] Replace temporary token stubs in runtime wiring with **`TokenService` implementation** meeting `architecture.md` / `rules_and_spec.md` §6 expectations (RS256, payload `sub`, `role`, **`jti`**, refresh rotation, Redis allowlist/revoke on logout — match DECISION-007 / DECISION-008 posture; HttpOnly cookie for refresh remains server responsibility)
  - [x] Document any **interim** algorithm (e.g. HS256) only if unavoidable, with explicit follow-up migration task noted in checklist completion notes

- [x] Frontend integration:
  - [x] Consume verify response **as single source of truth** for buyer identity fields (no hard-coded `buyer:` prefix ids in UI)
  - [x] Guards / axios interceptor unchanged apart from consuming real tokens from store refresh flow
  - [x] Regression: existing `LoginPage` tests updated; optional smoke assertion that post-login store matches API shape

- [x] CONTEXT / cleanup:
  - [x] Narrow or supersede **§2.61 “BUYER AUTH RUNTIME NOTE”** stub wording once wired (or explicitly reference 2.10.1 completion in that bullet)

- [x] Quality gate (mandatory before marking phase complete):
  - [x] `pnpm --filter @gorola/api` lint + typecheck + full Vitest suite
  - [x] `pnpm --filter @gorola/web` lint + typecheck + Vitest
  - [x] Root `pnpm ci:quality` green

### 2.11 — Address Entry

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend endpoint implemented and reachable at runtime: `POST /api/v1/orders` (+ supporting address flows as needed: `GET /api/v1/addresses`)
  - [x] Backend integration tests cover checkout placement with saved/new address paths + short landmark 400 (`order.controller.test.ts`)
  - [x] Routes are registered in runtime app route graph (`routes.ts`)
  - [x] Frontend tests validated against expected validation + place-order POST (`CheckoutPage.test.tsx`)

- [x] `src/pages/buyer/CheckoutPage.tsx` → route: `/checkout` (inside `ProtectedRoute` + `BuyerLayout`)
- [x] Step 1 — Address:
  - [x] If user has saved addresses: show list, allow select
  - [x] "Deliver to new location" (`new`) option always available
  - [x] New address form:
    - [x] Landmark description (required, min 10 chars, placeholder matches spec cue)
    - [x] Flat/room number (optional)
    - [x] NO pin code field (ever)
    - [x] "Save this address" checkbox (with label validation when saving)
  - [x] Optional: draggable map pin (Leaflet.js, OpenStreetMap tiles — free) to capture lat/lng — `AddressMapPicker` + API `lat`/`lng` on `POST /api/v1/orders` / save-address
- [x] Step 2 — Review (+ place): cart lines, subtotal, delivery fee (Rs 30, matches cart drawer), COD payment copy; **`POST /api/v1/orders`** on Place Order → navigate `/orders/:id`
- [ ] Review screen: show **discount** consistent with cart drawer `savedAmount` (not persisted on order payload yet — deferred)
- [x] TESTS: landmark validation + no pin/postal (`CheckoutPage.test.tsx`), mocked place order (saved + new address **`lat`/`lng`**, `AddressMapPicker` mocked); `AddressMapPicker.test.tsx` Leaflet mocks

### 2.11.1 — Wiring Hardening (Strict TDD)

- [x] API/Route Wiring Gate (mandatory for phase completion):
  - [x] Every buyer-visible navigation target in active UI has runtime route coverage (`App.tsx`) or is intentionally hidden
  - [x] Every frontend API call in active buyer flows is contract-aligned (path/method/payload/auth) with runtime backend routes
  - [x] Cross-flow identity model is consistent (cart mutations and checkout attribution map to same buyer session assumptions)
  - [x] Regression tests added for each fixed wiring issue before GREEN implementation
  - [x] Each fixed wiring issue includes explicit DB persistence/read verification (integration test assertion on repository/database state)
  - [x] Each fixed wiring issue has evidence chain documented: UI trigger -> network contract -> runtime route -> service/repository -> DB effect -> UI result

- [x] Fix: category page briefly showed products from other categories before filtering  
      _RED→GREEN_: added regression in `CategoryPage.test.tsx`, then gated `ProductGrid` render in `CategoryPage.tsx` until slug→categoryId resolve.

- [x] Full Wiring Issue Register (must be closed end-to-end)

- [x] **W-001 / P0:** Checkout success dead-end: `navigate("/orders/:id")` exists in UI flow but route is missing in runtime route graph
  - [x] RED: failing route-level test proving post-checkout navigation lands on unresolved path in app router
  - [x] GREEN: add runtime route coverage (or temporary explicit fallback) and matching component-level assertion
  - [x] API/Backend: `GET /api/v1/orders/:id` contract aligned when route goes live (Phase 2.12 coupling)
  - [x] DB assertion: placed order row/id is retrievable via backend path used by confirmation route

- [x] **W-002 / P0:** Category payload contract drift (`productCount`)
  - [x] RED: failing integration/contract test proving frontend category card expectation mismatches backend envelope
  - [x] GREEN option A: backend enriches category response with stable `productCount`; option B: frontend removes hard dependency and handles absent count
  - [x] Runtime route assertion for `GET /api/v1/categories` remains green via app wiring
  - [x] DB assertion: counts map to active products per category repository query semantics

- [x] **W-003 / P0:** Auth bootstrap vs route guard race (flicker/login bounce)
  - [x] RED: test proving protected deep-link can redirect before `bootstrapBuyerAuthSession()` settles
  - [x] GREEN: introduce deterministic auth-loading handshake in guard/bootstrap path
  - [x] API contract: refresh flow (`/api/v1/auth/buyer/refresh`) failure/success branches covered
  - [x] DB/session assertion: buyer identity continuity maintained across refresh and guarded navigation

- [x] **W-004 / P1:** Footer discoverability links route to non-registered paths (`/about`, `/support`)
  - [x] RED: route test proving links resolve to missing pages
  - [x] GREEN: register route targets or hide/remove links until ready
  - [x] UI assertion: no dead-end navigation from visible footer controls

- [x] **W-005 / P1:** Placeholder pages exposed as real routes without guardrails (`/search`, `/cart`, `/profile`, `/store`, `/admin`)
  - [x] RED: user-journey tests showing placeholder dead-ends from visible entry points
  - [x] GREEN: route policy per page (hide, redirect, or implement minimal working screen)
  - [x] Security assertion: role-gated placeholders do not leak confusing unauthorized UX

- [x] **W-006 / P1:** Search entry is wired (`/search?q=`) but route behavior is placeholder-only
  - [x] RED: failing UX test for query-driven search expectation
  - [x] GREEN: implement minimal query rendering or suppress navigation until real search page exists
  - [x] API contract: if wired to backend search, ensure params/response alignment

- [x] **W-007 / P2:** Cart/order identity robustness hardening (state vs token drift)
  - [x] RED: integration test reproducing cart mutations with stale/mismatched `userId` vs checkout JWT subject
  - [x] GREEN: single-source buyer identity strategy for cart + checkout
  - [x] Backend contract: cart endpoints and checkout endpoint identity assumptions are explicit and tested
  - [x] DB assertion: cart rows and resulting order ownership consistently map to same buyer

- [x] **W-008 / P2:** Discount consistency drift (`CartDrawer.savedAmount` vs checkout/order summary)
  - [x] RED: cross-page test proving discount shown in cart disappears at checkout review/order summary
  - [x] GREEN: shared pricing model across cart drawer, checkout review, and placement payload/summary
  - [x] Backend contract: discount persistence semantics explicit (persisted vs display-only)
  - [x] DB assertion: if persisted, order totals/discount fields reconcile to computed totals

- [x] **W-009 / P2:** Optimistic cart mutation ordering/rollback gaps under rapid +/- actions
  - [x] RED: race-condition test proving out-of-order responses can desync UI/server quantity
  - [x] GREEN: mutation serialization, request cancellation, or reconciliation strategy
  - [x] API contract: idempotent/update semantics respected for PUT/DELETE cart operations
  - [x] DB assertion: final persisted quantity equals final UI quantity after burst interactions

- [x] **W-010 / P2:** Zustand cart diverges from persisted `GET /api/v1/cart` (ghost lines / wrong subtotal / checkout mismatch)
  - [x] RED→GREEN: unit tests for `mapBuyerCartItemsToLines`, `replaceLines`, layout hydration replacing stale local-only lines
  - [x] API: cart payloads include buyer-display fields aligned with storefront (`productName`, variant label/unit, `unitPrice`)
  - [x] UX: hydrate on authenticated buyer shell load and on checkout mount; logout clears cart client state

### 2.12 — Order Confirmation Page

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend endpoint reachable at runtime: `GET /api/v1/orders/:id`
  - [x] Backend integration tests cover order detail payload, **embedded `store`**, and permission boundaries (`order.controller.test.ts`, `order.repository.test.ts`)
  - [x] Route is registered in runtime route graph (`/orders/:id` under `ProtectedRoute` + `BuyerLayout`)
  - [x] Frontend tests against API envelope (**`OrderConfirmationPage.test.tsx`**, **`router.test.tsx`**); GSAP mocked in unit tests

- [x] `src/pages/buyer/OrderConfirmationPage.tsx` → route: `/orders/:id`
- [x] On load: TanStack Query → `GET /api/v1/orders/:id`
- [x] GSAP entrance: fixed **`occ-bloom`** gradient layer → `timeline` fades it out (transparent) while content/check reveal
- [x] SVG check stroke animates via **`strokeDashoffset`** (no GSAP DrawSVG plugin)
- [x] Order summary: **`items`** with line math, **`subtotal` / `deliveryFee` / inferred `discount` / `total`**, payment label (**COD/UPI/CARD**), landmark + **`status`** banner + ETA copy (**`<time>`** when **`scheduledFor`** present)
- [x] Trust + call: storefront **`tel:{store.phone}`** with truthful copy (**no synthetic “owner name”** yet — schema is owner-email–centric)
- [ ] **Defer → 2.13:** countdown / **`order_status_changed`** Socket.IO (page calls this out plainly for shoppers)
- [x] **`useWeatherStore.isWeatherMode`**: amber “weather-aware” banner + cautious ETA paragraph (still no fake ticking ETA)
- [x] Honest copy baseline (explicit non-goals vs hype)
- [x] TESTS: RTL coverage for totals/trust/scheduling/weather; **live Socket deferred to 2.13**

### 2.13 — Order Status Page (for post-confirmation tracking)

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend order status read/update event contract validated for buyer timeline
  - [x] Backend integration tests cover status progression payloads (`order.socket.test.ts`)
  - [x] Required runtime routes/events are wired and documented (`socketPlugin` in `routes.ts`)
  - [x] Frontend tests validated against expected API/socket contract (`useOrderSocket.ts`, `OrderConfirmationPage.tsx`)

- [x] Status timeline: PLACED → PREPARING → OUT_FOR_DELIVERY → DELIVERED (visual stepper)
- [x] Current status highlighted, timestamps for completed steps
- [x] Store contact info visible at all times
- [x] "Need help?" — store phone number, one-tap call
- [x] Rider location: STUB — shows "Your rider is on the way" (no live GPS in v1), real-time stub ready for Phase 5
- [x] Socket.IO: subscribes to `order:{orderId}` room, updates timeline on `order_status_changed`
- [x] TESTS: status timeline renders all states correctly, Socket.IO event updates UI

### 2.14 — Saved Addresses Page

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend address list/update/delete/default endpoints reachable at runtime
  - [x] Backend integration tests cover saved address CRUD/default behavior
  - [x] Routes are registered in runtime app route graph
  - [x] Frontend tests validated against expected API envelope and edge states

- [x] `src/pages/buyer/SavedAddressesPage.tsx` → route: `/account/addresses`
- [x] Lists all saved addresses with landmark description
- [x] Edit, delete (soft), set as default
- [x] TESTS: renders addresses, edit/delete/default flows

### 2.15 — Order History + Reorder

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend endpoints reachable at runtime: order history, reorder, and rating endpoints
  - [x] Backend integration tests cover reorder/rating behavior and constraints
  - [x] Routes are registered in runtime app route graph
  - [x] Frontend tests validated against expected API envelope and edge states

- [x] `src/pages/buyer/OrderHistoryPage.tsx` → route: `/account/orders`
- [x] Lists past orders: store name, items summary, total, date, status
- [x] "Reorder" button: `POST /api/v1/orders/:id/reorder` — re-adds all items to cart, navigates to cart
- [x] Thumbs up / thumbs down rating (no stars): `PUT /api/v1/orders/:id/rate`
- [x] TESTS: reorder adds items to cart, rating submission

### 2.15.1 — Order Details & Status UI Hardening

- [x] Refine "Thank You" bloom animation:
  - [x] Increase bloom hold time for "excitement" (avoid jittery/fast feel)
  - [x] Smooth out GSAP transitions for cinematic reveal
- [x] Conditional "Thank You" bloom entrance: only executes if order was placed in the last 60 seconds or status is `PLACED`
- [x] Status-based messaging:
  - [x] `PLACED`: "Thanks for ordering" + Queue details
  - [x] `PREPARING`: "Store is picking items" + ETA trust copy
  - [x] `DELIVERED`: "Order Delivered" + immediate focus on Rating/Feedback UI
- [x] Hide "Queue" copy and " cinematic" effects for historically completed orders
- [x] TESTS: Component correctly switches content and animations based on API status payload

### 2.15.2 — Advanced Order States & Address Snapshoting

- [x] TDD: Create unit tests for `CANCELLED` state and `DELIVERED` duration badge
- [x] TDD: Create integration tests for Address Snapshoting (Database-level persistence)
- [x] DATABASE: Add `addressLabel` and `flatRoom` (optional) to `Order` model
- [x] BACKEND: Implement snapshot logic in `OrderService` (copy from Address profile or body)
- [x] UI: Implement "Delivered in XXm" duration calculation and badge
- [x] UI: Implement Full Address block (Label + Flat + Landmark)
- [x] UI: Hide in-progress elements (Contact, Footer, ETA) for `DELIVERED` and `CANCELLED`
- [x] UI: Add `CANCELLED` state with neutral styling and clear messaging


### 2.16 — Weather Mode (System-Wide Toggle)

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend feature-flag endpoint reachable at runtime: `GET /api/v1/feature-flags/WEATHER_MODE_ACTIVE`
  - [x] Backend integration tests cover flag retrieval and cache behavior as applicable
  - [x] Route is registered in runtime app route graph
  - [x] Frontend tests validated against expected API envelope and state transitions

- [x] `weatherMode` boolean in Zustand weather store
- [x] Fetched from `GET /api/v1/feature-flags/WEATHER_MODE_ACTIVE` on app load (refetched every 60s)
- [x] When `weatherMode = true`:
  - [x] Body background class: `weather-mode` (changes `--bg` to `--gorola-slate-mist`)
  - [x] Nav background: `--gorola-slate`
  - [x] ETA banner: slate blue, "Scheduled deliveries only tonight"
  - [x] Hero: alternate copy and color scheme
  - [x] All amber accent elements shift to slate-blue
- [x] Transition: smooth CSS var transition (0.6s ease) — not jarring
- [x] TESTS: weather mode state changes CSS variables, all affected components re-render correctly

### 2.17 — Advertisements Display

- [x] API Contract Gate (mandatory for phase completion):
  - [x] Backend ads endpoint reachable at runtime: `GET /api/v1/promotions/advertisements`
  - [x] Backend integration tests cover approved/active/date-window filtering
  - [x] Route is registered in runtime app route graph
  - [x] Frontend tests validated against expected API envelope and carousel states

- [x] `src/components/buyer/AdvertisementBanner.tsx`
  - [x] Fetches `GET /api/v1/promotions/advertisements` (only approved, active, within date range)
  - [x] Carousel (Embla carousel) for multiple ads
  - [x] Shown on home page between categories and featured products
  - [x] Each ad: image, optional link
  - [x] Auto-advance every 5s, pause on hover
- [x] TESTS: renders active ads, skips unapproved/expired, carousel navigation

### 2.18 — Sub-categories & Global Search (TDD End-to-End)

> **Architecture Note:** A new `SubCategory` table is introduced between `Category` and `Product`.
> Navigation flow: `Category → SubCategory → Product`.
> The existing search bar in `BuyerNav` navigates correctly but lands on a placeholder page.
> This phase replaces that placeholder with a real, functional Search Results page.

> [!IMPORTANT]
> **Image vs Emoji decision:** Both `Category` and `SubCategory` will use `imageUrl` (a proper image URL)
> instead of the current `emoji` field. The `emoji` column on `Category` must be **removed** via migration.
> This affects the existing categories API response shape — all consumers (frontend `CategoryGrid`) must be updated.

#### Database
- [x] **Migration 1 — Category image:** Remove `emoji` field from `Category`, add `imageUrl String?` to `Category`
  - Migration name: `prisma migrate dev --name category-image-replace-emoji`
  - Update seed: replace emoji values with placeholder image URLs (e.g. `https://picsum.photos/seed/groceries/400/300`)
- [x] **Migration 2 — SubCategory table:** Add new `SubCategory` model:
  - Fields: `id`, `slug` (unique), `name`, `imageUrl String?`, `displayOrder Int @default(0)`, `isActive Boolean @default(true)`, `categoryId` (FK to `Category`), `createdAt`, `updatedAt`
  - Index: `[categoryId, isActive, displayOrder]`
  - Migration name: `prisma migrate dev --name add-subcategories`
- [x] **Migration 3 — Product sub-category FK (non-nullable):**
  - `subCategoryId` on `Product` is **required** (`String`, not `String?`) — not nullable
  - Since all product data is seed/dummy data: **wipe all products in the seed first**, then re-seed with proper `subCategoryId` assignments
  - Migration strategy: add column as nullable temporarily → backfill via seed reset → apply `NOT NULL` constraint in a second migration, OR use `prisma migrate dev` with a shadow DB reset (`prisma migrate reset` locally)
  - Migration name: `prisma migrate dev --name product-subcategory-required-fk`
- [x] Seed: Update `prisma/seed.ts` — sub-categories created first, then products assigned to the correct `subCategoryId`. All existing dummy products reassigned.

#### Backend (TDD — Red-Stub → Green for every endpoint)
- [x] **TDD Gate — Category image change:**
  - [x] Write failing test: `GET /api/v1/categories` response has `imageUrl` (not `emoji`) on each item
  - [x] Update `CategoryRepository` to select `imageUrl` instead of `emoji`
  - [x] Update `category.controller.ts` serializer to expose `imageUrl`
  - [x] Update existing `category.controller.test.ts` assertions
  - [x] Confirm GREEN
- [x] **TDD Gate — Sub-categories endpoint:**
  - [x] Write failing test: `GET /api/v1/categories/:slug/sub-categories` returns array with `id, slug, name, imageUrl`
  - [x] Implement `SubCategoryRepository` — `findByCategory(categorySlug)`, `findBySlug(slug)`
  - [x] Implement `SubCategoryController` — `GET /api/v1/categories/:slug/sub-categories`
  - [x] Register in `routes.ts`
  - [x] Confirm GREEN
- [x] **TDD Gate — Products sub-category filter:**
  - [x] Write failing test: `GET /api/v1/products?subCategoryId=x` returns only products in that sub-category
  - [x] Update `ProductRepository.findMany` to accept `subCategoryId` filter
  - [x] Update `product.controller.ts` query schema to accept `subCategoryId`
  - [x] Confirm GREEN
- [x] **TDD Gate — Unified search:**
  - [x] Write failing test: `GET /api/v1/search?q=fruit` returns `{ categories: [], subCategories: [], products: [] }`
  - [x] Implement `SearchRepository` — queries products (`name` icontains), categories (`name`/`slug` icontains), sub-categories (`name`/`slug` icontains) in parallel
  - [x] Implement `SearchController` — `GET /api/v1/search`
  - [x] Register in `routes.ts`
  - [x] Confirm GREEN

#### Frontend (TDD — Red-Stub → Green)
- [x] **Update `CategoryGrid.tsx`** — replace `emoji` rendering with `<img src={category.imageUrl} />` (with fallback)
  - [x] Update `CategoryGrid.test.tsx` — assert `imageUrl` is rendered, remove `emoji` assertions
- [x] `SubCategoryGrid.tsx` — renders sub-category image tiles (same visual pattern as updated `CategoryGrid`)
  - [x] Each tile shows `imageUrl` + `name`
  - [x] Each tile navigates to `/categories/:categorySlug/:subCategorySlug`
  - [x] Unit tests: renders images, navigates on click, handles empty + error states
- [x] `CategoryPage.tsx` — currently shows `ProductGrid`; now shows `SubCategoryGrid` instead
  - [x] Update `CategoryPage.test.tsx`
- [x] New `SubCategoryPage.tsx` — route `/categories/:categorySlug/:subCategorySlug`
  - [x] Fetches products filtered by `subCategoryId`
  - [x] Shows `ProductGrid` with the correct sub-category context
  - [x] Unit tests written first
- [x] `SearchResultsPage.tsx` — replaces the current placeholder at `/search`
  - [x] Reads `?q=` from URL, calls `GET /api/v1/search?q=`
  - [x] Renders grouped results: Categories matched, Sub-categories matched, Products matched
  - [x] Debounced live re-fetch as `?q=` param updates (300ms)
  - [x] Empty state ("No results for …") and error state handled
  - [x] Unit tests written first
- [x] Update router in `App.tsx` to add `/categories/:categorySlug/:subCategorySlug` route and replace `SearchPlaceholderPage` with `SearchResultsPage`
- [x] **Post-Implementation Hardening:**
  - [x] Resolved "Cart Wipe" bug via guest-to-user merge logic in `syncBuyerCartFromServer`.
  - [x] Added visual asset (image) assertions to `ProductGrid`, `CategoryGrid`, and `SubCategoryGrid` tests.
  - [x] Fixed all API integration tests for FK constraint compatibility with new hierarchy.
- [x] TESTS: full quality gate green after all changes (339 API, 119 web)

---

### 2.19 — Wiring Hardening (Strict TDD — All Phantom Features Closed)

> **Purpose:** A post-2.18 audit identified 8 features marked "complete" in the docs that are either unreachable, hardcoded, or entirely absent from the runtime. This phase closes every gap before any new feature work begins. No item is marked done until: (a) a RED test proves the bug exists, (b) a GREEN implementation makes it pass, AND (c) an integration test proves the full path through the live route graph. Writing only a mocked unit test and calling it done is **not acceptable** here.

> [!IMPORTANT]
> **TDD rule for this phase:** Every fix needs **at minimum** one unit/component test AND one integration test. The integration test must prove the full path: UI trigger → API route → service → DB → response → UI state.

---

#### W-011 — Product Detail Page Unreachable (No Navigation Links)

**Root cause:** `ProductDetailPage.tsx` and route `/products/:id` both exist. `ProductGrid.tsx` renders product cards with an "Add" button but zero `<Link>` elements. A buyer can never navigate to a product's detail page from the UI.

**Fix:** Wrap each card's image + title in `<Link to={/products/${item.productId}}>`. Keep the "Add" button as a standalone `<button>` with `e.stopPropagation()`. Requires verifying the list API exposes `productId` (the `Product.id`, not a `ProductVariant.id`). Added product image to `ProductDetailPage` for improved aesthetics. Unified "Add to Cart" behavior across Grid and Detail pages with real-time sync and item-total transparency.

- [x] **RED — Unit (`ProductGrid.test.tsx`):**
  - [x] Test: each product card renders a link to `/products/<productId>`
  - [x] Test: clicking the "Add" button does NOT trigger navigation
  - [x] Run — confirm RED (no link found currently)
- [x] **RED — Integration (`product.controller.test.ts`):**
  - [x] Test: `GET /api/v1/products` items include a top-level `productId` field (the `Product.id`)
  - [x] Audit `listForBuyer()` — confirm whether current `id` on list items is the product id or a variant id
  - [x] Run — confirm RED if `productId` is absent from list response
- [x] **GREEN — Backend (`product.repository.ts`, `product.controller.ts`):**
  - [x] If current `id` on list items is a variant id, expose `productId: product.id` explicitly in the serialised response
  - [x] Run integration test — GREEN
- [x] **GREEN — Frontend (`ProductGrid.tsx`):**
  - [x] Add `productId: string` to the `ProductListItem` type
  - [x] Wrap card image + name in `<Link to={/products/${item.productId}}>`
  - [x] Add `e.stopPropagation()` to the "Add" `onClick`
  - [x] Run unit test — GREEN
- [x] **Verification chain:** Product grid → click card image/title → navigates to `/products/<id>` → `ProductDetailPage` renders with variants and "Add to cart"

---

#### W-012 — Subcategory Click in Search Results Uses Wrong Route

**Root cause:** `SearchResultsPage.tsx` line 141: `navigate('/search?q=${sub.name}')`. Clicking a subcategory result navigates back to search with its name as the query, not to `/categories/:categorySlug/:subSlug`. The search API also does not return `categorySlug` on subcategory results, so the correct URL cannot be built.

**Fix:** (1) Update `SearchRepository`/`SearchController` to include `categorySlug` on each subcategory item. (2) Update `SearchResultsPage` navigation to use the correct route.

- [x] **RED — Integration (`search.controller.test.ts`):**
  - [x] Test: `GET /api/v1/search?q=<term>` subcategory items include both `slug` AND `categorySlug` fields
  - [x] Run — confirm RED (`categorySlug` absent)
- [x] **GREEN — Backend (`search.repository.ts`, `search.controller.ts`):**
  - [x] Add `category { slug }` join to subcategory query
  - [x] Serialise `categorySlug: subCategory.category.slug` in response
  - [x] Run integration test — GREEN
- [x] **RED — Unit (`SearchResultsPage.test.tsx`):**
  - [x] Test: clicking a subcategory result calls `navigate('/categories/<categorySlug>/<subSlug>')`
  - [x] Run — confirm RED (currently navigates to `/search?q=...`)
- [x] **GREEN — Frontend (`SearchResultsPage.tsx`):**
  - [x] Add `categorySlug?: string` to `SearchResultItem` type
  - [x] Change `onClick` to `navigate('/categories/${sub.categorySlug}/${sub.slug}')`
  - [x] Fallback: if `categorySlug` is missing, navigate to `/search?q=${sub.name}` (safety net)
  - [x] Run unit test — GREEN
- [x] **Verification chain:** Search → click subcategory → lands on `/categories/groceries/dairy` → `SubCategoryPage` loads products correctly

---

#### W-013 — Phone Numbers Logged as Plain Text (PII Violation)

**Root cause:** `rules_and_spec.md §7`: *"Phone numbers in logs: mask to +91\*\*\*\*\*1234."* `logger.ts` `REDACT_PATHS` only covers `password` and `authorization`. All OTP flow log entries expose full phone numbers in plain text.

**Fix:** Add phone-related field paths to `REDACT_PATHS` in `logger.ts`.

- [x] **RED — Unit (`logger.test.ts`):**
  - [x] Test: a Pino log entry with `{ phone: '+919876543210' }` outputs `[Redacted]` for the phone field
  - [x] Test: a log entry with `{ body: { phone: '+919876543210' } }` also masks the nested phone
  - [x] Run — confirm RED
- [x] **GREEN — Implementation (`logger.ts`):**
  - [x] Add `"phone"`, `"*.phone"`, `"body.phone"`, `"req.body.phone"` to `REDACT_PATHS`
  - [x] Run unit test — GREEN
- [x] **RED — Integration (`server.request-logging.test.ts`):**
  - [x] Test: `POST /api/v1/auth/buyer/send-otp` with `{ phone: '+919876543210' }` — capture the Pino log stream and assert the literal string `+919876543210` does NOT appear in any log line
  - [x] Run — confirm RED
- [x] **GREEN:** Logger change alone is sufficient — run integration test — GREEN
- [x] **Verification chain:** OTP request → Fastify logs request body → phone field shows `[Redacted]` in log output

---

#### W-014 — Idempotency Key Not Honoured on POST /api/v1/orders

**Root cause:** `rules_and_spec.md §4`: *"All POST endpoints for orders and payments MUST accept and honor X-Idempotency-Key header."* `order.controller.ts` ignores this header. A user who double-taps "Place Order" or whose network retries the request creates duplicate orders.

**Fix:** Read `X-Idempotency-Key` in `order.controller.ts`. Check Redis for `idempotency:{buyerId}:{key}`. On cache hit return the cached response directly; on miss run `placeFromCart`, store the serialised response in Redis with a 24 h TTL, return.

- [x] **RED — Integration (`order.controller.test.ts`):**
  - [x] Test: two `POST /api/v1/orders` calls with identical `X-Idempotency-Key` both return the same `orderId`
  - [x] Test: only ONE `Order` row exists in the DB after both requests
  - [x] Test: a request without the header still functions normally
  - [x] Run — confirm RED (two orders created today)
- [x] **RED — Unit (`order.controller.unit.test.ts`):**
  - [x] Test: cache hit → `placeFromCart` is NOT called; cached payload is returned
  - [x] Test: cache miss → `placeFromCart` IS called and its result is stored in Redis
  - [x] Run — confirm RED
- [x] **GREEN — Implementation (`order.controller.ts`, `routes.ts`):**
  - [x] Add `redis: RedisLikeRuntime` to `RegisterOrderDeps`
  - [x] Before calling `placeFromCart`: check Redis for `idempotency:{buyerId}:{key}`
  - [x] On miss: call `placeFromCart`, store JSON with `EX 86400`, return response
  - [x] On hit: parse and return cached response directly
  - [x] Pass Redis through `registerOrderRoutes` in `routes.ts`
  - [x] Run both tests — GREEN
- [x] **Verification chain:** User double-taps Place Order → two requests with same key → DB has 1 order row → second response identical to first

---

#### W-015 — Rider Interface HTTP Stubs Not Registered (spec §12)

**Root cause:** `rules_and_spec.md §12` requires these 4 routes registered and returning 501:
`POST /api/v1/rider/auth/login`, `GET /api/v1/rider/orders/active`, `PUT /api/v1/rider/orders/:id/status`, `PUT /api/v1/rider/location`. Neither these routes nor the `/rider` Socket.IO namespace exist anywhere in the runtime.

**Fix:** Register all 4 stubs in `routes.ts` and add the `/rider` Socket.IO namespace stub in `socket.ts`.

- [x] **RED — Integration (`rider.routes.test.ts` — new file):**
  - [x] Test: `POST /api/v1/rider/auth/login` → 501 with error code `NOT_IMPLEMENTED`
  - [x] Test: `GET /api/v1/rider/orders/active` → 501
  - [x] Test: `PUT /api/v1/rider/orders/any-id/status` → 501
  - [x] Test: `PUT /api/v1/rider/location` → 501
  - [x] Run — confirm RED (404 currently for all)
- [x] **GREEN — Implementation (`routes.ts`):**
  - [x] Add `registerRiderStubRoutes(app)` — each of the 4 routes returns `reply.status(501).send({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Rider interface deferred to Phase 5' } })`
  - [x] Call it inside `registerAppRoutes`
  - [x] Run tests — GREEN
- [x] **Verification chain:** Any future rider client hits an endpoint → clear 501 with code → no ambiguous 404; Phase 5 only needs to fill in the bodies

---

#### W-016 — StockMovementType Enum Missing REFILL / ADJUSTMENT / INITIAL

**Root cause:** `rules_and_spec.md §13` defines 5 types: `SALE`, `CANCELLATION_RESTORE`, `REFILL`, `ADJUSTMENT`, `INITIAL`. `schema.prisma` only has `SALE` and `CANCELLATION_RESTORE`. Restocking and manual adjustments cannot be recorded.

**Fix:** Migration to add the 3 missing enum values.

- [x] **RED — Integration (`stock-movement.repository.test.ts`):**
  - [x] Test: can create `StockMovement` with `type: 'REFILL'`
  - [x] Test: can create `StockMovement` with `type: 'ADJUSTMENT'`
  - [x] Test: can create `StockMovement` with `type: 'INITIAL'`
  - [x] Run — confirm RED (Prisma type/runtime error)
- [x] **GREEN — Migration:**
  - [x] Add `REFILL`, `ADJUSTMENT`, `INITIAL` to `StockMovementType` enum in `schema.prisma`
  - [x] `pnpm --filter @gorola/api prisma migrate dev --name add-stock-movement-types`
  - [x] Apply migration to test DB: `pnpm --filter @gorola/api prisma:migrate:test-db`
  - [x] Run integration tests — GREEN
- [x] **Verification chain:** Store panel records a REFILL on restock → stock movement history shows correct enum value

---

#### W-017 — ProductVariant Missing lowStockThreshold / isLowStock / isInStock Fields

**Root cause:** `rules_and_spec.md §13` requires `lowStockThreshold Int @default(5)`, `isLowStock Boolean @default(false)`, `isInStock Boolean @default(true)` on every `ProductVariant`. None exist in `schema.prisma`. The buyer API cannot filter OOS variants; the store dashboard cannot alert on low stock.

**Fix:** Migration to add 3 fields. Update `decrementStock` / `incrementStock` in `variant.repository.ts` to set these flags atomically in the same DB call.

- [x] **RED — Integration (`variant.repository.test.ts`):**
  - [x] Test: new `ProductVariant` defaults: `isInStock: true`, `isLowStock: false`, `lowStockThreshold: 5`
  - [x] Test: `decrementStock` bringing `stockQty` to 0 also sets `isInStock: false`
  - [x] Test: `decrementStock` bringing `stockQty <= lowStockThreshold` sets `isLowStock: true`
  - [x] Test: `incrementStock` bringing `stockQty > 0` restores `isInStock: true`
  - [x] Test: `incrementStock` bringing `stockQty > lowStockThreshold` restores `isLowStock: false`
  - [x] Run — confirm RED
- [x] **GREEN — Migration + Implementation:**
  - [x] Add 3 fields to `ProductVariant` in `schema.prisma`
  - [x] `pnpm --filter @gorola/api prisma migrate dev --name add-variant-stock-flags`
  - [x] Apply to test DB
  - [x] Update `decrementStock`: after atomic decrement, compute and update `isInStock` and `isLowStock` in the same Prisma `$transaction`
  - [x] Update `incrementStock` (used in cancellation restore): same pattern
  - [x] Run integration tests — GREEN
- [x] **RED — Integration (`product.controller.test.ts`):**
  - [x] Test: `GET /api/v1/products/:id` variant payload includes `isInStock` field
  - [x] Test: a variant with `isInStock: false` is still visible in the detail response but marked clearly (buyer sees "Out of Stock")
  - [x] Run — confirm RED (field absent from response)
- [x] **GREEN — Backend (`product.repository.ts`, `product.controller.ts`):**
  - [x] Include `isInStock`, `isLowStock`, `lowStockThreshold` in variant select/return shape for both list and detail endpoints
  - [x] Run integration tests — GREEN
- [x] **Verification chain:** Stock → 0 → `isInStock: false` → buyer card disabled → checkout stock check rejects it

---

#### W-018 — OTPLog Prisma Model Contradicts "Redis Only" Spec

**Root cause:** `current_state.md §1.2` documents OTPLog as *"Redis, not DB."* But `schema.prisma` defines `model OTPLog { ... }`, creating a real `otp_logs` DB table. Zero application code reads or writes this table via Prisma. It's dead schema noise that contradicts the architecture.

**Fix:** Remove `model OTPLog` from `schema.prisma`. Create a migration to drop the table. Verify OTP flow still works (it uses Redis exclusively).

- [x] **Pre-check:** `grep -r "prisma.oTPLog\|prisma.oTPlog\|db.oTPLog" apps/api/src` — must return zero results in application code (test cleanup calls are acceptable)
- [x] **GREEN — Schema + Migration (this one has no RED — it's a deletion):**
  - [x] Remove `model OTPLog { ... }` block from `schema.prisma`
  - [x] `pnpm --filter @gorola/api prisma:migrate:dev --name remove-otp-log-table`
  - [x] Apply to test DB
  - [x] Run `pnpm --filter @gorola/api typecheck` — if any app code referenced `prisma.oTPLog`, it now fails (catching the bug)
- [x] **Integration test (`auth.controller.test.ts` — existing):**
  - [x] Test: full OTP send → verify flow (`POST /api/v1/auth/buyer/send-otp` then `POST /api/v1/auth/buyer/verify-otp`) still works end-to-end after migration
  - [x] Existing tests cover this — run them after migration and confirm GREEN
- [x] **Verification chain:** `schema.prisma` has no `OTPLog`; `prisma generate` removes the `db.oTPLog` accessor; `otp_logs` table dropped; full OTP auth flow passes

---

#### Phase 2.19 Quality Gate (ALL must be green before marking done)

- [ ] Every RED test was confirmed failing BEFORE any implementation started
- [ ] Every GREEN implementation confirmed by the failing test now passing
- [ ] `pnpm --filter @gorola/api lint` — clean
- [ ] `pnpm --filter @gorola/api typecheck` — clean
- [ ] `pnpm --filter @gorola/web lint` — clean
- [ ] `pnpm --filter @gorola/web typecheck` — clean
- [ ] `pnpm ci:quality` — full pipeline GREEN
- [ ] Manual smoke: click product card image → navigates to `/products/:id` ✓
- [ ] Manual smoke: search → click subcategory result → lands on `/categories/:cat/:sub` ✓
- [ ] Manual smoke: double-click Place Order → only one order in DB ✓
- [ ] Manual smoke: tail API logs during OTP request → no plain-text phone numbers in output ✓

---

### 2.20 — Profile Page

> Details to be added by the user.

---

### 2.21 — UI Overhaul

> Details to be added by the user.

---

### 2.22 — (Reserved)

> Details to be added by the user.

---

### 2.23 — E2E Tests (Playwright)

- [ ] `tests/e2e/buyer-journey.spec.ts`:
  - [ ] Browse home page → categories load
  - [ ] Navigate to Groceries → sub-category list loads
  - [ ] Navigate to a sub-category → product list loads
  - [ ] Search for a product → results page shows correct match
  - [ ] Add product to cart → cart count increments
  - [ ] Open cart → item visible
  - [ ] Remove item → cart updates
  - [ ] Login flow → OTP step 1 → step 2 (mock OTP in test)
  - [ ] Checkout → address entry → place order → confirmation page
  - [ ] Order history → reorder
- [ ] Weather mode E2E: admin toggles flag → buyer UI shifts

---

## 📋 Phase 3 — Store Owner Panel Checklist

_(Detailed checklist to be filled in when Phase 2 is 100% complete)_

- [ ] API Contract Gate (mandatory for phase completion of every Phase 3 item):
  - [ ] Required backend endpoint(s) for the item are implemented
  - [ ] Backend integration tests verify endpoint contract and access control
  - [ ] Endpoint routes are registered in runtime app route graph
  - [ ] Frontend tests verify expected API envelope + loading/empty/error states

### 3.1 — Store Auth (Email + TOTP 2FA)

- [ ] `src/pages/store/StoreLoginPage.tsx` → route: `/store/login`
  - [ ] Email + password form (Zod validation)
  - [ ] Submits `POST /api/v1/auth/store/login`
  - [ ] If 2FA enabled: redirect to `/store/2fa` for TOTP code entry
  - [ ] Error states: wrong credentials (generic message — no enumeration), account locked after 10 attempts
- [ ] `src/pages/store/StoreTwoFactorPage.tsx` → route: `/store/2fa`
  - [ ] 6-digit TOTP input (auto-focus, digit-by-digit)
  - [ ] Submits `POST /api/v1/auth/store/verify-2fa`
  - [ ] Error: wrong code, rate limit
- [ ] `src/pages/store/StoreSetup2FAPage.tsx` → route: `/store/setup-2fa`
  - [ ] Shows QR code URI rendered as QR image (use `qrcode.react`)
  - [ ] Manual entry key shown below QR
  - [ ] Verification step: enter current TOTP code to confirm setup
  - [ ] `POST /api/v1/auth/store/setup-2fa` → `POST /api/v1/auth/store/verify-2fa`
- [ ] `StoreLayout` — sidebar nav, main content area
- [ ] `StoreNav` sidebar items: Dashboard, Orders, Products, Advertisements, Offers & Discounts, Settings
- [ ] TESTS: login flow, 2FA flow, locked account behavior, wrong TOTP code

### 3.2 — Store Dashboard

- [ ] `src/pages/store/StoreDashboardPage.tsx` → route: `/store/dashboard`
- [ ] Fetches `GET /api/v1/store/dashboard`:
  - [ ] Today's orders count and revenue
  - [ ] Pending orders count (badge, highlighted if > 0)
  - [ ] Weekly revenue chart (Recharts bar chart, GoRola colors)
  - [ ] Top 5 products this week (by units sold)
  - [ ] Active advertisements count
  - [ ] Active offers count
- [ ] Pending orders alert: if any orders in PLACED status > 10 mins, show amber alert
- [ ] Weather mode indicator: shows current weather mode state + toggle link to admin (read-only for store)
- [ ] Auto-refresh every 30s (TanStack Query `refetchInterval: 30000`)
- [ ] Loading: skeleton matching dashboard layout
- [ ] TESTS: dashboard data renders, pending order alert triggers, auto-refresh, skeleton states

### 3.3 — Incoming Order Management

- [ ] `src/pages/store/StoreOrdersPage.tsx` → route: `/store/orders`
- [ ] Tabs: Pending | Preparing | Out for Delivery | Delivered (today) | All
- [ ] Order card:
  - [ ] Order ID (short), timestamp, buyer first name, landmark description
  - [ ] Items list (name, qty, variant)
  - [ ] Total amount, payment method (COD badge)
  - [ ] Action buttons per status:
    - [ ] PLACED: "Accept & Prepare" (→ PREPARING) + "Cancel" button
    - [ ] PREPARING: "Mark as Out for Delivery" (→ OUT_FOR_DELIVERY)
    - [ ] OUT_FOR_DELIVERY: "Mark as Delivered" (→ DELIVERED)
  - [ ] All status changes: `PUT /api/v1/store/orders/:id/status { status, note? }`
- [ ] Socket.IO: subscribes to `store:{storeId}` room, `new_order` event shows a toast + adds to pending list with animation
- [ ] New order sound notification: short audio ping (user must interact with page first — browser autoplay policy)
- [ ] TESTS: status transitions, Socket.IO new order toast, cancel flow, all tab filters

### 3.4 — Product Management

- [ ] `src/pages/store/StoreProductsPage.tsx` → route: `/store/products`
- [ ] List all store products with status (active/inactive), stock, price
- [ ] "Add Product" button → opens drawer/dialog
- [ ] Product form (`src/components/store/ProductForm.tsx`):
  - [ ] Name (required), description, category (dropdown — only active categories), image upload
  - [ ] Image upload: client-side resize to max 1200px, Cloudinary or API multipart upload
  - [ ] Variants section (at least one required):
    - [ ] Label (e.g. "500ml", "1kg"), price (Decimal, min 0.01), stock quantity, unit
    - [ ] "Add another variant" button
    - [ ] Variant delete (only if no order items reference it — API enforces)
  - [ ] Active/inactive toggle
- [ ] Edit product: same form, pre-populated
- [ ] Soft delete: "Archive Product" — sets isDeleted, removes from buyer catalog
- [ ] Zod validation on all fields, errors shown inline
- [ ] `PUT /api/v1/store/products/:id/variants/:variantId` — stock update (quick inline edit in list view)
- [ ] TESTS: form validation (all fields), image upload, variant add/remove, soft delete, stock update

### 3.5 — Advertisement Management

- [ ] `src/pages/store/StoreAdvertisementsPage.tsx` → route: `/store/promotions/advertisements`
- [ ] List: title, image preview, status (Pending Approval / Approved / Rejected / Expired), date range
- [ ] Create ad form:
  - [ ] Title (required), image upload (required, max 2MB, jpg/png/webp)
  - [ ] Optional: link URL (validated as https URL)
  - [ ] Start date + End date (date picker, start must be before end, end must be future)
- [ ] After submit: status = "Pending Approval" — admin must approve before it shows to buyers
- [ ] Cannot edit after submission (must delete and recreate)
- [ ] Cannot delete an approved active ad (must deactivate first via admin)
- [ ] Status badge with color: Pending (amber), Approved (green), Rejected (red), Expired (gray)
- [ ] TESTS: form validation, date range validation, status display, pending vs approved state

### 3.6 — Offers Management

- [ ] `src/pages/store/StoreOffersPage.tsx` → route: `/store/promotions/offers`
- [ ] List active and past offers
- [ ] Create offer form:
  - [ ] Title (required), description
  - [ ] Discount type: Percentage | Flat Amount (radio)
  - [ ] Discount value (required, min 1. If percentage: max 90)
  - [ ] Min order amount (optional)
  - [ ] Max discount cap (optional, only for percentage type)
  - [ ] Start date + End date (required, same rules as ads)
  - [ ] Active toggle
- [ ] Edit offer (if not yet started — once active, only deactivation allowed)
- [ ] TESTS: percentage vs flat type, max cap logic, date validation, edit restriction after activation

### 3.7 — Discount / Coupon Code Management

- [ ] `src/pages/store/StoreDiscountsPage.tsx` → route: `/store/promotions/discounts`
- [ ] List discount codes with: code, type, value, usage count/limit, status
- [ ] Create discount code form:
  - [ ] Code (required, uppercase, alphanumeric, 4-12 chars, no spaces — enforced by Zod)
  - [ ] Discount type + value (same as offers)
  - [ ] Usage limit (optional — unlimited if blank)
  - [ ] Min order amount (optional)
  - [ ] Start + End date
  - [ ] Scope: store-specific (always in store panel — storeId auto-attached)
- [ ] "Generate random code" button — generates 8-char alphanumeric
- [ ] Deactivate code button (sets isActive=false)
- [ ] TESTS: code format validation, usage limit enforcement (checked in order service), deactivation

### 3.8 — Store Settings

- [ ] `src/pages/store/StoreSettingsPage.tsx` → route: `/store/settings`
- [ ] Store info: name, description, phone, address/landmark (edit)
- [ ] Weather mode delivery window: text field for store owner to configure their scheduled window (e.g. "9:00–10:30 PM")
- [ ] Change password form (current + new + confirm, all Zod-validated)
- [ ] 2FA setup/disable (if already set up, show "Disable 2FA" with TOTP confirmation)
- [ ] TESTS: profile update, password change validation, 2FA setup/disable flow

### 3.9 — Inventory Management UI

- [ ] Stock status visible on product list page (3.4):
  - [ ] Each variant row shows current stock qty prominently
  - [ ] Color coding: green (> lowStockThreshold), amber (≤ lowStockThreshold, > 0), red (0 — Out of Stock)
  - [ ] isInStock badge on product card

- [ ] Quick restock inline on product list:
  - [ ] "+Stock" button per variant row → inline input: "Add quantity" + optional note
  - [ ] Submits `PUT /api/v1/store/products/:id/variants/:variantId/stock`
  - [ ] Optimistic UI update, reverts on API error
  - [ ] TESTS: restock adds to current qty, creates REFILL movement, isInStock flips true when restocking from 0

- [ ] Manual adjustment (full recount):
  - [ ] "Adjust Stock" option per variant → modal: "Set stock to" absolute value + required reason field
  - [ ] Submits `PUT /api/v1/store/products/:id/variants/:variantId/stock/adjust`
  - [ ] TESTS: sets absolute value (not delta), creates ADJUSTMENT movement, reason required

- [ ] Low stock alert section on store dashboard (3.2):
  - [ ] Card: "Low Stock Items" — lists all variants with isLowStock = true
  - [ ] Each item: product name, variant label, current qty, lowStockThreshold
  - [ ] Quick restock button inline (same flow as above)
  - [ ] TESTS: alert shows when isLowStock=true, disappears after restock above threshold

- [ ] Out of stock banner on buyer product card:
  - [ ] When all variants isInStock=false: product card shows "Out of Stock" overlay
  - [ ] "Add" button disabled
  - [ ] Product is still visible (not hidden) — buyer knows it exists but can't order
  - [ ] TESTS: disabled add button, overlay renders, no API call on click attempt

- [ ] Stock Movement History page:
  - [ ] Route: `/store/products/:id/stock-history`
  - [ ] Table: date, type (SALE/REFILL/ADJUSTMENT/CANCELLATION_RESTORE), change (+/-), qty before, qty after, reference (order ID or "Manual"), note
  - [ ] Filter by variant (if product has multiple variants)
  - [ ] Filter by movement type
  - [ ] Read-only — no edits
  - [ ] TESTS: all movement types display, filter by type, order link navigates to order detail

- [ ] Low stock threshold configuration per variant:
  - [ ] In product edit form (3.4): "Low stock alert at" field per variant (default 5, min 1)
  - [ ] Submits as part of variant update `PUT /api/v1/store/products/:id/variants/:variantId`
  - [ ] TESTS: threshold update reflects in low-stock check logic

---

## 📋 Phase 4 — Admin Panel Checklist

_(Detailed checklist to be filled in when Phase 3 is 100% complete)_

- [ ] API Contract Gate (mandatory for phase completion of every Phase 4 item):
  - [ ] Required backend endpoint(s) for the item are implemented
  - [ ] Backend integration tests verify endpoint contract, permissions, and audit behavior
  - [ ] Endpoint routes are registered in runtime app route graph
  - [ ] Frontend tests verify expected API envelope + loading/empty/error states

### 4.1 — Admin Auth (Email + Mandatory TOTP 2FA)

- [ ] `src/pages/admin/AdminLoginPage.tsx` → route: `/admin/login`
  - [ ] Email + password → `POST /api/v1/auth/admin/login`
  - [ ] Always redirects to 2FA step (mandatory — cannot skip)
  - [ ] Lock after 10 failed password attempts (account must be unlocked from DB — no self-service)
- [ ] `src/pages/admin/AdminTwoFactorPage.tsx` → route: `/admin/2fa`
  - [ ] TOTP input, same UX as store 2FA
  - [ ] If admin account has no TOTP set up yet: force through setup flow before accessing any admin page
- [ ] `src/pages/admin/AdminSetup2FAPage.tsx` — same as store setup but mandatory (cannot skip)
- [ ] `AdminLayout` — top nav + sidebar (different from store layout)
- [ ] `AdminGuard` route wrapper: requires ADMIN role + 2FA verified flag in session
- [ ] TESTS: 2FA cannot be skipped, lock after 10 attempts, no self-service unlock

### 4.2 — Admin Dashboard (All-Stores Overview)

- [ ] `src/pages/admin/AdminDashboardPage.tsx` → route: `/admin/dashboard`
- [ ] Fetches `GET /api/v1/admin/dashboard`:
  - [ ] Total orders today (across all stores), total revenue today
  - [ ] Per-store breakdown: orders, revenue, pending orders count
  - [ ] Platform-wide weekly revenue chart (Recharts, stacked bar by store)
  - [ ] Platform-wide low stock alert count (across all stores)
  - [ ] Total active buyers (users with at least one order)
  - [ ] Total products across all stores
  - [ ] Any pending advertisement approvals (badge)
  - [ ] Current feature flags status (quick view)
- [ ] Weather Mode active indicator (with quick toggle button — see 4.7)
- [ ] TESTS: all metrics render, per-store breakdown, pending approvals count

### 4.3 — All-Orders View

- [ ] `src/pages/admin/AdminOrdersPage.tsx` → route: `/admin/orders`
- [ ] Table: Order ID, Buyer (masked phone), Store, Items count, Total, Status, Created at, Payment method
- [ ] Filters: by store, by status, by date range, by payment method
- [ ] When an order is force-cancelled by admin, stock restoration is triggered (same cancellation flow)
- [ ] Cursor-based pagination (50 per page)
- [ ] Click row → order detail modal:
  - [ ] Full order details (items, prices, address, landmark)
  - [ ] Status history timeline
  - [ ] Admin can force-update status if needed (with required audit note)
- [ ] Export to CSV button: current filtered view (max 1000 rows)
- [ ] TESTS: filters work, pagination, force-status update creates audit log entry, CSV export

### 4.4 — User Management (Buyers)

- [ ] `src/pages/admin/AdminUsersPage.tsx` → route: `/admin/users`
- [ ] Table: masked phone, name, order count, total spent, created at, status (active/suspended)
- [ ] Search by phone (partial match, shows masked)
- [ ] User detail drawer: order history, addresses (masked), account status
- [ ] Suspend/unsuspend account (sets user.isActive — suspended users get 403 on login)
- [ ] All actions create audit log entries
- [ ] TESTS: search, suspend/unsuspend, audit log created on each action

### 4.5 — Store Management

- [ ] `src/pages/admin/AdminStoresPage.tsx` → route: `/admin/stores`
- [ ] Table: store name, owner email, order count (all time), revenue (all time), product count, status
- [ ] "Add Store" form:
  - [ ] Store name, description, phone, landmark address
  - [ ] Store owner email + temporary password (sent via email — stub for v1: shown on screen)
  - [ ] Weather mode delivery window config
- [ ] Stock movement history tab for the entire store (all products/variants)
- [ ] Store detail page → route: `/admin/stores/:id`
  - [ ] All store orders, products, revenue chart, advertisements, offers
  - [ ] Suspend store toggle (all store products hidden from buyers, new orders blocked)
  - [ ] Store owner management (reset password, enable/disable 2FA for owner account)
- [ ] TESTS: add store creates store + store owner in transaction, suspend hides products from buyer API

### 4.6 — Category Management

- [ ] `src/pages/admin/AdminCategoriesPage.tsx` → route: `/admin/categories`
- [ ] Table: name, emoji, slug, display order, product count, active status
- [ ] Add/edit category: name, emoji picker, slug (auto-generated from name, editable), display order
- [ ] Active/inactive toggle (inactive categories hidden from buyer catalog)
- [ ] Cannot delete category that has products (API enforces: 409 Conflict)
- [ ] Drag-to-reorder display order (dnd-kit)
- [ ] TESTS: add category, auto-slug generation, display order reorder, cannot delete with products

### 4.7 — Feature Flag Management

- [ ] `src/pages/admin/AdminFeatureFlagsPage.tsx` → route: `/admin/feature-flags`
- [ ] Table of all flags with description and current value
- [ ] Toggle switch per flag (updates `PUT /api/v1/admin/feature-flags/:key`)
- [ ] Confirmation modal for high-impact flags: WEATHER_MODE_ACTIVE, RIDER_INTERFACE_ENABLED
- [ ] Change is reflected in Redis cache within 60 seconds (shown as note in UI)
- [ ] Every flag change creates audit log entry
- [ ] WEATHER_MODE_ACTIVE toggle: shows a confirmation with weather mode impact summary
- [ ] TESTS: toggle creates audit log, confirmation modal for high-impact flags, Redis cache invalidation on update

### 4.8 — Advertisement Approval Queue

- [ ] `src/pages/admin/AdminAdvertisementsPage.tsx` → route: `/admin/advertisements`
- [ ] Tabs: Pending Approval | Approved | All
- [ ] Pending queue: shows ad image preview, title, store name, date range, submitted at
- [ ] "Approve" button → `PUT /api/v1/admin/advertisements/:id/approve`
- [ ] "Reject" button → rejection reason text field required → `PUT /api/v1/admin/advertisements/:id/reject`
- [ ] Approved ads: can deactivate (`PUT /api/v1/admin/advertisements/:id/deactivate`)
- [ ] All actions create audit log entries
- [ ] TESTS: approve/reject flows, rejection reason required, deactivation, audit log

### 4.9 — Audit Log Viewer

- [ ] `src/pages/admin/AdminAuditLogsPage.tsx` → route: `/admin/audit-logs`
- [ ] Table: timestamp, actor (masked), role, action, entity type, entity ID, IP (masked to /24)
- [ ] Filters: by actor role, by action, by entity type, by date range
- [ ] Expandable row: shows oldValue and newValue JSON diff (simple JSON viewer component)
- [ ] Read-only — no edit/delete actions anywhere on this page
- [ ] Export to CSV (current filtered view, max 1000 rows)
- [ ] TESTS: read-only (no mutation buttons), filters, JSON diff display

### 4.10 — Admin E2E Tests (Playwright)

- [ ] `tests/e2e/admin-journey.spec.ts`:
  - [ ] Login → 2FA → dashboard loads
  - [ ] Toggle WEATHER_MODE_ACTIVE → buyer home page reflects change
  - [ ] Approve advertisement → appears on buyer home page
  - [ ] Add new store → store owner can login with provided credentials
  - [ ] Audit log shows all above actions

---

## 📋 Phase 5 — Rider Interface (Deferred)

_(Implementation deferred; keep this gate in place for when Phase 5 starts.)_

- [ ] API Contract Gate (mandatory for phase completion of every Phase 5 item):
  - [ ] Required backend endpoint(s) for rider flows are implemented
  - [ ] Backend integration tests verify rider endpoint contract and permissions
  - [ ] Endpoint routes/events are registered in runtime app route graph
  - [ ] Frontend/client tests verify expected API/socket envelope + loading/error states

---

## 🐛 Known Issues & Blockers

_(None yet)_

---

## 🔑 Environment & Keys Status

| Variable               | Status           | Notes                                                                                       |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| DATABASE_URL           | ❌ Not set       | Railway will provide                                                                        |
| REDIS_URL              | ❌ Not set       | Railway will provide                                                                        |
| JWT_PRIVATE_KEY        | ❌ Not generated | Run: openssl genrsa -out private.pem 2048                                                   |
| JWT_PUBLIC_KEY         | ❌ Not generated | Run: openssl rsa -in private.pem -pubout -out public.pem                                    |
| FAST2SMS_API_KEY       | ❌ Not set       | Sign up at fast2sms.com                                                                     |
| RAZORPAY_KEY_ID        | ❌ Not set       | Phase 2 — not needed yet                                                                    |
| RAZORPAY_KEY_SECRET    | ❌ Not set       | Phase 2 — not needed yet                                                                    |
| CORS_ALLOWED_ORIGINS   | ✅ In Railway    | **Prod** includes Vercel web origin; **dev** still `http://localhost:5173` where configured |
| OTEL_EXPORTER_ENDPOINT | ❌ Not set       | http://localhost:4318/v1/traces for dev                                                     |

---

## 🏗️ Monorepo Structure (target)

```
gorola/
├── apps/
│   ├── api/                          # Fastify backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # Buyer OTP + Store/Admin auth
│   │   │   │   ├── user/             # Buyer profile, addresses
│   │   │   │   ├── store/            # Store management
│   │   │   │   ├── store-owner/      # Store owner auth + dashboard
│   │   │   │   ├── admin/            # Admin panel
│   │   │   │   ├── catalog/          # Categories, Products, Variants
│   │   │   │   ├── cart/             # Cart management
│   │   │   │   ├── order/            # Order lifecycle
│   │   │   │   ├── promotion/        # Ads, Offers, Discounts
│   │   │   │   ├── feature-flag/     # Feature flags
│   │   │   │   ├── delivery/         # STUB — rider interface
│   │   │   │   └── audit/            # Audit logging
│   │   │   ├── lib/
│   │   │   │   ├── prisma.ts         # Prisma client singleton
│   │   │   │   ├── redis.ts          # Redis client singleton
│   │   │   │   ├── logger.ts         # Pino logger singleton
│   │   │   │   └── otel.ts           # OpenTelemetry initialization
│   │   │   ├── plugins/              # Fastify plugins
│   │   │   ├── server.ts             # Fastify instance factory
│   │   │   └── app.ts                # Entry point
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── __tests__/
│   │       ├── unit/
│   │       └── integration/
│   │
│   └── web/                          # React frontend
│       ├── src/
│       │   ├── pages/
│       │   │   ├── buyer/            # Home, Category, Product, Cart, Order
│       │   │   ├── store/            # Store panel pages
│       │   │   └── admin/            # Admin panel pages
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui components (auto-generated)
│       │   │   ├── shared/           # Topographic bg, weather banner, etc.
│       │   │   ├── buyer/            # Buyer-specific components
│       │   │   ├── store/            # Store panel components
│       │   │   └── admin/            # Admin panel components
│       │   ├── hooks/                # useGorolaMotion (Lenis + GSAP), …
│       │   ├── store/                # Zustand stores
│       │   ├── lib/
│       │   │   ├── api.ts            # Axios/fetch client with interceptors
│       │   │   ├── gsap.ts           # GSAP + ScrollTrigger setup
│       │   │   └── lenis.ts          # Lenis smooth scroll
│       │   └── styles/
│       │       ├── tokens.css        # GoRola CSS custom properties
│       │       ├── fonts.css         # Font imports + animation classes
│       │       └── globals.css       # Tailwind directives
│       └── tests/
│           └── e2e/                  # Playwright E2E tests
│
├── packages/
│   ├── shared/                       # Shared TypeScript types + Zod schemas
│   │   └── src/
│   │       ├── types/                # Domain types (Order, Product, etc.)
│   │       ├── schemas/              # Zod validation schemas
│   │       └── errors.ts             # AppError class hierarchy
│   └── ui/                           # Shared UI components (Phase 2+)
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # CI + path filters + Vercel + Railway (main)
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── eslint.config.ts
├── .prettierrc
└── .env.example
```

---

## 📊 Test Coverage Status

| Module            | Unit Tests | Integration Tests | Coverage                                                                                                                                                          |
| ----------------- | ---------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth              | ✅         | ✅                | unit: `auth.service.test.ts`, `auth.middleware.test.ts`, `store-owner-auth.service.test.ts`, `admin-auth.service.test.ts`; integration: `auth.controller.test.ts` |
| user              | ❌         | ✅                | integration: `user.repository.test.ts`                                                                                                                            |
| store-owner       | ❌         | ✅                | integration: `store-owner.repository.test.ts`                                                                                                                     |
| admin             | ❌         | ✅                | integration: `admin.repository.test.ts`                                                                                                                           |
| **web (buyer)**   | **✅**     | ⏳                | **unit/component:** Vitest **119** in `apps/web` (cart sync fix, image hardening, hydration, `OrderConfirmationPage`); E2E = Phase 2.22 |
| catalog           | ❌         | ✅                | integration: **339 tests** passing across all API modules                                                                                                         |
| cart              | ❌         | ✅                | integration: `cart.repository.test.ts`                                                                                                                            |
| order             | ✅         | ✅                | unit: `order.service.test.ts`; integration: `order.repository.test.ts`, `order.service.stock.integration.test.ts`, `order.controller.test.ts` (checkout HTTP)     |
| inventory (stock) | ❌         | ✅                | integration: `stock-movement.repository.test.ts`                                                                                                                  |
| address           | ❌         | ✅                | integration: `address.repository.test.ts`, `address.controller.test.ts` (buyer GET list)                                                                          |
| store             | ❌         | ✅                | integration: `store.repository.test.ts`                                                                                                                           |
| promotion         | ❌         | ✅                | integration: `advertisement`, `offer`, `discount` `*.repository.test.ts`                                                                                          |
| feature-flag      | ❌         | ✅                | integration: `feature-flag.repository.test.ts`                                                                                                                    |
| audit             | ❌         | ✅                | integration: `audit.repository.test.ts`                                                                                                                           |
| delivery (stub)   | ❌         | ✅                | integration: `rider.repository.test.ts`                                                                                                                           |

---

## 🔗 Important URLs

| Resource     | URL                                                                             | Status |
| ------------ | ------------------------------------------------------------------------------- | ------ |
| GitHub Repo  | `https://github.com/kashishjd0009-creator/gorola_app`                           | ✅     |
| Railway API  | `https://gorolaapp-production.up.railway.app`                                   | ✅     |
| Vercel Web   | _Production URL on Vercel project (Domains)_ — e.g. `https://<name>.vercel.app` | ✅     |
| Health Check | `https://gorolaapp-production.up.railway.app/api/health`                        | ✅     |

---

## 💡 Session Notes & Decisions Made

_(Append new entries — never delete old ones)_

> Older session notes (0–80) have been moved to [session_history_v1.md](file:///c:/Users/Administrator/Desktop/GoRola/GoRola_app/CONTEXT/ARCHIVE/session_history_v1.md)


**Session 84 (Phase 2.15.2 Order Hardening & Address Snapshotting):**

- Implemented **Address Snapshotting** at checkout: `Order` model now stores `addressLabel` and `flatRoom` directly to preserve historical accuracy even if user addresses are updated/deleted.
- Refined `OrderConfirmationPage` into a robust **Status State Machine**:
  - `PLACED`: GSAP Bloom entrance.
  - `PREPARING`: Store picking status.
  - `OUT_FOR_DELIVERY`: Live rider tracking pulse.
  - `DELIVERED`: Clean summary with a premium **"Delivered in XXm"** duration badge.
  - `CANCELLED`: Neutral styling with apology messaging; hides in-progress UI elements.
- Implemented **Duration Logic**: `calculateDeliveryDuration` uses `statusHistory` (PLACED vs DELIVERED) with a fallback to `createdAt` and a safe UI default (fixed the "XXm" placeholder).
- Implemented **Full Address Block**: Shows label, flat/room, and landmark in a structured layout.
- **Test Stability Hardening**: Fixed flaky integration tests in the API package by adding `Cart` and `CartItem` deletions to the `cleanGraph` functions of `order.history.test.ts` and `order.rate.test.ts`, preventing foreign key constraint violations during test suite execution.
- Verification: Added integration tests for snapshots and state machine tests for UI; passed full repo `pnpm ci:quality`.

**Session 85 (Scoped Mutation States & UI Fixes):**

- Fixed a UI bug in `OrderHistoryPage` where multiple "Reorder" buttons displayed a spinning icon and became disabled simultaneously.
- Root Cause: Shared `reorderMutation.isPending` flag was used without checking if the mutation was specifically for the current order.
- Fix: Updated UI to check `reorderMutation.variables === order.id` for scoping loading/disabled states.
- Applied similar scoping fix to the **Rating Section** to prevent all "Thumbs Up/Down" buttons from being disabled when submitting feedback for one order.
- Verification: Created TDD reproduction test confirming the fix (Pass: 2/2) and re-verified original tests (Pass: 5/5).
- Regression: Merged the reproduction test cases into the permanent `OrderHistoryPage.test.tsx` suite to prevent future regressions.
- **Deployment Fix**: Added `rewrites` to `vercel.json` to handle SPA routing. This ensures that refreshing the page on any sub-route (like `/account/orders`) correctly serves `index.html` instead of a 404.

**Session 86 (Identity Hydration Fix):**

- Fixed bug where user profile (phone/name) reverted to "Buyer" on page reload.
- Root Cause: The refresh flow (`POST /api/v1/auth/buyer/refresh`) only returned new tokens, losing the user's identity details during hydration.
- Fix (Backend): Updated `TokenService` to store the user's `name` in Redis alongside the `userId` and `phone`. Modified `rotateRefreshToken` to return the full profile.
- Fix (Frontend): Updated `bootstrapBuyerAuthSession` in `api.ts` to consume the full profile from the refresh response and call `setBuyerSession` for complete store hydration.
- Verification: Implemented Red-Green TDD with new integration tests in `buyer-token.service.test.ts`, `auth.service.test.ts`, `auth.controller.test.ts`, and `api.test.ts`. Passed full repo `pnpm ci:quality`.

**Session 87 (Weather Mode):**
- **Decision 021:** Implemented a 60-second polling interval for weather mode synchronization. This balances the need for "real-time" aesthetic shifts (like fog arrival) with backend resource conservation.
- **Architectural Adherence:** Ensured the feature flag retrieval follows the strict Controller -> Service -> Repository pattern, even for simple read-only operations.
- **UI Persistence:** Integrated the body class toggle into `App.tsx` to ensure that weather-mode state is applied globally and survives navigation.
- **CSS Strategy:** Used CSS variables for theme shifting (slate vs pine) to minimize JS-driven style recalculations and keep transitions smooth.
- **Dev Tooling:** Added a floating `DevWeatherToggle` button (only visible in `import.meta.env.DEV`) to allow immediate manual testing of theme transitions without waiting for the 60s backend sync.

**Session 88 (Weather Mode Aesthetic Fix):**
- **Decision 022:** Switched to a "Color-Sweep" approach for theme shifting. Instead of only overriding primary variables, we now explicitly map the entire brand color spectrum (Pine, Saffron, Amber, Fog) to a cold Slate-Blue palette when in Weather Mode.
- **Selector Hardening:** Fixed a selector mismatch where `body { ... }` was nested inside `.weather-mode`. Changed to `body.weather-mode` to ensure the body background and all inherited child variables update correctly.
- **UI Consistency:** Explicitly targeted the `footer` and `nav` with specific overrides to prevent "stubborn" background colors caused by utility class specificity.

**Session 89 (Hero Section Refinement):**
- **UX Tuning:** Reduced `min-h-screen` to `min-h-[85vh]` in `HeroSection.tsx` to prevent the hero from occupying the entire viewport, improving scroll discoverability.
- **Targeted Theming:** Switched Hero background to `bg-gorola-slate-mist` in weather mode, but preserved brand green/orange on buttons per user preference.

**Session 90 (Slate Theme Harmonization):**
- **Decision 023:** Aligned the Hero Section's weather mode background with the Navigation bar's Slate theme (`bg-gorola-slate`) to create a more cohesive and professional "atmospheric" look.
- **Contrast Management:** Reverted hero text/logo to light variants (`gorola-fog`) for readability on the now-darker slate background.
- **Logo Flexibility:** Refactored `GorolaMountainMark` to accept `color` props, removing hardcoded hex values and enabling theme-reactive SVG rendering.

**Session 94 (Sub-category Hierarchy Finalization & Issue Guide):**
- Completed the 3-tier catalog hierarchy (`Category → SubCategory → Product`) across backend and frontend.
- Created `ISSUE_GUIDE/subcategory_mandatory_column.md` documenting the migration "Constraint Hell" and synchronization steps for dev/test databases.
- Updated `decision_log.md` (DECISION-029) regarding the mandatory sub-category hierarchy shift.
- Verified and fixed product image rendering in `ProductGrid.tsx` with hover-zoom and fallback logic.

**Session 95 (Catalog Hardening & Cart Sync Fix):**
- **Bug Fix:** Resolved the "Cart Wipe on Checkout" issue where logging in as a guest would clear the local cart. Implemented guest-to-user reconciliation in `buyer-cart-sync.ts`.
- **TDD Hardening:** Added image assertions to `ProductGrid.test.tsx`, `CategoryGrid.test.tsx`, and `SubCategoryGrid.test.tsx` to verify visual asset loading.
- **Backend Test Fix:** Mass-updated all catalog-related integration tests in `apps/api` to include `subCategory` cleanup, resolving foreign key constraint failures in CI.
- **Quality Gate:** Added `buyer-cart-sync.test.ts` to verify the merge logic. Full `ci:quality` (lint, typecheck, tests, build) is 100% GREEN.

**Session 96 (Wiring & Security Hardening):**
- **W-011 (Product Detail Navigation):** Fixed the "Add to Cart" button consistency. Now when the item count reaches zero, the "Add to Cart" button returns, matching the behavior on category pages.
- **W-012 (Search Routing Fix):** Corrected search routing to ensure global search correctly populates results across categories.
- **W-013 (Phone Redaction):** Implemented automatic PII redaction for phone numbers in logs (root, body, and req.body levels) to comply with data privacy specs.
- **W-014 (Order Idempotency):** Implemented support for `X-Idempotency-Key` using Redis caching (24h TTL) in the order placement controller. Verified with integration tests simulating concurrent "double-tap" requests to ensure only one order is created.
- **Quality Gate:** Resolved linting and typecheck issues in new unit tests. Final CI quality check confirmed GREEN with 491 passing tests.

**Session 97 (Rider Stub Hardening):**
- **W-015 (Rider Interface Stubs):** Registered the 4 required HTTP endpoints (`POST /api/v1/rider/auth/login`, `GET /api/v1/rider/orders/active`, `PUT /api/v1/rider/orders/:id/status`, `PUT /api/v1/rider/location`) as `501 Not Implemented`.
- **Architectural Adherence:** Instead of manual `reply.send()`, implemented stubs by throwing `NotImplementedError` from `@gorola/shared`. This ensures the global Fastify error handler applies the standard error envelope (including `requestId`) to these responses.
- **Socket.IO Stub:** Added the `/rider` namespace in `socket.ts`. It accepts connections but immediately emits an error and disconnects, as the rider interface is deferred to Phase 5.
- **Verification:** Followed strict TDD (RED failure at 404 -> Implementation -> GREEN pass at 501). Confirmed with full `ci:quality` gate (495 tests green).

**Session 98 (Inventory Foundation Hardening):**
- **W-016 (Stock Movement Types):** Added `REFILL`, `ADJUSTMENT`, and `INITIAL` to `StockMovementType` enum to support future store-side inventory management.
- **Schema Modification:** Made `StockMovement.orderId` optional. This is an architectural shift to allow recording inventory changes (like initial stock load or manual adjustments) that are not tied to a specific buyer order.
- **Repository Validation:** Updated `StockMovementRepository` to enforce strict arithmetic checks for all types (e.g., `REFILL` must result in `after = before + qty`, `ADJUSTMENT` must have `qty` matching the absolute difference).
- **Verification:** Followed TDD. Created RED tests for new types -> Migration -> Repository Implementation -> GREEN pass. Full CI quality gate passing with 499 tests.
**Session 99 (Phase 2.19 W-017 ProductVariant Stock Flags):**
- **Decision 024:** Implemented stock state flags (`isInStock`, `isLowStock`) as managed fields in `ProductVariant` rather than dynamic calculations. This improves query performance for large catalog filters.
- **Atomic Operations:** Updated `decrementStock` and `incrementStock` in `ProductVariantRepository` to update these flags within the same transaction as the quantity change, ensuring data consistency without race conditions.
- **Buyer UI Alignment:** Exposed `isInStock` to the Buyer API detail and list endpoints. This allows the frontend to proactively disable "Add to Cart" and show "Out of Stock" labels without waiting for a server-side validation error at checkout.
- **Verification:** Followed strict TDD. Added 30 integration tests covering default values, transition boundaries (e.g., stock 6 -> 5 triggering `isLowStock`), and restoration logic. Full CI gate: 505 tests green.

**Session 100 (Cart Wipe Bug Fix):**
- **Root Cause Analysis:** Navigating to the Checkout page triggered a `syncBuyerCartFromServer()` call. If a previous add-to-cart mutation was in flight, the server returned a stale "empty" cart, which unconditionally wiped the local Zustand store.
- **Mutation Barrier:** Introduced `waitForAllCartMutations()` in the mutation queue. The sync utility now waits for all pending network updates to settle before fetching the authoritative server state.
- **Resilient Reconciliation:** Hardened the sync logic to preserve local items if a server push fails (e.g., network timeout during guest-to-buyer migration).
- **Checkout Guard:** Added an optimization to `CheckoutPage` to skip re-syncing if the local SPA cart is already populated, eliminating the race window entirely.
- **Verification:** Created `buyer-cart-sync.hardening.test.ts` simulating stale responses and push failures. Full CI gate: 507 tests green.
**Session 101 (Phase 2.19 W-018 OTPLog Removal):**
- **Architecture Alignment:** Removed the `OTPLog` model from `schema.prisma` to resolve a contradiction with the architecture spec (§1.2), which specifies Redis as the single source of truth for OTP logs and rate limiting.
- **Cleanup Migration:** Successfully dropped the `otp_logs` table. Verified that no application code (or test code) relied on this table via a monorepo-wide grep and full typecheck.
- **Verification:** Confirmed that the `send-otp` and `verify-otp` integration tests pass using the existing Redis-backed logic. Full CI gate is 100% green with 507 tests.
