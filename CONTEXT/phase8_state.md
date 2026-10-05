# GoRola — Phase 8 State (DPDP Act 2023 Compliance)

> **This file covers Phase 8: Full compliance with India's Digital Personal Data Protection Act 2023.**
> Phase 8 is independent of Phases 5–7 and can be worked on in parallel.
> It is a hard requirement before any real user data is collected in production.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name                    | Status      | Notes |
| ------- | ----------------------- | ----------- | ----- |
| Phase 8 | DPDP Act 2023 Compliance | 🟡 IN PROGRESS | Sections 8.1, 8.2, 8.3 (Two-Stage Erasure, Data Portability, Nominee), 8.3.4 (Consent Overhaul & Admin Consent Panel), and 8.3.5 (DPDP UI Alignment, Audit Log Search & Nominee PII Protection) complete; Phases 8.4–8.6 complete; 8.7 documentation corrected 2026-10-05 (provider register + accurate DPA steps); 8.8 (Age Eligibility Gate, 18+) planned and ready to build; 8.9 (SMS OTP & call masking) pending vendor decision. |

---

## 📍 Last Updated

- **Date:** 2026-10-06
- **Session Summary (2026-10-06 — Sections 8.8.1 to 8.8.8 Complete):**
  1. Verified and completed Sections 8.8.1 to 8.8.6 checklist items.
  2. **Section 8.8.7 (Existing Legacy Users, Refresh Gate & Underage Purge):** Built `auth.service.refresh-age.test.ts` & `auth.confirm-age.legacy.integration.test.ts`. Implemented adult legacy confirmation with same userId and 1 `AGE_DECLARATION` consent, under-18 immediate `permanentPurgeAndAnonymize` + `terminateAllSessions` + `lockPhone` without 30-day grace, and `403 AGE_CONFIRMATION_REQUIRED` in `refreshToken` when `ageConfirmedAt` is null.
  3. **Section 8.8.8 (Admin Endpoints: Unlock Wrongly Locked Adult & Erase Discovered Minor):**
     - Built RED integration tests in `admin.age-gate.test.ts` (11 tests) and unit tests in `admin.age-gate.service.test.ts`.
     - Implemented `POST /api/v1/admin/age-gate/unlock` (`ADMIN` JWT, validates phone & reason >= 10 chars, deletes lockout, writes `AGE_GATE_LOCKOUT_CLEARED` audit log with zero raw phone digits).
     - Implemented `POST /api/v1/admin/users/:id/erase-underage` (`ADMIN` JWT, validates reason >= 10 chars, computes pre-purge phone hash, terminates user sessions, runs `permanentPurgeAndAnonymize`, locks phone hash for 90 days, writes `USER_ERASED_UNDERAGE` audit log with zero raw phone digits).
     - RBAC & validation guards (401 unauthenticated, 403 non-admin roles, 400 validation, 404 not found, 409 already erased).
  4. Quality gates verified: `pnpm --filter @gorola/api typecheck` (0 errors), `pnpm --filter @gorola/api lint` (0 errors, 0 warnings), all 11 test files / 52 tests 100% GREEN.
- **Next Session Must Start With:** Section 8.8.9 (Lockout Purge Worker).
- **In Progress Right Now:** Section 8.8.8 complete, ready for Section 8.8.9.
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
| **8.8** | **Age Eligibility Gate (18+): Neutral DOB Check, Lockout & Server-Side Consent Writes** | Backend + Frontend + Policy (TDD) | 🟢 **Planned 2026-10-05 — Ready to Build** |
| **8.9** | **SMS OTP & Mobile Call Masking Services** | Backend + Vendor Integration | 🟡 **Pending Client Vendor Decision (At End)** |

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
- [x] Create `apps/web/src/pages/buyer/PrivacyPolicyPage.tsx` routed at `/privacy` containing all 11 DPDP sections:
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
- [x] Add `/privacy` route to `buyer.tsx` and link in site footer.

#### 8.6.2 — `/terms` Terms of Service Page
- [x] Create `apps/web/src/pages/buyer/TermsOfServicePage.tsx` routed at `/terms` with explicit Section: *"Eligibility: GoRola is intended for users aged 18 and above..."*

#### 8.6.3 — Privacy Policy Versioning & Re-Consent Banner
- [x] [Schema & Migration] Add `privacyPolicyVersionAccepted String @default("1.0")` to `User` model in `schema.prisma`. Generate physical SQL migration file: `pnpm --filter @gorola/api exec prisma migrate dev --name add_privacy_policy_version_to_user` using `DIRECT_URL` / `db_owner` DDL role.
- [x] [DB Deployment] Apply migration SQL file to local databases (`gorola_dev` and `gorola_test`) via `pnpm --filter @gorola/api prisma:bootstrap:test` BEFORE writing implementation code or running tests.
- [x] [Frontend Banner] In `BuyerLayout.tsx`, check user's `privacyPolicyVersionAccepted` against current `CURRENT_POLICY_VERSION = "1.0"`. Render re-consent banner if mismatched.
- [x] [Cascade & Regression Testing] Check across modules for cascading broken logic. Run full test suite (`pnpm test` / unit, integration, and E2E) and quality gates (`pnpm typecheck`, `pnpm lint`) — **confirm GREEN.**


---

### 8.7 — Non-Code Prerequisites & Documentation (Current Setup)

> **Operational & Legal Steps — Detailed Step-by-Step Instructions:**

#### 8.7.1 — Designate Grievance Officer & Setup Dedicated Inbox
- **Step 1:** Formally designate founder/co-founder as named Grievance Officer.
- **Step 2:** Create dedicated domain email `privacy@gorola.in` in Google Workspace / Zoho Mail.
- **Step 3:** Ensure emails auto-forward to Grievance Officer.
- **Step 4:** Set monthly calendar reminder for reviewing inbox (30-day statutory response limit).

#### 8.7.2 — Third-Party Provider Register & How to Obtain / Document Each Provider's DPA

> **Corrected 2026-10-05 after researching each provider's real legal pages.** The earlier steps in this section were largely inaccurate: Railway has no "Workspace Settings → Legal / Compliance" tab with an "Accept DPA" button; Vercel's Hobby plan has no DPA section; Razorpay has no "Settings → Legal → DPA" screen; and Ola Maps' legal documents live in the Krutrim Cloud console, not `maps.olacabs.com`. Use the instructions below instead.
>
> ⚠️ Anything marked ⚠️ comes from public pages and research summaries that can change. **Open the linked page yourself, confirm the wording, and save a dated copy as evidence. The provider's page always wins over this document.**

**Why we collect these at all.** DPDP Act Section 8(2): a Data Fiduciary (GoRola) may engage a Data Processor only under a *valid contract*, and GoRola stays legally responsible for what its processors do. A Data Processing Agreement (DPA) is that contract. The main DPDP Rules obligations begin on **13 May 2027** (18 months after notification on 13 November 2025) ⚠️, so this is preparation rather than an emergency — except where a plan upgrade is needed (Vercel).

**Three possible outcomes — record which one each provider falls into:**
- ✅ **Executed DPA** — a DPA accepted or signed, saved as a PDF.
- 🟡 **Terms accepted, no separate DPA offered** — the provider's standard Terms + Privacy Policy are the contract. We save dated copies **and** a written reply (email) from the provider confirming its role.
- 🔴 **Missing** — nothing saved yet.

**Evidence rule (identical for every provider).** In `GoRola Legal/DPDP Compliance/DPAs/<Provider>/` save:
1. The executed DPA **or** the provider's written reply email, printed to PDF.
2. Dated PDFs of the provider's Terms and Privacy Policy, named `<provider>-terms-YYYY-MM-DD.pdf` and `<provider>-privacy-YYYY-MM-DD.pdf`.
3. A short `README.md` with: provider role, personal data shared, status (✅/🟡/🔴), date verified, next review date (every 6 months), and the contact used.

##### Provider Register (every third party GoRola uses or plans to use)

| # | Provider | What it does for GoRola | Personal data it receives | DPDP role | DPA reality | Needed before |
|---|---|---|---|---|---|---|
| 1 | **Railway** | API, PostgreSQL, Redis — all personal data lives here | Everything: phone, name, addresses, GPS, orders, consents, hashed OTPs | **Data Processor** | Self-serve DPA published at `https://railway.com/legal/dpa`; trust documents at `https://trust.railway.com` | Go-live |
| 2 | **Vercel** | Delivers the compiled React app (HTML/JS/CSS) | **None sent by GoRola.** Its edge logs inevitably see each visitor's IP and request metadata | Infrastructure provider; **not** a processor of buyer data (DECISION-061) | **No DPA needed for DPDP.** Hobby has none (the DPA is part of Pro/Enterprise). **The real issue: Hobby is non-commercial-only → upgrade to Pro** | Go-live (plan upgrade) |
| 3 | **Razorpay** | UPI / Card payments (never used for COD) | Name, phone, payment details, transaction IDs | Independent RBI-regulated payment aggregator; acts largely as its own fiduciary | **No self-serve DPA.** Merchant Agreement + Privacy Policy are the contract; ask support whether a DPDP addendum exists | Before `UPI_PAYMENT_ENABLED` is switched on |
| 4 | **Exotel** *(or Fast2SMS — vendor decision pending, Section 8.9)* | OTP SMS delivery; later call masking | Phone number, OTP message text | **Data Processor** | DPA **on request** via support/account manager; no public signing page found | Before real OTP SMS goes live (8.9) |
| 5 | **Ola Maps (Krutrim)** | Map tiles, place search, reverse-geocoding, route directions — called from the user's browser | User's IP, search text, GPS coordinates, route start/end points | **Data Processor** (Krutrim's own terms describe it so for customer data) | **No separate DPA published on any plan.** Terms of Service, Privacy Policy and Fair Usage Policy apply to every account; request a written statement from support | Go-live |
| 6 | **Google Workspace or Zoho Mail** (whichever hosts `privacy@gorola.in`, see 8.7.1) | The grievance mailbox | Complainant's name, email address, complaint text | **Data Processor** | Google: the Data Processing Amendment is accepted inside the Admin console (*Account settings → Legal and compliance*) ⚠️. Zoho: published DPA or on request ⚠️ | Before the mailbox is publicised |
| 7 | **GitHub Actions** | Builds, tests, deploys | **None** (code and secrets only) | Not a processor of personal data | None needed | — |

##### Provider 1 — Railway (all personal data) — ✅ target outcome: Executed DPA
1. Log into `https://railway.com` with an account that is an **admin of the GoRola workspace**.
2. Open `https://railway.com/legal/dpa` while logged in. Read the roles, sub-processor, breach-notification and data-transfer sections.
3. Use the accept / sign option on that page ⚠️. If the page only displays the text with no execute control, email `team@railway.com` asking them to confirm that the DPA applies to your workspace, and keep the reply.
4. Save the executed copy (or the confirmation) plus any `trust.railway.com` documents (security reports, certifications) to `DPAs/Railway/`.
5. In the Railway dashboard open each service (PostgreSQL, Redis, API) → *Settings* and **record the actual region**. Make the data inventory (8.7.4) and the Privacy Policy match the real region (the documents currently say US).

##### Provider 2 — Vercel (static files only) — 🟡 DPDP needs nothing; ✅ comes free with Pro
- **Do not request a DPDP DPA as a launch blocker.** Vercel serves only the compiled bundle; personal data goes browser → Railway directly (DECISION-061).
- **The real action is the plan upgrade.** Vercel's Hobby plan is for personal, non-commercial use. GoRola is commercial, so production traffic on Hobby breaches the plan terms and risks throttling or suspension of the storefront. ⚠️ Confirm on `vercel.com/pricing` and `vercel.com/legal/terms` (Fair Use).
1. Upgrade the Vercel team to **Pro** (about US$20 per month) **before the first real customer or real payment**. Until then, Vercel is development/staging only.
2. Open `https://vercel.com/legal/dpa`, `https://vercel.com/legal/terms` and the Fair Use page; save dated PDFs to `DPAs/Vercel/` (the DPA applies under Pro/Enterprise ⚠️).
3. Write `DPAs/Vercel/README.md`: *"Role: static file delivery. GoRola sends no personal data. Vercel's edge sees visitor IP + request metadata (infrastructure logs). Vercel Analytics and Speed Insights are disabled. Plan: Pro since <date>."*
4. Confirm Vercel Analytics / Speed Insights are off in the project dashboard and that `@vercel/analytics` and `@vercel/speed-insights` are absent from every `package.json` (DECISION-061 prohibition).

##### Provider 3 — Razorpay (payments) — 🟡 target outcome: Terms accepted + written role confirmation
1. Log into `https://dashboard.razorpay.com`. The Merchant Agreement you accepted during onboarding is the contract; download it from the dashboard account/settings area or request it from support ⚠️ (the exact menu varies).
2. Save `https://razorpay.com/terms/` and `https://razorpay.com/privacy/` as dated PDFs ⚠️.
3. Raise a dashboard support request (or email your account manager): *"As a merchant subject to the DPDP Act 2023, please confirm whether Razorpay acts as a data processor or an independent data fiduciary for the payment data we send, whether a data processing addendum is available, your sub-processors and data-location position, and your grievance contact."* Save the reply.
4. Our side is already correct: the `ORDER_PROCESSING` notice names Razorpay conditionally (Consent Guide section 8). Keep the data inventory note that card/UPI details never touch GoRola servers — only transaction references do.
5. Complete this **before** the `UPI_PAYMENT_ENABLED` feature flag is turned on.

##### Provider 4 — Exotel (OTP SMS; vendor decision pending) — ✅ target outcome: DPA obtained on request
1. **Wait until the vendor is final** (Section 8.9: Exotel vs Fast2SMS + Exotel). Today a no-op OTP stub is in use and no SMS leaves GoRola.
2. Email Exotel support or your account manager (contact details are in the Exotel dashboard) asking for: a DPA aligned to the DPDP Act 2023; where message logs are stored (India/Mumbai) and for how long; the sub-processor list; and the breach-notification timeline.
3. Save the DPA (or the written reply) plus Exotel's Terms and Privacy Policy as dated PDFs to `DPAs/Exotel/`. If Fast2SMS is chosen, repeat these steps for Fast2SMS.
4. TRAI DLT registration is a separate telecom-regulatory task (8.9.1), not a DPA.

##### Provider 5 — Ola Maps (Krutrim) — free tier — 🟡 target outcome: Terms accepted + written confirmation
**What Ola receives.** The browser calls Ola directly for tiles, place search, reverse-geocoding and directions, so Ola sees the user's IP address, search text and GPS coordinates. That is personal data. The consent notice already names Ola Maps (`ORDER_PROCESSING`), and Krutrim's terms require explicit DPDP-compliant consent before personal data is sent to its APIs — that part is satisfied.
1. Log into the **Krutrim Cloud console**, `https://cloud.olakrutrim.com` → *Maps* ⚠️. (The earlier `maps.olacabs.com` address is not where the legal documents are.)
2. Save dated PDFs of the Terms & Conditions, Privacy Policy and Fair Usage Policy, and note the attribution rules (our Ola watermark must stay visible).
3. **Check the free-tier terms** and record answers in `DPAs/Ola-Maps/README.md`: (a) is commercial use allowed on the free tier? (b) what is the monthly quota and what happens when it is exceeded (blocked vs billed)? (c) any rule against storing results? (we store only the coordinates the user picks).
4. Email `maps-support@olakrutrim.com`: *"We use Ola Maps from a commercial web app in India. Please confirm (i) whether Krutrim acts as a data processor for the personal data (IP, search text, coordinates) our users send, (ii) whether a data processing agreement is available, (iii) that free-tier use for a commercial service is permitted, (iv) how long request logs are retained and where processed."* Save the reply.
5. **Do you need a Pro/paid account to get a DPA? No.** No plan unlocks a separate DPA. Upgrade **only if** the free tier does not permit commercial use or the quota is insufficient; if you upgrade, redo steps 2–4 against the paid terms.
6. Data minimisation rule: send Ola coordinates and search text only — never names, phone numbers or order contents.

##### Provider 6 — Mailbox provider for `privacy@gorola.in` (Google Workspace or Zoho Mail)
1. **Google Workspace:** Admin console → *Account settings → Legal and compliance* → review and accept the **Data Processing Amendment** ⚠️; save a screenshot or PDF. **Zoho:** download Zoho's published DPA from its legal pages or request it from support ⚠️.
2. Save to `DPAs/Mail-Provider/`.

##### Provider 7 — GitHub Actions
- Nothing to collect: it receives code and secrets only, no personal data. Listed so the register is complete.

#### 8.7.3 — Create Private Team Compliance Folder
- Create private cloud storage directory: `GoRola Legal / DPDP Compliance` with subfolders:
  - `DPAs/` (one subfolder per provider: `Railway/`, `Vercel/`, `Razorpay/`, `Exotel/`, `Ola-Maps/`, `Mail-Provider/`)
  - `Consent-Records-Policy/`
  - `Data-Inventory/`
  - `Breach-Response-Plan/`
  - `Grievance-Log/`
  - `Age-Gate-Runbook/` (unlock and underage-report procedures, see 8.7.7)

#### 8.7.4 — Data Inventory Document (`data-inventory-v1.md`)
- Create `data-inventory-v1.md` in `Data-Inventory/` mapping every field:

| Data Field | Purpose | Retention | Storage Location | Shared With | Legal Basis |
|---|---|---|---|---|---|
| Phone number | Authentication & Contact | Account lifetime + 30d | PostgreSQL (Railway, US) | Exotel (India) | Consent (OTP_AUTH) |
| Full name | Order fulfillment | Account lifetime + 30d | PostgreSQL (Railway, US) | None | Consent (ORDER_PROCESSING) |
| Delivery Address | Order fulfillment | Account lifetime + 30d | PostgreSQL (Railway, US) | None | Consent (ORDER_PROCESSING) |
| Order History | Tax/GST Compliance | 7 Years (Indian GST / Companies Act statutory retention; the earlier "3 Years" contradicted the consent notices) | PostgreSQL (Railway, US) | Store Owners | Contractual Obligation |
| IP Address | Security & Anti-Fraud | 30 Days (Railway Pro built-in retention) | Railway logs (US) | None | Legitimate Security / DPDP Sec 12 |
| Age confirmation date (`User.ageConfirmedAt`) | Proof that the person confirmed they are an adult (Section 8.8) | Account lifetime + 30d | PostgreSQL (Railway) | None | Consent (AGE_DECLARATION) |
| Date of birth typed at sign-up | One-time age check | **Not stored.** Held in memory for the single request, then discarded; redacted from logs | None | None | Consent (AGE_DECLARATION) |
| Age-gate lockout (keyed one-way hash of the phone number only; no name, no DOB) | Stop repeat sign-up by someone who was refused | 90 days, then automatically deleted | PostgreSQL (Railway) | None | Protective purpose (child safety) — confirm with counsel (8.7.7) |
| Visitor IP and request metadata at the CDN | Delivering the website files | Vercel's own log retention (not controlled by GoRola) | Vercel edge | Vercel | Infrastructure provider; GoRola sends no personal data |
| Map requests (IP, search text, GPS coordinates) | Place search, geocoding, routes | Per Krutrim retention (ask support, 8.7.2 Provider 5) | Ola Maps (Krutrim) | Ola Maps | Consent (ORDER_PROCESSING) |

#### 8.7.5 — Data Breach Response Plan SOP (`dbrp-v1.md`)
- Create `dbrp-v1.md` in `Breach-Response-Plan/` defining 4-step protocol:
  1. Detect & Contain (0–2h): Rotate credentials, revoke compromised keys.
  2. Assess (2–6h): Identify affected records and data categories.
  3. Notify (within 72h): Notify Data Protection Board and affected users.
  4. Remediate & Document: Write incident report in `Grievance-Log/`.

#### 8.7.6 — Pre-emptive Payment-Provider Paperwork (Razorpay)
- Complete the Razorpay steps in 8.7.2 (save the accepted Merchant Agreement and Privacy Policy as dated PDFs, send Razorpay the DPDP role question, save the written reply) **before** turning on the `UPI_PAYMENT_ENABLED` feature flag. There is no "Settings → Legal → DPA" screen to click; that instruction was corrected on 2026-10-05.

#### 8.7.7 — Non-Code Prerequisites for the Age Gate (Section 8.8)

- [ ] **Runbook** `Age-Gate-Runbook/age-gate-runbook-v1.md`, owned by the Grievance Officer, covering three cases:
  1. **An adult was wrongly locked out** (typed a wrong date, or shared a device). The person emails `privacy@gorola.in` naming the phone number. The Officer **calls that number back**, asks the person to confirm they are an adult, and records the outcome in `Grievance-Log/` (**never ask for, or keep, ID documents or a date of birth**). An admin then opens **Admin → Age Gate**, looks up the number and clicks **Unlock this number** (approve) or **Decline appeal** (disapprove), writing a reason either way (screens in 8.8.14, endpoints in 8.8.8 / 8.8.14). The Officer then sends the matching reply template. Target: reply within 7 days (statutory ceiling 30 days).
  2. **Someone reports that a minor is using GoRola** (parent, rider, store, staff). Record the report. An admin opens **Admin → Age Gate**, looks up the number, optionally **Suspends** the account at once (freeze while checking), then clicks **Erase underage account** after the report is judged credible (8.8.14); reply to the reporter; log the outcome.
  - **Reply templates** (kept in `Age-Gate-Runbook/reply-templates.md`, written by the Officer and reviewed by counsel): (a) number unlocked, (b) appeal declined, (c) minor account erased, (d) "no lock found, your 24-hour device cooldown ends by itself", (e) request received, answer within 7 days. None of them may contain any age number other than 18.
  3. **A parent asks for a child's data to be deleted.** Treat as an erasure request under DPDP Section 12 using the same **Erase underage account** action (8.8.14).
- [ ] **Counsel review before launch** of: Privacy Policy section 7, the Terms eligibility clause, the `AGE_DECLARATION` notice text, the 90-day lockout retention and its legal basis, the decision not to store the date of birth, and whether the layered measures in 8.8.0 are adequate for a block-minors model.
- [ ] **Risk register entry** "A minor supplies a false age": likelihood medium, impact medium, mitigations = the layers in 8.8.0 section F, residual risk accepted in writing by the named owner with a date; review every 6 months and after any complaint.
- [ ] **Confirm configuration values** with the owner: `AGE_GATE_LOCKOUT_DAYS` (default 90) and `AGE_GATE_DEVICE_COOLDOWN_HOURS` (default 24).
- [ ] **Riders and store owners** are adults by their onboarding contract and the identity checks an Admin performs when creating their accounts; add "18 or over" to the onboarding checklist. They are outside the buyer age gate.

#### 8.7.8 — Consolidated Non-Code Action Checklist

| # | Action | Evidence to file | Done |
|---|---|---|---|
| 1 | Grievance Officer named and `privacy@gorola.in` live (8.7.1). **Note:** the Privacy Policy/8.7.1 use `privacy@gorola.in` while `ConsentNoticeModal` shows `dpo@gorola.com` — pick one; the code fix is in 8.8.11 | Officer designation memo | [ ] |
| 2 | Railway DPA executed; Railway region recorded | `DPAs/Railway/` | [ ] |
| 3 | Production `HMAC_SECRET` and `ENCRYPTION_KEY` set to strong, unique values in Railway (the code falls back to a built-in default when unset; the phone blind index and the age-gate lockout hash both depend on `HMAC_SECRET`) | Screenshot of variable names set (never the values) | [ ] |
| 4 | Vercel upgraded to **Pro** before the first real customer or payment; Analytics confirmed off | `DPAs/Vercel/` | [ ] |
| 5 | Razorpay: agreement + policy saved; DPDP role question sent and answered | `DPAs/Razorpay/` | [ ] |
| 6 | Exotel (or Fast2SMS): DPA requested after the vendor decision (8.9) | `DPAs/Exotel/` | [ ] |
| 7 | Ola Maps: terms saved; free-tier commercial-use and quota answers recorded; support reply saved | `DPAs/Ola-Maps/` | [ ] |
| 8 | Mailbox provider DPA accepted | `DPAs/Mail-Provider/` | [ ] |
| 9 | `data-inventory-v1.md` written including the rows added in 8.7.4 | `Data-Inventory/` | [ ] |
| 10 | `dbrp-v1.md` breach response plan written (8.7.5) | `Breach-Response-Plan/` | [ ] |
| 11 | Age-gate runbook, counsel review and risk-register entry (8.7.7) | `Age-Gate-Runbook/` | [ ] |

---

### 8.8 — Age Eligibility Gate (18+): Neutral DOB Check, Lockout & Server-Side Consent Writes

> **Type: Backend + Frontend + Policy copy (strict TDD). No dependency on any vendor decision.**
> **Why this section exists:** the Privacy Policy and Terms say GoRola is for people aged 18 and over, but **no code enforces it**. This section makes the statement true. Decision record: `decision_log.md` DECISION-062. Consent flow documentation: `DPDP Act/DPDP_CONSENT_ARCHITECTURE_GUIDE.md` section 15.
> **Not legal advice.** Have counsel review before launch (8.7.7).

---

#### 8.8.0 — Decision Record & Reasoning (read this first; no code in this item)

##### A. The problem we found
The Privacy Policy (section 7) and Terms of Service (eligibility) both state that users must be at least 18 and that GoRola "does not knowingly" process a minor's data. An investigation of the code found: no date-of-birth field, no age check on `send-otp` / `verify-otp`, no age column on `User`, no lockout. Anyone could sign up with just a phone number. A promise with no control behind it is a compliance weakness in itself.

##### B. Why 18 — and only 18
- **DPDP Act 2023, Section 2(f):** a "child" is a person **under 18**. Section 9 then requires verifiable parental consent before a child's personal data is processed, and forbids tracking, behavioural monitoring and targeted advertising directed at children. The Government may exempt specified classes of fiduciaries or purposes; none covering e-commerce has been notified as of 2026-10-05 ⚠️ (re-check at `dpdp.gov.in`).
- **Indian Majority Act 1875:** the age of majority is 18.
- **Indian Contract Act 1872, Section 11:** a person who is not of the age of majority cannot validly enter a contract; a contract with a minor is void. Every GoRola order (and every payment) is a contract, so even setting DPDP aside, the customer on an order must be an adult.
- **One threshold, no tiers.** Some other regimes use 13 or 16. India's DPDP Act does not, so adding tiers would only create inconsistency. **18 is the only age number anywhere in the product and in every document.** The user interface never shows any other age (enforced by an automated test, 8.8.11).

##### C. What the gate is, and is not
| It is | It is not |
|---|---|
| A **neutral date-of-birth screen** shown **once**, to **new phone numbers**, **after the OTP is verified** and **before the account exists** | A tick-box saying "I am 18+" (that shows the user which answer to give and is weak evidence) |
| A **server-side** check; the browser never decides eligibility | A client-side check that could be bypassed |
| A record that **someone confirmed they are an adult** (`ageConfirmedAt` + `AGE_DECLARATION` consent row) | A stored date of birth — **the DOB is never stored, logged, cached or put in analytics** |
| A one-strike **lockout** (hashed phone, 90 days) for anyone refused | Identity verification (we do not collect ID) |
| Layered, proportionate, documented measures | A guarantee that no minor can ever lie their way in (no self-declared gate can promise that) |

##### D. The flow and why the order matters
```
[1 Notice screen]  "GoRola is for people aged 18 and over" + OTP_AUTH read-acknowledgement
        |
[2 Phone]  POST send-otp ---- phone locked? ----> 403 AGE_GATE_LOCKED (no SMS is sent)
        |
[3 OTP]    POST verify-otp ---- OTP valid ---->
        |        |-- existing adult (ageConfirmedAt set) --> tokens, normal login
        |        |-- NEW phone  OR  legacy user without ageConfirmedAt
        |              --> 200 { ageGateRequired: true, ageTicket }  (NO account, NO tokens)
        |
[4 Date-of-birth screen]  3 numeric boxes (day / month / year), no hints about the cutoff
[5 "You entered 12 March 2010. Is this correct?"  [Yes] [Edit]]   <- stops typos locking out adults
        |
[6] POST confirm-age { ageTicket, dateOfBirth, acknowledgedNotice, consentVersion }
        |-- 18 or over --> ONE database transaction: create User (ageConfirmedAt set)
        |                  + ConsentLog OTP_AUTH + ConsentLog AGE_DECLARATION + AuditLog
        |                  --> tokens issued, user logged in. DOB discarded.
        |-- under 18  --> NO user created. AgeGateLockout(hash of phone, +90 days).
                           24-hour device cookie. Polite refusal screen. DOB discarded.
```
- **Why after the OTP, not before.** (1) The OTP proves the person controls the number, so the lockout key is reliable. (2) **Nobody can lock out someone else's number**: an attacker cannot type an under-18 date against a victim's phone without passing that phone's OTP. (3) Returning adults are never asked again. (4) No `User` row ever exists for a refused person.
- **Why the consent notice stays first.** DPDP Section 5 requires notice before processing; the acknowledgement of the `OTP_AUTH` notice happens before the phone number is typed. The server records it later, inside the same transaction as the account (8.8.5).
- **Why the date of birth is not stored.** After the yes/no answer nothing needs it. Data we do not hold cannot leak or be demanded. The audit trail keeps what matters: *"on <date> this person confirmed they are an adult under policy v1.1"*.
- **Why a one-extra-SMS cost is accepted.** The OTP must come first (reasons above). The only personal data a refused person leaves behind is a one-way keyed hash of their phone number for 90 days.

##### E. Why we are NOT building parental approval now
The DPDP Act lets a fiduciary process a child's data **if** it obtains *verifiable consent of the parent or lawful guardian*. We have chosen not to serve children at all, for these reasons:
1. **Verifying a parent is genuinely hard.** Rule 10 of the DPDP Rules 2025 ⚠️ expects due diligence that the consenting person is (a) an identifiable **adult** and (b) the child's **lawful guardian**. Acceptable inputs are details we already hold, details the person volunteers, or a **virtual token** issued by an authorised entity (DigiLocker-style). There is no cheap, perfect method. Proving the *relationship* (that this adult is this child's parent) is the weakest link in every available method.
2. **The infrastructure is not ready for a startup.** Direct DigiLocker-token integration generally requires approved-entity status; the alternative is a paid KYC vendor (per-check fees, contract, integration). The operating machinery is still being finalised and the Rules' main obligations only begin on 13 May 2027 ⚠️.
3. **More personal data, not less.** To verify a parent we would collect the parent's identity details — a new, sensitive category we must secure, retain, and delete. That is the opposite of data minimisation.
4. **Serving children triggers prohibitions that clash with our product.** Section 9 bans tracking and behavioural monitoring of children. Rider live-location tracking, delivery routing and telemetry would need separate, child-safe code paths and exemptions we do not have.
5. **The order would be the parent's contract anyway.** A minor cannot contract (Contract Act s.11), so a child's order would legally have to be the parent's. The natural model is already: **the parent holds the account and orders for the household.**
6. **Support and operations load.** Parent–child account linking, consent withdrawal, disputes, guardian-of-disabled-person cases (DPDP Rule 11), re-verification, and extra grievance handling.
7. **Risk versus reward.** Quick commerce in Mussoorie is not a child-directed product. The penalty ceiling for children's-data failures is up to **₹200 crore**. Not processing children's data removes that risk class far more cheaply than managing it.

**Complications a future parental-consent build must solve (so nobody underestimates it):** how to prove adulthood; how to prove guardianship; where to store and for how long the parent's verification data; how a parent withdraws consent and what happens to the child's account; handling guardians of persons with disabilities; handling a child who turns 18 (migrate to a normal adult account); separating tracking/analytics for child accounts; vendor cost per verification; abandonment at checkout; fraud (an older sibling posing as a parent).

**Revisit triggers — build a "Verified Parental Consent" phase (call it 8.10) only if one occurs:** (1) the business decides to serve under-18 customers; (2) the DPDP Rules' operational guidance and virtual-token providers become practical for private companies; (3) counsel advises that block-and-erase is not adequate; (4) a product line aimed at minors is introduced; (5) grievances show minors are a meaningful part of real usage.

##### F. Why this is still defensible when a minor enters a false age
The law asks for **appropriate, reasonable and proportionate** measures, not impossible certainty. A fiduciary is not an insurer against deliberate lies. GoRola's layered measures, each recorded and testable:
| Layer | What it does | Evidence it leaves |
|---|---|---|
| 1. Clear notice | The first screen and the policies say GoRola is for people aged 18 and over | `OTP_AUTH` consent row + policy versions |
| 2. Neutral DOB entry | No tick-box, no hint of the cutoff, no limited year list | Test that the screen contains no cutoff hints |
| 3. Confirmation step | "You entered 12 March 2010. Is this correct?" prevents accidental lockouts and shows a deliberate entry | Frontend test |
| 4. Server-side decision, one strike | A refused person cannot guess dates to find the cutoff | `AgeGateLockout` + audit entry |
| 5. Device cooling-off (24 h) | Stops instant retry with another number on the same browser | Cookie test |
| 6. Abuse alert | 5 refusals from one IP in 24 h raises a security alert | `AGE_GATE_ABUSE` log entry |
| 7. Warranty in the Terms | The user represents that they are 18 or over | Terms version |
| 8. Erase-on-discovery | A report from a parent, rider or store leads to immediate erasure and a lockout | `USER_ERASED_UNDERAGE` audit entry |
| 9. Grievance route | `privacy@gorola.in`, 30-day ceiling | Grievance log |
| 10. Written risk acceptance + counsel review | Residual risk is known and owned | Risk register (8.7.7) |
**Residual risk we accept in writing:** a determined minor can type a false date, or use an adult's phone number. We do **not** claim otherwise to users or regulators. We claim: *"we took reasonable, documented measures, and we act promptly when we learn of a minor."*

##### G. Constants and configuration
| Name | Value | Where |
|---|---|---|
| `MINIMUM_AGE_YEARS` | `18` | `packages/shared/src/age-gate.ts` |
| `CURRENT_PRIVACY_POLICY_VERSION` | `"1.1"` (was `"1.0"`; every existing user sees the re-consent banner once) | `packages/shared` (web and API both import it) |
| `AGE_GATE_LOCKOUT_DAYS` | `90` | API env (default 90) |
| `AGE_GATE_DEVICE_COOLDOWN_HOURS` | `24` | API env (default 24) |
| Age ticket lifetime | `600` seconds, single use | constant in `age-gate.service.ts` |
| Abuse alert threshold | `5` refusals per IP per 24 h (alert only; never blocks) | constant |
| Date source for "today" | calendar date in **Asia/Kolkata** | `age.util.ts` |

##### H. API contract (exact)
| Endpoint | Request | Success | Failures |
|---|---|---|---|
| `POST /api/v1/auth/buyer/send-otp` | `{ phone }` (unchanged) | `200 { sent: true }` | `403 AGE_GATE_LOCKED` when the phone has an active lockout (no SMS is sent) |
| `POST /api/v1/auth/buyer/verify-otp` | `{ otp, phone }` (unchanged) | Existing adult: unchanged tokens. **New phone or legacy user without `ageConfirmedAt`: `200 { ageGateRequired: true, ageTicket }` — no tokens, no cookie, no `User` row created** | unchanged |
| `POST /api/v1/auth/buyer/confirm-age` | `{ ageTicket, dateOfBirth: "YYYY-MM-DD", acknowledgedNotice: true, consentVersion: "1.1" }` | `200` same shape as verify-otp success, refresh cookie set | `400 VALIDATION_ERROR` bad date/payload (ticket stays usable); `401 AGE_TICKET_INVALID` missing/expired/used ticket; `403 AGE_REQUIREMENT_NOT_MET` under 18; `403 AGE_GATE_LOCKED` device cooling-off; `409 CONFLICT` account appeared meanwhile |
| `POST /api/v1/auth/buyer/refresh` | unchanged | unchanged | `403 AGE_CONFIRMATION_REQUIRED` when the user has no `ageConfirmedAt` |
| `POST /api/v1/admin/age-gate/unlock` | `{ phone, reason (≥10 chars) }` (ADMIN only) | `200 { cleared: true }` | `401/403` auth, `400` validation, `404` no active lockout |
| `POST /api/v1/admin/users/:id/erase-underage` | `{ reason (≥10 chars) }` (ADMIN only) | `200 { erased: true }` | `401/403`, `400`, `404`, `409 ALREADY_ERASED` |

##### I. Exact user-facing copy (the only age number is 18)
| Place | Copy |
|---|---|
| First notice screen (added line) | "GoRola is for people aged 18 and over." |
| DOB screen (also the stored `AGE_DECLARATION` v1.1 notice text) | "GoRola is available only to people aged 18 and over. You confirm that the date of birth you enter is correct. We use it once to check eligibility and do not store it; we keep only the date on which you confirmed. If you are under 18, we cannot create an account for you." |
| DOB validation error | "Please enter a valid date of birth." |
| Confirm screen | "You entered 12 March 2010. Is this correct?" with **Yes, continue** / **Edit** |
| Refusal screen (`AGE_REQUIREMENT_NOT_MET` and `AGE_GATE_LOCKED`) | Heading "We can't create your account". Body "GoRola is available only to people aged 18 and over. If you think this is a mistake, write to privacy@gorola.in." |
| Expired ticket | "Your session expired. Please enter your phone number again." |

##### J. Out of scope for 8.8 (explicit, so nothing is assumed)
Parental consent (see E); rider/store-owner/admin age checks (handled by onboarding, 8.7.7); automated e-mails to or from the grievance mailbox (the Grievance Officer writes every reply by hand from a template; the dashboard in 8.8.14 only records the decision and does not send mail); a permanent ban list for adults (a lock always ends after `AGE_GATE_LOCKOUT_DAYS`); a stored appeals queue (the mailbox plus `Grievance-Log/` is the queue); ID-document or DigiLocker verification; any age number other than 18.

---

#### 8.8.1 — Schema, Migration & Seeded Consent Purpose

**Root cause / Goal:**
There is nowhere to record that a person confirmed they are an adult, and nowhere to record a refusal. `ConsentLog` cannot hold a refusal: its `userId` is mandatory (a refused person has no `User`) and it is deleted with the user (`onDelete: Cascade`). `ConsentLog.purpose` is a foreign key to `ConsentPurposeConfig`, so `AGE_DECLARATION` must exist as a configured purpose.

**Approach:**
Add two nullable columns to `User`, one new table `AgeGateLockout` with no relation to `User`, and one seeded `ConsentPurposeConfig` row inserted by the migration itself (production may never run the seed script).

---

- [x] **RED — Integration (`apps/api/src/__tests__/integration/age-gate/age-gate.schema.test.ts`):**
  - [x] Test: `db.user.create({ data: { ..., ageConfirmedAt: new Date(), ageConfirmedPolicyVersion: "1.1" } })` succeeds and reads back both values.
  - [x] Test: `db.ageGateLockout.create({ data: { phoneHash: "h1", lockedUntil } })` succeeds; a second create with `phoneHash: "h1"` rejects with Prisma error code `P2002` (unique).
  - [x] Test: `SELECT * FROM "ConsentPurposeConfig" WHERE key = 'AGE_DECLARATION'` returns exactly 1 row with `isEssential = true`.
  - [x] Test: `db.consentLog.create` with `purpose: "AGE_DECLARATION"` succeeds for an existing user.
  - [x] Test: deleting the `User` row does **not** delete an `AgeGateLockout` row (no relation).
  - [x] **Run — confirm RED (columns, table and purpose do not exist).**

- [x] **GREEN — Backend (Schema → Migration → Seed):**
  - [x] [Schema] In `schema.prisma` add to `User`: `ageConfirmedAt DateTime?` and `ageConfirmedPolicyVersion String?`.
  - [x] [Schema] Add model: `model AgeGateLockout { id String @id @default(cuid()); phoneHash String @unique; lockedUntil DateTime; strikeCount Int @default(1); createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; @@index([lockedUntil]) }` (written one field per line in the real file).
  - [x] [Migration] Run `pnpm --filter @gorola/api exec prisma migrate dev --name add_age_gate_lockout_and_age_confirmation` with the `DIRECT_URL` / `db_owner` role. **Edit the generated SQL** to append: `INSERT INTO "ConsentPurposeConfig" ("key", "displayName", "description", "isEssential", "retentionSummary", "createdAt", "updatedAt") VALUES ('AGE_DECLARATION', 'Age Confirmation', 'Confirmation that you are 18 or over. Your date of birth is used once and never stored.', true, 'The date you confirmed is kept for the life of your account. Your date of birth is never stored.', NOW(), NOW()) ON CONFLICT ("key") DO NOTHING;` (confirm the exact column names against the existing `20261001200359_replace_consent_purpose_enum_with_config_table` migration).
  - [x] [Seed] Add the same row to the `ConsentPurposeConfig` upserts in `apps/api/prisma/seed.ts` and `seed-e2e.ts`.
  - [x] [Apply] Deploy to `gorola_dev` and `gorola_test` via `pnpm --filter @gorola/api prisma:bootstrap:test` **before** any other work (Mandatory Rules for Schema Changes).
  - [x] Run the integration test — **confirm GREEN**. Then run ALL suites (unit, integration, E2E bootstrap, `pnpm typecheck`, `pnpm lint`) — **confirm GREEN** (no existing code reads the new columns yet).

- [x] **RED / GREEN — Unit / Component:** N/A — schema-only item; no frontend or pure logic. Coverage for the new columns arrives in 8.8.2–8.8.10.

- [x] **Verification chain:**
  - [x] Developer runs migrations → `User` has the two nullable columns, `AgeGateLockout` exists with a unique `phoneHash`, and the `AGE_DECLARATION` purpose is present in a fresh database **without running the seed** → ✅ Done.

---

#### 8.8.2 — Shared Constants, Notice Texts & Age Calculation (pure logic)

**Root cause / Goal:**
The age rule must be implemented exactly once, correctly (time zone, leap years, invalid dates), and the notice texts must have a single source of truth so the text the user sees is byte-identical to the text the server stores as proof. Today the `OTP_AUTH` notice text lives only inside `LoginPage.tsx` and is sent *by the browser*, so the record cannot be trusted.

**Approach:**
Create `packages/shared/src/age-gate.ts` (`MINIMUM_AGE_YEARS = 18`), `packages/shared/src/consent-notices.ts` (canonical `OTP_AUTH` v1.1 and `AGE_DECLARATION` v1.1 texts, keyed by version), `CURRENT_PRIVACY_POLICY_VERSION = "1.1"`. Create `apps/api/src/modules/age-gate/age.util.ts` exporting `evaluateDateOfBirth(dobIso, now)`.

**The rule (no ambiguity):** let `today` be the calendar date in **Asia/Kolkata** as `YYYY-MM-DD`. Let `cutoff` be `(todayYear − 18)-(todayMonth)-(todayDay)` as a *string*. The person is an adult **if and only if** `dob <= cutoff` compared as strings. This automatically treats someone born on 29 February as turning 18 on 1 March in non-leap years (the conservative reading). A date is *valid* only if it matches `^\d{4}-\d{2}-\d{2}$`, is a real calendar date, has year ≥ 1900, and is not after `today`.

---

- [x] **RED — Unit (`apps/api/src/__tests__/unit/age-gate/age.util.test.ts`)** (use fixed `now` values; no real clock):
  - [x] Test: `now = 2026-10-05T10:00:00+05:30`: dob `2008-10-05` → `{ valid: true, isAdult: true }` (18th birthday today); `2008-10-06` → `isAdult: false`; `2008-10-04` → `isAdult: true`.
  - [x] Test (time zone): `now = 2026-10-04T19:00:00Z` (= 5 Oct 00:30 IST): dob `2008-10-05` → adult. `now = 2026-10-05T19:00:00Z` (= 6 Oct 00:30 IST): dob `2008-10-06` → adult although UTC date is still 5 Oct.
  - [x] Test (leap): dob `2008-02-29`: `now = 2026-02-28` → not adult; `now = 2026-03-01` → adult. `now = 2028-02-29`: dob `2010-02-28` → adult, dob `2010-03-01` → not adult.
  - [x] Test (invalid → `{ valid: false }`): `"2010-02-30"`, `"2010-13-01"`, `"2010-2-5"`, `"abcd"`, `""`, `"   "`, `"1899-12-31"`, a future date `"2026-10-06"` with `now` of 5 Oct 2026, `"2010-01-01T00:00:00Z"`, and the injection string `"2010-01-01'; DROP TABLE \"User\";--"`.
  - [x] Test: the function never throws for any input including `undefined as unknown as string`, numbers and objects (returns `{ valid: false }`).
  - [x] Test: the returned object contains **only** `valid` and `isAdult` (never echoes the date).
  - [x] **Run — confirm RED (file does not exist).**

- [x] **GREEN — Backend / Shared:**
  - [x] [Shared] Create `packages/shared/src/age-gate.ts`, `packages/shared/src/consent-notices.ts`, export from the package index; add `CURRENT_PRIVACY_POLICY_VERSION = "1.1"`. Rebuild the shared package.
  - [x] [Notice text] `OTP_AUTH` v1.1 = the existing `CONSENT_NOTICE_TEXT` from `LoginPage.tsx`, moved verbatim, plus the sentence "GoRola is for people aged 18 and over." `AGE_DECLARATION` v1.1 = the exact DOB-screen text in 8.8.0 section I.
  - [x] [Util] Create `apps/api/src/modules/age-gate/age.util.ts` implementing the rule above using `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })`.
  - [x] Run unit test — **confirm GREEN**.

- [x] **RED / GREEN — Integration & Frontend:** N/A for this item — pure functions and constants; HTTP-level proof arrives in 8.8.4–8.8.7 and component-level proof in 8.8.10–8.8.11.

- [x] **Verification chain:**
  - [x] A date of birth is supplied to `evaluateDateOfBirth` at 00:30 IST on someone's 18th birthday → the answer is "adult" → on the day before it is "not adult" → ✅ Done.

---

#### 8.8.3 — Lockout Repository, Service & Device Cookie

**Root cause / Goal:**
A refused person must not be able to retry immediately with a corrected date, and we must not keep their phone number or date of birth to achieve that.

**Approach:**
Create module `apps/api/src/modules/age-gate/` with `age-gate.repository.ts` (Prisma only), `age-gate.service.ts` (rules), `age-gate-cookie.ts`. The lockout key is `hashPII(phone)` from `apps/api/src/lib/crypto.ts` (HMAC-SHA256 with `HMAC_SECRET`, the same blind-index function already used for `User.phoneHash`). Raw phone numbers are never passed to the repository.

---

- [x] **RED — Integration (`age-gate.repository.test.ts`, real test DB):**
  - [x] Test: `upsertLock(hash, lockedUntil)` creates a row with `strikeCount = 1`; calling it again for the same hash sets `strikeCount = 2` and the new `lockedUntil`, still exactly 1 row.
  - [x] Test: `findActiveByPhoneHash(hash, now)` returns the row when `lockedUntil > now` and `null` when `lockedUntil <= now`.
  - [x] Test: `deleteByPhoneHash(hash)` returns `1` for an existing row and `0` otherwise; `deleteExpired(now)` deletes only rows with `lockedUntil <= now` and returns the count.
  - [x] Test (privacy): after locking phone `+919876543210`, `SELECT row_to_json(t)::text FROM "AgeGateLockout" t` does not contain `9876543210`.
  - [x] **Run — confirm RED.**

- [x] **RED — Unit (`age-gate.service.test.ts`, repository mocked; `age-gate-cookie.test.ts`):**
  - [x] Test: `lockPhone("+919876543210", now)` calls the repository with `phoneHash === hashPII("+919876543210")` and `lockedUntil === now + 90 days` (default) — and the repository mock is **never** called with the raw phone.
  - [x] Test: with `AGE_GATE_LOCKOUT_DAYS=30` the expiry is `now + 30 days`; an invalid value (`"abc"`, `"0"`, `"-5"`) falls back to 90.
  - [x] Test: `isPhoneLocked` returns `true` only when the repository returns an active row.
  - [x] Test: phone input `"+91'; DROP TABLE \"User\";--"` is hashed and passed on without throwing.
  - [x] Test (cookie): `signDeviceCookie(now)` → `verifyDeviceCookie(value, now)` is `true`; a changed character → `false`; `now + 24h + 1s` → `false`; `""`, `"garbage"`, `"123.abc"` → `false`; verification uses `crypto.timingSafeEqual`.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend (Repository → Service → Cookie util):**
  - [x] [Repository] Implement `upsertLock`, `findActiveByPhoneHash`, `deleteByPhoneHash`, `deleteExpired`.
  - [x] [Service] Implement `isPhoneLocked(phone, now)`, `lockPhone(phone, now)`, `unlockPhone(phone)`; read `AGE_GATE_LOCKOUT_DAYS` / `AGE_GATE_DEVICE_COOLDOWN_HOURS` from the validated env config (add both to the env schema with defaults 90 / 24).
  - [x] [Cookie] `age-gate-cookie.ts`: value `"<expiryEpochSeconds>.<hmacHex>"`, HMAC over `"ag:<expiry>"` with the same secret; expiry = now + cooldown hours.
  - [x] Run integration + unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] A phone is locked → the database holds only a hash, an expiry and a strike count → `isPhoneLocked` answers `true` until the expiry passes → ✅ Done.

---

#### 8.8.4 — `send-otp` Lockout Check & `verify-otp` Age Ticket (no account creation without the gate)

**Root cause / Goal:**
`AuthService.verifyOtp` currently calls `ensureBuyerUser(phone)`, which creates the `User` the moment the OTP is correct. There is no point at which age can be asked, and a locked-out phone can keep requesting OTPs.

**Approach:**
`send-otp` first asks `AgeGateService.isPhoneLocked`; if locked it throws `AppError("...", { code: "AGE_GATE_LOCKED", statusCode: 403 })` **before** any OTP is generated or sent. `verifyOtp` stops creating users: it calls a new dependency `findBuyerByPhone(phone)` (looks up by `phoneHash`, **including soft-deleted users**). If the user exists **and** `ageConfirmedAt` is set → unchanged login. Otherwise (new phone, or legacy user without `ageConfirmedAt`) → it deletes the OTP key, creates a single-use **age ticket** and returns `{ ageGateRequired: true, ageTicket }` with no tokens and no cookie. Ticket: `crypto.randomBytes(32).toString("hex")` (64 hex characters); stored in Redis at `age_ticket:<sha256(ticket)>` with value `{ phone, existingUserId | null, ip, createdAt }`, TTL 600 seconds; the plain ticket is never stored.

---

- [x] **RED — Integration (`apps/api/src/__tests__/integration/auth/auth.age-gate.integration.test.ts`):**
  - [x] Test: new phone `send-otp` → `verify-otp` returns HTTP 200 with `data.ageGateRequired === true` and `data.ageTicket` matching `/^[a-f0-9]{64}$/`; the body has **no** `accessToken`, `refreshToken` or `userId`; there is **no** `Set-Cookie: refreshToken`; `db.user.count({ where: { phoneHash } })` is `0`.
  - [x] Test: existing user with `ageConfirmedAt` set → `verify-otp` returns tokens exactly as before (`accessToken`, `refreshToken`, `userId`), and `data.ageGateRequired` is absent or `false`.
  - [x] Test: existing legacy user (`ageConfirmedAt = null`) → `verify-otp` returns `ageGateRequired: true`, no tokens; the `User` row is unchanged.
  - [x] Test: Redis key `age_ticket:<sha256 of the returned ticket>` exists with TTL between 1 and 600; its JSON value contains `phone` and `createdAt` and does **not** contain the key `dateOfBirth`; no Redis key equals the plain ticket.
  - [x] Test: after `verify-otp`, the `otp:<phone>` Redis key is gone, so repeating the same `verify-otp` returns 401 `OTP not found`.
  - [x] Test: with an active `AgeGateLockout` for the phone, `send-otp` returns HTTP 403 `error.code === "AGE_GATE_LOCKED"`, the OTP provider's `sendOtp` is called **zero** times, and no `otp:<phone>` key exists.
  - [x] Test: with a lockout whose `lockedUntil` is in the past, `send-otp` returns 200.
  - [x] Test: wrong-OTP, expired-OTP and 3-attempt lockout behaviours are unchanged (existing tests stay green).
  - [x] **Run — confirm RED (today a User is created and tokens are returned for a new phone).**

- [x] **RED — Unit (`auth.service.test.ts`, extended):**
  - [x] Test: when `findBuyerByPhone` returns `null`, `verifyOtp` returns `{ ageGateRequired: true, ageTicket }` and `tokenService.issueTokens` is called **zero** times.
  - [x] Test: `AuthServiceDependencies` no longer contains `ensureBuyerUser` (compile-time) and `auth.service.ts` source text contains neither `ensureBuyerUser` nor `ensureBuyerByPhone` (a small guard test reading the file).
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend (Types → Repository → Service → Controller → Wiring):**
  - [x] [Types] In `auth.types.ts` add `AgeTicketRecord`, `BuyerVerifyResult = BuyerVerifySuccess | { ageGateRequired: true; ageTicket: string }`; in `auth.service.ts` add `ageConfirmedAt?: Date | null` to `BuyerUserLookup`.
  - [x] [Repository] In `UserRepository` add `findByPhoneForAuth(phone)` (by `phoneHash`, includes soft-deleted).
  - [x] [Service] Replace `ensureBuyerUser` with `findBuyerByPhone` + inject `AgeGateService` and the clock; add `issueAgeTicket`; implement the logic above. Extract the token/session part of `verifyOtp` into a private `completeLogin(user, context)` (reused by 8.8.5).
  - [x] [Controller] In `auth.controller.ts` `send-otp`: check the lock first. `verify-otp`: if the result has `ageGateRequired`, return `success(request, reply, { ageGateRequired: true, ageTicket })` and **do not** set the refresh cookie.
  - [x] [Wiring] In `routes.ts` replace the `ensureBuyerUser` dependency with `findBuyerByPhone` and pass `AgeGateService`.
  - [x] [Guard] Add a code comment on `UserRepository.ensureBuyerByPhone`: "Seeds and test helpers only — never call from an authentication path."
  - [x] Run integration + unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] A new phone enters a valid OTP → the API answers "age check required" with a one-time ticket and creates nothing → a previously refused phone cannot even receive an OTP → ✅ Done.

---

#### 8.8.5 — `confirm-age`: the Adult Path (atomic account + server-side consent)

**Root cause / Goal:**
We need one endpoint that turns a verified ticket plus a date of birth into either an account or a refusal. For adults it must create the user and the consent evidence **atomically**, replacing the browser's fire-and-forget `OTP_AUTH` consent call (`LoginPage.tsx` lines ~233–240), which swallows failures and sends a client-supplied notice text.

**Approach:**
`POST /api/v1/auth/buyer/confirm-age`. Order of operations in `AuthService.confirmAge` (this order is mandatory):
1. Look up the ticket (`GET` the Redis key). Missing → `401 AGE_TICKET_INVALID`.
2. If the device cooldown cookie is valid → `403 AGE_GATE_LOCKED` (ticket untouched).
3. `evaluateDateOfBirth(dateOfBirth, now)`. Invalid → `400 VALIDATION_ERROR` (**ticket stays usable**).
4. Consume the ticket with `redis.del(key)`; if it deletes `0` keys another request won → `401 AGE_TICKET_INVALID` (this makes double-submits and races safe).
5. Adult branch: `AgeGateRepository.createAdultBuyerWithConsents(...)` runs **one Prisma transaction** creating the `User` (`phone`, `phoneHash`, `name: ""`, `isVerified: true`, `ageConfirmedAt: now`, `ageConfirmedPolicyVersion: "1.1"`, `privacyPolicyVersionAccepted: "1.1"`), two `ConsentLog` rows (`OTP_AUTH` and `AGE_DECLARATION`, both `consentVersion "1.1"`, `noticeText` = the **server's canonical text**, `ipAddress`, `userAgent`) and one `AuditLog` row (`AGE_CONFIRMED`).
6. `completeLogin` issues tokens and records the session. The date of birth is dropped here and never written anywhere.
Request validation (Zod in `auth.schema.ts`): `ageTicket` matches `/^[a-f0-9]{64}$/`; `dateOfBirth` is a string; `acknowledgedNotice` is the literal `true`; `consentVersion` is the literal `CURRENT_PRIVACY_POLICY_VERSION`.

---

- [x] **RED — Integration (`apps/api/src/__tests__/integration/auth/auth.confirm-age.integration.test.ts`):**
  - [x] Test: valid ticket + `{ dateOfBirth: "1990-05-14", acknowledgedNotice: true, consentVersion: "1.1" }` → HTTP 200; `data.accessToken` and `data.userId` are strings; `data.privacyPolicyVersionAccepted === "1.1"`; `Set-Cookie` contains `refreshToken`.
  - [x] Test: DB — exactly 1 `User` for the `phoneHash`; `ageConfirmedAt` within 5 seconds of now; `ageConfirmedPolicyVersion === "1.1"`; `isVerified === true`; `privacyPolicyVersionAccepted === "1.1"`.
  - [x] Test: DB — exactly 2 `ConsentLog` rows for the user, purposes `OTP_AUTH` and `AGE_DECLARATION`, `consentVersion === "1.1"`, `noticeText` strictly equal to the canonical strings from `@gorola/shared`, `ipAddress` not null. (Send a deliberately different `noticeText` in the body — it must be ignored.)
  - [x] Test: DB — exactly 1 `AuditLog` with `action = "AGE_CONFIRMED"`, `actorRole = "BUYER"`, `newValue` having no key matching `/birth|dob/i`.
  - [x] Test (DOB never persists): `JSON.stringify` of the `User` row, all `ConsentLog` rows and all `AuditLog` rows for the user does **not** contain `"1990-05-14"` or `"1990"`; scanning every Redis key and value does not contain it; the captured logger output (`getLogger` test stream) contains neither `"1990-05-14"` nor the ticket value.
  - [x] Test: sending the same request again → HTTP 401 `AGE_TICKET_INVALID`; still exactly 1 `User`.
  - [x] Test (race): two simultaneous requests with one ticket → exactly one 200 and one 401; exactly 1 `User`.
  - [x] Test: invalid payloads → HTTP 400 `VALIDATION_ERROR` **and the same ticket then succeeds** with a valid body: `"2010-02-30"`, a future date, `"1899-01-01"`, `"not-a-date"`, a missing `dateOfBirth`, `dateOfBirth: 19900514` (number), and `"1990-05-14'; DROP TABLE \"User\";--"`.
  - [x] Test: `acknowledgedNotice` missing or `false` → 400; `consentVersion: "9.9"` → 400; in both cases no `User` is created and the ticket still works.
  - [x] Test: ticket missing, `"x"`, or 64 random hex characters → HTTP 401 `AGE_TICKET_INVALID`.
  - [x] Test (atomicity): force the `AGE_DECLARATION` insert to fail (spy on the repository) → HTTP 500; `User` count 0, `ConsentLog` count 0 and no `AGE_CONFIRMED` audit row for that phone (all-or-nothing).
  - [x] Test (conflict): a `User` for that phone appears between ticket and confirm → HTTP 409 `CONFLICT`, no duplicate.
  - [x] **Run — confirm RED (endpoint does not exist).**

- [x] **RED — Unit (`auth.service.confirm-age.test.ts`, all dependencies mocked):**
  - [x] Test: adult DOB → `createAdultBuyerWithConsents` called exactly once; `lockPhone` zero times; tokens issued once.
  - [x] Test: invalid DOB → `redis.del`, the repository and `lockPhone` are never called.
  - [x] Test: `redis.del` returns `0` → `AGE_TICKET_INVALID`, repository never called.
  - [x] Test: the version stored equals `CURRENT_PRIVACY_POLICY_VERSION` from shared.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend (Schema → Repository → Service → Controller → Logger):**
  - [x] [Schema] `confirmAgeSchema` + `parseConfirmAgeInput` in `auth.schema.ts`.
  - [x] [Repository] `AgeGateRepository.createAdultBuyerWithConsents` (single `$transaction`; the repository contains no business `if/else`).
  - [x] [Service] `AuthService.confirmAge` in the exact order above; reuse `completeLogin`.
  - [x] [Controller] Register `POST /api/v1/auth/buyer/confirm-age`; set the refresh cookie with `refreshCookieOptions()`; response envelope identical to `verify-otp` success plus `ageGateRequired: false`.
  - [x] [Logger] Add `dateOfBirth`, `*.dateOfBirth`, `body.dateOfBirth`, `req.body.dateOfBirth`, `ageTicket`, `*.ageTicket`, `body.ageTicket`, `req.body.ageTicket` to `REDACT_PATHS` in `apps/api/src/lib/logger.ts`.
  - [x] [Coverage] Auth module coverage must stay at 100% (project rule).
  - [x] Run integration + unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] Adult enters OTP → enters 14 May 1990 → confirms → one transaction creates the account and both consent rows → user is logged in → a database dump contains no date of birth anywhere → ✅ Done.

---

#### 8.8.6 — `confirm-age`: the Under-18 Path (refusal, lockout, cooling-off, abuse alert)

**Root cause / Goal:**
A refusal must create no account, leave no date of birth, make an immediate retry impossible, and reveal nothing that helps someone find the cutoff.

**Approach:**
In the same `confirmAge` flow, after the ticket is consumed, a valid date that is not an adult → `AgeGateService.lockPhone(phone)`; write one `AuditLog` (`action "AGE_GATE_LOCKOUT_CREATED"`, `actorId "anonymous"`, `actorRole SYSTEM`, `entityType "AgeGateLockout"`, `entityId` = lockout id, `newValue { lockedUntil, strikeCount }` only); set cookie `gorola_ag` (HttpOnly, same attributes as `refreshCookieOptions()`, `maxAge = 24 h`); increment Redis counter `age_gate:refusals:<ip>` (24 h TTL) and, **when it reaches exactly 5**, call `logSecurityAlert` with `alertType "AGE_GATE_ABUSE"` (alert only — never blocks, because mobile networks share IP addresses); throw `AppError` `AGE_REQUIREMENT_NOT_MET`, HTTP 403, message "We can't create an account for you. GoRola is available only to people aged 18 and over." The refusal message is identical whatever the entered date (no cutoff leak). Add `AGE_REQUIREMENT_NOT_MET` and `AGE_GATE_LOCKED` to the shared error-code list if one exists.

---

- [x] **RED — Integration (`auth.confirm-age.minor.integration.test.ts`):**
  - [x] Test: ticket + `dateOfBirth: "2012-03-10"` → HTTP 403 `error.code === "AGE_REQUIREMENT_NOT_MET"`; body has no tokens; `Set-Cookie` includes `gorola_ag` with `HttpOnly` and `Max-Age=86400`.
  - [x] Test: DB — `User` count for the phone is `0`; exactly 1 `AgeGateLockout` with `phoneHash === hashPII(phone)`, `lockedUntil` within 1 minute of now + 90 days, `strikeCount === 1`; its row JSON contains neither the phone digits nor `2012`.
  - [x] Test: DB — exactly 1 `AuditLog` `AGE_GATE_LOCKOUT_CREATED`, `actorRole SYSTEM`, `newValue` keys exactly `lockedUntil` and `strikeCount`; zero `ConsentLog` rows were created.
  - [x] Test: replaying the same ticket → HTTP 401 `AGE_TICKET_INVALID`.
  - [x] Test: afterwards `send-otp` for that phone → HTTP 403 `AGE_GATE_LOCKED`; OTP provider `sendOtp` called zero times.
  - [x] Test (cooling-off): with the `gorola_ag` cookie, a *different* phone completes OTP and `confirm-age` with an **adult** DOB → HTTP 403 `AGE_GATE_LOCKED`, no user created; with an expired or tampered cookie the same flow → HTTP 200.
  - [x] Test (boundary, with a controllable clock): at `now = 2026-10-05 IST`, dob `2008-10-06` → 403 refusal; dob `2008-10-05` → 200 account.
  - [x] Test (strikes): an expired lockout row followed by a new refusal → `strikeCount === 2` and a new `lockedUntil`, still 1 row.
  - [x] Test (abuse alert): 5 refusals from one IP within 24 h → the captured log stream contains exactly one entry with `alertType "AGE_GATE_ABUSE"`; the 6th request is still processed normally.
  - [x] Test (no cutoff leak): refusal bodies for dob `2008-10-06` and `2012-01-01` are identical except `meta.requestId`.
  - [x] **Run — confirm RED.**

- [x] **RED — Unit (`age-gate.service.test.ts`, extended):**
  - [x] Test: `recordRefusal(ip)` raises the alert exactly when the counter value is `5`; not at `4` and not at `6`.
  - [x] Test: audit payload built for a refusal contains no phone, hash or date.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend (Repository → Service → Controller):**
  - [x] [Repository/Service] Implement the minor branch of `confirmAge` as described; extend `RedisLikeClient` if `incr`/`expire` are not available.
  - [x] [Types] Add `"AGE_GATE_ABUSE"` to the `alertType` union of `SecurityAlertPayload` in `apps/api/src/lib/logger.ts` (today it allows only `FAILED_AUTH_BURST`, `RATE_LIMIT_BURST`, `SUSPICIOUS_ACCESS`, `ANOMALOUS_REVOCATION`). This alert is written to the log only; no e-mail or push is sent. Admins see the volume on the **Age Gate** screen (8.8.14).
  - [x] [Controller] Map the `AppError`s; set the `gorola_ag` cookie on the refusal response only; check the cookie in `confirm-age` step 2.
  - [x] Run integration + unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] A person enters a date that makes them under 18 → sees the refusal screen → nothing but a hashed phone and an expiry is stored → trying again with the same number (even with a corrected date) is blocked before any SMS is sent → ✅ Done.

---

#### 8.8.7 — Existing Users Without `ageConfirmedAt` (legacy gate, refresh gate, underage purge)

**Root cause / Goal:**
Users created before this section have `ageConfirmedAt = null`. They must pass the same gate once. The product is pre-launch, so these are development/staging/test users, but the code must not leave a bypass. A legacy user found to be under 18 must **not** be restorable through the 30-day deletion grace period.

**Approach:**
`verify-otp` already issues a ticket for a legacy user (8.8.4) with `existingUserId` set. In `confirmAge`: adult → update `User.ageConfirmedAt`, `ageConfirmedPolicyVersion`, and write **one** `AGE_DECLARATION` consent row (no new user, no extra `OTP_AUTH` row) and an `AGE_CONFIRMED` audit row, then `completeLogin` (the response keeps `isPendingDeletion` / `deletionScheduledFor` so the reactivation screen still appears). Under 18 → compute the phone hash **first**, revoke all the user's tokens, run the existing `permanentPurgeAndAnonymize` **immediately** (skipping the 30-day grace), then create the lockout. `AuthService.refreshToken` rejects a user with `ageConfirmedAt == null` with `403 AGE_CONFIRMATION_REQUIRED`, which forces a fresh OTP login and therefore the gate.

---

- [x] **RED — Integration (`auth.confirm-age.legacy.integration.test.ts`):**
  - [x] Test: legacy user + adult DOB → HTTP 200 with the **same** `userId`; `ageConfirmedAt` set; exactly 1 `AGE_DECLARATION` `ConsentLog` and still exactly 1 `User`; an `AGE_CONFIRMED` audit row.
  - [x] Test: legacy user + under-18 DOB → HTTP 403 `AGE_REQUIREMENT_NOT_MET`; afterwards the user row has `name = "[deleted]"`, `phone = "DELETED_<id>"`, `phoneHash = null`, `isActive = false`, `isDeleted = true`; all addresses deleted; order totals and invoice numbers intact; Redis `rt:*` keys for the user are gone; an `AgeGateLockout` row exists for the **pre-purge** hash.
  - [x] Test: legacy user in the 30-day deletion grace + adult DOB → HTTP 200 with `isPendingDeletion: true`; `POST /api/v1/user/reactivate-account` then succeeds.
  - [x] Test: `POST /api/v1/auth/buyer/refresh` for a user with `ageConfirmedAt = null` → HTTP 403 `AGE_CONFIRMATION_REQUIRED`; for a confirmed user → HTTP 200.
  - [x] **Run — confirm RED.**

- [x] **RED — Unit (`auth.service.refresh-age.test.ts`, extended):**
  - [x] Test: `refreshToken` throws `AGE_CONFIRMATION_REQUIRED` when `findUserById` returns `ageConfirmedAt: null`; issues tokens when set.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend + Frontend plumbing:**
  - [x] [Service] Implement the existing-user branches in `confirmAge`; add the check in `refreshToken`; include `ageConfirmedAt` in the `findUserById` lookup mapping in `routes.ts`.
  - [x] [Frontend] In the shared API client's refresh-failure handling, treat `AGE_CONFIRMATION_REQUIRED` like an expired session: clear the session and redirect to `/login` (add a test beside the existing refresh-failure test).
  - [x] Run integration + unit tests — **confirm GREEN**.

- [x] **Verification chain:**
  - [x] An old test account logs in → is asked for a date of birth once → adult: continues with the same account; under 18: account is erased immediately and the number is locked → ✅ Done.

---

#### 8.8.8 — Admin Endpoints: Unlock a Wrongly Locked Adult & Erase a Discovered Minor

**Root cause / Goal:**
The policy promises that a minor found using GoRola is erased, and an adult who mistyped needs a way back. Both need an audited, admin-only action. (The admin screens that call them, and the extra look-up / decline / list endpoints, are specified in 8.8.14.)

---

- [x] **RED — Integration (`admin.age-gate.test.ts`):**
  - [x] Test: `POST /api/v1/admin/age-gate/unlock` with an ADMIN JWT and `{ phone: "+919876543210", reason: "Verified by call-back, adult confirmed" }` → HTTP 200 `{ cleared: true }`; the `AgeGateLockout` row is gone; one `AuditLog` `AGE_GATE_LOCKOUT_CLEARED`, `actorRole ADMIN`, `newValue` contains the `reason` and **no** phone number.
  - [x] Test: no token → HTTP 401; BUYER JWT and STORE_OWNER JWT → HTTP 403.
  - [x] Test: `reason` shorter than 10 characters → 400; malformed phone → 400; phone without an active lockout → 404.
  - [x] Test: `POST /api/v1/admin/users/:id/erase-underage` with `{ reason }` → HTTP 200 `{ erased: true }`; the user is anonymised exactly as in 8.8.7; a lockout exists for the pre-purge hash; all sessions revoked; one `AuditLog` `USER_ERASED_UNDERAGE`.
  - [x] Test: unknown user id → 404; already-erased user → HTTP 409 `ALREADY_ERASED`; non-admin tokens → 401/403.
  - [x] **Run — confirm RED.**

- [x] **GREEN — Backend (Schema → Service → Controller → Routes):**
  - [x] [Schema] Zod schemas in the admin module for both bodies.
  - [x] [Service] Methods on `admin.service.ts` calling `AgeGateService.unlockPhone` and the shared erase-underage routine (hash first, then revoke tokens, `permanentPurgeAndAnonymize`, then lock). Write the audit rows.
  - [x] [Controller] Register both routes guarded by `authenticateToken` and `requireRole(ActorRole.ADMIN)`.
  - [x] Run integration test — **confirm GREEN**.

- [x] **RED / GREEN — Unit / Component:** N/A — the screens are specified in 8.8.14. Service logic is covered through the integration tests above plus a unit test that the erase routine computes the hash **before** the purge.

- [x] **Verification chain:**
  - [x] A wrongly locked adult emails the Grievance Officer → call-back confirms → admin calls unlock with a reason → the person can request an OTP again; a parent reports a minor → admin calls erase-underage → the account is anonymised and the number is locked → ✅ Done.

---

#### 8.8.9 — Lockout Purge Worker

**Root cause / Goal:**
DPDP storage limitation: lockout rows must not outlive their purpose. Delete each row when its `lockedUntil` passes.

---

- [ ] **RED — Integration (`age-gate-lockout-purge.test.ts`, modelled on `data-retention.test.ts`):**
  - [ ] Test: with one expired and one active lockout, `purgeExpiredAgeGateLockouts(now)` returns `1`, deletes only the expired row and leaves the active one.
  - [ ] Test: the scheduler's job list includes a job named `age-gate-lockout-purge` that runs daily.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Worker → Scheduler):**
  - [ ] Create `apps/api/src/workers/age-gate-lockout-purge.worker.ts` calling `AgeGateRepository.deleteExpired`; register it in `apps/api/src/workers/scheduler.ts` (daily).
  - [ ] Run integration test — **confirm GREEN**.

- [ ] **RED / GREEN — Unit / Component:** N/A — no frontend; the worker is a thin call covered by the integration test.

- [ ] **Verification chain:**
  - [ ] 90 days after a refusal → the daily job runs → the lockout row disappears → ✅ Done.

---

#### 8.8.10 — Frontend Login Flow: Age Step, Confirmation, Refusal & Removal of the Client Consent Call

**Root cause / Goal:**
`LoginPage.tsx` has the steps `consent | phone | otp | reactivate` and no age step. It also posts `OTP_AUTH` consent from the browser after login with a silent `.catch`, which the server now owns (8.8.5).

**Approach:**
Add the steps `age`, `ageConfirm` and `ageBlocked`. New component `apps/web/src/components/auth/AgeStep.tsx`: three numeric inputs (day, month, year), `inputMode="numeric"`, `autoComplete="off"`, **no** `<input type="date">` and **no** `min`/`max` attributes (they would reveal the cutoff). The browser never decides eligibility. The ticket and the date live **only in component state**: never `localStorage`, `sessionStorage`, URL, the Zustand session store or the query cache. Delete the fire-and-forget `POST /api/v1/consent` block.

---

- [ ] **RED — Unit / Component (`AgeStep.test.tsx`, extended `LoginPage.test.tsx`):**
  - [ ] Test: `AgeStep` renders `data-testid="age-day"`, `"age-month"`, `"age-year"`; contains no element of `type="date"` and no `min`/`max` attribute; the rendered text equals the canonical `AGE_DECLARATION` text from `@gorola/shared`.
  - [ ] Test: the Continue button (`age-continue-btn`) is disabled until all three fields have values.
  - [ ] Test: invalid entries (`31/02/2010`, month `13`, day `0`, year `99`, year `1899`, a future year) show `data-testid="age-error"` with exactly "Please enter a valid date of birth." and make **zero** API calls.
  - [ ] Test: valid entry `10/03/2012` shows the confirm step with the text "You entered 10 March 2012. Is this correct?"; **Edit** returns to the fields with the values still filled; **Yes, continue** (`age-confirm-yes-btn`) posts once to `/api/v1/auth/buyer/confirm-age` with body exactly `{ ageTicket, dateOfBirth: "2012-03-10", acknowledgedNotice: true, consentVersion: "1.1" }`.
  - [ ] Test: double-clicking **Yes, continue** sends exactly **one** request (button disabled while in flight).
  - [ ] Test: `verify-otp` answering `{ ageGateRequired: true, ageTicket }` moves the page to the age step; a normal token response skips it (returning adult).
  - [ ] Test: a `200` from `confirm-age` calls `completeBuyerLogin` and navigates to the `from` target; **no** request to `/api/v1/consent` is ever made (assert `postMock` was never called with that URL — this replaces the old test at line ~249 of `LoginPage.test.tsx`).
  - [ ] Test: `403 AGE_REQUIREMENT_NOT_MET` and `403 AGE_GATE_LOCKED` (also from `send-otp`) show `data-testid="age-blocked-step"` with the exact refusal copy in 8.8.0 section I, and there is no control that returns to the date fields.
  - [ ] Test: `401 AGE_TICKET_INVALID` returns to the phone step with "Your session expired. Please enter your phone number again."
  - [ ] Test (no persistence): after success and after refusal, `JSON.stringify(localStorage)`, `JSON.stringify(sessionStorage)`, the session store state and `window.location.href` contain neither `2012` nor the ticket.
  - [ ] Test (age copy): the full rendered text of every new step contains no number other than `18`.
  - [ ] Test (accessibility): inputs have associated labels; the error region uses `aria-live="polite"`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Types → Component → Page):**
  - [ ] [Types] Extend `VerifyEnvelope.data` with `ageGateRequired?: boolean` and `ageTicket?: string`; extend the step union with `"age" | "ageConfirm" | "ageBlocked"`.
  - [ ] [Component] Create `AgeStep.tsx` (fields, validation, confirm view, refusal view) with the `data-testid`s used above; format the confirm date with `Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" })`.
  - [ ] [Page] In `LoginPage.tsx` handle the new response branch, call `confirm-age`, map the error codes, remove the client-side `OTP_AUTH` POST, import the notice text from `@gorola/shared`, add the line "GoRola is for people aged 18 and over." to the first (consent) screen.
  - [ ] Run unit tests — **confirm GREEN**.

- [ ] **RED / GREEN — Integration:** covered end to end by the API integration tests in 8.8.4–8.8.7 and the Playwright scenarios in 8.8.13.

- [ ] **Verification chain:**
  - [ ] New user ticks the notice, enters phone and OTP → sees the date-of-birth screen → types a date → sees "You entered … Is this correct?" → confirms → lands logged in (adult) or sees the refusal screen (under 18) → returning adults never see the date screen → ✅ Done.

---

#### 8.8.11 — Policy Copy, Version Bump to 1.1 & the "Only 18" Guard

**Root cause / Goal:**
Section 7 of the Privacy Policy says minor data is deleted "if we discover" it but describes no control; the Terms eligibility clause has no consequence statement. Changing policy text must bump the version so existing users re-consent. Also, there must be an automatic guard that no age number other than 18 ever appears in the UI.

**Approach:**
Rewrite the two clauses (exact text below), bump `CURRENT_PRIVACY_POLICY_VERSION` to `"1.1"` (used by `BuyerLayout.tsx`, by `POST /api/v1/user/accept-policy`, and by new-account creation), keep the heading `7. Protection of Children's Data` and the phrase "18 years of age" (existing tests depend on them), reconcile the grievance email, add a regression guard test.

**Exact new Privacy Policy section 7 body:**
> "GoRola is for people who are at least **18 years of age**. When you first create an account we ask for your date of birth once, to confirm this. We do not store your date of birth — we keep only the date on which you confirmed you are an adult. We do not knowingly collect or process personal data of anyone under 18. If we learn that someone under 18 has an account, we close it and erase their personal data. If someone is refused at sign-up, we keep a one-way scrambled (hashed) form of their phone number, which cannot be read back, for 90 days only, solely to stop repeated sign-up attempts, and then delete it. If you are a parent or guardian and believe a child is using GoRola, write to privacy@gorola.in."

**Exact new Terms of Service eligibility body:**
> "To use GoRola you must be **at least 18 years of age** and legally able to enter into a binding contract under the Indian Contract Act, 1872. When you create an account you confirm that the date of birth you enter is correct. If we find that you are under 18, or that you gave a false date of birth, we may close your account and erase your data."

---

- [ ] **RED — Unit / Component:**
  - [ ] (`PrivacyPolicyPage.test.tsx`) Test: section 7 contains "18 years of age", "date of birth", "do not store", "90 days", "hashed" and "privacy@gorola.in"; the heading `7. Protection of Children's Data` is still present.
  - [ ] (`TermsOfServicePage.test.tsx`) Test: the eligibility text contains "at least 18 years of age", "date of birth is correct" and "close your account".
  - [ ] (`age-copy.guard.test.ts`, new, web) Test: scan every non-test source file under `apps/web/src` (`*.ts`, `*.tsx`, excluding `*.test.*`); search with the regex `/\b(\d{1,3})\s*(?:\+\s*)?years?\s*(?:old|of age)\b|\b(?:aged?|age of)\s+(\d{1,3})\b|\b(\d{1,3})\s*\+?\s*(?:and (?:over|above|older)|only)\b/i`; for every match the captured number **must equal 18**. (Retention phrases such as "7 years" or "30 days" do not match because the regex requires "old", "of age", "aged" or "and over". **This guard is green from day one by design; it is a regression guard.** The other tests in this item are RED.)
  - [ ] (`BuyerLayout.test.tsx`) Test: a logged-in user with `privacyPolicyVersionAccepted: "1.0"` sees the re-consent banner; with `"1.1"` does not.
  - [ ] (`ConsentNoticeModal.test.tsx`) Test: the `OTP_AUTH` modal text includes "aged 18 and over" and uses the grievance address chosen in 8.7.8 row 1.
  - [ ] **Run — confirm RED.**

- [ ] **RED — Integration (`user.accept-policy.test.ts`):**
  - [ ] Test: `POST /api/v1/user/accept-policy` with `{ version: "1.1" }` → HTTP 200 and `User.privacyPolicyVersionAccepted === "1.1"`; with `"9.9"` → HTTP 400.
  - [ ] **Run — confirm RED (inspect `user.schema.ts` / `user.controller.ts`; any hard-coded `"1.0"` is the cause).**

- [ ] **GREEN — Backend + Frontend:**
  - [ ] [Backend] Make `accept-policy` validate against `CURRENT_PRIVACY_POLICY_VERSION` from shared.
  - [ ] [Frontend] Replace the constant in `BuyerLayout.tsx` with the shared import; update `PrivacyPolicyPage.tsx` and `TermsOfServicePage.tsx` with the exact texts above; update the `OTP_AUTH` text in `ConsentNoticeModal.tsx` from the shared constant; use one shared grievance-address constant everywhere.
  - [ ] [Cascade] Update existing test fixtures that assume version `"1.0"` is current (search `"1.0"` in `apps/web/src` and `apps/api/src/__tests__`).
  - [ ] Run unit + integration tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] An existing user opens the site → sees the "policy updated" banner once → reads the new section 7 → accepts → version `1.1` is saved; a developer adds "21+" to any page → the guard test fails the build → ✅ Done.

---

#### 8.8.12 — Privacy Dashboard, Data Export & Admin Consent Panel

**Root cause / Goal:**
`AGE_DECLARATION` is a new essential purpose. It must be visible to the user as a read-only fact, included in their data export (DPDP Section 11), shown to admins in the consent panel, and must not be withdrawable on its own (withdrawing it would mean closing the account, which already has its own flow).

---

- [ ] **RED — Integration (`user.my-data.test.ts`, `consent.controller.test.ts`, `admin.users.test.ts` extended):**
  - [ ] Test: `GET /api/v1/user/my-data` returns `user.ageConfirmedAt` (ISO string) and a `consentHistory` entry with `purpose "AGE_DECLARATION"`; no key matching `/birth|dob/i` anywhere in the payload.
  - [ ] Test: `DELETE /api/v1/consent/AGE_DECLARATION` → HTTP 403 (essential purpose; confirm how `OTP_AUTH` / `ORDER_PROCESSING` are treated today and match it).
  - [ ] Test: `GET /api/v1/admin/users/:id/consents` summary now includes a row for `AGE_DECLARATION` (status "Active" for a confirmed user, "Never Given" for a legacy user); update the existing assertions that expect exactly 4 summary rows.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Repository] Add `ageConfirmedAt` to the `getMyData` selection and serializer; treat `AGE_DECLARATION` as essential in `ESSENTIAL_PURPOSES` in `consent.service.ts` and add it to `ConsentPurpose` / the Zod purposes list.
  - [ ] Run integration tests — **confirm GREEN**.

- [ ] **RED — Unit / Component (`PrivacySettingsSection.test.tsx`, `AdminUsersPage.test.tsx`):**
  - [ ] Test: when the consent list includes `AGE_DECLARATION`, the section shows `data-testid="age-confirmation-line"` with "Age confirmed on <date>" and **no** Withdraw button; `buildPurposeCards` still renders exactly **4** purpose cards.
  - [ ] Test: the admin drawer's consent summary table renders 5 rows.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend:**
  - [ ] [Types] Add `"AGE_DECLARATION"` to the purpose union types in `PrivacySettingsSection.tsx`, `ConsentNoticeModal.tsx` and the admin types, **excluding** it from the user-facing 4-card builder.
  - [ ] [Component] Add the read-only age line; update the admin summary rendering for the fifth row.
  - [ ] Run unit tests — **confirm GREEN**.

- [ ] **Verification chain:**
  - [ ] Adult opens `/account/privacy` → sees "Age confirmed on 5 Oct 2026" and still 4 purpose cards → downloads their data → the file shows the confirmation date and no date of birth; an admin opens the user → sees `AGE_DECLARATION: Active` → ✅ Done.

---

#### 8.8.13 — Cascade Audit, Test Helpers, Seeds, E2E, Environment & Quality Gates

**Root cause / Goal:**
The new rule changes who may log in. Every place that creates buyers through `verify-otp`, or inserts `User` rows directly, either breaks or silently bypasses the gate. This item finds and fixes all of them.

---

- [ ] **RED — find the breakage (run first):**
  - [ ] Run the full API and web suites after 8.8.4; list every failure. Expected causes: tests that call `verify-otp` for a brand-new phone and expect tokens (for example `auth.buyer-flow.integration.test.ts`, session/refresh tests, order/cart/consent/user integration tests that log buyers in); tests with `User` factories that omit `ageConfirmedAt`.
  - [ ] **Run — confirm RED (the failures are the work list).**

- [ ] **GREEN — Backend tests, helpers & seeds:**
  - [ ] Search the repository for `/api/v1/auth/buyer/` and `verify-otp` in `apps/api/src/__tests__`, `apps/web/src`, the Playwright directory and `scripts/`. Create **one** helper `loginBuyer(app, phone)` in `apps/api/src/__tests__/helpers/` that runs `send-otp` → `verify-otp` → (if a ticket is returned) `confirm-age` with `dateOfBirth "1990-01-01"`, returning the tokens. Use it everywhere; do not copy the three calls.
  - [ ] Search `user.create`, `user.upsert`, `ensureBuyerByPhone` in tests and seeds. Every created buyer gets `ageConfirmedAt: new Date()`, `ageConfirmedPolicyVersion: "1.1"`, `privacyPolicyVersionAccepted: "1.1"`. Update `seed.ts` and `seed-e2e.ts`.
  - [ ] Update `auth.buyer-flow.integration.test.ts` ("send-otp + verify persists User; second verify yields same userId") to the new two-step reality.

- [ ] **RED / GREEN — Playwright E2E (`age-gate.spec.ts` in the existing Playwright directory):**
  - [ ] Scenario 1: new adult phone → notice → phone → OTP → DOB `14/05/1990` → confirm → logged in; second login with the same phone shows **no** date screen.
  - [ ] Scenario 2: new phone → DOB `10/03/2012` → confirm → refusal screen (`age-blocked-step`) → reload and use the same phone → refusal again at the phone step.
  - [ ] Scenario 3: wrong date typed then **Edit** → corrected → account created, no lockout.
  - [ ] Scenario 4: existing seeded users still log in without the date screen (their seeds are confirmed).
  - [ ] Update the shared Playwright login helper so every existing journey still passes.
  - [ ] **Run — confirm RED first (scenarios fail before 8.8.10), then GREEN.**

- [ ] **GREEN — Environment & configuration:**
  - [ ] Add `AGE_GATE_LOCKOUT_DAYS` and `AGE_GATE_DEVICE_COOLDOWN_HOURS` to the env schema, root `.env.example`, `apps/api/.env.example`, `LOCAL_SETUP.md` and the Railway variables; update the `current_state.md` environment table and `project_data.json` `environment_variables_required` (project rule: a new env var must be recorded there).

- [ ] **GREEN — Quality gates (project rules):**
  - [ ] `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (0 failures), `pnpm build` (succeeds), `pnpm test:coverage` (≥ 80% overall; **100%** for the auth module including `confirmAge`).
  - [ ] Run all four Mandatory-Rules test layers (unit, integration, E2E bootstrap, quality gates).

- [ ] **Verification chain:**
  - [ ] A fresh clone is set up → seeds create confirmed test users → every existing journey logs in as before → a brand-new phone must pass the date screen → all gates are green → ✅ Done.

---

#### 8.8.14 — Admin Dashboard: the Complete Age-Gate Case Pipeline (e-mail → Age Gate screen → decision → reply)

**Root cause / Goal:**
8.8.8 gives admins two API endpoints but no screen, and nothing tells an admin where to go when a complaint e-mail arrives. The Grievance Officer must be able to handle every age-gate complaint **without a developer**: find the person, see what the system holds, approve, disapprove, freeze or erase, leave an audit trail, and reply. One more fact shapes the design: a refused person has **no `User` row**, and the lockout stores only a one-way hash, so the existing Users screen can never show them. They need a screen that looks up by phone number.

**How a complaint travels (the whole pipeline, no gaps):**
1. The complaint **arrives by e-mail** at `privacy@gorola.in` (a normal mailbox read by the Grievance Officer, 8.7.1). **The system sends no e-mail to admins and receives none**; there is no e-mail integration to build.
2. The Officer decides which case it is (table below) and, for a wrongly locked adult, **calls the number back** (8.7.7). No ID document or date of birth is requested or stored.
3. An admin signs in (e-mail + password + 2FA, existing flow) and opens **Admin → Age Gate** (`/admin/age-gate`, new item in the admin side menu, right after *Users*).
4. The admin types the phone number from the e-mail and clicks **Look up**. The screen shows a **Lock card** and/or an **Account card** (or a "nothing found" message).
5. The admin picks one action. Every action opens a confirmation dialog that **requires a written reason of at least 10 characters**, and every action writes one `AuditLog` row.
6. The Officer sends the matching reply template by e-mail and records the outcome in `Grievance-Log/`. Target: within 7 days; statutory ceiling 30 days.

**Case table (what the admin does, what the system does):**

| # | The e-mail says | Screen shows after look-up | Admin action (button) | What the system does | Reply template |
|---|---|---|---|---|---|
| A | "I am an adult, I mistyped my date" and the call-back confirms | **Lock card** (locked until, days remaining, refusals) | **Unlock this number** (= *approve*) | Deletes the `AgeGateLockout` row; audit `AGE_GATE_LOCKOUT_CLEARED` with the reason; person can ask for a code and enter the date again | (a) unlocked |
| B | Same, but the call-back fails or the story does not hold | Lock card | **Decline appeal** (= *disapprove*) | **No data change.** Audit `AGE_GATE_APPEAL_DECLINED` with the reason; the lock runs to its end date | (b) declined |
| C | "My child (under age) has an account" or a rider/store/staff report | **Account card** (name, masked phone, status, joined, age confirmed on, orders) | **Suspend** first if you need time (= *ban, reversible*), then **Erase underage account** (= *ban, permanent*) | Suspend: `isActive=false`, **all sessions revoked at once**, audit `ADMIN_USER_SUSPEND` with reason. Erase: anonymises exactly as in 8.8.7, revokes sessions, **locks the number for `AGE_GATE_LOCKOUT_DAYS`**, audit `USER_ERASED_UNDERAGE` | (c) erased |
| D | Parent asks to delete the child's data | Account card | **Erase underage account** | Same as C (DPDP Section 12 request) | (c) erased |
| E | "I was refused but I did not enter a wrong date" and look-up finds **nothing** | **"Nothing found"** message | None (nothing to change) | If the refusal was under 24 hours ago, only the device cooldown cookie applies and ends by itself; otherwise the person may simply sign in | (d) no lock found |
| F | Look-up shows a lock **and** the lock already expired | Lock card with **Expired** badge | None | The person can already sign up; the daily purge removes the row (8.8.9) | (d) no lock found |
| G | A reported number whose account is already erased | Lock card only (the account is gone) | **Decline appeal** or nothing | Erased accounts cannot be found by phone because their hash was removed; the lock created by the erase is what appears | (b) or (c) |

**Screen specification (no ambiguity):**
- **Route / menu:** `/admin/age-gate` (prefix-aware through `getScopedPath`, works on the `admin` sub-domain), menu label **Age Gate**, guarded by the existing `AdminRoute`.
- **Block 1 — "Look up a phone number":** one input (`data-testid="agegate-phone-input"`, placeholder "Mobile number, e.g. 9876543210") and a **Look up** button (`agegate-lookup-button`), disabled until the input is a valid Indian mobile (10 digits starting 6–9, with or without `+91`). Invalid input shows "Enter a valid 10-digit mobile number". Reuse the buyer phone Zod schema and normalise to E.164 before sending.
- **Block 2 — result area** (`agegate-result`): shows `lockout-card`, `account-card`, both, or `agegate-empty` ("No lock and no account found for this number. If the person was refused less than 24 hours ago, a device cooldown may apply; it ends by itself."). While loading show a skeleton; on error show "Look-up failed. Try again." with a Retry button.
  - **Lock card** fields: status badge (**Active** red / **Expired** grey), "Locked until <date>", "<n> days remaining" (0 when expired), "Refusals: <strikeCount>", "First refused on <date>", reference (first 8 characters of the lockout id, for the grievance log). Buttons (Active only): **Unlock this number** (`unlock-button`), **Decline appeal** (`decline-button`). **No hash and no full phone number is ever shown.**
  - **Account card** fields: name, masked phone, status badge (**Active** / **Suspended** / **Pending deletion**), "Joined <date>", "Age confirmed on <date>" or "Age not confirmed (older account)", "Orders: <n>". Buttons: **Open user** (`open-user-link`, goes to `/admin/users/<id>`), **Suspend** (`suspend-button`) or **Unsuspend** (`unsuspend-button`) depending on status, **Erase underage account** (`erase-underage-button`, red).
- **Block 3 — "Recent refusals"** (`lockouts-table`, below the result): summary tiles **Active locks** (`active-lockouts-count`) and **Refusals in the last 7 days** (`lockouts-last-7-days`), then a table with columns *Reference, Refused on, Locked until, Refusals, Status*, newest first, 20 per page with Previous/Next. **There is deliberately no phone column** (only a hash exists). A hint line says "To act on one, look up the number the person gave in their e-mail." Empty state: "No refusals recorded." A **View audit log** link goes to `/admin/audit-logs`.
- **Dialogs** (same modal pattern as the status-confirmation modal in `AdminUserDetailPage.tsx`; Escape and backdrop click cancel; focus moves to the reason box; buttons disabled while the request runs):
  - **Unlock:** title "Unlock this number?"; text "The person will be able to ask for a code and enter their date of birth again. Do this only after you called the number back and the person confirmed they are 18 or over."; textarea **Reason** (min 10, max 500, live counter); checkbox "I called this number back and the person confirmed they are an adult"; the **Unlock number** button stays disabled until the reason is valid **and** the box is ticked. Success toast: "Number unlocked. Tell the person they can sign in again." Then the look-up re-runs.
  - **Decline:** title "Decline this appeal?"; text "Nothing changes for the person. The lock stays until it ends. Your reason is saved in the audit log."; Reason field; **Record decision** button. Success toast: "Decision recorded. The number stays locked."
  - **Suspend:** title "Suspend this account?"; text "The person is signed out everywhere immediately and cannot sign in until you unsuspend."; Reason field; **Suspend account** button. Success toast: "Account suspended."
  - **Erase underage account:** red title "Erase this account?"; text lists exactly what happens (name and phone removed, saved addresses deleted, signed out everywhere, number locked for `AGE_GATE_LOCKOUT_DAYS` days, order amounts and invoices kept for tax law) and says "This cannot be undone."; Reason field **and** a box where the admin must type `ERASE` (case-sensitive); the **Erase account** button stays disabled until both are valid. Success toast: "Account erased and number locked." On the Users detail screen the admin is then sent to `/admin/users` (the account no longer exists to display); on the Age Gate screen the look-up re-runs and shows the new Lock card.
- **Users detail screen** (`AdminUserDetailPage`): add a line `age-confirmed-line` ("Age confirmed on <date>" or "Age not confirmed (older account)") and the same **Erase underage account** button and dialog, so an admin who arrives from the Users list does not have to retype the number.
- **Copy rule:** all text on these screens uses only the number 18 when an age is mentioned (extends the guard in 8.8.11).

**API added or changed by this item** (the unlock and erase endpoints already exist from 8.8.8). All are guarded by `authenticateToken` + `requireRole(ActorRole.ADMIN)`:

| Method and path | Body / query | Success response |
|---|---|---|
| `POST /api/v1/admin/age-gate/lookup` (POST so the number never appears in a URL or access log) | `{ phone }` | `200 { lockout: { id, createdAt, lockedUntil, strikeCount, isActive, daysRemaining } \| null, account: { id, name, maskedPhone, status: "ACTIVE" \| "SUSPENDED" \| "PENDING_DELETION", createdAt, ageConfirmedAt \| null, ordersCount } \| null }` (both null is a normal 200) |
| `GET /api/v1/admin/age-gate/lockouts` | `?page=1&limit=20` (limit max 50) | `200 { items: [{ id, createdAt, lockedUntil, strikeCount, isActive }], summary: { activeCount, createdLast7Days }, page, limit, total, totalPages }` |
| `POST /api/v1/admin/age-gate/decline` | `{ phone, reason }` | `200 { recorded: true }` |
| `PUT /api/v1/admin/users/:id/suspend` (existing) | optional `{ reason }` (10–500 characters when present) | existing response; now also **revokes every session** |
| `GET /api/v1/admin/users/:id` (existing) | none | existing response plus `ageConfirmedAt` (ISO or null) |

**Audit rows written (never contain a phone number, hash or date of birth):** `AGE_GATE_LOOKUP` (`entityType "AgeGate"`, `entityId` = lockout id, else user id, else `"none"`, `newValue { foundLockout, foundAccount }`), `AGE_GATE_LOCKOUT_CLEARED`, `AGE_GATE_APPEAL_DECLINED` (`newValue { reason }`), `ADMIN_USER_SUSPEND` (reason added when given), `USER_ERASED_UNDERAGE`. All use `actorRole ADMIN`, the admin's id, IP and user agent.

---

- [ ] **RED — Integration (`apps/api/src/__tests__/integration/age-gate/admin.age-gate.dashboard.test.ts`):**
  - [ ] Test `lookup`, active lock: seed a lockout for `hashPII("+919876543210")`; `POST lookup { phone }` with an ADMIN JWT → HTTP 200; `data.lockout.isActive === true`, `daysRemaining` between 89 and 90, `data.account === null`; the raw response text contains neither `phoneHash` nor `9876543210`.
  - [ ] Test `lookup`, expired lock: `lockedUntil` yesterday → `lockout.isActive === false`, `daysRemaining === 0`.
  - [ ] Test `lookup`, live account: an active buyer with 2 orders and `ageConfirmedAt` set → `account.status === "ACTIVE"`, `ordersCount === 2`, `ageConfirmedAt` is an ISO string, `maskedPhone` ends with `3210` and has no other digits, `lockout === null`.
  - [ ] Test `lookup`, status mapping: `isActive=false` → `"SUSPENDED"`; `deletionScheduledFor` set (inside the grace period) → `"PENDING_DELETION"`.
  - [ ] Test `lookup`, nothing known → HTTP 200 with `{ lockout: null, account: null }`.
  - [ ] Test `lookup`, after `erase-underage` on that user: original phone → `account === null` and `lockout` present (the erase created it).
  - [ ] Test `lookup` audit: exactly one `AGE_GATE_LOOKUP` row per call; `newValue` keys are exactly `foundLockout` and `foundAccount`; no phone, hash or name anywhere in the row.
  - [ ] Test `lookup` validation and guards: malformed phone → 400; no token → 401; BUYER and STORE_OWNER tokens → 403.
  - [ ] Test `lockouts` list: 2 active + 1 expired seeded → 3 items newest first, each with **exactly** the keys `id, createdAt, lockedUntil, strikeCount, isActive`; `summary.activeCount === 2`; `summary.createdLast7Days` counts only rows created in the last 7 days; `limit=2` → `totalPages === 2`; `limit=51` → 400; guards as above.
  - [ ] Test `decline`: active lock + reason "Call-back could not confirm adult" → HTTP 200 `{ recorded: true }`; the lockout row is **unchanged** (same `lockedUntil`, `strikeCount`); one `AGE_GATE_APPEAL_DECLINED` audit row with the reason and no phone; no lock for the number → 404; reason shorter than 10 characters → 400; guards.
  - [ ] Test `suspend` with reason: `PUT /admin/users/:id/suspend { reason }` → 200; audit `ADMIN_USER_SUSPEND` `newValue.reason` equals the reason; with **no body** → still 200 (backward compatible); `reason` of 5 characters → 400.
  - [ ] Test `suspend` revokes sessions: before the call the user's access token works on `GET /api/v1/me` and `rt:<token>` exists in Redis; afterwards the old access token is rejected (HTTP 401 or 403, whichever the existing guard returns for inactive users — assert it is not 200), the refresh call fails, and a fresh OTP login for that phone is refused. If the existing code already refuses, the test passes at once and the extra revoke call is still asserted through the Redis key being gone.
  - [ ] Test `GET /admin/users/:id` returns `ageConfirmedAt` (ISO) for a confirmed user and `null` for a legacy user.
  - [ ] **Run — confirm RED (routes, fields and revoke do not exist).**

- [ ] **RED — Unit (`admin.age-gate.service.test.ts`):**
  - [ ] Test: `deriveAccountStatus` returns `"PENDING_DELETION"` before `"SUSPENDED"` before `"ACTIVE"` when flags overlap.
  - [ ] Test: `daysRemaining` is `Math.ceil` of the remaining time, never negative, and `0` at the exact expiry.
  - [ ] Test: the look-up result mapper has no property named `phoneHash`, `phone` or `dateOfBirth`.
  - [ ] Test: the audit payload builders for look-up and decline contain no phone, hash or name.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Schema → Repository → Service → Controller → Types):**
  - [ ] [Schema] In the admin module add Zod schemas: `ageGateLookupBodySchema { phone }` (reuse the buyer E.164 phone schema), `ageGateDeclineBodySchema { phone, reason: string 10–500 }`, `ageGateLockoutsQuerySchema { page default 1, limit default 20, max 50 }`; extend the existing suspend body with an optional `reason` (10–500).
  - [ ] [Repository] In `AgeGateRepository` add `findByPhoneHash`, `listLockouts(page, limit)`, `countActive(now)`, `countCreatedSince(date)`. Find the account with `db.user.findFirst({ where: { phoneHash: hashPII(phone) } })` and count its orders; never return the hash.
  - [ ] [Service] Add `lookupAgeGate`, `listAgeGateLockouts`, `declineAgeGateAppeal` to `admin.service.ts` plus the pure helpers `deriveAccountStatus` and `buildLookupAudit`; in `suspendUser` accept the optional reason, store it in the audit `newValue`, and call the same `revokeAllUserTokens` routine the delete-account flow uses.
  - [ ] [Controller] Register the three new routes under the existing admin `preHandler`; add `ageConfirmedAt` to the `GET /admin/users/:id` mapper; pass the optional body to `suspendUser`.
  - [ ] [Types] Add the response types (`AgeGateLookupResult`, `AgeGateLockoutList`) to `packages/shared` and use them in the web app.
  - [ ] Run integration + unit tests — **confirm GREEN**.

- [ ] **RED — Unit / Component (`AdminAgeGatePage.test.tsx`, `AdminAgeGateModals.test.tsx`, `AdminUserDetailPage.test.tsx` extended, `AdminLayout` and `AdminRoute.test.tsx` extended):**
  - [ ] Test: the page renders heading "Age Gate"; the Look up button is disabled for `"123"`, shows "Enter a valid 10-digit mobile number", and becomes enabled for `"9876543210"` and `"+919876543210"`; the request body always carries the E.164 form.
  - [ ] Test: result with an active lock → `lockout-card` shows "Locked until", "89 days remaining" (for the mocked value), "Refusals: 1", the **Active** badge and the buttons `unlock-button` and `decline-button`; `account-card` is absent; the card text contains no phone digits.
  - [ ] Test: expired lock → **Expired** badge, no action buttons.
  - [ ] Test: result with an account → `account-card` shows name, masked phone, status badge, "Orders: 2", "Age confirmed on …"; `open-user-link` has `href` ending `/admin/users/<id>`; a suspended account shows `unsuspend-button` and **not** `suspend-button`; a legacy account shows "Age not confirmed (older account)".
  - [ ] Test: nothing found → `agegate-empty` with the exact sentence above; API error → "Look-up failed. Try again." with a Retry button.
  - [ ] Test (unlock dialog): confirm disabled with an empty reason; disabled with a 9-character reason; disabled with a valid reason but the box unticked; enabled with both; submit sends `POST /api/v1/admin/age-gate/unlock` with `{ phone: "+919876543210", reason }`; success shows the toast "Number unlocked. Tell the person they can sign in again." and the look-up runs again; a 404 shows an error toast and keeps the dialog open.
  - [ ] Test (decline dialog): confirm disabled until the reason has 10 characters; submit sends `POST …/decline`; toast "Decision recorded. The number stays locked."
  - [ ] Test (suspend dialog): submit sends `PUT /api/v1/admin/users/<id>/suspend` with `{ reason }`; toast "Account suspended."
  - [ ] Test (erase dialog): confirm disabled until the reason is valid **and** the typed text is exactly `ERASE` (`erase` and `Erase` keep it disabled); submit sends `POST /api/v1/admin/users/<id>/erase-underage` with `{ reason }`; toast "Account erased and number locked."; the dialog text lists the five effects and "This cannot be undone."
  - [ ] Test (recent refusals): tiles show the mocked counts; the table has exactly the five column headers and **no** phone column; empty state "No refusals recorded."; Next/Previous change the `page` query.
  - [ ] Test (copy guard): the rendered text of the page and of all four dialogs never matches `/\b(?!18\b)\d{1,2}\s*(years?|yrs?)\b/i`.
  - [ ] Test (users detail): `age-confirmed-line` renders both variants; `erase-underage-button` opens the same dialog; after success the app navigates to `/admin/users`.
  - [ ] Test (menu and route): the admin side menu has an **Age Gate** item right after **Users** whose link ends `/admin/age-gate` (also in sub-domain mode); an unauthenticated visit to the route redirects to the admin login like the other admin pages.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Types → Component → Page → Route):**
  - [ ] [Types] Use the shared response types; add the audit action names to any admin audit-log action filter list if one exists.
  - [ ] [Component] Create `apps/web/src/components/admin/AgeGateActionModals.tsx` exporting `UnlockModal`, `DeclineModal`, `SuspendModal`, `EraseUnderageModal` (one shared reason field with the live counter). Create `AgeGateLookupCards.tsx` for the Lock card and Account card.
  - [ ] [Page] Create `apps/web/src/pages/admin/AdminAgeGatePage.tsx` using `@tanstack/react-query` and the shared `api` client, like the other admin pages.
  - [ ] [Route] Register `/admin/age-gate` in `apps/web/src/app/routes/admin.tsx` behind `AdminRoute`; add the menu item in `AdminLayout.tsx`; add the age line and Erase button to `AdminUserDetailPage.tsx`.
  - [ ] Run unit tests — **confirm GREEN**.

- [ ] **RED / GREEN — Playwright E2E (`admin-age-gate.spec.ts`, reuse the existing admin login helper with its 2FA handling; never bypass 2FA):**
  - [ ] Scenario 1 (approve): a new phone enters a date that makes it a refusal; in a separate admin session open **Age Gate**, look up the number → Lock card; unlock with a reason and the ticked box → "nothing found"; the person signs in again, passes the date screen with an adult date and gets an account.
  - [ ] Scenario 2 (disapprove): same refusal; the admin declines with a reason → the Lock card is still there; the person still gets `AGE_GATE_LOCKED` at the phone step; the **Audit Logs** screen shows `AGE_GATE_APPEAL_DECLINED`.
  - [ ] Scenario 3 (erase): a seeded buyer with an order; the admin looks up the number → Account card → **Erase underage account** (reason, typed `ERASE`) → the Lock card appears; the Users list no longer shows that buyer; the Orders screen still shows the order total with the buyer shown as deleted; the buyer's next sign-in attempt is refused.
  - [ ] Scenario 4 (suspend / unsuspend): the admin suspends with a reason → the buyer's open session is signed out on its next request and sign-in is refused; **Unsuspend** restores access.
  - [ ] **Run — confirm RED first (screen missing), then GREEN.**

- [ ] **GREEN — Quality gates (project rules):**
  - [ ] `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (0 failures), `pnpm build` (succeeds), `pnpm test:coverage` (≥ 80% overall; **100%** for the new admin age-gate service methods and helpers).

- [ ] **Verification chain:**
  - [ ] A complaint e-mail arrives at `privacy@gorola.in` → the Officer calls the number back → an admin opens **Admin → Age Gate**, looks up the number, sees the Lock card, and clicks **Unlock this number** (approve) or **Decline appeal** (disapprove) with a reason → a parent's report about a minor is handled by **Suspend** then **Erase underage account** → each action is in the audit log without a phone number → the Officer sends the template reply and logs it → ✅ Done.

---

#### 8.8.15 — Documentation Close-out

**Goal:** Every document that describes login, consent or the database reflects the age gate, so a future developer is not misled.

- [x] `decision_log.md`: DECISION-061 amended (Vercel) and DECISION-062 added (age gate) — done 2026-10-05.
- [x] `DPDP Act/DPDP_CONSENT_ARCHITECTURE_GUIDE.md`: section 15 added (age flow and its fit with `OTP_AUTH`, parental-consent reasoning, why it is safe), sections 14.6 / header updated — done 2026-10-05.
- [x] `architecture.md`: Vercel note updated — done 2026-10-05.
- [x] `architecture.md`: add the `age-gate` module to the Module Map and the confirm-age step to the buyer auth data flow — done 2026-10-05.
- [x] `database_schema.md`: add `AgeGateLockout` and the two `User` columns — done 2026-10-05.
- [x] `DPDP Act/DPDP_CONSENT_ARCHITECTURE_GUIDE.md`: section 2 diagram and heading updated to five pipelines, section 15.7 rewritten for the admin screen — done 2026-10-05.
- [x] `architecture.md`: add the admin age-gate routes and screen to the admin section of the Module Map — done 2026-10-05.
- [x] `current_state.md`: environment table (8.8.13), test counts, and "Phase 8" notes — done 2026-10-05.
- [x] `project_data.json`: entities updated with `AgeGateLockout` and full `User`/DPDP schema — done 2026-10-05.
- [ ] This file: tick the 8.8 items as they are completed and update the "📍 Last Updated" block.

---

### 8.9 — PENDING VENDOR DECISION — SMS OTP & Mobile Call Masking

> ⚠️ **These items are deferred to the end of Phase 8 until the client finalizes the vendor choice (Exotel vs Fast2SMS + Exotel).**

---

#### 8.9.1 — TRAI DLT Portal Registration & Template Approval

**Step-by-step Non-Code Instructions:**
- [ ] **Step 1:** Log into JioTrueConnect (`trueconnect.jio.com`) or Airtel DLT (`dltconnect.airtel.in`).
- [ ] **Step 2:** Register business as **Principal Entity (PE)**. Provide Business Registration / GSTIN and PAN. Obtain **PE ID**.
- [ ] **Step 3:** Register **Header / Sender ID** (`GOROLA` — 6 characters).
- [ ] **Step 4:** Register **OTP Content Template**:
  `Your GoRola verification code is {#var#}. Valid for 10 minutes. Do not share with anyone. -GoRola`
- [ ] **Step 5:** Obtain approved **Template ID** and input into chosen vendor dashboard (Exotel / Fast2SMS).

---

#### 8.9.2 — Telecommunications Vendor DPA (Exotel / Fast2SMS) — procedure in 8.7.2 Provider 4

- [ ] Log into vendor dashboard (Exotel / Fast2SMS), request/download signed DPA for DPDP compliance. Save to `DPAs/telecom-dpa.pdf`.

---

#### 8.9.3 — Real OTP Gateway Integration

- [ ] **RED — Integration (`otp.gateway.test.ts`):**
  - [ ] Test: `POST /api/v1/auth/otp/send` with `{ phone: '+919876543210' }` in production environment calls vendor API (`ExotelService.sendSMS` / `Fast2SMSService.sendSMS`) with PE ID and Template ID.
  - [ ] Test: Vendor API failure gracefully returns HTTP 502 `SMS_GATEWAY_ERROR`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] Create `apps/api/src/modules/auth/otp-gateway.service.ts` wrapping vendor REST API. Update `auth.service.ts` to replace dummy OTP with live gateway call.
  - [ ] Run integration test — **confirm GREEN.**

---

#### 8.9.4 — Mobile Call Masking Proxy Integration

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

- **Session 1 — 2026-07-29 — Plan Restructuring & TDD Specification:** Restructured Phase 8 into strict `TDD_INSTRUCTION_GUIDE.md` format. Expanded all technical sections with explicit Root Cause, RED integration & unit tests ("Run — confirm RED"), GREEN architectural tier steps, and end-to-end Verification Chains. Added detailed step-by-step non-coding instructions for vendor DPAs (Railway paid plan, Vercel free plan ToS, Ola Maps), Grievance Officer workflow, TRAI DLT portal registration, Data Inventory, and Data Breach Response Plan. Deferred vendor-dependent SMS OTP & Mobile Call Masking items to Section 8.9 at the end (originally numbered 8.8; renumbered on 2026-10-05 when the Age Eligibility Gate became 8.8).

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
    - Removed premature "Exotel" vendor reference from `OTP_AUTH` description across the app (pending Phase 8.9 vendor selection).
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
- **Session 12 — 2026-10-05 — Phase 8.7 Correction, Vercel/Ola Findings & Phase 8.8 (Age Eligibility Gate) Planning (documentation only, NO application code changed):**
  - **8.7 corrected:** researched Railway, Vercel, Razorpay, Exotel, Ola Maps (Krutrim), the mailbox provider and GitHub Actions; replaced 8.7.2 with a provider register and accurate DPA steps; added 8.7.7 (age-gate non-code prerequisites) and 8.7.8 (consolidated checklist); corrected the data inventory (Order History retention is 7 years, not 3; new rows for age confirmation, DOB-not-stored, lockout hash, CDN IP logs, map requests).
  - **Vercel (DECISION-061 amended):** no DPDP DPA needed because GoRola sends Vercel no personal data (edge IP logs only); the real problem is that the Hobby plan is non-commercial-only, so production needs Pro before the first real customer.
  - **Ola Maps:** no plan unlocks a separate DPA; save Terms/Privacy/Fair Usage from the Krutrim Cloud console, verify free-tier commercial-use and quota terms, and email support for a written role confirmation. Upgrade only if the free tier does not permit commercial use or quota is insufficient.
  - **Age gate planned (Section 8.8, DECISION-062):** neutral DOB screen after OTP and before account creation for new phones; DOB never stored; `User.ageConfirmedAt` + `AGE_DECLARATION` consent; `AgeGateLockout` (hashed phone, 90 days) + 24 h device cookie; server-side atomic consent writes replacing the browser's fire-and-forget `OTP_AUTH` call; no parental-consent flow at launch (reasoning in 8.8.0 and Consent Guide section 15); policy version bumped to 1.1; only the number 18 ever appears in the UI (guard test).
  - **Renumbering:** the vendor-dependent SMS OTP / call-masking section moved from 8.8 to 8.9 (still last).
  - **Findings to act on:** `HMAC_SECRET` / `ENCRYPTION_KEY` fall back to built-in defaults when unset (8.7.8 row 3); two different grievance email addresses exist in the product (8.7.8 row 1, fixed in 8.8.11).
  - **Admin pipeline added (8.8.14, documentation only):** full case pipeline from the complaint e-mail to the **Admin → Age Gate** screen (`/admin/age-gate`): look up by phone, Lock card / Account card, Unlock (approve), Decline appeal (disapprove), Suspend (reversible ban), Erase underage account (permanent ban), reasons required, audit rows without phone numbers, reply templates, TDD tiers and four Playwright journeys. New endpoints: `lookup`, `lockouts`, `decline`; `suspend` gains an optional reason and now revokes sessions (existing code only set `isActive=false`). The system sends no e-mail. The close-out checklist moved to 8.8.15; the Consent Guide diagram now shows five pipelines and section 15.7 describes the admin handling.
- **Session 13 — 2026-10-06 — Phase 8.8 (Sections 8.8.1–8.8.6 Implementation & Verification):**
  - **8.8.1 Schema & Seeds:** Added `ageConfirmedAt` and `ageConfirmedPolicyVersion` to `User`, `AgeGateLockout` table, migration with `AGE_DECLARATION` seeded into `ConsentPurposeConfig`. Added `ConsentPurposeConfig` upserts to `seed.ts`.
  - **8.8.2 Shared Constants & Pure Logic:** Added `MINIMUM_AGE_YEARS = 18`, `CURRENT_PRIVACY_POLICY_VERSION = "1.1"`, canonical `OTP_AUTH` and `AGE_DECLARATION` texts in `@gorola/shared`. Created pure `evaluateDateOfBirth(dob, now)` adhering to `Asia/Kolkata` midnight boundaries and leap-year rules.
  - **8.8.3 Lockout Repo, Service & Cookie:** Implemented `AgeGateRepository`, `AgeGateService` (with `hashPII` blind indexing), and HMAC-SHA256 signed `gorola_ag` device cooldown cookies (`verifyDeviceCookie` with `crypto.timingSafeEqual`).
  - **8.8.4 OTP Lockout Check & Age Ticket:** Implemented lockout gate on `sendOtp` (403 `AGE_GATE_LOCKED`), replaced `ensureBuyerUser` with `findBuyerByPhone`, issued single-use hashed age tickets (`age_ticket:<sha256(ticket)>`, TTL 600s).
  - **8.8.5 `confirm-age` Adult Path:** Implemented atomic account creation + dual server-side canonical consent logs (`OTP_AUTH` + `AGE_DECLARATION`) + `AGE_CONFIRMED` audit log in single Prisma `$transaction`. Registered `POST /api/v1/auth/buyer/confirm-age` route in Fastify. Redacted `dateOfBirth` and `ageTicket` in Logger.
  - **8.8.6 `confirm-age` Under-18 Path:** Implemented refusal flow with atomic single-use ticket consumption (`redis.del`), hashed phone lockout creation (`AgeGateService.lockPhone`), `AGE_GATE_LOCKOUT_CREATED` system audit log, 24h IP-based refusal counter with `AGE_GATE_ABUSE` security alert on the 5th attempt, tamper-evident HMAC-SHA256 `gorola_ag` device cooling-off cookie, and 403 `AGE_REQUIREMENT_NOT_MET` response.
  - **Quality Gates:** 100% GREEN (all age-gate & auth test files passed, 0 TypeScript errors, 0 ESLint errors/warnings).

- **Session 14 — 2026-10-06 — Phase 8.8 (Sections 8.8.7–8.8.8 Implementation & Verification):**
  - **8.8.7 Existing Users Without `ageConfirmedAt` (Legacy Gate, Refresh Gate & Underage Purge):**
    - Built unit tests in `auth.service.refresh-age.test.ts` and integration tests in `auth.confirm-age.legacy.integration.test.ts`.
    - Implemented `AgeGateRepository.confirmAdultLegacyBuyer`: updates `ageConfirmedAt`, `ageConfirmedPolicyVersion`, and records exactly 1 `AGE_DECLARATION` `ConsentLog` and `AGE_CONFIRMED` `AuditLog` without creating redundant `User` or `OTP_AUTH` rows.
    - Implemented underage purge in `AuthService.confirmAge`: computes pre-purge phone hash, terminates all active sessions, triggers immediate `UserRepository.permanentPurgeAndAnonymize` (skipping the 30-day grace period), locks phone hash for 90 days, and returns `403 AGE_REQUIREMENT_NOT_MET`.
    - Implemented refresh token age gate in `AuthService.refreshToken`: returns `403 AGE_CONFIRMATION_REQUIRED` when `user.ageConfirmedAt` is null, forcing fresh OTP login and age confirmation.
    - Added frontend API client handling in `apps/web/src/lib/api.ts` to clear session and redirect to login on `403 AGE_CONFIRMATION_REQUIRED`.
  - **8.8.8 Admin Endpoints (Unlock Wrongly Locked Adult & Erase Discovered Minor):**
    - Built integration tests in `admin.age-gate.test.ts` (11 tests) and unit tests in `admin.age-gate.service.test.ts`.
    - Implemented `AdminService.unlockAgeGate` & `POST /api/v1/admin/age-gate/unlock`: validates E.164 phone and reason (>= 10 chars), deletes `AgeGateLockout` record, writes `AGE_GATE_LOCKOUT_CLEARED` audit log with zero raw phone digits.
    - Implemented `AdminService.eraseUnderageUser` & `POST /api/v1/admin/users/:id/erase-underage`: validates reason (>= 10 chars), computes pre-purge phone hash, terminates Redis sessions (`rt:*` and `user_sessions:*`), executes `UserRepository.permanentPurgeAndAnonymize`, creates 90-day `AgeGateLockout`, and writes `USER_ERASED_UNDERAGE` audit log with zero raw phone digits.
    - Added strict RBAC (401 unauthenticated, 403 non-admin roles), input validation (400), 404 for missing records, and 409 `ALREADY_ERASED`.
  - **Quality Gates:** 100% GREEN (11 test files / 52 tests passing, `pnpm --filter @gorola/api typecheck` 0 errors, `pnpm --filter @gorola/api lint` 0 errors, 0 warnings).


