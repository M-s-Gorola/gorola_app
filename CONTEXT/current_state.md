# GoRola — Current State (Master Index)

> **ALWAYS read this file first at the start of every session.**
> After reading this file, open the **phase file for your active phase** — it has the checklist AND the current stopping point.
> **DO NOT update this file every session.** Only update it when a phase changes status (NOT STARTED → IN PROGRESS → COMPLETE), a new env key is added, or a cross-cutting architectural decision is made.
> Per-session tracking (Last Updated, In Progress, Next Task) lives in each phase file — not here.

---

---

## 🗂️ Phase File Navigation

> **CRITICAL:** The detailed checklists live in the files below — NOT in this file.
> Open the file for your active phase and read the checklist before writing any code.

| Phase | File | Status | Notes |
|-------|------|--------|-------|
| Phase 1 & 2 | [`phase1_2_state.md`](./phase1_2_state.md) | ✅ COMPLETE    | 2.1–2.23 complete. **File locked.** |
| Phase 3 & 4 | [`phase3_4_state.md`](./phase3_4_state.md) | ✅ COMPLETE    | Phase 3 and Phase 4 fully complete. All E2E runs passing cleanly. |
| Phase 5 | [`phase5_state.md`](./phase5_state.md) | ✅ COMPLETE    | Phase 5.1 to 5.7.5 complete. Earnings page, order accepting, names, map displays, and lockouts complete. |
| Phase 6 | [`phase6_state.md`](./phase6_state.md) | ✅ COMPLETE    | Subdomain Routing, UX refinement, and TDD parity. |
| Phase 7 | [`phase7_state.md`](./phase7_state.md) | ✅ COMPLETE    | Independent — Booking Commerce |
| Phase 8 | [`phase8_state.md`](./phase8_state.md) | 🔴 NOT STARTED | DPDP Act 2023 Compliance |
 
 ---
 
 ## 🚦 Overall Phase Status
 
 | Phase   | Name                 | Status         | Notes |
 | ------- | -------------------- | -------------- | ----- |
 | Phase 1 | NFR Foundation       | ✅ COMPLETE    | All 1.1–1.10 items complete |
 | Phase 2 | Buyer Web Experience | ✅ COMPLETE    | 2.1–2.23 complete. |
 | Phase 3 | Store Owner Panel    | ✅ COMPLETE    | Phase 3.1–3.10.1 complete. All E2E tests passing. |
 | Phase 4 | Admin Panel          | ✅ COMPLETE    | All Phase 4.1–4.10 items complete. |
 | Phase 5 | Rider Interface      | ✅ COMPLETE    | Phase 5.1 to 5.7.5 complete. |
| Phase 6 | Subdomain Routing    | ✅ COMPLETE    | All 6.1–6.9 checklists and UX refinements complete. |
| Phase 7 | Booking Commerce     | ✅ COMPLETE    | Independent — can start any time after Phase 2 |
| Phase 8 | DPDP Act Compliance  | 🔴 NOT STARTED | Must be complete before production launch.    |

---

## 🐛 Known Issues & Blockers

_(None currently)_

---

## 🔑 Environment & Keys Status

| Variable               | Status           | Notes                                                                                       |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| DATABASE_URL           | ✅ Railway       | Railway PostgreSQL service provides this                                                    |
| REDIS_URL              | ✅ Railway       | Railway Redis service provides this                                                         |
| JWT_PRIVATE_KEY        | ✅ Set           | RS256 private key configured in Railway                                                     |
| JWT_PUBLIC_KEY         | ✅ Set           | RS256 public key configured in Railway                                                      |
| FAST2SMS_API_KEY       | ❌ Not set       | Sign up at fast2sms.com — needed for production OTP                                         |
| GOROLA_DUMMY_OTP       | ✅ Dev/staging   | 6-digit fixed OTP for manual testing before SMS integration                                 |
| GOROLA_TEST_OTP        | ✅ CI only       | Deterministic OTP for integration tests in GitHub Actions                                   |
| RAZORPAY_KEY_ID        | ❌ Not set       | Phase 3+ — not needed yet                                                                   |
| RAZORPAY_KEY_SECRET    | ❌ Not set       | Phase 3+ — not needed yet                                                                   |
| CORS_ALLOWED_ORIGINS   | ✅ Railway       | Prod includes Vercel web origin; dev = `http://localhost:5173`                              |
| OTEL_EXPORTER_ENDPOINT | ❌ Not set       | `http://localhost:4318/v1/traces` for dev; optional                                         |
| VITE_MAP_PROVIDER      | ✅ Dev/Defaults  | 'leaflet' (default) or 'ola'                                                                |
| VITE_OLA_MAPS_API_KEY  | ❌ Not set       | Needed for Ola Maps integration                                                             |

---

## 📊 Test Coverage Status

| Module            | Unit Tests | Integration Tests | Coverage Notes |
| ----------------- | ---------- | ----------------- | -------------- |
| auth              | ✅         | ✅                | unit: auth.service, auth.middleware, store-owner-auth.service, admin-auth.service; integration: auth.controller |
| user              | ❌         | ✅                | integration: user.repository |
| store-owner       | ❌         | ✅                | integration: store-owner.repository |
| admin             | ❌         | ✅                | integration: admin.repository |
| **web (buyer)**   | **✅**     | ✅ COMPLETE     | 33/34 E2E scenarios passing. |
| catalog           | ❌         | ✅                | integration: 339+ tests across all API modules |
| cart              | ❌         | ✅                | integration: cart.repository, cart.controller |
| order             | ✅         | ✅                | unit: order.service; integration: order.repository, order.service.stock, order.controller |
| inventory (stock) | ❌         | ✅                | integration: stock-movement.repository |
| address           | ❌         | ✅                | integration: address.repository, address.controller |
| store             | ❌         | ✅                | integration: store.repository |
| promotion         | ❌         | ✅                | integration: advertisement, offer, discount repositories |
| feature-flag      | ❌         | ✅                | integration: feature-flag.repository |
| audit             | ❌         | ✅                | integration: audit.repository |
| delivery          | ✅         | ✅                | unit: RiderLoginPage, RiderOrdersPage; integration: rider.endpoints, rider.orders |
| booking           | ❌         | ✅                | integration: booking-schema |

**Last known test count:** 1004 Vitest (619 API + 385 web) + 34 Playwright E2E tests GREEN.
**E2E (Playwright):** All E2E tests passing green.

---

## 🏗️ Monorepo Structure

```
gorola/
├── apps/
│   ├── api/                          # Fastify backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # Buyer OTP + Store/Admin/Rider auth
│   │   │   │   ├── user/             # Buyer profile, addresses
│   │   │   │   ├── store/            # Store management (Phase 3 controllers here)
│   │   │   │   ├── store-owner/      # Store owner auth + dashboard
│   │   │   │   ├── admin/            # Admin panel (Phase 4 controllers here)
│   │   │   │   ├── catalog/          # Categories, Products, Variants, SubCategories
│   │   │   │   ├── cart/             # Cart management
│   │   │   │   ├── order/            # Order lifecycle
│   │   │   │   ├── promotion/        # Ads, Offers, Discounts
│   │   │   │   ├── feature-flag/     # Feature flags
│   │   │   │   ├── delivery/         # Rider interface (Phase 5 real impl here)
│   │   │   │   └── audit/            # Audit logging
│   │   │   ├── lib/
│   │   │   └── ...
│   │   └── prisma/
│   │
│   └── web/                          # React frontend (single Vite app)
│       └── src/
│           └── pages/
│               ├── buyer/            # Phase 2 — buyer-facing pages
│               ├── store/            # Phase 3 — StoreRoute-gated pages
│               ├── admin/            # Phase 4 — AdminRoute-gated pages
│               └── rider/            # Phase 5 — RiderRoute-gated pages
│
├── packages/
│   ├── shared/                       # Shared TypeScript types + Zod schemas
│   └── ui/                           # Shared React components
│
└── CONTEXT/
    ├── current_state.md              ← THIS FILE (master index)
    ├── phase1_2_state.md             ← Phase 1 & 2 checklists (locks after 2.23)
    ├── phase3_4_state.md             ← Phase 3 & 4 checklists (active work file)
    ├── phase5_state.md               ← Phase 5 checklist (independent)
    ├── AGENT_ENTRY.md                ← Read this first
    ├── architecture.md
    ├── rules_and_spec.md
    ├── decision_log.md
    ├── project_data.json
    └── ARCHIVE/
        ├── current_state_pre_split.md  ← Original monolithic file
        └── session_history_v1.md       ← Sessions 0–80 (inlined in phase1_2_state.md)
```

---

## 💡 Cross-Cutting Architectural Decisions

> **ONLY record decisions here that affect multiple phases simultaneously** (e.g. switching a shared library, changing the API envelope format, restructuring the monorepo). Phase-specific session notes belong in the phase file's own Session Notes section.

_(Append new entries here — never delete old entries.)_

**2026-05-11 — Context Split:**
- Split `current_state.md` into 4 files: this master index + `phase1_2_state.md`, `phase3_4_state.md`, `phase5_state.md`.
- Per-session tracking (Last Updated, In Progress, Next Task) moved into each phase file. `current_state.md` is now a stable reference — only update at phase boundary events.
- Phase 3 and 4 backend controllers (Service → Controller → Routes) added explicitly to every section.
- Phase 5 expanded from stub to full 6-section TDD plan. Rider frontend in `apps/web/src/pages/rider/` using `RiderRoute` guard — matching store/admin pattern.
- Discount code E2E: seed `TESTDEAL10` in Playwright `beforeAll` (Phase 3.7 adds store UI for creation).
- Weather mode E2E: use `DevWeatherToggle` (only visible in `import.meta.env.DEV`; Playwright targets Vite dev server so DEV=true).
