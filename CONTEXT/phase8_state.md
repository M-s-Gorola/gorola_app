# GoRola — Phase 8 State (DPDP Act 2023 Compliance)

> **This file covers Phase 8: Full compliance with India's Digital Personal Data Protection Act 2023.**
> Phase 8 is independent of Phases 5–7 and can be worked on in parallel.
> It is a hard requirement before any real user data is collected in production.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name                    | Status      | Notes |
| ------- | ----------------------- | ----------- | ----- |
| Phase 8 | DPDP Act 2023 Compliance | 🟡 IN PROGRESS | Sections 8.1, 8.2, 8.3 (Two-Stage Erasure, Data Portability, Nominee), 8.3.4 (Consent Overhaul & Admin Consent Panel), and 8.3.5 (DPDP UI Alignment, Audit Log Search & Nominee PII Protection) complete; Phase 8.4 (Session Transparency & Security Alerting) ready to execute. |

---

## 📍 Last Updated

- **Date:** 2026-10-03
- **Session Summary:** Fully implemented and verified Phase 8.4 (Session Transparency & Security Alerting) and Phase 8.5 (Automated Data Retention & Purge Jobs) in strict TDD format, plus mobile UI/UX improvements:
  - **8.4.1 (Active Sessions & Remote Revocation):** Implemented session tracking in `AuthService`, routes `GET /api/v1/auth/sessions` & `DELETE /api/v1/auth/sessions`, Fastify IP/User-Agent context extraction, and `ActiveSessionsSection.tsx` component with mobile-responsive design.
  - **8.4.2 (Security Alerting):** Structured `SecurityAlertPayload` and `logSecurityAlert` helper in `logger.ts` triggering `FAILED_AUTH_BURST` security alert upon reaching lockout thresholds.
  - **8.5.1 (Automated Data Retention & Purge Jobs):** Built `audit-log-archive.worker.ts` (365-day audit purge), `otp-log-purge.worker.ts` (90-day statutory OTP purge), and unified `scheduler.ts`. Verified in `data-retention.test.ts`.
  - **8.5.2 (Railway Log Retention):** Verified Railway Pro plan fixed 30-day log retention compliance.
  - **Consent UI/UX Accordion Refinement:** Implemented bold headings and Compact Accordion per Purpose in `PrivacySettingsSection.tsx` for optimal mobile readability and DPDP transparency.
  - **Final Quality Gate:** 100% GREEN (122 API test files / 744 tests passed, 95 Web test files / 541 tests passed, 0 TypeScript errors across 4 packages, 0 ESLint errors).
- **Next Session Must Start With:** Phase 8.6 — Privacy Policy & Legal Pages.
- **In Progress Right Now:** None (Phases 8.4 & 8.5 complete).
- **Current Blocker:** None.


> ⚠️ **Update THIS block at the end of every session** (not `current_state.md`). Also mark completed checklist items `[x]` and append to the Session Notes section at the bottom. Update `current_state.md` ONLY when Phase 8 changes status (NOT STARTED → IN PROGRESS → COMPLETE).

---

## Mandatory Rules for Data Schema Changes & Migrations

> ⚠️ **MANDATORY RULES FOR ALL SECTIONS WITH SCHEMA CHANGES:**
> 1. **Migration Files Are Mandatory:** Whenever `schema.prisma` is modified, you MUST generate a physical SQL migration file using `pnpm --filter @gorola/api exec prisma migrate dev --name <migration_name>` with `DIRECT_URL` / `db_owner` DDL credentials. `prisma db push` alone is NOT allowed for releases.
> 2. **Apply Migration to Local & Test DBs First:** You MUST deploy the generated SQL migration file to both `gorola_dev` AND `gorola_test` (e.g. via `pnpm --filter @gorola/api prisma:bootstrap:test`) BEFORE running green implementation code or running test suites.
> 3. **Beware of Cascading Broken Logic:** Schema changes (new fields, unique constraints, or column types) can break existing serializations, filters, or direct Prisma calls across distant modules (e.g., admin, rider, store-owner, order services).
> 4. **Run Full Multi-Layer Test Suites:** After any schema change, you MUST run ALL test suites to catch regressions:
>    - Unit Tests: `pnpm --filter @gorola/api test -- src/__tests__/unit/`
>    - Integration Tests: `pnpm --filter @gorola/api test -- src/__tests__/integration/`
>    - E2E & Bootstrap: `pnpm --filter @gorola/api prisma:bootstrap:test` and E2E verification scripts.
>    - Quality Gates: `pnpm typecheck` and `pnpm lint`.

---

## ⚠️ Legal Disclaimer (Read Before Starting)


This phase plan is a **technical and operational guide** based on the text of the Digital Personal Data Protection Act 2023 and notified Rules. It does not constitute legal advice. **Before going live, have a qualified Indian legal counsel review your Privacy Policy, consent flows, and Data Processing Agreements.** Monitor `dpdp.gov.in` and `meity.gov.in` for statutory updates.

---

## Why This Phase Exists

GoRola collects phone numbers, names, delivery addresses, location coordinates, and order history from Indian users. It processes rider tracking via Socket.IO and maps (Ola Maps/Leaflet). It is hosted on US cloud infrastructure (Railway, Vercel). All of this triggers Data Fiduciary status under the DPDP Act 2023.

**Current compliance posture: ~40/90 (Partial Compliance).** Technical security foundations are strong (HttpOnly JWTs, OTP rate-limiting, no raw OTP logging, Zod validation, soft deletes). Missing elements include consent logging, field-level PII encryption, DDL/DML role separation, user rights endpoints (erasure/export), Privacy Policy pages, vendor paperwork, and call masking.

**Penalties for non-compliance range from ₹10 Crore to ₹250 Crore per violation category** (Sec 8(5) safeguard failures: up to ₹250 Cr; Children's data violations: up to ₹200 Cr).

---

## Phase 8 Section Map

| Section | Name | Type | Dependencies / Status |
|---------|------|------|-----------------------|
| **8.1** | **Database & Infrastructure Security** | Backend (TDD) | 🟢 **Current Setup — Do First** |
| **8.2** | **Consent Collection & Management** | Backend + Frontend (TDD) | 🟢 **Current Setup — Do First** |
| **8.3** | **User Rights: Erasure, Access & Nomination** | Backend + Frontend (TDD) | 🟢 **Current Setup** |
| **8.4** | **Session Transparency & Security Alerting** | Backend + Frontend (TDD) | 🟢 **Current Setup** |
| **8.5** | **Automated Data Retention & Purge Jobs** | Backend (TDD) | 🟢 **Current Setup** |
| **8.6** | **Privacy Policy & Legal Pages** | Frontend + Backend (TDD) | 🟢 **Current Setup** |
| **8.7** | **Non-Code Prerequisites & Documentation** | Internal / Operational / Legal | 🟢 **Current Setup** |
| **8.8** | **SMS OTP & Mobile Call Masking Services** | Backend + Vendor Integration | 🟡 **Pending Client Vendor Decision (At End)** |

---

## Mandatory API Contract Gate (all code sections in Phase 8)

- [ ] Required backend endpoint(s) fully implemented
- [ ] Backend integration tests verify: endpoint contract, HTTP status codes, auth/role guards
- [ ] Endpoint routes registered and returning correct responses
- [ ] Frontend/client tests verify: expected API envelope, loading state, empty state, error state

---

## Phase 8 Checklist

---

### 8.1 — Database & Infrastructure Security (Current Setup)

> **Type: Backend & Database configuration. Can be built immediately with existing Railway setup.**

---

#### 8.1.1 — Database Least-Privilege Credential Setup

**Root cause / Goal:**
Currently, `DATABASE_URL` in `apps/api` connects to Railway PostgreSQL using the primary administrative connection string (`postgres://...`). This user possesses full DDL rights (`CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`, `TRUNCATE`). Under DPDP Act Sec 8(5) & MeitY Security Rules, application runtime database connections must use restricted DML credentials (`app_service`) with no schema alteration rights. Schema migrations must use a separate privileged credential (`db_owner`).

**Fix / Approach:**
Create `db_owner` (DDL + DML) and `app_service` (DML only) PostgreSQL roles in Railway. Configure Railway API production environment variables to use `app_service` for `DATABASE_URL`, and configure GitHub Actions CI/CD to use `db_owner` for `MIGRATION_DATABASE_URL`.

---

- [x] **RED — Integration (`database.least-privilege.test.ts`):**
  - [x] Test setup: Connect to database using `DATABASE_URL` (`app_service` role).
  - [x] Test: Execute a raw DDL query `DROP TABLE IF EXISTS "TestDummyTable";` or `TRUNCATE "User";` → expect PostgreSQL error code `42501` (`insufficient_privilege`).
  - [x] Test: Execute DML query `SELECT COUNT(*) FROM "User";` or `INSERT INTO "User" ...` → expect success.
  - [x] **Run — confirm RED (currently `DATABASE_URL` has owner rights, so `DROP TABLE` succeeds).**

- [x] **GREEN — Database & Environment:**
  - [x] Execute SQL in Railway PostgreSQL console:
    ```sql
    -- 1. Create DDL / Migration role
    CREATE ROLE db_owner WITH LOGIN PASSWORD 'strong_owner_password_here';
    GRANT ALL PRIVILEGES ON DATABASE gorola TO db_owner;

    -- 2. Create Application Runtime role (DML only)
    CREATE ROLE app_service WITH LOGIN PASSWORD 'strong_app_password_here';
    GRANT CONNECT ON DATABASE gorola TO app_service;
    GRANT USAGE ON SCHEMA public TO app_service;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service;
    ```
  - [x] Update `DATABASE_URL` in Railway API environment variables: `postgresql://app_service:strong_app_password_here@.../gorola`.
  - [x] Update `MIGRATION_DATABASE_URL` in GitHub Actions secrets: `postgresql://db_owner:strong_owner_password_here@.../gorola`.
  - [x] Update `apps/api/prisma/schema.prisma` datasource block to use `directUrl = env("MIGRATION_DATABASE_URL")` for migrations if needed.
  - [x] Run integration test — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Production API executes normal CRUD operations successfully → An attacker attempts SQL injection DDL `DROP TABLE "User"` → PostgreSQL rejects query with error `42501` (`insufficient_privilege`) → Database tables remain intact → ✅ Done.

---

#### 8.1.2 — PII Field Encryption at Rest (Phone Number & Address)

**Root cause / Goal:**
In `schema.prisma`, `User.phone` and `DeliveryRider.phone` are currently stored as plain text strings (`String @unique`). PDF Module 2.1 and MeitY Security Rules mandate that phone numbers and personal identifiers must be stored in encrypted or hashed form at rest.

**Fix / Approach:**
Add a deterministic HMAC-SHA256 blind index field (`phoneHash`) to `User` and `DeliveryRider` models for exact-match lookups. Encrypt `phone` values at rest using AES-256-GCM in application repository layers before writing to PostgreSQL, and decrypt upon retrieval.

---

- [x] **RED — Integration (`pii.encryption.test.ts`):**
  - [x] Test setup: Create user via repository with phone `"+919876543210"`.
  - [x] Test: Inspect raw database record using raw Prisma `$queryRaw` query `SELECT phone, "phoneHash" FROM "User" WHERE id = ?`. Assert `phone` does NOT equal plain text `"+919876543210"` and starts with encryption IV prefix `enc:`. Assert `"phoneHash"` is a 64-character hex string.
  - [x] Test: Retrieve user via `userRepository.findByPhone("+919876543210")` → returns decrypted user object with `phone === "+919876543210"`.
  - [x] **Run — confirm RED (phone is currently stored as unencrypted plain text).**

- [x] **GREEN — Backend (Schema → Repository → Service):**
  - [x] [Schema] Update `schema.prisma`:
    ```prisma
    model User {
      id          String   @id @default(cuid())
      phone       String   // Encrypted text (AES-256-GCM)
      phoneHash   String   @unique // HMAC-SHA256 blind index for exact search
      // ...
    }

    model DeliveryRider {
      id          String   @id @default(cuid())
      phone       String   // Encrypted text
      phoneHash   String   @unique // HMAC-SHA256 blind index
      // ...
    }
    ```
  - [x] Run `pnpm --filter @gorola/api prisma migrate dev --name add_pii_encryption_fields`. Apply to test DB.
  - [x] [Crypto Helper] Create `apps/api/src/lib/crypto.ts`:
    - `encryptPII(text: string): string` — AES-256-GCM using `ENCRYPTION_KEY` env var, returns `enc:<iv>:<ciphertext>:<authTag>`
    - `decryptPII(encryptedText: string): string` — extracts IV and tag, decrypts ciphertext
    - `hashPII(text: string): string` — HMAC-SHA256 using `HMAC_SECRET` env var, returns hex string
  - [x] [Repository] In `user.repository.ts` and `rider.repository.ts`:
    - On create/update: set `phone = encryptPII(rawPhone)` and `phoneHash = hashPII(rawPhone)`.
    - On lookup by phone: search `where: { phoneHash: hashPII(rawPhone) }`.
    - On read output: map returned entity through `decryptPII(user.phone)`.
  - [x] Run integration test — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] User logs in with phone `"+919876543210"` → Backend computes HMAC `phoneHash` to locate user → User entity returned with decrypted phone `"+919876543210"` → Database dump file contains only encrypted ciphertext strings → ✅ Done.


---

### 8.2 — Consent Collection & Management (Current Setup)

#### 8.2.1 — ConsentLog Schema & Consent API Endpoints

**Root cause / Goal:**
The DPDP Act requires that explicit, specific, and informed consent is obtained *before* any personal data is processed, and a record of consent must be maintained with timestamp, purpose, notice version, IP address, and withdrawal status. No consent recording endpoints or tables exist today.

**Fix / Approach:**
Create `ConsentLog` model in Prisma. Create `consent.repository.ts`, `consent.service.ts`, `consent.controller.ts`, exposing `POST /api/v1/consent` (record), `GET /api/v1/consent` (list user consents), and `DELETE /api/v1/consent/:purpose` (withdraw).

---

- [x] **RED — Integration (`consent.controller.test.ts`):**
  - [x] Test setup: Authenticated buyer JWT. ConsentLog table empty.
  - [x] Test: `POST /api/v1/consent` with body `{ purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: 'We collect your phone number to send a one-time password.' }` → HTTP 201 with `{ success: true, data: { id, purpose, consentVersion, givenAt } }`.
  - [x] Test: Query DB and assert exactly ONE `ConsentLog` row exists with `userId`, `purpose = 'OTP_AUTH'`, `isWithdrawn = false`, `ipAddress` not null.
  - [x] Test: `GET /api/v1/consent` with buyer JWT → HTTP 200 returning array of user consent records.
  - [x] Test: `DELETE /api/v1/consent/MARKETING_EMAIL` → HTTP 200; `ConsentLog` row updated to `isWithdrawn = true`, `withdrawnAt` set.
  - [x] Test: `DELETE /api/v1/consent/OTP_AUTH` → HTTP 400 `CANNOT_WITHDRAW_ESSENTIAL_CONSENT`.
  - [x] **Run — confirm RED (consent endpoints do not exist).**

- [x] **GREEN — Backend (Schema & Migration → Repository → Service → Controller):**
  - [x] [Schema & Migration] Add `ConsentLog` model and `ConsentPurpose` enum (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_EMAIL`, `ANALYTICS`) to `schema.prisma`. Generate physical SQL migration file: `pnpm --filter @gorola/api exec prisma migrate dev --name add_consent_log_model` using `DIRECT_URL` / `db_owner` DDL role.
  - [x] [DB Deployment] Apply migration SQL file to local databases (`gorola_dev` and `gorola_test`) via `pnpm --filter @gorola/api prisma:bootstrap:test` BEFORE writing implementation code or running tests.
  - [x] [Repository] Create `consent.repository.ts`: `create`, `findAllByUserId`, `findByUserIdAndPurpose`, `withdraw`.
  - [x] [Service] Create `consent.service.ts`: `recordConsent`, `getUserConsents`, `withdrawConsent` (throws `CannotWithdrawEssentialConsentError` if purpose is essential).
  - [x] [Controller] Create `consent.controller.ts` for `POST`, `GET`, `DELETE` routes.
  - [x] [Routes] Register consent routes in Fastify app with buyer JWT middleware.
  - [x] [Cascade & Regression Testing] Check across modules for cascading broken logic. Run full test suite (`pnpm test` / unit, integration, and E2E) and quality gates (`pnpm typecheck`, `pnpm lint`) — **confirm GREEN.**


- [x] **Verification chain:**
  - [x] Buyer calls `POST /api/v1/consent` → DB row created with IP and timestamp → `GET /api/v1/consent` lists consent → `DELETE /api/v1/consent/MARKETING_EMAIL` marks `isWithdrawn = true` → ✅ Done.

---

#### 8.2.2 — Consent Notice Screen in OTP Login Flow

**Root cause / Goal:**
Before a user enters their phone number on `LoginPage.tsx`, they must see a consent notice explaining what their phone number will be used for and who it will be shared with. Tapping "Continue & Accept" records this consent for `OTP_AUTH`.

---

- [x] **RED — Unit / Component (`LoginPage.test.tsx`):**
  - [x] Test: Initial render displays consent notice step (`data-testid="consent-notice-step"`), NOT phone input (`data-testid="phone-input"`).
  - [x] Test: Consent notice contains text "We collect your phone number to send a one-time password (OTP)" and link to `/privacy`.
  - [x] Test: Clicking "Continue & Accept" (`data-testid="consent-continue-btn"`) displays phone input step.
  - [x] Test: After successful OTP login, `POST /api/v1/consent` is called with `{ purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: '...' }`.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Frontend (Types → Component):**
  - [x] [Component] In `LoginPage.tsx`, add step state `'consent' | 'phone' | 'otp' | 'done'`. Render `ConsentNoticeStep` sub-component initially.
  - [x] [Component] On successful OTP verification callback, call `apiClient.post('/api/v1/consent', { purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: CONSENT_NOTICE_TEXT })`.
  - [x] Run unit test — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] User opens `/login` → Sees consent notice with Privacy Policy link → Clicks "Continue & Accept" → Enters phone & OTP → On auth success, `ConsentLog` row created in DB → ✅ Done.

---

#### 8.2.3 — Consent Withdrawal in Account Privacy Settings

- [x] **RED — Unit / Component (`PrivacySettingsSection.test.tsx`):**
  - [x] Test: Renders list of consents returned by `GET /api/v1/consent`. Non-essential consents render "Withdraw" button; essential consents (`OTP_AUTH`) render "Essential" label without button.
  - [x] Test: Clicking "Withdraw" on `MARKETING_EMAIL` calls `DELETE /api/v1/consent/MARKETING_EMAIL` and updates UI status to "Withdrawn".
  - [x] **Run — confirm RED.**

- [x] **GREEN — Frontend (Component):**
  - [x] Create `apps/web/src/components/account/PrivacySettingsSection.tsx` and integrate into `/account` page.
  - [x] Run unit test — **confirm GREEN.**

---

#### 8.2.4 — Consent Log Audit Trail & Immutability

- [x] **RED — Integration (`consent.audit.test.ts`):**
  - [x] Test: `POST /api/v1/consent` creates an `AuditLog` row with `action = 'CONSENT_GIVEN'`.
  - [x] Test: `DELETE /api/v1/consent/MARKETING_EMAIL` creates an `AuditLog` row with `action = 'CONSENT_WITHDRAWN'`.
  - [x] Test: Direct programmatic call to `prisma.consentLog.delete({ where: { id } })` throws `AppError` code `CONSENT_LOG_IMMUTABLE` (Prisma middleware guard).
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend:**
  - [x] Add Prisma middleware in `apps/api/src/lib/prisma.ts` blocking `delete` and `deleteMany` on `ConsentLog`. Update `consent.service.ts` to log to `AuditLog`.
  - [x] Run integration test — **confirm GREEN.**

---

#### 8.2.5 — `ORDER_PROCESSING` Consent on Address Modals & Checkout Flow

**Root cause / Goal:**
Saving a delivery address or placing an order collects landmark notes, GPS pins, and phone numbers to be shared with merchants and riders. DPDP Act Sec 5 requires prominent notice before collection.

- [x] **RED — Unit / Component (`SavedAddressesPage.test.tsx`, `CheckoutPage.test.tsx`):**
  - [x] Test: "Add Address" modal renders prominent `data-testid="order-processing-consent-notice"` detailing data sharing with merchants, delivery partners, and Ola Maps.
  - [x] Test: Saving an address dispatches `POST /api/v1/consent` with `{ purpose: 'ORDER_PROCESSING', ... }` and refreshes consent query cache.
  - [x] Test: Checkout review step displays prominent fulfillment consent step.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Frontend Component & Wiring:**
  - [x] [Component] In `SavedAddressesPage.tsx` and `BookingTimeslotPage.tsx`, render prominent DPDP notice card naming Ola Maps above Save button.
  - [x] [Wiring] On address creation/update success, trigger `apiClient.post('/api/v1/consent', { purpose: 'ORDER_PROCESSING', consentVersion: '1.0', noticeText: ... })` and invalidate `['consents']` query cache.
  - [x] [Component] In `CheckoutPage.tsx`, ensure prominent order fulfillment consent and Ola Maps & Razorpay disclosure are displayed.
  - [x] Run unit tests — **confirm GREEN.**

---

#### 8.2.6 — `MARKETING_EMAIL` Opt-In & Privacy Settings Controls

**Root cause / Goal:**
Marketing communications must be strictly opt-in (never pre-ticked) and fully controllable via self-serve switches in Profile Settings.

- [x] **RED — Unit / Component (`PrivacySettingsSection.test.tsx`):**
  - [x] Test: Privacy Settings renders interactive opt-in toggle card for `MARKETING_EMAIL`.
  - [x] Test: Enabling toggle sends `POST /api/v1/consent` (`MARKETING_EMAIL`).
  - [x] Test: Disabling toggle sends `DELETE /api/v1/consent/MARKETING_EMAIL`.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Frontend Component:**
  - [x] [Component] In `PrivacySettingsSection.tsx`, implement bi-directional opt-in/opt-out toggles for non-essential consents.
  - [x] [Component] In `CheckoutPage.tsx`, add un-ticked optional marketing opt-in card.
  - [x] Run unit tests — **confirm GREEN.**

---

#### 8.2.7 — `ANALYTICS` Authenticated Banner & Telemetry Opt-In (Option A)

**Root cause / Goal:**
Under DPDP Act 2023, anonymous performance telemetry requires prior notice with explicit Accept and Decline options. Under Option A, the banner only renders for authenticated users (`useAuthStore`) who haven't logged an analytics choice yet, ensuring `POST /api/v1/consent` is properly tied to a valid `userId` in PostgreSQL while maintaining local caching in `localStorage`.

- [x] **RED — Unit / Component (`AnalyticsConsentBanner.test.tsx`):**
  - [x] Test: Unauthenticated (guest) users do not see the banner.
  - [x] Test: Authenticated users without prior choice see prominent banner with `DPDP Act 2023` badge.
  - [x] Test: "Accept Analytics" calls `POST /api/v1/consent` (`ANALYTICS`), saves to `localStorage`, and closes banner.
  - [x] Test: "Decline / Essential Only" closes banner without calling API, saves declined state to `localStorage`.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Frontend Component:**
  - [x] [Component] Update `apps/web/src/components/consent/AnalyticsConsentBanner.tsx` with Option A auth gating, `whitespace-nowrap` on badge, and responsive layout.
  - [x] Run unit tests — **confirm GREEN (5/5 passed).**

---

#### 8.2.8 — Multi-Layer E2E Suite Updates & Regression Verification

- [x] Update Playwright E2E suites (`auth.spec.ts`, `checkout.spec.ts`, `booking-journey.spec.ts`, `store-owner-journey.spec.ts`, `admin-journey.spec.ts`) to handle interactive consent steps (`data-testid="consent-continue-btn"`).
- [x] Run full automated unit & integration test suites (`pnpm test` — 87 web test files + 114 API test files = 1200+ tests 100% green).
- [x] Verify `pnpm typecheck` and `pnpm lint` pass with 0 errors.

---

### Phase 8.2.9 State: DPDP Consent UI Compliance Fixes

> **Scope:** Frontend-only. No schema changes. No new API endpoints.
> **Triggered by:** Audit revealing that the built consent UI does not match the spec in
> `privacy_and_consent_card.md` and `DPDP_CONSENT_ARCHITECTURE_GUIDE.md` on three points:
> 1. Essential consent cards have no acknowledgement checkbox — the action button is always active.
> 2. The `ORDER_PROCESSING` essential card shows the wrong inactive status text.
> 3. No "View Complete Notice" modal exists on any consent card anywhere in the app.
> **Applicable Law:** DPDP Act 2023, Section 5(2) — notice must be demonstrably seen before data collection.

---

#### 📍 Last Updated

- **Date:** 2026-09-30
- **Session Summary:** Completed Phase 8.2.9 in strict TDD. All statutory 5-section notices, acknowledgment checkboxes inside cards, Option 2 active status rendering, and notice modals across all 6 touchpoints verified.
- **Next Session Must Start With:** Phase 8.3 — User Rights: Erasure, Access & Nomination.
- **In Progress Right Now:** Phase 8.2.9 Complete.
- **Current Blocker:** None.

> ⚠️ **Update THIS block at the end of every session.** Mark completed checklist items `[x]`
> and append to Session Notes at the bottom.

---

#### Phase 8.2.9 Section Map

| Work Item | Name | Files Touched | Status |
|-----------|------|---------------|--------|
| **8.2.9.1** | Acknowledgement Checkbox — Login Flow (`OTP_AUTH`) | `LoginPage.tsx`, `LoginPage.test.tsx` | 🟢 Complete (18/18 tests green) |
| **8.2.9.2** | Acknowledgement Checkbox — Address & Checkout Modals (`ORDER_PROCESSING`) | `SavedAddressesPage.tsx`, `BookingTimeslotPage.tsx`, `CheckoutPage.tsx` + tests | 🟢 Complete (34/34 tests green) |
| **8.2.9.3** | Acknowledgement Checkbox — Analytics Banner (no change needed — see rationale) | `AnalyticsConsentBanner.tsx` | ✅ No Change Required |
| **8.2.9.4** | Correct Essential Card Status Text in Privacy Dashboard | `PrivacySettingsSection.tsx`, `PrivacySettingsSection.test.tsx` | 🟢 Complete (6/6 tests green) |
| **8.2.9.5** | View Complete Notice Modal — Shared Component | `ConsentNoticeModal.tsx`, `ConsentNoticeModal.test.tsx` | 🟢 Complete (6/6 tests green) |
| **8.2.9.6** | Wire View Complete Notice into All Consent Touchpoints | All touchpoints + their tests | 🟢 Complete |
| **8.2.9.7** | Quality Gate — Full Suite + Typecheck + Lint | All (211 test files, 1247 tests 100% green) | 🟢 Complete |

---

#### Mandatory API Contract Gate

> This phase is **frontend-only**. No new API endpoints. All existing
> `POST /api/v1/consent`, `GET /api/v1/consent`, and `DELETE /api/v1/consent/:purpose`
> contracts are unchanged. The gate below applies to frontend component contracts only.

- [x] All new components have `data-testid` attributes matching the test assertions
- [x] No `any` types introduced — all props strictly typed
- [x] No new network calls beyond the existing consent API calls
- [x] `pnpm typecheck` passes with 0 errors after all changes
- [x] `pnpm lint` passes with 0 warnings after all changes

---

#### The Three Problems Being Fixed

##### Problem 1 — Essential Consent Has No Acknowledgement Checkpoint

**Root Cause:**
DPDP Act Section 5(2) requires that a notice is *demonstrably provided* before data
collection begins. Simply rendering a notice card on screen is insufficient — there
must be a UX mechanism that proves the user engaged with the notice before proceeding.
Currently, the "Verify OTP & Continue" button on `LoginPage.tsx` is active from the
first render. A user can skip past the notice entirely.

**What the spec requires (`privacy_and_consent_card.md`):**
Every essential consent step must have an **acknowledgement checkbox** labelled
`"I have read and understood this notice"` that the user must check before the
primary action button becomes active. This is **not** a grant/refuse toggle.
The user cannot refuse an essential consent. The checkbox is a read-acknowledgement
gate that strengthens the audit trail in `ConsentLog`.

**Distinction from Optional Consent:**
- **Essential** → Acknowledgement checkbox (`I have read and understood this notice`) —
  must be checked before button activates. No refuse option.
- **Optional** → Opt-in checkbox (`I agree to receive...`) — unchecked by default,
  user actively ticks to opt in. Already correct in the codebase.

---

##### Problem 2 — Wrong Inactive Status Text on `ORDER_PROCESSING` Card

**Root Cause:**
`PrivacySettingsSection.tsx` uses one generic fallback string for all inactive cards:
`"Withdrawn / Inactive — you can enable below"`. This is correct for optional cards
(`MARKETING_EMAIL`, `ANALYTICS`) but **wrong** for essential cards that have not yet
been triggered.

**Required status text per card + state:**

| Card | `isActive === true` | `isActive === false` |
|------|---------------------|----------------------|
| `OTP_AUTH` | `Active since [date] (v[version])` | `Active since account creation` |
| `ORDER_PROCESSING` | `Active since [date] (v[version])` | `🟡 Pending — Activated when you save an address or place your first order` |
| `MARKETING_EMAIL` | `Active since [date] (v[version])` | `Withdrawn / Inactive — you can enable below` ✅ |
| `ANALYTICS` | `Active since [date] (v[version])` | `Withdrawn / Inactive — you can enable below` ✅ |

---

##### Problem 3 — No "View Complete Notice" Exists Anywhere

**Root Cause:**
`privacy_and_consent_card.md` specifies `📋 [View Complete Notice]` on each card.
The built cards only show a one-line description. The full 5-section statutory notices
(Purpose, Data Categories, Third Parties, Retention, Rights & Complaints) are not
surfaced anywhere in the app. DPDP Section 5(2) requires the complete notice —
including third-party processors, retention period, and DPBI complaint path — be
accessible at the point of interaction.

**Where it must appear:**
1. `/account/privacy` — all 4 canonical consent cards.
2. `/login` — `OTP_AUTH` consent step.
3. `/account/addresses` — Add/Edit address modal.
4. `/booking` — Add Address dialog and above "Confirm Booking" button.
5. `/checkout` — Review step consent block.
6. `AnalyticsConsentBanner` — within the banner body.

---

#### Phase 8.2.9 Checklist

---

##### 8.2.9.1 — Acknowledgement Checkbox: Login Flow (`OTP_AUTH`)

**Root cause / Goal:**
`LoginPage.tsx` consent step renders a notice and a "Continue & Accept" button that
is immediately active. The button must be disabled until the user checks the
acknowledgement checkbox. This proves the notice was engaged with before the
`OTP_AUTH` ConsentLog record is created.

---

- [x] **RED — Unit / Component (`LoginPage.test.tsx`):**
  - [x] Test: On `consent-notice-step`, `data-testid="consent-continue-btn"` is **disabled** on initial render.
  - [x] Test: `data-testid="consent-acknowledge-checkbox"` renders unchecked on initial render.
  - [x] Test: Clicking `consent-continue-btn` when checkbox is unchecked does NOT advance the step.
  - [x] Test: Checking `consent-acknowledge-checkbox` enables `consent-continue-btn`.
  - [x] Test: After checking the checkbox and clicking `consent-continue-btn`, step advances to `phone-input`.
  - [x] **Run — confirm RED** (`pnpm --filter @gorola/web test -- --run LoginPage`).

- [x] **GREEN — Frontend (`LoginPage.tsx`):**
  - [x] Add `const [acknowledged, setAcknowledged] = useState(false)` to the consent step state.
  - [x] Render a `<Checkbox>` (shadcn/ui) with `data-testid="consent-acknowledge-checkbox"`, `id="consent-ack"`, `checked={acknowledged}`, `onCheckedChange={(v) => setAcknowledged(!!v)}`.
  - [x] Render `<label htmlFor="consent-ack">I have read and understood this notice</label>` adjacent to the checkbox.
  - [x] Add `disabled={!acknowledged}` to the "Continue & Accept" button.
  - [x] Run unit test — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] User opens `/login` → Consent notice + unchecked checkbox rendered → Button visually disabled → User checks checkbox → Button becomes active → User clicks → Advances to phone entry → OTP flow proceeds normally → ConsentLog row created → ✅ Done.

---

##### 8.2.9.2 — Acknowledgement Checkbox: Address & Checkout Modals (`ORDER_PROCESSING`)

**Root cause / Goal:**
The `ORDER_PROCESSING` consent notice cards on `SavedAddressesPage.tsx`,
`BookingTimeslotPage.tsx`, and `CheckoutPage.tsx` show the notice above the action button
but the button is always active. The same acknowledgement gate must apply.

**Special rule — idempotency interaction:**
The acknowledgement checkbox must only be shown when the user **has not yet** granted
`ORDER_PROCESSING` consent (`hasOrderProcessingConsent === false`). If they already have
an active `ORDER_PROCESSING` ConsentLog record, the notice is shown as a read-only
reminder without checkbox gating — because consent was already recorded.

---

- [x] **RED — Unit / Component (`SavedAddressesPage.test.tsx`):**
  - [x] Test: When `GET /api/v1/consent` returns no `ORDER_PROCESSING` record, Add Address modal renders `data-testid="order-processing-acknowledge-checkbox"` unchecked.
  - [x] Test: When checkbox is unchecked, `data-testid="save-address-btn"` is **disabled**.
  - [x] Test: Checking `order-processing-acknowledge-checkbox` enables the "Save Address" button.
  - [x] Test: When `GET /api/v1/consent` returns an active `ORDER_PROCESSING` record, the checkbox is **not rendered** and "Save Address" is not disabled by the consent gate.
  - [x] **Run — confirm RED** (`pnpm --filter @gorola/web test -- --run SavedAddressesPage`).

- [x] **RED — Unit / Component (`CheckoutPage.test.tsx`):**
  - [x] Test: When no `ORDER_PROCESSING` consent exists, "Place Order" button is disabled until acknowledgement checkbox is checked.
  - [x] Test: When active `ORDER_PROCESSING` consent exists, no checkbox rendered and "Place Order" button not consent-gated.
  - [x] **Run — confirm RED** (`pnpm --filter @gorola/web test -- --run CheckoutPage`).

- [x] **RED — Unit / Component (`BookingTimeslotPage.test.tsx`):**
  - [x] Test: When no `ORDER_PROCESSING` consent exists, "Confirm Booking" button is disabled until acknowledgement checkbox is checked.
  - [x] **Run — confirm RED** (`pnpm --filter @gorola/web test -- --run BookingTimeslotPage`).

- [x] **GREEN — Frontend (Shared Hook + Component Updates):**
  - [x] [Shared Hook] Create `apps/web/src/hooks/useOrderProcessingConsent.ts`:
    - Returns `{ hasConsent: boolean, isLoading: boolean }`.
    - Reads from React Query cache `["consents"]` — no new fetch.
    - `hasConsent = true` if any non-withdrawn `ORDER_PROCESSING` row exists.
  - [x] [SavedAddressesPage.tsx] Import `useOrderProcessingConsent`. In Add Address dialog, conditionally render `<Checkbox id="op-ack" data-testid="order-processing-acknowledge-checkbox">` and `<label>` only when `!hasConsent`. Pass `disabled={!hasConsent && !opAcknowledged}` to "Save Address" button.
  - [x] [CheckoutPage.tsx] Same pattern — conditionally render checkbox, gate "Place Order" button.
  - [x] [BookingTimeslotPage.tsx] Same pattern — gate "Confirm Booking" button.
  - [x] Reset `opAcknowledged` to `false` each time the modal opens (on dialog `onOpenChange`).
  - [x] Run unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] New user opens Add Address modal → Acknowledgement checkbox rendered unchecked → "Save Address" disabled → Checks checkbox → Button enables → Saves address → `POST /api/v1/consent ORDER_PROCESSING` fired → On next modal open, `hasConsent === true` → Checkbox not shown, button not disabled → ✅ Done.

---

##### 8.2.9.3 — Acknowledgement Checkbox: Analytics Banner

**Rationale (no code change):**
`AnalyticsConsentBanner.tsx` already forces a binary choice — "Accept Analytics" vs
"Decline / Essential Only". The "Decline" button is the refusal mechanism, which makes
a pre-read acknowledgement gate redundant. Adding a required read-checkbox before
showing the Accept/Decline buttons would itself be a dark pattern. The binary
Accept/Decline structure is the correct DPDP pattern for optional consents per
`DPDP_CONSENT_ARCHITECTURE_GUIDE.md` Section 5.

- [x] **No checkbox change required.** Existing tests remain valid.

---

##### 8.2.9.4 — Correct Essential Card Status Text in Privacy Dashboard

**Root cause / Goal:**
`PrivacySettingsSection.tsx` uses `"Withdrawn / Inactive — you can enable below"` for
all inactive cards. Essential cards (`OTP_AUTH`, `ORDER_PROCESSING`) have no enable
mechanism, making this text factually wrong and misleading for first-time users.

---

- [x] **RED — Unit / Component (`PrivacySettingsSection.test.tsx`):**
  - [x] Test: When `GET /api/v1/consent` returns empty array, `ORDER_PROCESSING` card renders status text containing `"Pending"` (not `"Withdrawn"`).
  - [x] Test: When `GET /api/v1/consent` returns empty array, `OTP_AUTH` card renders status text containing `"account creation"` (not `"Withdrawn"`).
  - [x] Test: When `GET /api/v1/consent` returns empty array, `MARKETING_EMAIL` card still renders `"Withdrawn / Inactive — you can enable below"`.
  - [x] Test: When `GET /api/v1/consent` returns empty array, `ANALYTICS` card still renders `"Withdrawn / Inactive — you can enable below"`.
  - [x] **Run — confirm RED** (`pnpm --filter @gorola/web test -- --run PrivacySettingsSection`).

- [x] **GREEN — Frontend (`PrivacySettingsSection.tsx`):**
  - [x] Add helper function inside the component file:
    ```ts
    function getInactiveStatusText(purpose: ConsentPurpose): string {
      switch (purpose) {
        case 'OTP_AUTH':
          return 'Active since account creation';
        case 'ORDER_PROCESSING':
          return '🟡 Pending — Activated when you save an address or place your first order';
        default:
          return 'Withdrawn / Inactive — you can enable below';
      }
    }
    ```
  - [x] Replace the existing inline inactive text with: `{card.isActive ? `Active since ...` : getInactiveStatusText(card.purpose)}`.
  - [x] Run unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] New user with no orders opens `/account/privacy` → `ORDER_PROCESSING` card shows `"🟡 Pending — Activated when you save an address..."` → User places first order → Returns to `/account/privacy` → Card now shows `"Active since [date] (v1.0)"` → ✅ Done.

---

##### 8.2.9.5 — View Complete Notice Modal: Shared Component

**Root cause / Goal:**
No "View Complete Notice" UI exists anywhere in the app. A shared modal component must
render the full 5-section statutory notices defined in `privacy_and_consent_card.md`
on demand at every consent touchpoint.

**Notice structure (5 sections per purpose):**
1. Purpose of Processing
2. Categories of Personal Data Collected
3. Third-Party Recipients & Processors
4. Retention Period
5. Your Rights & Complaints

---

- [x] **RED — Unit / Component (`ConsentNoticeModal.test.tsx`):**
  - [x] Test: `<ConsentNoticeModal purpose="OTP_AUTH" />` renders trigger button, modal closed by default.
  - [x] Test: Clicking trigger (`data-testid="view-notice-btn-OTP_AUTH"`) opens modal (`data-testid="consent-notice-modal"` becomes visible).
  - [x] Test: Modal content contains heading `"Authentication & Account Security"`.
  - [x] Test: Modal content contains all 5 section headings: `"Purpose of Processing"`, `"Categories of Personal Data Collected"`, `"Third-Party Recipients & Processors"`, `"Retention Period"`, `"Your Rights & Complaints"`.
  - [x] Test: `OTP_AUTH` modal contains text `"Exotel"`.
  - [x] Test: `ORDER_PROCESSING` modal contains text `"Ola Maps"` and `"Razorpay"`.
  - [x] Test: `MARKETING_EMAIL` modal contains text `"withdraw your consent"`.
  - [x] Test: `ANALYTICS` modal contains text `"Zero PII"`.
  - [x] Test: Modal contains link text `"dpo@gorola.com"`.
  - [x] Test: Modal contains text `"Data Protection Board of India"`.
  - [x] Test: Clicking close button closes modal.
  - [x] **Run — confirm RED** (component does not exist).

- [x] **GREEN — Frontend (New Shared Component):**
  - [x] Create `apps/web/src/components/consent/ConsentNoticeModal.tsx`.
  - [x] Props: `{ purpose: ConsentPurpose; triggerLabel?: string; triggerClassName?: string }`.
  - [x] Define `CONSENT_NOTICES` record inside the file with verbatim content from `privacy_and_consent_card.md`.
  - [x] Use shadcn/ui `<Dialog>` for the modal container with `<ScrollArea>` for content.
  - [x] Trigger: ghost `<Button variant="ghost" size="sm">` with `FileText` Lucide icon.
  - [x] Footer: `dpo@gorola.com` mailto link + `"Data Protection Board of India (DPBI)"` text.
  - [x] `data-testid` on trigger: `view-notice-btn-{purpose}`. On modal: `consent-notice-modal`.
  - [x] Export as: `export function ConsentNoticeModal(props: ConsentNoticeModalProps): ReactElement`.
  - [x] Run unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] User on any consent touchpoint clicks `"View Complete Notice"` → Modal opens → Full 5-section statutory notice rendered with all third parties named, retention periods stated, DPBI complaint path shown → User closes modal → Returns to consent flow → ✅ Done.

---

##### 8.2.9.6 — Wire View Complete Notice into All Consent Touchpoints

**Root cause / Goal:**
`ConsentNoticeModal` must be rendered at every consent touchpoint. This work item wires
the shared component into all 6 locations and updates each location's existing tests
to assert the trigger is present.

---

- [x] **RED — Update existing test files:**
  - [x] `LoginPage.test.tsx`
  - [x] `PrivacySettingsSection.test.tsx`
  - [x] `SavedAddressesPage.test.tsx`
  - [x] `CheckoutPage.test.tsx`
  - [x] `BookingTimeslotPage.test.tsx`
  - [x] `AnalyticsConsentBanner.test.tsx`

- [x] **GREEN — Wire `ConsentNoticeModal` into all touchpoints:**
  - [x] **`LoginPage.tsx`** — Consent notice step: add `<ConsentNoticeModal purpose="OTP_AUTH" />`.
  - [x] **`PrivacySettingsSection.tsx`** — Each card body: add `<ConsentNoticeModal purpose={card.purpose} />`.
  - [x] **`SavedAddressesPage.tsx`** — Add Address dialog consent block: add `<ConsentNoticeModal purpose="ORDER_PROCESSING" />`.
  - [x] **`CheckoutPage.tsx`** — Address block and marketing card: add `<ConsentNoticeModal />`.
  - [x] **`BookingTimeslotPage.tsx`** — Add Address dialog + marketing card: add `<ConsentNoticeModal />`.
  - [x] **`AnalyticsConsentBanner.tsx`** — Banner body: add `<ConsentNoticeModal purpose="ANALYTICS" />`.
  - [x] Run all updated unit tests — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] All 6 touchpoints have functional "View Complete Notice" modals displaying 5-section statutory disclosures.

---

##### 8.2.9.7 — Quality Gate: Full Suite + Typecheck + Lint

- [x] **Run full web test suite:** `pnpm --filter @gorola/web test -- --run` (92 test files, 528 tests 100% green).
- [x] **Run full API test suite:** `pnpm --filter @gorola/api test -- --run` (119 test files, 719 tests 100% green).
- [x] **TypeScript typecheck:** `pnpm typecheck` (0 errors across monorepo).
- [x] **ESLint:** `pnpm lint` (0 errors, 0 warnings).
- [x] **Verification chain:**
  - [x] All quality gates pass → ✅ Phase 8.2.9 Complete.

---

#### New Files Created in This Phase

| File | Purpose |
|------|---------|
| `apps/web/src/components/consent/ConsentNoticeModal.tsx` | Shared modal for all 4 full statutory notices |
| `apps/web/src/components/consent/ConsentNoticeModal.test.tsx` | Unit tests for the modal component |
| `apps/web/src/hooks/useOrderProcessingConsent.ts` | Shared hook — reads ORDER_PROCESSING consent status from React Query cache |

#### Modified Files in This Phase

| File | Changes |
|------|---------|
| `apps/web/src/pages/buyer/LoginPage.tsx` | Add acknowledgement checkbox; wire `ConsentNoticeModal` |
| `apps/web/src/pages/buyer/LoginPage.test.tsx` | New RED tests for checkbox + notice modal trigger |
| `apps/web/src/pages/buyer/SavedAddressesPage.tsx` | Add conditional acknowledgement checkbox; wire `ConsentNoticeModal` |
| `apps/web/src/pages/buyer/SavedAddressesPage.test.tsx` | New RED tests |
| `apps/web/src/pages/buyer/CheckoutPage.tsx` | Add conditional acknowledgement checkbox; wire `ConsentNoticeModal` |
| `apps/web/src/pages/buyer/CheckoutPage.test.tsx` | New RED tests |
| `apps/web/src/pages/buyer/BookingTimeslotPage.tsx` | Add conditional acknowledgement checkbox; wire `ConsentNoticeModal` |
| `apps/web/src/pages/buyer/BookingTimeslotPage.test.tsx` | New RED tests |
| `apps/web/src/components/account/PrivacySettingsSection.tsx` | Fix inactive status text; wire `ConsentNoticeModal` |
| `apps/web/src/components/account/PrivacySettingsSection.test.tsx` | New RED tests for status text + notice modal trigger |
| `apps/web/src/components/consent/AnalyticsConsentBanner.tsx` | Wire `ConsentNoticeModal` |
| `apps/web/src/components/consent/AnalyticsConsentBanner.test.tsx` | New RED test for notice modal trigger |

---

#### 📝 Session Notes: Phase 8.2.9 Implementation

- **Date:** 2026-09-30
- **Scope:** Completed full implementation of Phase 8.2.9 (DPDP Consent UI Compliance Fixes) in strict TDD (RED-GREEN-REFACTOR).
- **Key Deliverables:**
  1. **ConsentNoticeModal Component (`ConsentNoticeModal.tsx` & `ConsentNoticeModal.test.tsx`)**:
     - Built shared modal dialog displaying verbatim statutory 5-section notices (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_EMAIL`, `ANALYTICS`) with data categories, third-party processors (Ola Maps, Razorpay, SMS gateways), retention periods, DPO grievance contact (`dpo@gorola.com`), and statutory complaint path to the Data Protection Board of India (DPBI).
  2. **Login Consent Flow (`LoginPage.tsx` & `LoginPage.test.tsx`)**:
     - Embedded acknowledgement checkbox (`[ ] I have read and understood this notice`) inside the white card container.
     - Clean inline link layout (`[📄 View Complete Notice] • [Privacy Policy & Terms]`). Gated "Continue & Accept" button until checkbox is checked.
  3. **Order Processing & Address Management (`SavedAddressesPage.tsx`, `CheckoutPage.tsx`, `BookingTimeslotPage.tsx`)**:
     - Integrated `ORDER_PROCESSING` statutory notice + acknowledgment checkbox directly into all address creation forms.
     - Implemented **Option 2** consented state: Once granted, subsequent address/booking interactions display `🟢 Consent Active • Permanent operational requirement` without redundant blocking checkboxes.
     - Streamlined Booking and Checkout review screens to remove redundant `ORDER_PROCESSING` cards, keeping review flows fast and focused.
  4. **Promotions & Analytics Opt-In (`BookingTimeslotPage.tsx`, `CheckoutPage.tsx`, `AnalyticsConsentBanner.tsx`)**:
     - Rich cards for optional marketing offers with un-ticked opt-in checkboxes and Option 2 active status display.
     - Wired `<ConsentNoticeModal />` triggers into all 6 canonical consent touchpoints and banner body.
  5. **Privacy & Consent Preferences Dashboard (`PrivacySettingsSection.tsx` & `PrivacySettingsSection.test.tsx`)**:
     - Fixed canonical status text fallback for inactive essential consents (`🟡 Pending — Activated when you save an address or place your first order`).
     - Added direct `[📄 View Complete Notice]` triggers across all 4 purpose cards.
- **Quality Gate Results:**
  - `@gorola/web` test suite: **92/92 test files (528 tests) 100% GREEN**.
  - `@gorola/api` test suite: **119/119 test files (719 tests) 100% GREEN**.
  - Total Vitest tests: **211 test files, 1,247 tests passing 100%**.
  - Monorepo typecheck (`pnpm typecheck`): **0 errors**.
  - Monorepo lint (`pnpm lint`): **0 errors, 0 warnings**.

---

### 8.3 — User Rights: Erasure, Access & Nomination (Current Setup)

#### 8.3.1 — Right to Erasure with 30-Day Recovery Grace Period (`DELETE /api/v1/user/account` & `POST /api/v1/user/reactivate-account`)

**Root cause / Goal:**
Under India's DPDP Act Section 12, Data Principals have the statutory right to erase their personal data. To prevent accidental data loss and maintain industry-standard security, GoRola provides a **30-day grace period** during which users can cancel the deletion and restore their account simply by logging back in via Phone OTP.

**Lifecycle Architecture:**
1. **Day 0 (Deletion Request — `DELETE /api/v1/user/account`):**
   - Soft-delete: Sets `deletedAt = new Date()`, `deletionScheduledFor = Date.now() + 30 days`.
   - Preserves `phone` and `name` temporarily so the user can be authenticated during the grace period.
   - Revokes active sessions: Deletes Redis session keys (`user_sessions:{userId}`) and refresh tokens (`rt:buyer:{token}`) for instant logout across all devices.
   - Enqueues BullMQ `UserDataPurgeJob` scheduled to execute with a 30-day delay.
   - UI shows confirmation modal: *"Your account has been scheduled for deletion. You have a 30-day grace period. Simply log in with your phone number within 30 days to cancel deletion and restore your account."*
2. **Days 1–30 (Account Recovery / Reactivation — `POST /api/v1/user/reactivate-account`):**
   - User verifies Phone OTP on `/login`.
   - Backend detects `deletedAt !== null` and returns `{ isPendingDeletion: true, deletionScheduledFor }`.
   - Frontend displays **Account Reactivation Prompt**:
     - *"Welcome back! Your account is scheduled for permanent deletion on [Date]. Would you like to restore your account?"*
     - Action: **"Cancel Deletion & Restore Account"** $\rightarrow$ calls `POST /api/v1/user/reactivate-account`, clears `deletedAt = null`, cancels BullMQ job, restores full account access.
3. **Day 31+ (Permanent Hard Purge & Anonymization — BullMQ `UserDataPurgeJob`):**
   - Worker checks if `deletedAt !== null` (account was not reactivated).
   - Irreversibly anonymizes User profile: `name = '[deleted]'`, `phone = 'DELETED_${userId}'`, `phoneHash = null`, `isDeleted = true`, `isActive = false`.
   - Purges saved delivery addresses from `Address` table.
   - Purges nominee details (`nomineeName = null`, `nomineeContact = null`, `nomineeRelationship = null`).
   - Sanitizes order delivery PII in `Order` table (`landmarkDescription = '[deleted]'`, `flatRoom = null`, `deliveryNote = null`, `deliveryLat = null`, `deliveryLng = null`, `addressLabel = null`) while keeping financial totals for statutory merchant tax audits.
   - Marks all `ConsentLog` records with `isWithdrawn = true` and `withdrawnAt = new Date()`.
   - Cleans up any remaining Redis keys.

---

- [x] **RED — Integration (`user.account-deletion.test.ts` & `user.account-reactivation.test.ts`):**
  - [x] Test: `DELETE /api/v1/user/account` + buyer JWT → HTTP 200 with `{ isPendingDeletion: true, deletionScheduledFor: ... }`.
  - [x] Test: Query DB: `User` row has `deletedAt` set, `phone` intact for grace period, `isDeleted = false`.
  - [x] Test: Redis sessions for user are invalidated.
  - [x] Test: BullMQ `UserDataPurgeJob` scheduled logic tested.
  - [x] Test: `POST /api/v1/user/reactivate-account` clears `deletedAt` and restores active status.
  - [x] Test: Running `purgeExpiredUsers` after 30 days executes irreversible anonymization (`name = '[deleted]'`, `phone = 'DELETED_...'`, addresses purged, consents withdrawn).
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend & Frontend:**
  - [x] [Repository] Add `markPendingDeletion(userId)`, `reactivateAccount(userId)`, and `permanentPurgeAndAnonymize(userId)` in `user.repository.ts`.
  - [x] [Worker] Create `apps/api/src/workers/user-data-purge.worker.ts` with `purgeExpiredUsers` handler.
  - [x] [Controller] Add `DELETE /api/v1/user/account` and `POST /api/v1/user/reactivate-account`.
  - [x] [Frontend] Add "Danger Zone" card on `/account/privacy` with deletion dialog.
  - [x] Run integration & unit tests — **confirm GREEN (33/33 API + 15/15 web passed).**

- [x] **Verification chain:**
  - [x] Buyer goes to `/account/privacy` → Clicks "Delete my account" → Confirms modal → Soft-deleted & logged out → Buyer logs in within 30 days → Can restore account → If not restored in 30 days, purge worker executes permanent PII scrub → ✅ Done.

---

#### 8.3.2 — Right to Information (`GET /api/v1/user/my-data`)

- [x] **RED — Integration (`user.my-data.test.ts`):**
  - [x] Test: `GET /api/v1/user/my-data` + buyer JWT → HTTP 200 with JSON payload `{ profile, addresses, orders, consents }`. `passwordHash` and internal Prisma fields are absent.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend & Frontend:**
  - [x] [Repository] Add `getMyData(userId)` to `user.repository.ts` selecting profile, addresses, recent 50 orders, and consents.
  - [x] [Controller] Add `GET /api/v1/user/my-data` route with buyer JWT middleware.
  - [x] [Frontend] Add "Download my data" card on `/account/privacy` page triggering browser download of `gorola-my-data-[date].json`.
  - [x] Run integration & unit tests — **confirm GREEN.**

---

#### 8.3.3 — Right to Nominate (India-Specific Sec 14)

- [x] **RED — Integration (`user.nominee.test.ts`):**
  - [x] Test: `PUT /api/v1/user/nominee` with `{ nomineeName: 'Rajesh Kumar', nomineeContact: '+919876543211', nomineeRelationship: 'Spouse' }` + buyer JWT → HTTP 200; saves fields on user record.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend & Frontend:**
  - [x] [Schema] Add `nomineeName String?`, `nomineeContact String?`, `nomineeRelationship String?` to `User` model in `schema.prisma`. Run migration `20260924040500_add_user_nominee_and_deletion_fields`.
  - [x] [Controller & Repository] Add `updateNominee(userId, data)` and `getNominee(userId)` in `user.repository.ts` and `PUT /api/v1/user/nominee` + `GET /api/v1/user/nominee` routes.
  - [x] [Frontend] Add "Data Nominee (DPDP Act Sec 14)" card to `/account/privacy` page with form inputs.
  - [x] Run integration & unit tests — **confirm GREEN.**

---
### 8.3.4 — Consent Architecture Overhaul & Admin Consent Panel

> **Type: Backend (schema migration + new endpoint) + Frontend (notice text corrections + admin UI). Full TDD.**
> **Prerequisite: Phase 8.3.1–8.3.3 must be complete.**
> **This section has four sequential sub-tasks. Complete them strictly in order — each one is a dependency for the next.**

---

#### Sub-task Overview

| Sub-task | Name | Type | Dependency |
|----------|------|------|-----------|
| **8.3.4.1** | Replace `ConsentPurpose` enum with `ConsentPurposeConfig` table & rename `MARKETING_EMAIL` → `MARKETING_COMMS` | Schema + Backend | None — do first |
| **8.3.4.2** | Correct all consent notice text (GPS retention, name disclosure, marketing channel) | Backend + Frontend | 8.3.4.1 complete |
| **8.3.4.3** | Add `GET /api/v1/admin/users/:id/consents` endpoint (paginated) | Backend | 8.3.4.1 complete |
| **8.3.4.4** | Add Consent & Privacy section to Admin User Detail drawer | Frontend | 8.3.4.3 complete |

---

### 8.3.4.1 — Replace `ConsentPurpose` Enum with `ConsentPurposeConfig` Table & Rename `MARKETING_EMAIL` → `MARKETING_COMMS`

**Root cause / Goal:**
The `ConsentPurpose` PostgreSQL enum (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_EMAIL`, `ANALYTICS`) has two problems:

1. **Wrong enum name:** `MARKETING_EMAIL` implies email is the communication channel. GoRola has no email system — all promotional communication is SMS/push. The correct name is `MARKETING_COMMS`.
2. **Wrong architectural pattern:** A hardcoded PostgreSQL enum makes it impossible to add, retire, or rename consent purposes without a schema migration + full code deploy + Prisma client regeneration. As DPDP Act 2023 Rules continue to be notified, new consent purposes will be needed (e.g., `THIRD_PARTY_ANALYTICS`, `LOCATION_TRACKING`). Adding them must be a database-level operation, not a code deploy.

**Fix / Approach:**
Replace the `ConsentPurpose` enum in `schema.prisma` with a new `ConsentPurposeConfig` table that stores purpose metadata (key, display name, description, whether it is essential, retention description). Change `ConsentLog.purpose` from the `ConsentPurpose` enum type to a plain `String` referencing `ConsentPurposeConfig.key`. Generate a single migration that: (a) creates `ConsentPurposeConfig`, (b) drops the old enum column, (c) adds a new `String` column for `purpose`, (d) seeds the four canonical rows with `MARKETING_EMAIL` renamed to `MARKETING_COMMS`, and (e) updates all existing `ConsentLog` rows where `purpose = 'MARKETING_EMAIL'` to `purpose = 'MARKETING_COMMS'`. Update all TypeScript layers — types, Zod schemas, service, repository, controller — to use the string type instead of the Prisma-generated enum type. Confirm no Prisma-generated `ConsentPurpose` enum import remains anywhere.

---

- [x] **RED — Integration (`consent.controller.test.ts`):**
  - [x] At the top of the file, add one new test: `POST /api/v1/consent` with body `{ purpose: "MARKETING_COMMS", consentVersion: "1.0", noticeText: "test" }` → expect HTTP 201 with `data.purpose === "MARKETING_COMMS"`.
  - [x] Add one new test: `POST /api/v1/consent` with body `{ purpose: "MARKETING_EMAIL", consentVersion: "1.0", noticeText: "test" }` → expect HTTP 400 `VALIDATION_ERROR` (the old enum value is no longer accepted).
  - [x] Add one new test: `DELETE /api/v1/consent/MARKETING_COMMS` → expect HTTP 200; `ConsentLog` row updated to `isWithdrawn = true`.
  - [x] Add one new test: `DELETE /api/v1/consent/MARKETING_EMAIL` → expect HTTP 400 `VALIDATION_ERROR` (invalid purpose string).
  - [x] **Run — confirm RED (all four new tests fail because `MARKETING_COMMS` does not exist in the current Zod enum; `MARKETING_EMAIL` currently succeeds).**

- [x] **GREEN — Backend (Schema → Migration → Seed → Repository → Service → Controller):**

  - [x] **[Schema]** In `apps/api/prisma/schema.prisma`:
    - Delete the `enum ConsentPurpose { ... }` block entirely.
    - Add the following new model:
      ```prisma
      model ConsentPurposeConfig {
        key              String  @id        // e.g. "OTP_AUTH"
        displayName      String             // e.g. "Authentication & Account Security"
        description      String             // one-line description
        isEssential      Boolean @default(false)
        retentionSummary String             // one-line plain-English retention
        createdAt        DateTime @default(now())
        updatedAt        DateTime @updatedAt
        consents         ConsentLog[]
      }
      ```
    - Change `ConsentLog.purpose` from `ConsentPurpose` to `String`.
    - Add the relation: `purposeConfig ConsentPurposeConfig @relation(fields: [purpose], references: [key])`.
    - Remove all `@@map` or `@relation` references to the old enum.
    - Delete the `ConsentPurpose` import from `consent.types.ts` (it was a Prisma-generated type).

  - [x] **[Migration]** Run:
    ```
    pnpm --filter @gorola/api exec prisma migrate dev --name replace_consent_purpose_enum_with_config_table
    ```
    using the `db_owner` / `MIGRATION_DATABASE_URL` DDL credential. Verify the generated SQL file contains: `CREATE TABLE "ConsentPurposeConfig"`, `ALTER TABLE "ConsentLog" DROP COLUMN "purpose"` (or equivalent), `ALTER TABLE "ConsentLog" ADD COLUMN "purpose" TEXT`, and a foreign key constraint from `ConsentLog.purpose` → `ConsentPurposeConfig.key`.

  - [x] **[Seed in migration]** The migration SQL file (or a companion seed executed immediately after) must insert the four canonical rows into `ConsentPurposeConfig` AND rename the existing `MARKETING_EMAIL` rows:
    ```sql
    INSERT INTO "ConsentPurposeConfig" ("key", "displayName", "description", "isEssential", "retentionSummary", "createdAt", "updatedAt")
    VALUES
      ('OTP_AUTH',           'Authentication & Account Security',  'Verifies your identity via One-Time Password.', true,  'Lifetime of account; deleted within 30 days of account erasure.', now(), now()),
      ('ORDER_PROCESSING',   'Order Fulfillment & Location Services', 'Processes your location and order details for delivery.', true, 'Addresses deleted on erasure. Order GPS nulled on erasure; financials kept 7 years (GST).', now(), now()),
      ('MARKETING_COMMS',    'Promotions & Seasonal Offers',       'Sends you optional hill-station discounts and store coupons.', false, 'Scrubbed from all distributions within 48 hours of withdrawal.', now(), now()),
      ('ANALYTICS',          'Usage & Performance Analytics',      'Collects anonymous performance telemetry to improve the app.', false, 'Aggregated logs purged or anonymised after 180 days.', now(), now());

    -- Rename all existing MARKETING_EMAIL rows to MARKETING_COMMS
    UPDATE "ConsentLog" SET "purpose" = 'MARKETING_COMMS' WHERE "purpose" = 'MARKETING_EMAIL';
    ```

  - [x] **[Apply to test DB]** Run `pnpm --filter @gorola/api prisma:bootstrap:test` to apply the migration to `gorola_test`. Verify with a direct DB query that `SELECT COUNT(*) FROM "ConsentLog" WHERE purpose = 'MARKETING_EMAIL'` returns 0 and `SELECT * FROM "ConsentPurposeConfig"` returns exactly 4 rows.

  - [x] **[Types — `consent.types.ts`]** Remove `import type { ConsentLog, ConsentPurpose } from "@prisma/client"`. Define `ConsentPurpose` as a plain string union locally:
    ```typescript
    export type ConsentPurpose = "OTP_AUTH" | "ORDER_PROCESSING" | "MARKETING_COMMS" | "ANALYTICS";
    ```
    Update `RecordConsentInput.purpose` and `ConsentDTO.purpose` to use this local type.

  - [x] **[Schema — `consent.schema.ts`]** Update `consentPurposeEnum` to:
    ```typescript
    export const consentPurposeEnum = z.enum([
      "OTP_AUTH",
      "ORDER_PROCESSING",
      "MARKETING_COMMS",
      "ANALYTICS"
    ]);
    ```
    `MARKETING_EMAIL` must no longer be in this list.

  - [x] **[Service — `consent.service.ts`]** The `ESSENTIAL_PURPOSES` set already uses string literals. Change `"MARKETING_EMAIL"` if it appears. It should not — only `OTP_AUTH` and `ORDER_PROCESSING` are essential. Confirm no stale reference to `MARKETING_EMAIL` exists.

  - [x] **[Repository — `consent.repository.ts`]** No logic change needed. Verify that `findLatestByUserIdAndPurpose` and `withdraw` use the `purpose: ConsentPurpose` parameter type (now the local string union). Confirm all Prisma calls compile correctly with the new schema (the `purposeConfig` relation is not needed in existing queries — purpose is still just a string column for lookup).

  - [x] **[Controller — `consent.controller.ts`]** No route change needed. The Zod schema update in `consent.schema.ts` is sufficient — invalid purpose strings will be rejected at the parse step.

  - [x] Run `pnpm --filter @gorola/api test -- src/__tests__/integration/consent/` — **confirm GREEN.**
  - [x] Run `pnpm typecheck` — **confirm 0 errors.** No remaining `import { ConsentPurpose } from "@prisma/client"` anywhere in the codebase.

- [x] **RED — Unit / Component (`ConsentNoticeModal.test.tsx`, `PrivacySettingsSection.test.tsx`, all files referencing `MARKETING_EMAIL` as a string literal):**
  - [x] In `ConsentNoticeModal.test.tsx`: add test — rendering `<ConsentNoticeModal purpose="MARKETING_COMMS" />` and clicking `data-testid="view-notice-btn-MARKETING_COMMS"` opens the modal. **Confirm RED** (key `MARKETING_COMMS` does not exist in `CONSENT_NOTICES` yet).
  - [x] In `PrivacySettingsSection.test.tsx`: update all mock consent objects with `purpose: "MARKETING_EMAIL"` to `purpose: "MARKETING_COMMS"`. Update all `data-testid` assertions from `consent-card-MARKETING_EMAIL`, `withdraw-btn-MARKETING_EMAIL`, `optin-btn-MARKETING_EMAIL` to use `MARKETING_COMMS`. **Run — confirm RED** (testids don't match yet).
  - [x] In `PrivacySettingsPage.test.tsx`: same updates — replace every `"MARKETING_EMAIL"` string literal with `"MARKETING_COMMS"`. **Run — confirm RED.**
  - [x] In `CheckoutPage.test.tsx` and `BookingTimeslotPage.test.tsx`: replace every `"MARKETING_EMAIL"` string literal with `"MARKETING_COMMS"`. **Run — confirm RED.**
  - [x] **Run all frontend tests — confirm RED.**

- [x] **GREEN — Frontend (Types → Components):**
  - [x] **[`ConsentNoticeModal.tsx`]** — Rename the key in `CONSENT_NOTICES` from `MARKETING_EMAIL` to `MARKETING_COMMS`. Update the exported `ConsentPurpose` type union to replace `"MARKETING_EMAIL"` with `"MARKETING_COMMS"`.
  - [x] **[`PrivacySettingsSection.tsx`]** — In the `CONSENT_META` (or equivalent config object), rename the `MARKETING_EMAIL` key to `MARKETING_COMMS`. Update the `ConsentCard` ordering array to use `"MARKETING_COMMS"`. Update the local `ConsentPurpose` type union.
  - [x] **[`CheckoutPage.tsx`]** — In the `hasMarketingConsent` selector (`c.purpose === "MARKETING_EMAIL"`), change to `"MARKETING_COMMS"`. In the `POST /api/v1/consent` call for marketing opt-in, change `purpose: "MARKETING_EMAIL"` to `purpose: "MARKETING_COMMS"`.
  - [x] **[`BookingTimeslotPage.tsx`]** — Same two changes as `CheckoutPage.tsx`.
  - [x] **[`SavedAddressesPage.tsx`]** — Verify no `MARKETING_EMAIL` string appears; if it does, rename to `MARKETING_COMMS`.
  - [x] Run `pnpm --filter @gorola/web test -- --run` — **confirm GREEN (all previously RED tests now pass).**
  - [x] Run `pnpm lint` — **confirm 0 warnings.**

- [x] **Verification chain:**
  - [x] Admin queries `SELECT * FROM "ConsentPurposeConfig"` → sees 4 rows with keys `OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_COMMS`, `ANALYTICS` → `SELECT COUNT(*) FROM "ConsentLog" WHERE purpose = 'MARKETING_EMAIL'` returns 0 → User opens `/account/privacy` → Privacy Settings panel renders the "Promotions & Seasonal Offers" card with `data-testid="consent-card-MARKETING_COMMS"` → User clicks "View Complete Notice" → modal opens correctly → User opens `/checkout` and opts into marketing → `POST /api/v1/consent` is called with `purpose: "MARKETING_COMMS"` → DB row created with `purpose = 'MARKETING_COMMS'` → ✅ Done.

---

### 8.3.4.2 — Correct All Consent Notice Text (GPS Retention, Conditional Name Disclosure, Marketing Channel)

**Root cause / Goal:**
Three factual inaccuracies in the consent notices create legal exposure under DPDP Act 2023 Section 5(2), which requires notices to be "clear, plain, and accurate":

1. **GPS retention lie:** The `ORDER_PROCESSING` full notice (in `ConsentNoticeModal.tsx`) states *"Live GPS streams deleted immediately upon successful delivery verification."* This is false. `Address.lat/lng` are stored until the address is deleted. `Order.deliveryLat/deliveryLng` are stored for the 7-year GST retention period (nulled only on account erasure, not on delivery).

2. **Undisclosed name processing:** The user's `name` field is passed to store partners and riders on every order (visible in store order management UI). The `ORDER_PROCESSING` and `MARKETING_COMMS` notices do not disclose this. However, `name` is optional — if never set, the value stored is `"Registered User"` (a non-identifying placeholder). The disclosure must therefore be conditional, following the existing Razorpay pattern: *"Display name (if you have set one)"*.

3. **Wrong channel in `MARKETING_COMMS` purpose/retention text:** After the rename in 8.3.4.1, the modal body text for `MARKETING_COMMS` still says "contact details" without specifying the channel. It must be updated to say "phone number and app notifications" (not "email").

**Fix / Approach:**
Update only `CONSENT_NOTICES` in `ConsentNoticeModal.tsx` (the full notice modal content) and the inline `noticeText` string literals in `SavedAddressesPage.tsx`, `CheckoutPage.tsx`, `BookingTimeslotPage.tsx`, and `LoginPage.tsx`. No schema changes. No new API calls.

---

- [x] **RED — Unit / Component (`ConsentNoticeModal.test.tsx`):**
  - [x] Test: Render `<ConsentNoticeModal purpose="ORDER_PROCESSING" />`, click `data-testid="view-notice-btn-ORDER_PROCESSING"` → assert modal body contains the text `"Address coordinates stored until address deletion"` (or equivalent agreed wording).
  - [x] Test: Assert modal body does NOT contain the old text `"deleted immediately upon successful delivery"`.
  - [x] Test: Assert modal body contains `"Display name (if you have set one)"`.
  - [x] Test: Render `<ConsentNoticeModal purpose="MARKETING_COMMS" />`, click `data-testid="view-notice-btn-MARKETING_COMMS"` → assert modal body contains `"phone number and app notifications"` and does NOT contain `"email"`.
  - [x] **Run — confirm RED (all assertions fail against current text).**

- [x] **GREEN — Frontend (`ConsentNoticeModal.tsx` only):**
  Update `CONSENT_NOTICES` in `apps/web/src/components/consent/ConsentNoticeModal.tsx` as follows. No other file is touched in the GREEN step for the modal.

  - [x] **`ORDER_PROCESSING.dataCollected`** — Replace the existing array with:
    ```typescript
    dataCollected: [
      "Delivery Address & Landmark Notes",
      "GPS Coordinates (saved address pin & order delivery coordinates)",
      "Display Name (if you have set one) — shared with your assigned store partner and delivery rider for order identification",
      "Transaction & Billing Details (excluding raw credit card data/CVV) — only when online payment is selected"
    ]
    ```
  - [x] **`ORDER_PROCESSING.retention`** — Replace with:
    ```
    "Your saved delivery address (including GPS pin) is stored until you delete it or your account. The GPS coordinates copied to each order record are nulled out when you exercise your Right to Erasure; the financial record of the order (totals, payment method) is retained for 7 years under Indian GST and financial accounting law. Live GPS streams used for routing are never persisted — they are processed in-transit by Ola Maps and discarded."
    ```
  - [x] **`MARKETING_COMMS.dataCollected`** — Replace with:
    ```typescript
    dataCollected: [
      "Phone Number — used to send SMS promotional messages",
      "Display Name (if you have set one) — used for personalised greetings",
      "Purchase History & Regional Location (Mussoorie cluster) — used to personalise offers"
    ]
    ```
  - [x] **`MARKETING_COMMS.thirdParties`** — Replace with:
    ```
    "Promotional messages are sent via our authorised SMS gateway partners. No data is shared with external advertising networks or third-party marketers. Your phone number is never sold."
    ```
  - [x] Run `ConsentNoticeModal.test.tsx` — **confirm GREEN.**

- [x] **RED — Unit / Component (`SavedAddressesPage.test.tsx`, `CheckoutPage.test.tsx`, `BookingTimeslotPage.test.tsx`, `LoginPage.test.tsx`):**
  - [x] In `SavedAddressesPage.test.tsx`: add assertion that when address save succeeds, `POST /api/v1/consent` is called with `noticeText` containing the text `"GPS coordinates"`. **Run — confirm RED** (current `noticeText` does not contain "GPS coordinates").
  - [x] In `CheckoutPage.test.tsx`: add assertion that `POST /api/v1/consent` for `ORDER_PROCESSING` is called with `noticeText` containing `"GPS coordinates"`. **Run — confirm RED.**
  - [x] In `BookingTimeslotPage.test.tsx`: same assertion for both the address-save call and the booking-confirm call. **Run — confirm RED.**
  - [x] In `LoginPage.test.tsx`: the existing test asserts `noticeText: expect.any(String)`. Tighten it: assert `noticeText` contains `"One-Time Password"` and contains `"phone number"`. **Run — confirm RED** if the current `CONSENT_NOTICE_TEXT` in `LoginPage.tsx` line 85 does not contain exactly those substrings (it currently says "one-time password (OTP)" so `"One-Time Password"` as case-insensitive match may pass — tighten as needed to produce a RED state that forces an accurate rewrite).

- [x] **GREEN — Frontend (inline `noticeText` strings):**
  - [x] **[`LoginPage.tsx` line 85]** Replace `CONSENT_NOTICE_TEXT` value with:
    ```typescript
    const CONSENT_NOTICE_TEXT =
      "We collect your phone number to send you a One-Time Password (OTP) and authenticate your account. Your phone number is shared with our authorised SMS gateway partner solely for OTP delivery.";
    ```
  - [x] **[`SavedAddressesPage.tsx` lines 85 and 112]** Replace both `noticeText` strings with:
    ```
    "Your delivery address, landmark notes, and GPS coordinates are saved to your account and shared with Ola Maps for routing, and with your assigned store partner and delivery rider for fulfillment. If you have set a display name, it will be visible to your assigned store partner and rider."
    ```
  - [x] **[`CheckoutPage.tsx` line 326]** Replace the `noticeText` string for `ORDER_PROCESSING` with the same text as above.
  - [x] **[`BookingTimeslotPage.tsx` lines 125 and 355]** Replace both `noticeText` strings with the same text as above.
  - [x] Run all updated test files — **confirm GREEN.**
  - [x] Run `pnpm lint && pnpm typecheck` — **confirm 0 errors, 0 warnings.**

- [x] **Verification chain:**
  - [x] User opens `/login` → Consent notice step shows accurate OTP/phone text → User opens `View Complete Notice` for `ORDER_PROCESSING` on `/account/privacy` → Modal body shows the GPS storage truth ("stored until address deletion" / "nulled on erasure, financials kept 7 years") → Modal does NOT say "deleted immediately upon delivery" → User opens `MARKETING_COMMS` modal → body says "phone number and app notifications", not "email" → All frontend and integration tests green → ✅ Done.

---

### 8.3.4.3 — Add `GET /api/v1/admin/users/:id/consents` Endpoint (Paginated)

**Root cause / Goal:**
The existing `GET /api/v1/admin/users/:id` endpoint (handled by `adminService.getUserDetail()`) returns only orders and addresses. Admin operators have no way to see a user's DPDP consent history — which consents they have given, which they have withdrawn, when, and from what IP. This is an operational necessity: when a user challenges a data processing decision, the admin must be able to produce an audit trail. A separate endpoint is required (not bolted onto `getUserDetail`) so the consent log can be paginated independently without loading all historical records on every drawer open.

**Fix / Approach:**
Add a new method `getUserConsentLogs(userId, page, limit)` to `AdminService`. Add a new route `GET /api/v1/admin/users/:id/consents` in `admin.controller.ts` with query params `page` (default 1) and `limit` (default 20, max 50). The response includes a `summary` object (one entry per `ConsentPurposeConfig.key` showing current active status) and a `logs` array (paginated `ConsentLog` rows, newest first) plus `total` and `totalPages` pagination metadata.

---

- [x] **RED — Integration (`admin.users.test.ts`):**
  - [x] Test setup: Create a test user. Create two `ConsentLog` rows for that user: one `OTP_AUTH` (active), one `MARKETING_COMMS` (withdrawn). Create one `ConsentPurposeConfig` row for each purpose used.
  - [x] Test: `GET /api/v1/admin/users/:id/consents` with admin JWT and no query params → HTTP 200 with response shape:
    ```json
    {
      "success": true,
      "data": {
        "summary": [
          { "purpose": "OTP_AUTH", "isActive": true, "givenAt": "<ISO string>", "version": "1.0" },
          { "purpose": "MARKETING_COMMS", "isActive": false, "withdrawnAt": "<ISO string>", "version": "1.0" }
        ],
        "logs": [
          { "id": "...", "purpose": "...", "isWithdrawn": true|false, "consentVersion": "1.0", "noticeText": "...", "ipAddress": "...", "userAgent": "...", "createdAt": "...", "withdrawnAt": "..." }
        ],
        "total": 2,
        "page": 1,
        "totalPages": 1,
        "limit": 20
      }
    }
    ```
  - [x] Test: `GET /api/v1/admin/users/:id/consents?page=1&limit=1` → `data.logs` has exactly 1 item; `data.total` is 2; `data.totalPages` is 2.
  - [x] Test: `GET /api/v1/admin/users/:id/consents?page=2&limit=1` → `data.logs` has exactly 1 item (the second log entry).
  - [x] Test: `GET /api/v1/admin/users/:id/consents` with **buyer JWT** (not admin) → HTTP 403.
  - [x] Test: `GET /api/v1/admin/users/nonexistent-id/consents` with admin JWT → HTTP 404 with `error.code = "NOT_FOUND"`.
  - [x] **Run — confirm RED (route does not exist, all tests return 404).**

- [x] **GREEN — Backend (Service → Controller):**
  - [x] **[Service — `admin.service.ts`]** Add method `getUserConsentLogs(userId: string, page: number, limit: number)`:
    ```typescript
    public async getUserConsentLogs(userId: string, page: number, limit: number) {
      // 1. Verify user exists
      const user = await this.db.user.findFirst({ where: { id: userId, isDeleted: false } });
      if (!user) throw new NotFoundError("User not found");

      const skip = (page - 1) * limit;
      const total = await this.db.consentLog.count({ where: { userId } });

      // 2. Paginated log, newest first
      const logs = await this.db.consentLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });

      // 3. Summary: latest record per purpose (whether active or not)
      const allPurposes = await this.db.consentPurposeConfig.findMany();
      const summary = await Promise.all(
        allPurposes.map(async (p) => {
          const latest = await this.db.consentLog.findFirst({
            where: { userId, purpose: p.key },
            orderBy: { createdAt: "desc" }
          });
          return {
            purpose: p.key,
            displayName: p.displayName,
            isEssential: p.isEssential,
            isActive: latest ? !latest.isWithdrawn : false,
            givenAt: latest?.createdAt.toISOString() ?? null,
            withdrawnAt: latest?.withdrawnAt?.toISOString() ?? null,
            version: latest?.consentVersion ?? null
          };
        })
      );

      return {
        summary,
        logs: logs.map((l) => ({
          id: l.id,
          purpose: l.purpose,
          isWithdrawn: l.isWithdrawn,
          consentVersion: l.consentVersion,
          noticeText: l.noticeText,
          ipAddress: l.ipAddress ?? null,
          userAgent: l.userAgent ?? null,
          createdAt: l.createdAt.toISOString(),
          withdrawnAt: l.withdrawnAt?.toISOString() ?? null
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }
    ```
  - [x] **[Controller — `admin.controller.ts`]** Add the new route after the existing `GET /api/v1/admin/users/:id` handler (around line 237):
    ```typescript
    const consentLogsQuerySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20)
    });

    app.get("/api/v1/admin/users/:id/consents", { preHandler }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = consentLogsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError("Invalid query parameters", parsed.error.flatten());
      }
      const result = await adminService.getUserConsentLogs(id, parsed.data.page, parsed.data.limit);
      return {
        success: true,
        data: result,
        meta: { requestId: getRequestId(request, reply) }
      };
    });
    ```
    **Important:** This route must be registered AFTER `GET /api/v1/admin/users/:id` to avoid Fastify's route matching treating `/consents` as the `:id` param. Verify route ordering carefully.
  - [x] Run `pnpm --filter @gorola/api test -- src/__tests__/integration/admin/admin.users.test.ts` — **confirm GREEN.**
  - [x] Run full integration test suite `pnpm --filter @gorola/api test -- --run` — **confirm no regressions.**

- [x] **Verification chain:**
  - [x] Admin authenticates → sends `GET /api/v1/admin/users/cuid123/consents?page=1&limit=20` → receives `data.summary` with one entry per consent purpose showing current active/inactive state → receives `data.logs` array with all historical `ConsentLog` rows paginated → sends `GET /api/v1/admin/users/cuid123/consents?page=2&limit=5` → receives the second page of results → ✅ Done.

---

### 8.3.4.4 — Add "Consent & Privacy" Section to Admin User Detail Drawer

**Root cause / Goal:**
`AdminUsersPage.tsx` user-detail drawer currently shows: profile info, registered addresses, order history. There is no visibility into a user's DPDP consent status. This means an admin cannot respond to a regulatory query ("did this user consent to X?") or an internal audit ("when did this user withdraw marketing consent?") without directly querying the database. The drawer must surface: (1) a 4-row consent summary table showing current active/inactive status per purpose, and (2) a collapsible paginated full log of all consent events for that user.

**Fix / Approach:**
Add a new "Consent & Privacy" section at the bottom of the user detail drawer in `AdminUsersPage.tsx`. Use a separate React Query query (enabled only when `selectedUserId` is non-null) to lazily fetch `GET /api/v1/admin/users/:id/consents`. The summary renders immediately; the full log is behind a "Show full log" expand toggle, and uses the `page` query param with simple Previous/Next pagination controls.

---

- [x] **RED — Unit / Component (`AdminUsersPage.test.tsx`):**
  - [x] Test setup: Mock `GET /api/v1/admin/users/user-1` to return a valid `UserDetail`. Mock `GET /api/v1/admin/users/user-1/consents` to return:
    ```json
    {
      "summary": [
        { "purpose": "OTP_AUTH", "displayName": "Authentication & Account Security", "isEssential": true, "isActive": true, "givenAt": "2026-01-01T00:00:00.000Z", "withdrawnAt": null, "version": "1.0" },
        { "purpose": "MARKETING_COMMS", "displayName": "Promotions & Seasonal Offers", "isEssential": false, "isActive": false, "givenAt": "2026-01-02T00:00:00.000Z", "withdrawnAt": "2026-01-03T00:00:00.000Z", "version": "1.0" }
      ],
      "logs": [
        { "id": "log-1", "purpose": "MARKETING_COMMS", "isWithdrawn": true, "consentVersion": "1.0", "noticeText": "test", "ipAddress": "1.2.3.4", "userAgent": "Mozilla/5.0", "createdAt": "2026-01-02T00:00:00.000Z", "withdrawnAt": "2026-01-03T00:00:00.000Z" }
      ],
      "total": 2,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
    ```
  - [x] Test: Click `data-testid="view-details-user-1"` → drawer opens → assert `data-testid="consent-summary-section"` is present in the DOM.
  - [x] Test: In the summary section, assert `data-testid="consent-row-OTP_AUTH"` renders with text "Active" and a green badge.
  - [x] Test: Assert `data-testid="consent-row-MARKETING_COMMS"` renders with text "Withdrawn" and a grey/red badge.
  - [x] Test: Assert `data-testid="consent-log-toggle"` button is present.
  - [x] Test: Click `data-testid="consent-log-toggle"` → assert `data-testid="consent-log-table"` becomes visible.
  - [x] Test: `consent-log-table` contains one row showing purpose `"MARKETING_COMMS"`, status "Withdrawn", IP "1.2.3.4".
  - [x] **Run — confirm RED (the consent summary section does not exist in the current drawer).**

- [x] **GREEN — Frontend (Types → Component):**
  - [x] **[Types — `AdminUsersPage.tsx`]** Add the following type definitions at the top of the file:
    ```typescript
    type ConsentSummaryItem = {
      purpose: string;
      displayName: string;
      isEssential: boolean;
      isActive: boolean;
      givenAt: string | null;
      withdrawnAt: string | null;
      version: string | null;
    };

    type ConsentLogItem = {
      id: string;
      purpose: string;
      isWithdrawn: boolean;
      consentVersion: string;
      noticeText: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
      withdrawnAt: string | null;
    };

    type UserConsentResponse = {
      success: boolean;
      data: {
        summary: ConsentSummaryItem[];
        logs: ConsentLogItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
    ```

  - [x] **[State — `AdminUsersPage.tsx`]** Add two new state variables alongside the existing state:
    ```typescript
    const [consentLogOpen, setConsentLogOpen] = useState(false);
    const [consentPage, setConsentPage] = useState(1);
    ```
    Reset both to initial values inside the `onClick` handler that sets `selectedUserId` (so the log is collapsed by default every time a new user is opened):
    ```typescript
    onClick={() => {
      setSelectedUserId(user.id);
      setConsentLogOpen(false);
      setConsentPage(1);
    }}
    ```

  - [x] **[Query — `AdminUsersPage.tsx`]** Add a new `useQuery` directly below the existing `userDetail` query:
    ```typescript
    const { data: userConsents, isLoading: isConsentLoading } = useQuery<UserConsentResponse["data"]>({
      queryKey: ["admin", "user-consents", selectedUserId, consentPage],
      queryFn: async () => {
        if (!api) throw new Error("API helper not initialized");
        const res = await api.get<UserConsentResponse>(
          `/api/v1/admin/users/${selectedUserId}/consents?page=${consentPage}&limit=20`
        );
        return res.data.data;
      },
      enabled: !!selectedUserId
    });
    ```

  - [x] **[Component — `AdminUsersPage.tsx`]** Inside the drawer, after the closing `</div>` of the "Order History" section and before the closing `</>` of the `userDetail &&` block, add the full "Consent & Privacy" section:
    ```tsx
    {/* Consent & Privacy */}
    <div data-testid="consent-summary-section" className="space-y-3">
      <h3 className="text-xs font-black uppercase tracking-wider text-gorola-slate">
        Consent & Privacy (DPDP Act 2023)
      </h3>

      {isConsentLoading ? (
        <div className="h-20 bg-gorola-charcoal/5 rounded-xl animate-pulse" />
      ) : userConsents ? (
        <>
          {/* Summary Table */}
          <div className="border border-gorola-charcoal/10 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gorola-charcoal/5 bg-gorola-charcoal/[0.01]">
                  <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Purpose</th>
                  <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Status</th>
                  <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gorola-charcoal/5 text-xs">
                {userConsents.summary.map((row) => (
                  <tr key={row.purpose} data-testid={`consent-row-${row.purpose}`}>
                    <td className="px-4 py-3 font-medium text-gorola-charcoal">
                      {row.displayName}
                      {row.isEssential && (
                        <span className="ml-2 text-[9px] font-black uppercase text-gorola-pine bg-gorola-mint/10 px-1.5 py-0.5 rounded-full">
                          Essential
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        row.isActive
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200/50"
                          : "bg-gray-100 text-gray-600 border-gray-200/50"
                      }`}>
                        {row.isActive ? "Active" : row.givenAt ? "Withdrawn" : "Never Given"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gorola-slate">
                      {row.isActive && row.givenAt
                        ? new Date(row.givenAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
                        : row.withdrawnAt
                        ? `Withdrawn ${new Date(row.withdrawnAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Full Log Toggle */}
          <button
            data-testid="consent-log-toggle"
            onClick={() => setConsentLogOpen((o) => !o)}
            className="text-xs font-bold text-gorola-pine hover:underline flex items-center gap-1"
          >
            {consentLogOpen ? "Hide full log" : `Show full log (${userConsents.total} events)`}
          </button>

          {/* Full Log Table — only rendered when open */}
          {consentLogOpen && (
            <div data-testid="consent-log-table" className="border border-gorola-charcoal/10 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gorola-charcoal/5 bg-gorola-charcoal/[0.01]">
                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Purpose</th>
                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Event</th>
                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">Date</th>
                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gorola-slate">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gorola-charcoal/5 text-xs">
                  {userConsents.logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 font-mono font-bold text-gorola-charcoal">{log.purpose}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-[10px] uppercase ${log.isWithdrawn ? "text-rose-600" : "text-emerald-600"}`}>
                          {log.isWithdrawn ? "Withdrawn" : "Given"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gorola-slate">
                        {new Date(log.isWithdrawn && log.withdrawnAt ? log.withdrawnAt : log.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 font-mono text-gorola-slate">{log.ipAddress ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {userConsents.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gorola-charcoal/5 text-xs">
                  <span className="text-gorola-slate">
                    Page {userConsents.page} of {userConsents.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      data-testid="consent-log-prev"
                      onClick={() => setConsentPage((p) => Math.max(1, p - 1))}
                      disabled={consentPage <= 1}
                      className="px-3 py-1.5 border border-gorola-charcoal/10 rounded-lg font-bold text-gorola-slate disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      data-testid="consent-log-next"
                      onClick={() => setConsentPage((p) => Math.min(userConsents.totalPages, p + 1))}
                      disabled={consentPage >= userConsents.totalPages}
                      className="px-3 py-1.5 border border-gorola-charcoal/10 rounded-lg font-bold text-gorola-slate disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
    ```

  - [x] Run `pnpm --filter @gorola/web test -- --run AdminUsersPage` — **confirm GREEN (all tests including the new consent-section tests pass).**
  - [x] Run full web test suite `pnpm --filter @gorola/web test -- --run` — **confirm no regressions.**

- [x] **Verification chain:**
  - [x] Admin logs into admin panel → navigates to Platform Users → clicks "View Details" on any user → drawer slides open → "Consent & Privacy (DPDP Act 2023)" section appears at the bottom showing a 4-row table with `OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_COMMS`, `ANALYTICS` and their current Active/Withdrawn/Never Given status → Admin clicks "Show full log (N events)" → log table expands showing every `ConsentLog` row for that user with purpose, event type, date, and masked IP → If more than 20 rows exist, Previous/Next pagination buttons appear and work correctly → ✅ Done.

---

### 8.3.4 — Final Quality Gate (Run after all four sub-tasks are complete)

- [x] Run full API test suite: `pnpm --filter @gorola/api test -- --run` → **0 failures.**
- [x] Run full web test suite: `pnpm --filter @gorola/web test -- --run` → **0 failures.**
- [x] Run `pnpm typecheck` → **0 errors.**
- [x] Run `pnpm lint` → **0 errors, 0 warnings.**
- [x] Confirm no string `"MARKETING_EMAIL"` exists anywhere in the codebase: search across all `.ts` and `.tsx` files → 0 results.
- [x] Confirm no import `ConsentPurpose from "@prisma/client"` exists anywhere in the codebase → 0 results.
- [x] Confirm `SELECT COUNT(*) FROM "ConsentLog" WHERE purpose = 'MARKETING_EMAIL'` against both `gorola_dev` and `gorola_test` databases returns 0.
- [x] Confirm `SELECT COUNT(*) FROM "ConsentPurposeConfig"` returns exactly 4 on both databases.

---

### 8.3.5 — DPDP UI Alignment, Audit Log Search & Nominee PII Protection

> **Type: Backend (repository filters + DTO serialization) + Frontend (consent cards, transparency lines, audit log search & user detail Nominee card). Full TDD.**
> **Prerequisite: Phase 8.3.4 complete.**
> **This section has three sequential sub-tasks. Complete them strictly in order.**

---

#### Sub-task Overview

| Sub-task | Name | Type | Dependency |
|----------|------|------|-----------|
| **8.3.5.1** | Canonical Consent Cards Content Alignment & Purpose-Specific Transparency Lines | Frontend + Backend | Phase 8.3.4 complete |
| **8.3.5.2** | Admin Audit Log Substring Search & Case-Insensitive Filtering | Backend + Frontend | None — can run in parallel |
| **8.3.5.3** | Admin User Detail Nominee Field Integration & Strict PII Minimization | Backend + Frontend | None — can run in parallel |

---

### 8.3.5.1 — Canonical Consent Cards Content Alignment & Purpose-Specific Transparency Lines

**Root cause / Goal:**
In Phase 8.3.4.2, we corrected the full statutory notices inside `ConsentNoticeModal.tsx`. However, the concise consent cards across buyer interfaces (`PURPOSE_META` in `PrivacySettingsSection.tsx`, `SavedAddressesPage.tsx`, `CheckoutPage.tsx`, `BookingTimeslotPage.tsx`, `LoginPage.tsx`, `AnalyticsConsentBanner.tsx`) still suffer from gaps in disclosed stored data:
1. `ORDER_PROCESSING`: Omitted **Display Name (if set)** shared with store partners and delivery riders, Ola Maps spatial routing, Razorpay online payments, and 7-year GST retention terms.
2. `OTP_AUTH`: Omitted the DLT-registered SMS gateway partner (**Exotel**) and 30-day permanent erasure guarantee upon account deletion.
3. `MARKETING_COMMS`: Omitted explicit communication channels (**SMS and app notifications**), personal data utilized (phone number, Display Name if set, purchase categories), and the 48-hour opt-out scrubbing policy.
4. `ANALYTICS`: Omitted the 180-day telemetry auto-purge / anonymization schedule.
5. Furthermore, consent cards lacked distinct, purpose-specific 1-line transparency prompts placed directly above action buttons/checkboxes that clearly distinguish the quick, purpose-specific Statutory Notice from the overarching, platform-wide Privacy Policy (`/privacy`).
6. When a user grants consent in `PrivacySettingsSection.tsx`, `handleGrant` sends a brief `meta.description` instead of the canonical statutory text.

**Fix / Approach:**
1. Update `PURPOSE_META` in `PrivacySettingsSection.tsx` and all inline consent cards (`SavedAddressesPage.tsx`, `CheckoutPage.tsx`, `BookingTimeslotPage.tsx`, `LoginPage.tsx`, `AnalyticsConsentBanner.tsx`) to contain complete, accurate data disclosures while preserving concise readability.
2. Add purpose-specific 1-line transparency prompts directly before checkboxes and action buttons:
   - **ORDER_PROCESSING:** *"For details on location sharing and order data retention, read the [Order Fulfillment Notice] (or view our platform-wide [Privacy Policy])."*
   - **OTP_AUTH:** *"For details on OTP verification and account security, read the [Authentication Notice] (or view our platform-wide [Privacy Policy])."*
   - **MARKETING_COMMS:** *"For details on promotional messages and 1-click opt-out, read the [Promotions Notice] (or view our platform-wide [Privacy Policy])."*
   - **ANALYTICS:** *"For details on performance logs and zero-PII data handling, read the [Analytics Notice] (or view our platform-wide [Privacy Policy])."*
3. Update `handleGrant` in `PrivacySettingsSection.tsx` to log the canonical notice text from `CONSENT_NOTICES[purpose].purpose` or full statutory summary to `POST /api/v1/consent`.

---

- [x] **RED — Unit / Component Tests:**
  - [x] `PrivacySettingsSection.test.tsx`:
    - [x] Test: Renders `ORDER_PROCESSING` card containing `"Ola Maps"`, `"Display Name"`, `"Razorpay"`, and detailed transparency prompt before action button.
    - [x] Test: Renders `OTP_AUTH` card containing `"Exotel"` and authentication transparency prompt.
    - [x] Test: Renders `MARKETING_COMMS` card containing `"Exotel"` and promotions transparency prompt.
    - [x] Test: Renders `ANALYTICS` card and analytics transparency prompt.
    - [x] Test: Renders distinct purpose transparency lines linking to statutory notice trigger and `/privacy` for each card.
  - [x] `SavedAddressesPage.test.tsx`:
    - [x] Test: Renders DPDP fulfillment notice containing `"Ola Maps"`, `"Display Name"`, `"Razorpay"`, followed by the transparency line *"For full details on statutory 7-year GST retention, live GPS handling, and data rights..."* with links before the acknowledgement checkbox.
  - [x] `CheckoutPage.test.tsx` & `BookingTimeslotPage.test.tsx`:
    - [x] Test: Renders marketing opt-in card with Exotel disclosure and the purpose transparency line before checkbox.
  - [x] `LoginPage.test.tsx`:
    - [x] Test: Renders OTP consent notice with Exotel disclosure and authentication transparency line before checkbox.
  - [x] `AnalyticsConsentBanner.test.tsx`:
    - [x] Test: Renders analytics consent card with telemetry purge disclosure and transparency line before Accept/Decline buttons.
  - [x] `PrivacyPolicyPage.test.tsx`:
    - [x] Test: Renders public DPDP policy page with bolded third-party services and statutory rights.
  - [x] **Run — confirm GREEN.**

- [x] **GREEN — Frontend Component Updates:**
  - [x] In `apps/web/src/components/account/PrivacySettingsSection.tsx`:
    - Update `PURPOSE_META` descriptions with concise stored data and recipient details.
    - Add purpose-specific transparency lines and ensure `handleGrant` logs canonical notice text.
    - Move action button into header row so notice text spans 100% width.
  - [x] In `apps/web/src/pages/buyer/SavedAddressesPage.tsx`:
    - Update inline `order-processing-consent-notice` with concise disclosures and transparency line before checkbox.
  - [x] In `apps/web/src/pages/buyer/LoginPage.tsx`:
    - Update OTP consent card with Exotel disclosure and transparency line.
  - [x] In `apps/web/src/pages/buyer/CheckoutPage.tsx` & `BookingTimeslotPage.tsx`:
    - Update Order Processing & Marketing opt-in cards with standardized text and transparency lines.
  - [x] In `apps/web/src/components/consent/AnalyticsConsentBanner.tsx`:
    - Update telemetry disclosures and transparency prompt.
  - [x] In `apps/web/src/pages/buyer/PrivacyPolicyPage.tsx`:
    - Create public `/privacy` policy page with full DPDP Act 2023 disclosures and DPO details.
  - [x] Run `pnpm --filter @gorola/web test -- --run` — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Buyer visits `/account/privacy` → sees all 4 cards with concise stored data & recipient disclosures (Display Name, Ola Maps, Exotel, Razorpay in bold) → each card has distinct transparency line linking to statutory modal and `/privacy` → Buyer adds address on `/account/addresses` → sees full fulfillment notice and transparency line before checking box → Buyer checks out on `/checkout` → sees marketing opt-in with channel & opt-out details → Visiting `/privacy` opens public policy page → ✅ Done.

---

### 8.3.5.2 — Admin Audit Log Substring Search & Case-Insensitive Filtering

**Root cause / Goal:**
In `apps/api/src/modules/audit/audit.repository.ts`, `findMany` builds the Prisma where filter using strict equality:
`...(action ? { action } : {})` and `...(entityType ? { entityType } : {})`.
This creates two critical defects:
1. Searching for `"SUSPEND"` fails to match `"ADMIN_USER_SUSPEND"` because Prisma expects an exact string match.
2. In `AdminAuditLogsPage.tsx`, typing even a single character triggers the 350ms debounce and requests `?action=s` or `?entityType=s`. Because the backend performs an exact match for `"s"`, the log table immediately empties out.

**Fix / Approach:**
1. In `apps/api/src/modules/audit/audit.repository.ts`, update `action` and `entityType` query filters to use Prisma's `{ contains: term, mode: "insensitive" }`.
2. In `apps/web/src/pages/admin/AdminAuditLogsPage.tsx`, ensure input filters are trimmed and queries seamlessly match partial actions (e.g. `"SUSPEND"`, `"USER"`, `"STORE"`).

---

- [x] **RED — Integration (`admin.audit-logs.test.ts`):**
  - [x] Test: `GET /api/v1/admin/audit-logs?action=SUSPEND` returns audit logs with `action: "ADMIN_USER_SUSPEND"`.
  - [x] Test: `GET /api/v1/admin/audit-logs?action=suspend` (lowercase) returns audit logs with `action: "ADMIN_USER_SUSPEND"` (case-insensitive).
  - [x] Test: `GET /api/v1/admin/audit-logs?entityType=store` returns audit logs with `entityType: "STORE"` or `"Store"`.
  - [x] **Run — confirm GREEN.**

- [x] **GREEN — Backend (Repository → Service → Controller):**
  - [x] [Repository] In `apps/api/src/modules/audit/audit.repository.ts`, update `findMany`:
    ```typescript
    const where: Prisma.AuditLogWhereInput = {
      ...(actorRole ? { actorRole } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(entityType ? { entityType: { contains: entityType, mode: "insensitive" } } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {})
        }
      } : {})
    };
    ```
  - [x] Run integration test `pnpm --filter @gorola/api test -- src/__tests__/integration/admin/admin.audit-logs.test.ts` — **confirm GREEN.**

- [x] **RED — Unit / Component (`AdminAuditLogsPage.test.tsx`):**
  - [x] Test: Admin types `"SUSPEND"` into Action Type filter → API query param `action=SUSPEND` is triggered → matching records render in table.
  - [x] Test: Admin types `"store"` into Entity Type filter → API query param `entityType=store` is triggered → matching records render in table.
  - [x] **Run — confirm GREEN.**

- [x] **GREEN — Frontend Component:**
  - [x] In `apps/web/src/pages/admin/AdminAuditLogsPage.tsx`, verify debounce and URL syncing.
  - [x] Run `pnpm --filter @gorola/web test -- src/pages/admin/AdminAuditLogsPage.test.tsx` — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Admin navigates to `/admin/audit-logs` → types `"SUSPEND"` into Action Type input → table immediately filters and displays all `ADMIN_USER_SUSPEND` events → Admin types `"store"` into Entity Type input → table displays all Store entity actions → Log export CSV includes filtered results → ✅ Done.

---

### 8.3.5.3 — Admin User Detail Nominee Field Integration & Strict PII Minimization

**Root cause / Goal:**
1. In `AdminUserDetailPage.tsx`, the Nominee Info card checks `user.nomineeName` and `user.nomineeRelationship`. However, `adminService.getUserDetail(userId)` in `apps/api/src/modules/admin/admin.service.ts` does not select or return `nomineeName` in the DTO. As a result, `user.nomineeName` is always `undefined`, and the card perpetually displays `"Not Configured"`.
2. **Strict PII Protection Constraint (DPDP Act Sec 14):** Nominee data belongs to a third party (the user's emergency representative). To enforce strict data minimization, the admin panel must **ONLY contain the nominee's name if set** (`nomineeName`), and **NOTHING ELSE** — strictly omitting `nomineeContact` and `nomineeRelationship` to prevent internal exposure of third-party personal contact details.

**Fix / Approach:**
1. In `apps/api/src/modules/admin/admin.service.ts` (`getUserDetail`), include `nomineeName: user.nomineeName ?? null` in the returned DTO. Strictly do NOT include `nomineeContact` or `nomineeRelationship`.
2. In `apps/web/src/pages/admin/AdminUserDetailPage.tsx`:
   - Update `UserDetail` TypeScript type to include `nomineeName?: string | null` only (remove `nomineeContact` and `nomineeRelationship`).
   - Update the Nominee Info card to display `Nominee Name: {user.nomineeName}` if present, or `"Not Configured"` if null/unset.

---

- [x] **RED — Integration (`admin.users.test.ts`):**
  - [x] Test: `GET /api/v1/admin/users/:id` for user with configured nominee returns `{ nomineeName: "Aarav Sharma" }`.
  - [x] Test: `GET /api/v1/admin/users/:id` explicitly does NOT include `nomineeContact` or `nomineeRelationship` in the JSON response payload.
  - [x] Test: `GET /api/v1/admin/users/:id` for user without nominee returns `{ nomineeName: null }`.
  - [x] **Run — confirm GREEN.**

- [x] **GREEN — Backend (Service → Controller):**
  - [x] [Service] In `apps/api/src/modules/admin/admin.service.ts` (`getUserDetail`):
    ```typescript
    return {
      id: user.id,
      name: user.name,
      maskedPhone: maskPhone(user.phone),
      isActive: user.isActive,
      nomineeName: user.nomineeName ?? null,
      createdAt: user.createdAt.toISOString(),
      orders: user.orders.map(...),
      addresses: user.addresses.map(...)
    };
    ```
  - [x] Run integration test `pnpm --filter @gorola/api test -- src/__tests__/integration/admin/admin.users.test.ts` — **confirm GREEN.**

- [x] **RED — Unit / Component (`AdminUserDetailPage.test.tsx`):**
  - [x] Test: When `nomineeName` is `"Aarav Sharma"`, Nominee Info card displays `"Aarav Sharma"` with zero contact or relationship information rendered.
  - [x] Test: When `nomineeName` is `null`, Nominee Info card displays `"Not Configured"`.
  - [x] **Run — confirm GREEN.**

- [x] **GREEN — Frontend (Types → Component):**
  - [x] [Types] In `apps/web/src/pages/admin/AdminUserDetailPage.tsx`, update `UserDetail` type:
    ```typescript
    type UserDetail = {
      id: string;
      name: string | null;
      maskedPhone: string;
      isActive: boolean;
      nomineeName?: string | null;
      createdAt: string;
      addresses: Array<{ id: string; flatRoom: string | null; landmarkDescription: string }>;
      orders: Array<{ id: string; storeName: string; total: number; status: string; createdAt: string }>;
    };
    ```
  - [x] [Component] In `AdminUserDetailPage.tsx`:
    ```tsx
    <div className="bg-gorola-mint/5 border border-gorola-mint/15 rounded-2xl p-4 flex items-center gap-3">
      <ShieldCheck className="h-5 w-5 text-gorola-slate" />
      <div>
        <p className="text-[10px] uppercase font-black text-gorola-slate/70">Nominee Info</p>
        <p className="text-sm font-black text-gorola-charcoal">
          {user.nomineeName ? user.nomineeName : "Not Configured"}
        </p>
      </div>
    </div>
    ```
  - [x] Run component test `pnpm --filter @gorola/web test -- src/pages/admin/AdminUserDetailPage.test.tsx` — **confirm GREEN.**

- [x] **Verification chain:**
  - [x] Admin opens `/admin/users/:id` for a user who set a nominee → Nominee Info card displays `"Aarav Sharma"` (name only, zero PII contact leakage) → Admin opens user without nominee → card displays `"Not Configured"` → ✅ Done.

---

### 8.3.5 — Final Quality Gate (Run after all three sub-tasks are complete)

- [x] Run full API test suite: `pnpm --filter @gorola/api test -- --run` → **0 failures (119 test files, 737 passed).**
- [x] Run full web test suite: `pnpm --filter @gorola/web test -- --run` → **0 failures (95 test files, 541 passed).**
- [x] Run `pnpm typecheck` → **0 errors.**
- [x] Run `pnpm lint` → **0 errors, 0 warnings.**
- [ ] Run E2E test suite: `pnpm test:e2e` → **0 failures.**

---

#### 📝 Session Note: Phase 8.3.5 Execution & Completion (2026-10-02)

- **DPDP UI Alignment & Concise Consent Cards (8.3.5.1):**
  - Streamlined consent card body across `PrivacySettingsSection.tsx`, `LoginPage.tsx`, `CheckoutPage.tsx`, `BookingTimeslotPage.tsx`, `SavedAddressesPage.tsx`, and `AnalyticsConsentBanner.tsx` to state strictly what data is stored, whom it is shared with, and the reason.
  - Bolds third-party service partners (**Exotel**, **Ola Maps**, **Razorpay**) across all notice cards and statutory notice modals.
  - Added purpose-specific transparency lines below each card detailing statutory retention (e.g. 7-year GST records, 180-day telemetry auto-purges, 48-hour opt-out scrubbing, erasure mechanisms) and clearly differentiating the statutory notice modal from the platform-wide Privacy Policy.
  - Resolved typographic vertical baseline misalignment for inline notice modal trigger buttons and icons (`FileText`).
  - Restructured `PrivacySettingsSection.tsx` consent cards so Opt In / Withdraw buttons reside in the card header, allowing notice text to span full card width.
  - Created a dedicated public `/privacy` policy page (`PrivacyPolicyPage.tsx`) registered in buyer routes with DPO contact and DPBI escalation details.
- **Admin Audit Log Substring Search, Pagination & UI Stability (8.3.5.2):**
  - Updated `audit.repository.ts` Prisma query filters to use `{ contains: term, mode: "insensitive" }` for `action` and `entityType`, resolving exact-match limitations and 1-character search blanking.
  - Configured `keepPreviousData` in TanStack Query and persistent filter input mounting in `AdminAuditLogsPage.tsx`, preventing full-page teardowns, filter unmounting, and caret/focus loss during live typing.
  - Added a dedicated pagination toolbar to `AdminAuditLogsPage.tsx` with dynamic rows per page selector (`10`, `20`, `50`, `100`), entry count indicator, and `Previous`/`Next` page navigation buttons.
  - Enhanced `audit.repository.ts` date filtering to normalize `to` date strings to `23:59:59.999Z`, making the selected "To Date" 100% inclusive of all events recorded throughout that entire day.
- **Admin Nominee PII Protection & Data Minimization (8.3.5.3):**
  - Updated `admin.service.ts` (`getUserDetail`) to serialize ONLY `nomineeName: user.nomineeName ?? null`, strictly omitting `nomineeContact` and `nomineeRelationship` to prevent third-party PII leakage under DPDP Act Sec 14.
  - Updated `AdminUserDetailPage.tsx` Nominee Info card to display nominee name or `"Not Configured"`.
- **Quality Gates Verification:**
  - Full API test suite: 119 files / 737 tests passed (0 failures).
  - Full Web test suite: 95 files / 541 tests passed (0 failures).
  - Typecheck: 0 errors across 4 workspace packages.
  - Lint: 0 errors, 0 warnings across all apps/packages.

---

---

### 8.4 — Session Transparency & Security Alerting (Current Setup)

#### 8.4.1 — Active Sessions & Remote Revoke

- [x] **RED — Integration (`auth.sessions.test.ts`):**
  - [x] Test: `GET /api/v1/auth/sessions` + buyer JWT → HTTP 200 with `{ sessions: [{ sessionId, createdAt, ipAddress, isCurrent }] }`.
  - [x] Test: `DELETE /api/v1/auth/sessions` (terminate all) → HTTP 200; invalidates all refresh tokens for user in Redis.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend & Frontend:**
  - [x] In `auth.service.ts`, store session metadata in Redis `user_sessions:{userId}` set on login.
  - [x] Add `getActiveSessions` and `terminateAllSessions` in `auth.service.ts`. Add `GET` and `DELETE` routes in `auth.controller.ts`.
  - [x] Add "Active Sessions" card on `/account` page with "Sign out all devices" button.
  - [x] Run integration & unit tests — **confirm GREEN.**

---

#### 8.4.2 — Security Log Anomaly Alerting

- [x] **GREEN — Backend:** Add Pino error transport logger in `apps/api/src/lib/logger.ts` to log structured `SECURITY_ALERT` JSON events when rate-limits or failed auth attempts trigger bursts.

---

### 8.5 — Automated Data Retention & Purge Jobs (Current Setup)

#### 8.5.1 — BullMQ Automated Cron Purge Workers

- [x] **RED — Integration (`data-retention.test.ts`):**
  - [x] Test: Seed `OTPLog` row with `createdAt = 91 days ago`. Run `OtpLogPurgeJob`. Assert row deleted.
  - [x] Test: Seed `OTPLog` row with `createdAt = 89 days ago`. Run `OtpLogPurgeJob`. Assert row retained.
  - [x] Test: Seed `AuditLog` row with `createdAt = 366 days ago`. Run `AuditLogArchiveJob`. Assert row archived/deleted.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend Workers:**
  - [x] Create `apps/api/src/workers/otp-log-purge.worker.ts` (purges `OTPLog` > 90d).
  - [x] Create `apps/api/src/workers/audit-log-archive.worker.ts` (archives `AuditLog` > 1y).
  - [x] Register workers in app bootstrap as repeatable BullMQ cron jobs (`OtpLogPurgeJob`: daily 3 AM; `AuditLogArchiveJob`: monthly 4 AM; `UserDataPurgeJob`: daily 2 AM).
  - [x] Run integration tests — **confirm GREEN.**

---

#### 8.5.2 — Railway Application Log Retention Settings

- [x] Verified Railway Pro Plan fixed 30-day built-in log retention (satisfies statutory DPDP Sec 12 data minimization requirement).

---

### 8.6 — Privacy Policy & Legal Pages (Current Setup)

#### 8.6.1 — `/privacy` Privacy Policy Page
- [ ] Create `apps/web/src/pages/legal/PrivacyPolicyPage.tsx` routed at `/privacy` containing all 11 DPDP sections:
  1. Who we are (GoRola)
  2. What personal data we collect (phone, name, address, orders, IP)
  3. Why we collect it (purpose per field)
  4. How long we keep it (retention schedules)
  5. Who we share it with (Exotel, Railway, Vercel, Razorpay, Ola Maps)
  6. User rights (Info, Correction, Erasure, Withdrawal, Nomination)
  7. Children's data (18+ eligibility)
  8. Data breach notification (72 hours)
  9. Grievance Officer details (`privacy@gorola.in`)
  10. Policy updates & re-consent
  11. Governing law (DPDP Act 2023)
- [ ] Add `/privacy` route to `App.tsx` and link in site footer.

#### 8.6.2 — `/terms` Terms of Service Page
- [ ] Create `apps/web/src/pages/legal/TermsOfServicePage.tsx` routed at `/terms` with explicit Section: *"Eligibility: GoRola is intended for users aged 18 and above..."*

#### 8.6.3 — Privacy Policy Versioning & Re-Consent Banner
- [ ] [Schema & Migration] Add `privacyPolicyVersionAccepted String @default("1.0")` to `User` model in `schema.prisma`. Generate physical SQL migration file: `pnpm --filter @gorola/api exec prisma migrate dev --name add_privacy_policy_version_to_user` using `DIRECT_URL` / `db_owner` DDL role.
- [ ] [DB Deployment] Apply migration SQL file to local databases (`gorola_dev` and `gorola_test`) via `pnpm --filter @gorola/api prisma:bootstrap:test` BEFORE writing implementation code or running tests.
- [ ] [Frontend Banner] In `App.tsx`, check user's `privacyPolicyVersionAccepted` against current `CURRENT_POLICY_VERSION = "1.0"`. Render re-consent banner if mismatched.
- [ ] [Cascade & Regression Testing] Check across modules for cascading broken logic. Run full test suite (`pnpm test` / unit, integration, and E2E) and quality gates (`pnpm typecheck`, `pnpm lint`) — **confirm GREEN.**


---

### 8.7 — Non-Code Prerequisites & Documentation (Current Setup)

> **Operational & Legal Steps — Detailed Step-by-Step Instructions:**

#### 8.7.1 — Designate Grievance Officer & Setup Dedicated Inbox
- **Step 1:** Formally designate founder/co-founder as named Grievance Officer.
- **Step 2:** Create dedicated domain email `privacy@gorola.in` in Google Workspace / Zoho Mail.
- **Step 3:** Ensure emails auto-forward to Grievance Officer.
- **Step 4:** Set monthly calendar reminder for reviewing inbox (30-day statutory response limit).

#### 8.7.2 — How to Obtain & Document Vendor Data Processing Agreements (DPAs)

##### 1. Railway.app (Database & API Host — Paid Plan)
- **Step 1:** Log into Railway at `https://railway.app`.
- **Step 2:** Click Account Avatar → **Workspace Settings** → **Legal / Compliance**.
- **Step 3:** Review Railway Data Processing Addendum at `https://railway.app/legal/dpa`.
- **Step 4:** Click **Accept DPA** (or download signed PDF). Save PDF to `GoRola Legal/DPDP Compliance/DPAs/railway-dpa.pdf`.

##### 2. Vercel (Frontend Static Host — Free/Hobby Plan)
- **Context:** On Vercel Hobby plan, Vercel only serves static HTML/JS/CSS assets. API database requests bypass Vercel directly to Railway.
- **Step 1:** Access Vercel Terms of Service at `https://vercel.com/legal/terms` and Data Processing Addendum at `https://vercel.com/legal/dpa`.
- **Step 2:** Create document `GoRola Legal/DPDP Compliance/DPAs/vercel-tos-dpa.md` noting:
  > *"Vercel Hobby Plan static asset hosting governed by Vercel standard Terms of Service Data Protection Addendum section. Verified on [DATE]. Upgrade to Vercel Pro ($20/mo) planned prior to enterprise scale for self-serve executed DPA download."*

##### 3. Ola Maps Developer Platform (Map Provider)
- **Step 1:** Log into Ola Maps Developer Console at `https://maps.olacabs.com`.
- **Step 2:** Navigate to **Documentation / Legal Terms**.
- **Step 3:** Save Ola Maps Data Privacy Terms to `GoRola Legal/DPDP Compliance/DPAs/ola-maps-terms.pdf`.

#### 8.7.3 — Create Private Team Compliance Folder
- Create private cloud storage directory: `GoRola Legal / DPDP Compliance` with subfolders:
  - `DPAs/`
  - `Consent-Records-Policy/`
  - `Data-Inventory/`
  - `Breach-Response-Plan/`
  - `Grievance-Log/`

#### 8.7.4 — Data Inventory Document (`data-inventory-v1.md`)
- Create `data-inventory-v1.md` in `Data-Inventory/` mapping every field:

| Data Field | Purpose | Retention | Storage Location | Shared With | Legal Basis |
|---|---|---|---|---|---|
| Phone number | Authentication & Contact | Account lifetime + 30d | PostgreSQL (Railway, US) | Exotel (India) | Consent (OTP_AUTH) |
| Full name | Order fulfillment | Account lifetime + 30d | PostgreSQL (Railway, US) | None | Consent (ORDER_PROCESSING) |
| Delivery Address | Order fulfillment | Account lifetime + 30d | PostgreSQL (Railway, US) | None | Consent (ORDER_PROCESSING) |
| Order History | Tax/GST Compliance | 3 Years | PostgreSQL (Railway, US) | Store Owners | Contractual Obligation |
| IP Address | Security & Anti-Fraud | 30 Days (Railway Pro built-in retention) | Railway logs (US) | None | Legitimate Security / DPDP Sec 12 |

#### 8.7.5 — Data Breach Response Plan SOP (`dbrp-v1.md`)
- Create `dbrp-v1.md` in `Breach-Response-Plan/` defining 4-step protocol:
  1. Detect & Contain (0–2h): Rotate credentials, revoke compromised keys.
  2. Assess (2–6h): Identify affected records and data categories.
  3. Notify (within 72h): Notify Data Protection Board and affected users.
  4. Remediate & Document: Write incident report in `Grievance-Log/`.

#### 8.7.6 — Pre-emptive DPA for Razorpay
- Execute DPA via Razorpay Dashboard (Settings → Legal → DPA) prior to turning on `UPI_PAYMENT_ENABLED` feature flag.

---

### 8.8 — PENDING VENDOR DECISION — SMS OTP & Mobile Call Masking

> ⚠️ **These items are deferred to the end of Phase 8 until the client finalizes the vendor choice (Exotel vs Fast2SMS + Exotel).**

---

#### 8.8.1 — TRAI DLT Portal Registration & Template Approval

**Step-by-step Non-Code Instructions:**
- [ ] **Step 1:** Log into JioTrueConnect (`trueconnect.jio.com`) or Airtel DLT (`dltconnect.airtel.in`).
- [ ] **Step 2:** Register business as **Principal Entity (PE)**. Provide Business Registration / GSTIN and PAN. Obtain **PE ID**.
- [ ] **Step 3:** Register **Header / Sender ID** (`GOROLA` — 6 characters).
- [ ] **Step 4:** Register **OTP Content Template**:
  `Your GoRola verification code is {#var#}. Valid for 10 minutes. Do not share with anyone. -GoRola`
- [ ] **Step 5:** Obtain approved **Template ID** and input into chosen vendor dashboard (Exotel / Fast2SMS).

---

#### 8.8.2 — Telecommunications Vendor DPA (Exotel / Fast2SMS)

- [ ] Log into vendor dashboard (Exotel / Fast2SMS), request/download signed DPA for DPDP compliance. Save to `DPAs/telecom-dpa.pdf`.

---

#### 8.8.3 — Real OTP Gateway Integration

- [ ] **RED — Integration (`otp.gateway.test.ts`):**
  - [ ] Test: `POST /api/v1/auth/otp/send` with `{ phone: '+919876543210' }` in production environment calls vendor API (`ExotelService.sendSMS` / `Fast2SMSService.sendSMS`) with PE ID and Template ID.
  - [ ] Test: Vendor API failure gracefully returns HTTP 502 `SMS_GATEWAY_ERROR`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] Create `apps/api/src/modules/auth/otp-gateway.service.ts` wrapping vendor REST API. Update `auth.service.ts` to replace dummy OTP with live gateway call.
  - [ ] Run integration test — **confirm GREEN.**

---

#### 8.8.4 — Mobile Call Masking Proxy Integration

**Root cause / Goal:**
Riders must call buyers to coordinate delivery without seeing raw buyer phone numbers on their screens. Exposing raw buyer numbers to riders creates serious data privacy and harassment risks under DPDP Sec 8(5).

**Fix / Approach:**
Create backend endpoint `POST /api/v1/rider/orders/:id/call`. When a rider taps "Call Customer", the backend calls Exotel's Connect API (`https://api.exotel.com/v1/Accounts/{AccountSid}/Calls/connect`) to bridge a call between rider and buyer using Exotel's Virtual Number. Update rider order serializers to mask buyer phone numbers (`buyerMaskedPhone: "+91 98XXXXXX12"`).

---

- [ ] **RED — Integration (`rider.call-masking.test.ts`):**
  - [ ] Test: `GET /api/v1/rider/orders/active` with rider JWT returns order where `buyerPhone` is NOT exposed, and `buyerMaskedPhone` is formatted as `"+91 98XXXXXX12"`.
  - [ ] Test: `POST /api/v1/rider/orders/<orderId>/call` with rider JWT triggers HTTP POST request to Exotel Connect API with `{ From: riderPhone, To: buyerPhone, CallerId: exotelVirtualNumber }` and returns HTTP 200 `{ success: true, message: 'Call bridging initiated' }`.
  - [ ] Test: Calling `POST /api/v1/rider/orders/<orderId>/call` for an order belonging to a different store returns HTTP 403 `FORBIDDEN`.
  - [ ] **Run — confirm RED (call endpoint does not exist; raw phone numbers exposed).**

- [ ] **GREEN — Backend (Service → Controller → Routes):**
  - [ ] [Service] Create `apps/api/src/modules/delivery/call-masking.service.ts`:
    - `initiateMaskedCall(riderId: string, orderId: string)`:
      - Validates rider belongs to store assigned to order.
      - Decrypts rider phone and buyer phone from database.
      - Calls Exotel Connect API via `fetch` / `axios` with Account SID, API Key, Token, Rider Phone (`From`), Buyer Phone (`To`), and Exotel Virtual Number (`CallerId`).
      - Logs call initiation event to `AuditLog`.
  - [ ] [Controller] Add handler for `POST /api/v1/rider/orders/:id/call` in `delivery/rider.controller.ts`.
  - [ ] [Serializer] Update `RiderOrderSerializer` to output `buyerMaskedPhone` (`+91 98******12`) and omit raw unencrypted `phone`.
  - [ ] Run integration test — **confirm GREEN.**

- [ ] **RED — Unit / Component (`RiderOrdersPage.test.tsx` / `BookingVisitCard.test.tsx`):**
  - [ ] Test: Order card renders "Call Customer" button (`data-testid="call-customer-btn"`) instead of `href="tel:rawNumber"`.
  - [ ] Test: Clicking "Call Customer" button fires API POST request to `/api/v1/rider/orders/:id/call`.
  - [ ] Test: Displays toast notification "Initiating call... Your phone will ring shortly."
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Component):**
  - [ ] In `RiderOrdersPage.tsx` and `BookingVisitCard`, replace direct phone links with `Call Customer` button wired to `apiClient.post('/api/v1/rider/orders/${order.id}/call')`.
  - [ ] Run unit test — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Rider opens active order card → Buyer phone is masked (`+91 98******12`) → Rider taps "Call Customer" → API calls Exotel Connect API → Exotel dials rider's phone → Rider answers → Exotel connects call to buyer's phone using Virtual Number → Neither party sees the other's real phone number → ✅ Done.

---

## Session Notes (Phase 8)

- **Session 1 — 2026-07-29 — Plan Restructuring & TDD Specification:** Restructured Phase 8 into strict `TDD_INSTRUCTION_GUIDE.md` format. Expanded all technical sections with explicit Root Cause, RED integration & unit tests ("Run — confirm RED"), GREEN architectural tier steps, and end-to-end Verification Chains. Added detailed step-by-step non-coding instructions for vendor DPAs (Railway paid plan, Vercel free plan ToS, Ola Maps), Grievance Officer workflow, TRAI DLT portal registration, Data Inventory, and Data Breach Response Plan. Deferred vendor-dependent SMS OTP & Mobile Call Masking items to Section 8.8 at the end.

- **Session 2 — 2026-07-29 — Section 8.1.1 & 8.1.2 Completion + Global PII Interceptor Architecture:**
  - **Least-Privilege Database Role Separation (8.1.1):** Built `database.least-privilege.test.ts`. Configured `app_service` (DML role) and `db_owner` (DDL role) on PostgreSQL containers for `gorola_dev` and `gorola_test`. Executed schema `public` grant commands. Built helper script `run-studio.cjs` and registered `"prisma:studio": "node ./scripts/run-studio.cjs"` in `apps/api/package.json` to launch Prisma Studio using `DIRECT_URL` / `db_owner` credentials.
  - **PII Field Encryption at Rest (8.1.2):** Built `pii.encryption.test.ts` querying raw DB columns with `$queryRawUnsafe`. Created AES-256-GCM encryption & HMAC-SHA256 blind indexing helper `src/lib/crypto.ts`. Updated `schema.prisma` adding `phoneHash String? @unique` to `User` and `DeliveryRider` models. Generated and deployed migration `20260729201500_add_pii_encryption_fields`. Updated `user.repository.ts`, `rider.repository.ts`, `seed.ts`, and `seed-e2e.ts`.
  - **Changes Outside Section 8.1 Boundaries (Global Architecture & Alignment):**
    - *Prisma Client Extension (`$extends`):* Implemented Prisma Client Extension in `apps/api/src/lib/prisma.ts` for model `User`. Automatically intercepts `findUnique`, `findUniqueOrThrow`, `findFirst`, `findMany`, `count`, `create`, `update`, `upsert`, `deleteMany`, and `updateMany` to handle write encryption, `phoneHash` queries, and output decryption globally across all existing test files and services without breaking direct Prisma callers.
    - *Centralized Phone Masking:* Extended `maskPhone` in `src/lib/crypto.ts` to decrypt ciphertext before masking (`enc:...` → plaintext → `*********3210`). Replaced local `maskPhone` functions in `admin.service.ts`, `store-owner.service.ts`, `rider.controller.ts`, and `booking.controller.ts`.
    - *Admin User Search:* Updated `getUsers({ phone })` in `admin.service.ts` to perform in-memory partial substring matching on decrypted phone numbers.
    - *Test Harness Synchronization:* Updated `apps/api/src/__tests__/setup/test-env.ts` to map `DIRECT_URL` to `MIGRATION_DATABASE_URL_TEST` / `db_owner`.
    - *Developer Setup & Env Templates:* Updated `LOCAL_SETUP.md`, `GoRola_app/.env.example`, and `apps/api/.env.example` with `DATABASE_URL`, `DATABASE_URL_TEST`, `DIRECT_URL`, `MIGRATION_DATABASE_URL`, and `MIGRATION_DATABASE_URL_TEST`.
  - **Quality Gates Verified:** `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), and full integration test suites passed 100% green.

- **Session 3 — 2026-07-30 — Local Dev DB Infrastructure Fixes & CI/CD Migration Pipeline Repair:**
  - **Root Cause Analysis:** Identified and resolved a cascade of PostgreSQL least-privilege permission gaps that prevented `prisma migrate dev` from running locally on a fresh Docker container. Three distinct permission errors were uncovered and fixed in sequence: (1) `P3014` shadow database creation, (2) `permission denied for schema public`, and (3) `permission denied for table Store` during seeding.
  - **`migrate-dev.cjs` Wrapper Script (New):** Created `apps/api/scripts/migrate-dev.cjs` — a wrapper that temporarily overrides `DATABASE_URL` with `MIGRATION_DATABASE_URL` (`db_owner`) before invoking `prisma migrate dev`. This ensures the shadow database can be created without granting `CREATEDB` to `app_service`. Updated `prisma:migrate:dev` script in `apps/api/package.json` to call this wrapper instead of `prisma migrate dev` directly.
  - **PostgreSQL Permission Fixes (Three-Layer Fix):**
    1. `CREATEDB` must be added to `CREATE ROLE db_owner` — Prisma's shadow database is a whole new PostgreSQL database, not just a table. Without `CREATEDB`, migration fails with `P3014`.
    2. `GRANT ALL ON SCHEMA public TO db_owner` + `ALTER SCHEMA public OWNER TO db_owner` — PostgreSQL 15 removed the default `CREATE` privilege on the `public` schema. Without schema ownership, migration fails with `permission denied for schema public`.
    3. `ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT ... TO app_service` — the `FOR ROLE db_owner` clause is critical. Without it, auto-grants only fire for tables created by `postgres`, so `app_service` gets no access to tables created by `db_owner` during migrations, causing `permission denied for table` errors during seeding and API queries.
  - **Script Audit & Fixes (`bootstrap-local-db.cjs`, `bootstrap-test-db.cjs`):** Both bootstrap scripts were using `DATABASE_URL` (`app_service`) for `prisma migrate deploy`, which fails with `permission denied for schema public`. Fixed both to use `MIGRATION_DATABASE_URL` / `MIGRATION_DATABASE_URL_TEST` (`db_owner`) for the migration step, then restore `DATABASE_URL` (`app_service`) for the seeding step.
  - **`setup-railway-roles.cjs` Fix:** Added `CREATEDB` to the `db_owner` role creation (both `CREATE` and `ALTER` branches of the idempotent `DO $$` block). Added `GRANT ALL ON SCHEMA public TO db_owner` and `ALTER SCHEMA public OWNER TO db_owner` queries. Fixed `ALTER DEFAULT PRIVILEGES` to include `FOR ROLE db_owner`.
  - **CI/CD Deploy Pipeline Fix (`deploy-railway.yml`):** The `deploy-railway.yml` reusable workflow was calling `pnpm` without ever installing it, causing `pnpm: command not found` (exit 127). Added `pnpm/action-setup@v4`, `actions/setup-node@v4` with pnpm cache, and `pnpm install --frozen-lockfile --prefer-offline` steps before the Railway CLI install and migration steps — mirroring the pattern already used in `ci.yml`.
  - **Documentation Updated:** `LOCAL_SETUP.md` and `DEPLOYMENT INFO/DEPLOYMENT_CONFIG_GUIDE.md` updated throughout to reflect all corrected role setup commands, including `CREATEDB`, schema ownership, `FOR ROLE db_owner` default privileges, sequences grants, and recovery one-liners (`ALTER ROLE db_owner CREATEDB;`) for the "role already exists" scenario.

- **Session 4 — 2026-09-23 — Phase 8.2 Implementation & Consent Architecture Documentation:**
  - **Schema & Backend API (8.2.1 & 8.2.4):**
    - Created `ConsentLog` model with enum `ConsentPurpose` (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_EMAIL`, `ANALYTICS`) and physical migration `20260922205638_add_consent_log_model`.
    - Implemented `POST /api/v1/consent`, `GET /api/v1/consent`, `DELETE /api/v1/consent/:purpose`.
    - Added Prisma Client extension blocking `delete` and `deleteMany` operations on `ConsentLog` to guarantee audit trail immutability.
    - Integration tests: `consent.controller.test.ts` (4/4 passed) & `consent.audit.test.ts` (3/3 passed).
  - **Frontend Notices & Contextual Consent (8.2.2, 8.2.5, 8.2.6, 8.2.7):**
    - **`OTP_AUTH`:** Step notice on `LoginPage.tsx` logging consent on OTP verification.
    - **`ORDER_PROCESSING`:** Address dialog notice naming Ola Maps on `SavedAddressesPage.tsx` and `BookingTimeslotPage.tsx`. Checkout fulfillment notice naming Ola Maps and Razorpay on `CheckoutPage.tsx`.
    - **`MARKETING_EMAIL`:** Un-ticked opt-in checkbox on `CheckoutPage.tsx` and 1-click Opt-In / Withdraw toggle card in `PrivacySettingsSection.tsx`.
    - **`ANALYTICS`:** Built `AnalyticsConsentBanner.tsx` with Option A authentication gating (only renders for `role === 'BUYER'` when unset, suppressed on Rider/Store/Admin portals).
  - **Architecture Guide Created:**
    - Authored `DPDP Act/DPDP_CONSENT_ARCHITECTURE_GUIDE.md` documenting all 4 consent pipelines, ASCII architecture diagram, sub-processor disclosures (Ola Maps, Razorpay, Exotel), hosting disclosures (Railway, Vercel), and checkbox vs action button standards.
  - **Identified Frontend State Cleanups for Future Polish:**
    1. *Profile Consent Grouping:* Update `PrivacySettingsSection.tsx` to group raw database logs into the 4 canonical purpose cards rather than rendering duplicate historical rows.
    2. *Card Description Update:* Update `ORDER_PROCESSING` label in `PrivacySettingsSection.tsx` to explicitly name Razorpay and Ola Maps.
    3. *Checkout Consent State Awareness:* In `CheckoutPage.tsx`, hide the `MARKETING_EMAIL` checkbox if already Active in user profile, and suppress duplicate `ORDER_PROCESSING` API dispatches on repeat orders.

- **Session 5 — 2026-09-23 — DPDP Notice Canonical Standardization & Booking Consent Completion:**
  - **Canonical Notice Harmonization:** Reconciled `ORDER_PROCESSING` notice wording across all buyer touchpoints (`SavedAddressesPage.tsx`, `BookingTimeslotPage.tsx`, `CheckoutPage.tsx`) using the single, legally truthful conditional formulation:
    > *"Your address, landmark notes, and GPS coordinates are shared with **Ola Maps** for location services, and with assigned store partners and delivery riders for order fulfillment. If you choose online payment, your transaction details are processed securely via **Razorpay**. Governed by India's DPDP Act 2023."*
  - **Booking Checkout Consent Completion:** Added the missing `ORDER_PROCESSING` DPDP consent notice card directly above the "Confirm Booking" CTA on `BookingTimeslotPage.tsx`, and wired background consent logging (`POST /api/v1/consent`) upon booking confirmation.
  - **Audit Trail Uniformity:** Ensured the exact canonical notice text is sent in the `noticeText` payload for all `ORDER_PROCESSING` consent creations (address save, booking confirmation, order checkout) so `ConsentLog` rows are 100% consistent during compliance audits.
  - **Architecture Guide (v1.1):** Documented Section 8 in `DPDP_CONSENT_ARCHITECTURE_GUIDE.md` detailing the ADR on why Razorpay disclosure is incorporated into `ORDER_PROCESSING` with a conditional clause rather than an unmanageable fifth consent purpose (`PAYMENT_PROCESSING`).
  - **Quality Gates:** All unit and component tests passing green (`BookingTimeslotPage.test.tsx`, `SavedAddressesPage.test.tsx`, `CheckoutPage.test.tsx` — 20/20 tests passed) and `pnpm typecheck` passed with 0 errors.

- **Session 6 — 2026-09-24 — Consent Idempotency, Profile UI Canonical Aggregation & Dedicated Privacy Dashboard Architecture:**
  - **Dedicated Account Privacy Dashboard (`/account/privacy`):**
    - Created `PrivacySettingsPage.tsx` registered under protected route `/account/privacy` in `buyer.tsx`.
    - Transferred full statutory consent management (`PrivacySettingsSection.tsx`) into this dedicated view.
    - Updated `ProfilePage.tsx` by replacing the awkwardly placed bottom section with a clean `Privacy & Consent` Quick Link card (`<ShieldCheck />`) positioned directly above the Logout action.
    - Resolved grid layout stretching in `ProfilePage.tsx` using `md:items-start` and balanced spacing to eliminate excess whitespace on the Personal Info card.
    - Unit tests created in `PrivacySettingsPage.test.tsx` and updated in `ProfilePage.test.tsx`.
  - **Phase 8.3 Roadmap Alignment for `/account/privacy`:**
    - Documented architectural plan: `/account/privacy` serves as the user-facing hub for upcoming Phase 8.3 user rights:
      1. **Section 8.3.1 (Right to Erasure):** "Delete Account" modal invoking `DELETE /api/v1/user/account`.
      2. **Section 8.3.2 (Right to Access):** "Download My Data" button triggering JSON export via `GET /api/v1/user/my-data`.
      3. **Section 8.3.3 (Right to Nominate):** Nomination form saving trusted contact fields to `User` model.
    - Differentiated interactive account dashboard (`/account/privacy` for logged-in buyers) from public legal disclosures (`/privacy` for guests, regulators, and legal text in Phase 8.6).
  - **Consent Idempotency Guard (8.2 & DPDP Sec 10):**
    - Enhanced `recordConsent` in `consent.service.ts` to inspect `findLatestByUserIdAndPurpose`. If an active, unwithdrawn record for the same purpose already exists with matching `consentVersion` and `noticeText`, it returns `{ record, isNew: false }` rather than inserting a duplicate row.
    - Updated `consent.controller.ts` to respond with `200 OK` on idempotency short-circuits vs `201 Created` for fresh consent grants.
    - Added dedicated idempotency integration tests in `consent.controller.test.ts` (verifying single row persistence across multiple repeated requests).
  - **Canonical 4-Card Profile Privacy Settings UI (`PrivacySettingsSection.tsx`):**
    - Refactored `PrivacySettingsSection.tsx` from rendering raw historical database rows to aggregating entries into the 4 canonical purpose cards (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_EMAIL`, `ANALYTICS`) via `buildPurposeCards()`.
    - Guaranteed all 4 canonical cards are always rendered even with empty server records, with 1-click Opt-In / Withdraw buttons.
    - Removed premature "Exotel" vendor reference from `OTP_AUTH` description across the app (pending Phase 8.8 vendor selection).
  - **Universal Heading Standardization:**
    - Standardized every consent form and dialog across the buyer app to use the exact same canonical heading as the Profile Privacy page:
      - `OTP_AUTH`: **Authentication & Account Security** (`LoginPage.tsx`)
      - `ORDER_PROCESSING`: **Order Fulfillment & Location Services** (`CheckoutPage.tsx`, `SavedAddressesPage.tsx`, `BookingTimeslotPage.tsx`)
      - `MARKETING_EMAIL`: **Promotions & Seasonal Offers** (`CheckoutPage.tsx`)
      - `ANALYTICS`: **Usage & Performance Analytics** (`AnalyticsConsentBanner.tsx`)
  - **Cross-Device Analytics Sync (`AnalyticsConsentBanner.tsx`):**
    - Implemented cross-device server check on mount (`GET /api/v1/consent`) to sync `localStorage` (`accepted`/`declined`) on new devices without redisplaying the popup for existing users.
    - Wired "Decline" to persist locally and dispatch background `DELETE /api/v1/consent/ANALYTICS` so all devices stay in sync.
  - **Checkout Consent State Awareness (`CheckoutPage.tsx`):**
    - Integrated `consentsQuery` via `useQuery` to fetch active user consents on load.
    - Suppressed duplicate `POST /api/v1/consent` (ORDER_PROCESSING) dispatches on order placement when consent is already active.
    - Conditionally hid the `MARKETING_EMAIL` opt-in checkbox if the user has already granted marketing consent.
  - **Architecture Guide v1.2 Documentation (`DPDP_CONSENT_ARCHITECTURE_GUIDE.md`):**
    - Added **Section 9: Booking Commerce Consent ADR** explaining why `ORDER_PROCESSING` legally and architecturally covers booking commerce without creating redundant purpose enums.
    - Added **Section 10: OTP_AUTH Idempotency & Authentication Lifecycle ADR** rationalizing why OTP consent occurs post-verification (when userId is known) and how backend idempotency prevents log bloat.
  - **Quality & Lint Fixes:**
    - 100% test pass rate across 55 Vitest component/unit tests and 0 ESLint warnings across the entire monorepo.

- **Session 7 — 2026-09-24 — Rider UI Mobile Layout, PII Key Rotation Fallback, CI E2E Mobile Stability & Booking Consent Parity:**
  - **Rider UI Mobile Bottom Navigation Centering (`RiderLayout.tsx`):**
    - Fixed bottom tab bar detachment on desktop and preview containers by applying `max-w-md mx-auto` to `<nav className="fixed bottom-0 left-0 right-0 ...">`, keeping navigation controls centered and aligned with the mobile card container across all viewport sizes.
  - **PII Phone Number Decryption & Key-Rotation Fallback (`crypto.ts`, `rider.controller.ts`, `admin.service.ts`):**
    - *Rider Profile Endpoint:* Added missing `decryptPII(rider.phone)` call in `GET /api/v1/rider/profile` (`rider.controller.ts`).
    - *Admin Platform Riders:* Added missing `decryptPII(r.phone)` mapping in `listRiders()`, `createRider()`, and `updateRider()` in `admin.service.ts` so admin tables display readable plain numbers (`+919000000001`) instead of raw `enc:...` ciphertexts.
    - *Dynamic Key & Fallback Decryption:* Refactored `crypto.ts` from evaluating `ENCRYPTION_KEY` at import-time to dynamically reading `process.env.ENCRYPTION_KEY` inside `getCipherKey()` and `getHmacSecret()`. Added automated fallback key decryption so historical database seed records encrypted with default keys and newly provisioned records encrypted with custom `.env` keys decrypt seamlessly.
  - **Playwright E2E CI Mobile Viewport Fixes (`iphone-se`):**
    - *Click Occlusion Resolution:* Diagnosed and fixed timeout failures in `E2E-022` (`store-owner-journey.spec.ts`) and `E2E-008` (`checkout.spec.ts`) caused by `{ force: true }` clicks clicking behind the fixed `z-50` mobile bottom nav bar. Replaced with `evaluate(node => node.scrollIntoView({ block: 'center' }))` + `.click()`.
    - *Deterministic Quantity Increments:* Updated `E2E-028` to assert each quantity increment step (`2` → `3` → `4`) before verifying the automatic discount summary, eliminating race conditions during fast automated runs.
  - **Quality Gates:** 100% GREEN run on `pnpm ci:quality` (84/84 tests passing with zero failures).

- **Session 8 — 2026-09-24 — Phase 8.3 (User Rights: Erasure, Data Portability, and Nomination) Complete:**
  - **Prisma Schema Migration (`20260924040500_add_user_nominee_and_deletion_fields`):**
    - Added `deletedAt`, `deletionScheduledFor`, `nomineeName`, `nomineeContact`, and `nomineeRelationship` to `User` model with index on `deletedAt`. Applied to both local and test databases cleanly.
  - **Right to Access & Data Portability (DPDP Act Sec 11):**
    - Backend: Implemented `GET /api/v1/user/my-data` in `user.controller.ts` & `user.repository.ts`, returning complete sanitized JSON archive of profile, addresses, orders, and consent logs.
    - Frontend: Added `<DataPortabilitySection />` with 1-click JSON download (`gorola-my-data-[date].json`).
  - **Right to Nominate (DPDP Act Sec 14):**
    - Backend: Implemented `PUT /api/v1/user/nominee` and `GET /api/v1/user/nominee` with Zod validation.
    - Frontend: Added `<DataNomineeSection />` on `/account/privacy` with pre-filled inputs and save/remove actions.
  - **Right to Erasure with 30-Day Recovery Grace Period & Interactive Re-Login Restoration (DPDP Act Sec 12):**
    - Backend: Implemented `DELETE /api/v1/user/account` (soft-delete with 30-day grace period, session revocation) and `POST /api/v1/user/reactivate-account` (restore account).
    - Auth Forwarding: Updated `routes.ts`, `auth.service.ts`, and `auth.controller.ts` so `POST /api/v1/auth/buyer/verify-otp` detects soft-deleted accounts and returns `isPendingDeletion: true` and `deletionScheduledFor`.
    - Interactive Re-Login Restoration UI: Added dedicated `reactivate` step in `LoginPage.tsx` presenting an interactive restoration screen when logging in during the 30-day grace period, with unambiguous buttons:
      - **"Restore My Account"** (Primary): Dispatches `POST /api/v1/user/reactivate-account`, clears deletion timestamps, and restores access.
      - **"Proceed with Deletion & Exit"** (Secondary): Keeps deletion timer active and signs out back to login.
    - Worker: Created `apps/api/src/workers/user-data-purge.worker.ts` with `purgeExpiredUsers` executing permanent PII scrub and consent withdrawal after 30 days.
    - Frontend: Added `<DangerZoneSection />` on `/account/privacy` with 30-day recovery dialog.
  - **Quality & TDD Parity:** 34/34 API unit/integration tests and 16/16 web unit tests GREEN. 0 ESLint errors, 0 TypeScript errors across all workspace projects.

- **Session 9 — 2026-10-02 — Phase 8.3.4 (DPDP Act 2023 Consent Architecture Overhaul & Admin Consent Panel) Complete:**
  - **Schema & DB Migration (`20261001200359_replace_consent_purpose_enum_with_config_table`):**
    - Replaced rigid PostgreSQL `ConsentPurpose` enum with dynamic relational `ConsentPurposeConfig` table (`key` PK, `displayName`, `description`, `isEssential`, `retentionSummary`).
    - Renamed canonical purpose from `MARKETING_EMAIL` to `MARKETING_COMMS` to accurately reflect multi-channel communications (Email, SMS, Push, WhatsApp).
    - Converted `ConsentLog.purpose` to `TEXT` with foreign key constraint to `ConsentPurposeConfig.key`.
    - Seeded initial canonical configuration rows (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_COMMS`, `ANALYTICS`) in `gorola_dev` and `gorola_test`.
    - Updated `apps/api/prisma/seed.ts` to seed `ConsentPurposeConfig` across fresh installations.
  - **Notice Text Corrections & Statutory Accuracy (DPDP Act Sec 5 & 6):**
    - Corrected GPS retention disclosures in `ConsentNoticeModal.tsx` and all inline cards (`SavedAddressesPage.tsx`, `CheckoutPage.tsx`, `BookingTimeslotPage.tsx`): clearly stated that address GPS coordinates are retained alongside saved delivery addresses, order GPS is permanently nulled upon account erasure, and financial records are retained for 7 years for GST compliance.
    - Updated identity disclosures to "Display Name (if you have set one)" rather than implying mandatory full legal name collection.
    - Clarified that transactional SMS OTPs are routed via TRAI/DLT-registered Indian telecommunication gateways.
  - **Admin Consents Auditing API (DPDP Act Sec 8 & 10):**
    - Implemented `GET /api/v1/admin/users/:id/consents` with pagination (`page`, `limit`), returning both an aggregate summary of active consent per configured purpose and a complete, append-only log history.
    - Added comprehensive integration tests in `admin.users.test.ts` (9/9 tests green).
  - **Admin User Detail Drawer UI (`AdminUsersPage.tsx`):**
    - Added dedicated **"Consent & Privacy (DPDP Act 2023)"** section to the user detail side drawer.
    - Rendered summary table displaying all 4 canonical purposes with `Active` (green) / `Withdrawn` (red) status badges, essential purpose indicators, and latest consent update timestamps.
    - Built expandable, paginated full consent log audit table with direct pagination controls.
    - Added unit and interaction test coverage in `AdminUsersPage.test.tsx` (2/2 tests green).
  - **Comprehensive Quality Gates & Documentation:**
    - Test Suite: 516/516 backend tests passed across 41 files; 529/529 frontend tests passed across 92 files.
    - Code Quality: `pnpm typecheck` passed (0 errors); `pnpm lint` passed (0 warnings).
    - Zero active `MARKETING_EMAIL` strings remaining in application source code.
    - Documentation: Updated `architecture.md`, `database_schema.md`, `decision_log.md` (`[DECISION-059]`), `DPDP_CONSENT_ARCHITECTURE_GUIDE.md` (v1.7), `phase8_state.md`, `current_state.md`, and `project_data.json`.
- **Session 10 — 2026-10-02 — Phase 8.3.5 (DPDP UI Alignment, Audit Log Search & Nominee PII Protection) Complete:**
  - **DPDP UI Alignment & Concise Consent Cards (8.3.5.1):**
    - Streamlined consent card body across `PrivacySettingsSection.tsx`, `LoginPage.tsx`, `CheckoutPage.tsx`, `BookingTimeslotPage.tsx`, `SavedAddressesPage.tsx`, and `AnalyticsConsentBanner.tsx` to state strictly what data is stored, whom it is shared with, and the reason.
    - Bolds third-party service partners (**Exotel**, **Ola Maps**, **Razorpay**) across all notice cards and statutory notice modals.
    - Added purpose-specific transparency lines below each card detailing statutory retention (e.g. 7-year GST records, 180-day telemetry auto-purges, 48-hour opt-out scrubbing, erasure mechanisms) and clearly differentiating the statutory notice modal from the platform-wide Privacy Policy.
    - Resolved typographic vertical baseline misalignment for inline notice modal trigger buttons and icons (`FileText`).
    - Restructured `PrivacySettingsSection.tsx` consent cards so Opt In / Withdraw buttons reside in the card header, allowing notice text to span full card width.
    - Created a dedicated public `/privacy` policy page (`PrivacyPolicyPage.tsx`) registered in buyer routes with DPO contact and DPBI escalation details.
  - **Admin Audit Log Substring Search, Pagination & UI Stability (8.3.5.2):**
    - Updated `audit.repository.ts` Prisma query filters to use `{ contains: term, mode: "insensitive" }` for `action` and `entityType`, resolving exact-match limitations and 1-character search blanking.
    - Configured `keepPreviousData` in TanStack Query and persistent filter input mounting in `AdminAuditLogsPage.tsx`, preventing full-page teardowns, filter unmounting, and caret/focus loss during live typing.
    - Added a dedicated pagination toolbar to `AdminAuditLogsPage.tsx` with dynamic rows per page selector (`10`, `20`, `50`, `100`), entry count indicator, and `Previous`/`Next` page navigation buttons.
    - Enhanced `audit.repository.ts` date filtering to normalize `to` date strings to `23:59:59.999Z`, making the selected "To Date" 100% inclusive of all events recorded throughout that entire day.
  - **Admin Nominee PII Protection & Data Minimization (8.3.5.3):**
    - Updated `admin.service.ts` (`getUserDetail`) to serialize ONLY `nomineeName: user.nomineeName ?? null`, strictly omitting `nomineeContact` and `nomineeRelationship` to prevent third-party PII leakage under DPDP Act Sec 14.
    - Updated `AdminUserDetailPage.tsx` Nominee Info card to display nominee name or `"Not Configured"`.
  - **Comprehensive Quality Gates:**
    - Full API test suite: 119 files / 737 tests passed (0 failures).
    - Full Web test suite: 95 files / 541 tests passed (0 failures).
    - Typecheck: 0 errors across 4 workspace packages.
    - Lint: 0 errors, 0 warnings across all apps/packages.
- **Session 11 — 2026-10-03 — Phase 8.4 (Session Transparency & Security Alerting) & Phase 8.5 (Automated Data Retention) Complete:**
  - **Active Sessions & Remote Revocation (8.4.1):**
    - Enhanced `AuthService` with active session tracking in `verifyOtp`, `refreshToken`, `logout`, `getActiveSessions`, and `terminateAllSessions`.
    - Added routes `GET /api/v1/auth/sessions` and `DELETE /api/v1/auth/sessions` with Fastify client context (`ipAddress`, `userAgent`) and token verification middleware.
    - Built `ActiveSessionsSection.tsx` and integration tests in `auth.sessions.test.ts` & `ActiveSessionsSection.test.tsx` (all green).
  - **Security Alerting (8.4.2):**
    - Added structured `SecurityAlertPayload` and `logSecurityAlert` helper in `logger.ts`, integrated into `AuthService.verifyOtp` triggering `FAILED_AUTH_BURST` security alert upon reaching lockout thresholds.
    - Verified via unit test `security-alert.test.ts` (100% green).
  - **Automated Data Retention & Purge Jobs (8.5.1):**
    - Created `audit-log-archive.worker.ts` (purges `AuditLog` records older than 365 days).
    - Created `otp-log-purge.worker.ts` (statutory 90-day OTP safety purge).
    - Created unified `scheduler.ts` combining user grace period purge, audit archive, and OTP purge.
    - Verified in `data-retention.test.ts` (3/3 integration tests green).
  - **Railway Log Retention (8.5.2):**
    - Verified and confirmed that Railway Pro Plan provides fixed 30-day built-in log retention (satisfies DPDP Sec 12 data minimization).
  - **Consent UI/UX Accordion Refinement:**
    - Made all consent card headings prominent and bold (`font-bold text-gorola-charcoal`).
    - Implemented Compact Accordion per Purpose in `PrivacySettingsSection.tsx`, drastically reducing page height on mobile and keeping all account actions (Active Sessions, Download My Data, Nominee, Account Deletion) immediately visible.
  - **Quality Gates:**
    - 122 API test files (744 tests) passed 100% green.
    - 95 Web test files (541 tests) passed 100% green.
    - `pnpm typecheck` passed (0 errors across 4 packages).
    - `pnpm lint` passed (0 errors, 0 warnings).
