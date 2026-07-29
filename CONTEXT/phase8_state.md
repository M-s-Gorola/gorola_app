# GoRola — Phase 8 State (DPDP Act 2023 Compliance)

> **This file covers Phase 8: Full compliance with India's Digital Personal Data Protection Act 2023.**
> Phase 8 is independent of Phases 5–7 and can be worked on in parallel.
> It is a hard requirement before any real user data is collected in production.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name                    | Status      | Notes |
| ------- | ----------------------- | ----------- | ----- |
| Phase 8 | DPDP Act 2023 Compliance | 🔴 NOT STARTED | Must be complete before production launch. Sections 8.1–8.7 use the current setup; Section 8.8 is pending client vendor selection (SMS OTP & Call Masking). |

---

## 📍 Last Updated

- **Date:** 2026-07-29
- **Session Summary:** Completed Section 8.1.1 (Database Least-Privilege Credential Setup) and Section 8.1.2 (PII Field Encryption at Rest). Implemented `database.least-privilege.test.ts` and `pii.encryption.test.ts`. Built AES-256-GCM encryption & HMAC-SHA256 blind indexing in `src/lib/crypto.ts`, updated `User` and `DeliveryRider` schema with `phoneHash`, generated and deployed migration `20260729201500_add_pii_encryption_fields`, and updated `user.repository.ts`, `rider.repository.ts`, `seed.ts`, and `seed-e2e.ts`. All integration tests and quality gates (`pnpm typecheck`, `pnpm lint`) passing 100% green.
- **Next Session Must Start With:** 8.2.1 — ConsentLog Schema & Consent API Endpoints (`POST /api/v1/consent`, `GET /api/v1/consent`, `DELETE /api/v1/consent/:purpose`).
- **In Progress Right Now:** Section 8.2.1 (ConsentLog Schema & Consent API Endpoints).
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

- [ ] **RED — Integration (`consent.controller.test.ts`):**
  - [ ] Test setup: Authenticated buyer JWT. ConsentLog table empty.
  - [ ] Test: `POST /api/v1/consent` with body `{ purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: 'We collect your phone number to send a one-time password.' }` → HTTP 201 with `{ success: true, data: { id, purpose, consentVersion, givenAt } }`.
  - [ ] Test: Query DB and assert exactly ONE `ConsentLog` row exists with `userId`, `purpose = 'OTP_AUTH'`, `isWithdrawn = false`, `ipAddress` not null.
  - [ ] Test: `GET /api/v1/consent` with buyer JWT → HTTP 200 returning array of user consent records.
  - [ ] Test: `DELETE /api/v1/consent/MARKETING_EMAIL` → HTTP 200; `ConsentLog` row updated to `isWithdrawn = true`, `withdrawnAt` set.
  - [ ] Test: `DELETE /api/v1/consent/OTP_AUTH` → HTTP 400 `CANNOT_WITHDRAW_ESSENTIAL_CONSENT`.
  - [ ] **Run — confirm RED (consent endpoints do not exist).**

- [ ] **GREEN — Backend (Schema & Migration → Repository → Service → Controller):**
  - [ ] [Schema & Migration] Add `ConsentLog` model and `ConsentPurpose` enum (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_EMAIL`, `ANALYTICS`) to `schema.prisma`. Generate physical SQL migration file: `pnpm --filter @gorola/api exec prisma migrate dev --name add_consent_log_model` using `DIRECT_URL` / `db_owner` DDL role.
  - [ ] [DB Deployment] Apply migration SQL file to local databases (`gorola_dev` and `gorola_test`) via `pnpm --filter @gorola/api prisma:bootstrap:test` BEFORE writing implementation code or running tests.
  - [ ] [Repository] Create `consent.repository.ts`: `create`, `findAllByUserId`, `findByUserIdAndPurpose`, `withdraw`.
  - [ ] [Service] Create `consent.service.ts`: `recordConsent`, `getUserConsents`, `withdrawConsent` (throws `CannotWithdrawEssentialConsentError` if purpose is essential).
  - [ ] [Controller] Create `consent.controller.ts` for `POST`, `GET`, `DELETE` routes.
  - [ ] [Routes] Register consent routes in Fastify app with buyer JWT middleware.
  - [ ] [Cascade & Regression Testing] Check across modules for cascading broken logic. Run full test suite (`pnpm test` / unit, integration, and E2E) and quality gates (`pnpm typecheck`, `pnpm lint`) — **confirm GREEN.**


- [ ] **Verification chain:**
  - [ ] Buyer calls `POST /api/v1/consent` → DB row created with IP and timestamp → `GET /api/v1/consent` lists consent → `DELETE /api/v1/consent/MARKETING_EMAIL` marks `isWithdrawn = true` → ✅ Done.

---

#### 8.2.2 — Consent Notice Screen in OTP Login Flow

**Root cause / Goal:**
Before a user enters their phone number on `LoginPage.tsx`, they must see a consent notice explaining what their phone number will be used for and who it will be shared with. Tapping "Continue & Accept" records this consent for `OTP_AUTH`.

---

- [ ] **RED — Unit / Component (`LoginPage.test.tsx`):**
  - [ ] Test: Initial render displays consent notice step (`data-testid="consent-notice-step"`), NOT phone input (`data-testid="phone-input"`).
  - [ ] Test: Consent notice contains text "We collect your phone number to send a one-time password (OTP)" and link to `/privacy`.
  - [ ] Test: Clicking "Continue & Accept" (`data-testid="consent-continue-btn"`) displays phone input step.
  - [ ] Test: After successful OTP login, `POST /api/v1/consent` is called with `{ purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: '...' }`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Types → Component):**
  - [ ] [Component] In `LoginPage.tsx`, add step state `'consent' | 'phone' | 'otp' | 'done'`. Render `ConsentNoticeStep` sub-component initially.
  - [ ] [Component] On successful OTP verification callback, call `apiClient.post('/api/v1/consent', { purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: CONSENT_NOTICE_TEXT })`.
  - [ ] Run unit test — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] User opens `/login` → Sees consent notice with Privacy Policy link → Clicks "Continue & Accept" → Enters phone & OTP → On auth success, `ConsentLog` row created in DB → ✅ Done.

---

#### 8.2.3 — Consent Withdrawal in Account Privacy Settings

- [ ] **RED — Unit / Component (`PrivacySettingsSection.test.tsx`):**
  - [ ] Test: Renders list of consents returned by `GET /api/v1/consent`. Non-essential consents render "Withdraw" button; essential consents (`OTP_AUTH`) render "Essential" label without button.
  - [ ] Test: Clicking "Withdraw" on `MARKETING_EMAIL` calls `DELETE /api/v1/consent/MARKETING_EMAIL` and updates UI status to "Withdrawn".
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Component):**
  - [ ] Create `apps/web/src/components/account/PrivacySettingsSection.tsx` and integrate into `/account` page.
  - [ ] Run unit test — **confirm GREEN.**

---

#### 8.2.4 — Consent Log Audit Trail & Immutability

- [ ] **RED — Integration (`consent.audit.test.ts`):**
  - [ ] Test: `POST /api/v1/consent` creates an `AuditLog` row with `action = 'CONSENT_GIVEN'`.
  - [ ] Test: `DELETE /api/v1/consent/MARKETING_EMAIL` creates an `AuditLog` row with `action = 'CONSENT_WITHDRAWN'`.
  - [ ] Test: Direct programmatic call to `prisma.consentLog.delete({ where: { id } })` throws `AppError` code `CONSENT_LOG_IMMUTABLE` (Prisma middleware guard).
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] Add Prisma middleware in `apps/api/src/lib/prisma.ts` blocking `delete` and `deleteMany` on `ConsentLog`. Update `consent.service.ts` to log to `AuditLog`.
  - [ ] Run integration test — **confirm GREEN.**

---

### 8.3 — User Rights: Erasure, Access & Nomination (Current Setup)

#### 8.3.1 — Right to Erasure (`DELETE /api/v1/user/account`)

**Root cause / Goal:**
No account deletion endpoint exists. DPDP Act requires self-serve account deletion that triggers purging of personal data across all systems. GoRola soft-deletes users; this must anonymize PII fields (`name = '[deleted]'`, `phone = 'DELETED_${userId}'`), soft-delete addresses, invalidate active refresh tokens, and queue a 30-day hard-purge job in BullMQ.

---

- [ ] **RED — Integration (`user.account-deletion.test.ts`):**
  - [ ] Test setup: Seed buyer with name "Test User", phone "+919876543210", 2 addresses, 1 order, 1 ConsentLog.
  - [ ] Test: `DELETE /api/v1/user/account` + buyer JWT → HTTP 200 with `{ success: true, data: { message: 'Your account has been scheduled for deletion...' } }`.
  - [ ] Test: Query DB: `User` row has `name = '[deleted]'`, `phone` starts with `'DELETED_'`, `isDeleted = true`.
  - [ ] Test: Query DB: `Address` rows have `deletedAt` set. `ConsentLog` rows have `isWithdrawn = true`.
  - [ ] Test: Refresh token for user in Redis `refresh:{token}` is deleted.
  - [ ] Test: `UserDataPurgeJob` enqueued in BullMQ for 30 days later.
  - [ ] **Run — confirm RED (endpoint does not exist).**

- [ ] **GREEN — Backend & Frontend:**
  - [ ] [Repository] Add `anonymiseAndSoftDelete(userId)` to `user.repository.ts` and `withdrawAllForUser(userId)` to `consent.repository.ts`.
  - [ ] [Service] Add `requestAccountDeletion(userId)` to `user.service.ts`: runs anonymization, deletes Redis session keys `user_sessions:{userId}`, enqueues BullMQ `UserDataPurgeJob`.
  - [ ] [Worker] Create `apps/api/src/workers/user-data-purge.worker.ts`: hard-deletes `User` row after 30-day grace period.
  - [ ] [Controller] Add handler for `DELETE /api/v1/user/account`.
  - [ ] [Frontend] Add "Danger Zone" section to `/account` page with "Delete my account" button and confirmation dialog.
  - [ ] Run integration & unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Buyer goes to `/account` → Clicks "Delete my account" → Confirms deletion modal → API anonymizes PII and invalidates session → User is logged out and redirected to `/` → DB shows anonymized user row → BullMQ job scheduled for 30-day hard purge → ✅ Done.

---

#### 8.3.2 — Right to Information (`GET /api/v1/user/my-data`)

- [ ] **RED — Integration (`user.my-data.test.ts`):**
  - [ ] Test: `GET /api/v1/user/my-data` + buyer JWT → HTTP 200 with JSON payload `{ profile, addresses, orders, consents }`. `passwordHash` and internal Prisma fields are absent.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend & Frontend:**
  - [ ] [Service] Add `getMyData(userId)` to `user.service.ts` selecting profile, addresses, recent 50 orders, and consents.
  - [ ] [Controller] Add `GET /api/v1/user/my-data` route with buyer JWT middleware.
  - [ ] [Frontend] Add "Download my data" button on `/account` page triggering browser download of `gorola-my-data-[date].json`.
  - [ ] Run integration & unit tests — **confirm GREEN.**

---

#### 8.3.3 — Right to Nominate (India-Specific Sec 14)

- [ ] **RED — Integration (`user.nominee.test.ts`):**
  - [ ] Test: `PUT /api/v1/user/nominee` with `{ nomineeName: 'Rajesh Kumar', nomineeContact: 'privacy-nominee@test.com', relationship: 'Spouse' }` + buyer JWT → HTTP 200; saves fields on user record.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend & Frontend:**
  - [ ] [Schema] Add `nomineeName String?`, `nomineeContact String?`, `nomineeRelationship String?` to `User` model in `schema.prisma`. Run migration.
  - [ ] [Service/Controller] Add `updateNominee(userId, data)` in `user.service.ts` and `PUT /api/v1/user/nominee` route.
  - [ ] [Frontend] Add "Data Nominee (DPDP Act Sec 14)" card to `/account` page with form inputs.
  - [ ] Run integration & unit tests — **confirm GREEN.**

---

### 8.4 — Session Transparency & Security Alerting (Current Setup)

#### 8.4.1 — Active Sessions & Remote Revoke

- [ ] **RED — Integration (`auth.sessions.test.ts`):**
  - [ ] Test: `GET /api/v1/auth/sessions` + buyer JWT → HTTP 200 with `{ sessions: [{ sessionId, createdAt, ipAddress, isCurrent }] }`.
  - [ ] Test: `DELETE /api/v1/auth/sessions` (terminate all) → HTTP 200; invalidates all refresh tokens for user in Redis.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend & Frontend:**
  - [ ] In `auth.service.ts`, store session metadata in Redis `user_sessions:{userId}` set on login.
  - [ ] Add `getActiveSessions` and `terminateAllSessions` in `auth.service.ts`. Add `GET` and `DELETE` routes in `auth.controller.ts`.
  - [ ] Add "Active Sessions" card on `/account` page with "Sign out all devices" button.
  - [ ] Run integration & unit tests — **confirm GREEN.**

---

#### 8.4.2 — Security Log Anomaly Alerting

- [ ] **GREEN — Backend:** Add Pino error transport logger in `apps/api/src/lib/logger.ts` to log structured `SECURITY_ALERT` JSON events when rate-limits or failed auth attempts trigger bursts.

---

### 8.5 — Automated Data Retention & Purge Jobs (Current Setup)

#### 8.5.1 — BullMQ Automated Cron Purge Workers

- [ ] **RED — Integration (`data-retention.test.ts`):**
  - [ ] Test: Seed `OTPLog` row with `createdAt = 91 days ago`. Run `OtpLogPurgeJob`. Assert row deleted.
  - [ ] Test: Seed `OTPLog` row with `createdAt = 89 days ago`. Run `OtpLogPurgeJob`. Assert row retained.
  - [ ] Test: Seed `AuditLog` row with `createdAt = 366 days ago`. Run `AuditLogArchiveJob`. Assert row archived/deleted.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend Workers:**
  - [ ] Create `apps/api/src/workers/otp-log-purge.worker.ts` (purges `OTPLog` > 90d).
  - [ ] Create `apps/api/src/workers/audit-log-archive.worker.ts` (archives `AuditLog` > 1y).
  - [ ] Register workers in app bootstrap as repeatable BullMQ cron jobs (`OtpLogPurgeJob`: daily 3 AM; `AuditLogArchiveJob`: monthly 4 AM; `UserDataPurgeJob`: daily 2 AM).
  - [ ] Run integration tests — **confirm GREEN.**

---

#### 8.5.2 — Railway Application Log Retention Settings

- [ ] Navigate to Railway Dashboard → API Service → Settings → Log Retention → Set retention to **90 days**. Document configuration date.

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
| IP Address | Security & Anti-Fraud | 90 Days | Railway logs (US) | None | Legitimate Security |

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