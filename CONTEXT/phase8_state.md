# GoRola — Phase 8 State (DPDP Act 2023 Compliance)

> **This file covers Phase 8: Full compliance with India's Digital Personal Data Protection Act 2023.**
> Phase 8 is independent of Phases 5–7 and can be worked on in parallel.
> It is a hard requirement before any real user data is collected in production.
> For overall project status: read `current_state.md` first.

---

## Phase Status

| Phase   | Name                    | Status      | Notes |
| ------- | ----------------------- | ----------- | ----- |
| Phase 8 | DPDP Act 2023 Compliance | NOT STARTED | Must be complete before production launch. No real user data may be collected until 8.1 and 8.2 are done. |

---

## 📍 Last Updated

- **Date:** —
- **Session Summary:** Not started.
- **Next Session Must Start With:** 8.1 — Non-code prerequisites (Grievance Officer, DPAs, TRAI DLT registration).
- **In Progress Right Now:** Nothing.
- **Current Blocker:** None.

> ⚠️ **Update THIS block at the end of every session** (not `current_state.md`). Also mark completed checklist items `[x]` and append to the Session Notes section at the bottom. Update `current_state.md` ONLY when Phase 8 changes status (NOT STARTED → IN PROGRESS → COMPLETE).

---

## ⚠️ Legal Disclaimer (Read Before Starting)

This phase plan is a **technical and operational guide** based on the publicly available text of the DPDP Act 2023. It does not constitute legal advice. The Rules under the Act are pending notification by the Central Government and may alter specific obligations. **Before going live, have a qualified Indian legal counsel review your Privacy Policy, consent flows, and Data Processing Agreements.** Monitor `dpdp.gov.in` and `meity.gov.in` for Rules updates.

---

## Why This Phase Exists

GoRola collects phone numbers, names, delivery addresses, and order history from Indian users. It sends OTPs via a third-party SMS gateway. It is hosted on US-based infrastructure (Railway, Vercel). All of this triggers Data Fiduciary status under the DPDP Act 2023.

**Current compliance posture: ~40/90 (Partial Compliance).** The technical security foundations are strong (HttpOnly JWTs, OTP rate-limiting, no raw OTP logging, Zod validation, soft deletes). What is entirely missing is the legal-facing surface: consent flows, a Privacy Policy, user rights endpoints, vendor paperwork, and an age verification strategy.

**Penalties for non-compliance range from ₹10 Crore to ₹250 Crore per violation category.** Children's data violations alone carry up to ₹200 Crore. This is not optional.

---

## Phase 8 Section Map

| Section | Name | Type | Blocks Launch? |
|---------|------|------|----------------|
| 8.1 | Non-Code Prerequisites | Operational / Legal | ✅ Yes — do first |
| 8.2 | Privacy Policy & Legal Pages | Frontend (no TDD needed) | ✅ Yes |
| 8.3 | Consent Collection Flow | Backend + Frontend (TDD) | ✅ Yes |
| 8.4 | User Rights: Erasure & Data Access | Backend + Frontend (TDD) | ✅ Yes |
| 8.5 | Age Verification | Backend + Frontend (TDD) | ✅ Yes |
| 8.6 | Consent Records & Audit Trail | Backend (TDD) | ✅ Yes |
| 8.7 | Session Transparency | Backend + Frontend (TDD) | High priority |
| 8.8 | Data Retention & Purge Jobs | Backend (TDD) | High priority |
| 8.9 | Data Inventory Document | Internal document | ✅ Yes |
| 8.10 | Data Breach Response Plan | Internal document | High priority |

---

## Mandatory API Contract Gate (all code sections in Phase 8)

- [ ] Required backend endpoint(s) fully implemented
- [ ] Backend integration tests verify: endpoint contract, HTTP status codes, auth/role guards
- [ ] Endpoint routes registered and returning correct responses
- [ ] Frontend/client tests verify: expected API envelope, loading state, empty state, error state

---

## Phase 8 Checklist

---

### 8.1 — Non-Code Prerequisites

> **These are operational and legal steps. No code is written here. Complete ALL of them before any real user data is collected.**
> There are no TDD steps in this section — these are human actions with documented outcomes.
> Mark each item `[x]` only when you have the signed document, confirmation email, or registration in hand.

---

#### 8.1.1 — Designate a Grievance Officer

**What the law requires:**
Every Data Fiduciary must appoint a named individual as Grievance Officer and publish their name and contact email publicly. "Contact support" does not qualify. The officer must respond to grievances within 30 days.

**Step-by-step:**

- [ ] **Step 1:** Decide who the Grievance Officer is. This must be a real, named individual — the founder, co-founder, or a designated legal contact. For a small startup, the founder is the correct choice.
- [ ] **Step 2:** Write down the following details on a private document and keep it accessible to the whole team:
  - Full name of the officer
  - Direct email address (e.g., `privacy@gorola.in` — a dedicated address is strongly preferable to a personal one)
  - This person's responsibility: receive, acknowledge within 48 hours, and resolve within 30 days all data-related complaints
- [ ] **Step 3:** Create the email address `privacy@gorola.in` (or equivalent) in your domain email provider (Google Workspace, Zoho Mail, etc.) and ensure the Grievance Officer receives all mail sent to it.
- [ ] **Step 4:** Note this name and email — they will be embedded in the Privacy Policy (Section 8.2) and the `/privacy` page footer.
- [ ] **Step 5:** Set a monthly calendar reminder for the Grievance Officer to review this inbox. Unanswered grievances after 30 days are a violation.

**Done when:** Named individual confirmed, dedicated email address created and tested, name and email ready to paste into the Privacy Policy.

---

#### 8.1.2 — TRAI DLT Registration for OTP SMS

**What the law requires:**
OTP SMS sent to Indian phone numbers must use a TRAI-registered sender ID and a DLT (Distributed Ledger Technology) pre-approved template. Unregistered templates are increasingly blocked by telecom operators. This is both a TRAI regulatory requirement and a DPDP Act requirement (your consent notice stating you share phone numbers with an SMS gateway is only valid if that gateway is used lawfully).

**Step-by-step:**

- [ ] **Step 1:** Navigate to the DLT portal. Fast2SMS uses the **Videocon/d2h Telecom DLT portal** or the **Airtel DLT portal** — check Fast2SMS's documentation at `https://www.fast2sms.com` for their current recommended DLT portal. As of 2025, most OTP providers support **JioTrueCloud DLT** (`trueconnect.jio.com`) or **Airtel DLT** (`dltconnect.airtel.in`).
- [ ] **Step 2:** Register your company as a **Principal Entity (PE)** on the DLT portal. You will need:
  - Company/business name (GoRola or your registered business entity)
  - GST number (if registered) or business registration document
  - Authorised signatory's Aadhaar or PAN
  - Company address
  - Allow 2–5 business days for approval.
- [ ] **Step 3:** Once your PE is approved, register your **Sender ID** (e.g., `GOROLA` or `GORLAA` — 6 characters, no spaces). This appears as the sender name on the OTP SMS.
- [ ] **Step 4:** Register your **OTP message template**. The template must match your actual SMS message exactly, with variable parts marked as `{#var#}`. Example template:
  ```
  Your GoRola verification code is {#var#}. Valid for 10 minutes. Do not share with anyone. -GoRola
  ```
  Obtain the **Template ID** assigned by the DLT portal after approval.
- [ ] **Step 5:** Log in to your Fast2SMS account. Go to Settings → DLT and enter your:
  - PE ID (from DLT portal)
  - Template ID
  - Sender ID
- [ ] **Step 6:** Send a test OTP to your own number using the registered template. Confirm it is delivered and the sender shows as your registered ID.
- [ ] **Step 7:** Record the PE ID, Template ID, and Sender ID in your private environment documentation (not in the repo).

**Done when:** PE registration approved, sender ID live, template ID configured in Fast2SMS, test OTP delivered successfully with registered sender name.

---

#### 8.1.3 — Data Processing Agreement (DPA) with Fast2SMS

**What the law requires:**
Fast2SMS processes Indian users' phone numbers on your behalf. They are a Data Processor. A DPA is mandatory before you send a single production OTP.

**Step-by-step:**

- [ ] **Step 1:** Log in to your Fast2SMS account at `https://www.fast2sms.com`.
- [ ] **Step 2:** Navigate to **Account Settings** → look for a "Legal", "Privacy", or "DPA" section. If not present, proceed to Step 3.
- [ ] **Step 3:** Send an email to Fast2SMS support (`support@fast2sms.com`) with the following:
  ```
  Subject: Request for Data Processing Agreement (DPA) — DPDP Act 2023 Compliance

  Dear Fast2SMS Team,

  We are [Your Company Name], operating GoRola (gorola.in), a quick-commerce platform.
  We use Fast2SMS to send OTP messages to Indian users. Under India's Digital Personal
  Data Protection Act 2023, we are required to have a signed Data Processing Agreement
  in place with all vendors who process personal data (phone numbers) on our behalf.

  Could you please provide your standard DPA, or confirm whether one is already
  included in your Terms of Service for business accounts?

  We would appreciate a written response for our compliance records.

  Thank you.
  ```
- [ ] **Step 4:** Save the response email (or signed DPA PDF) in a private compliance folder (e.g., Google Drive → GoRola Legal → DPAs).
- [ ] **Step 5:** If Fast2SMS cannot provide a DPA, document this in your compliance folder with the date and their response. Evaluate switching to MSG91 or Twilio, both of which offer standard DPAs.

**Done when:** Either a signed/confirmed DPA is on file, or a documented attempt + escalation decision is recorded.

---

#### 8.1.4 — Data Processing Agreement with Railway

**What the law requires:**
Railway.app hosts your PostgreSQL database, Redis instance, and Node.js API — all of which contain Indian users' personal data. Railway is a US-based company. You are the Data Fiduciary; they are a Data Processor. A DPA is required.

**Step-by-step:**

- [ ] **Step 1:** Log in to Railway at `https://railway.app`.
- [ ] **Step 2:** Navigate to your **account/workspace Settings** → look for "Legal" or "Privacy" or "Data Processing Agreement."
- [ ] **Step 3:** As of 2025, Railway offers a DPA as part of their business plan. If you are on the free/hobby tier, you may need to upgrade to access the DPA. Check `https://railway.app/legal` for current DPA availability.
- [ ] **Step 4:** If a self-serve DPA is available, accept it and download/screenshot the confirmation.
- [ ] **Step 5:** If not available self-serve, email `support@railway.app` using the same template as 8.1.3 (adapted for Railway). Document their response.
- [ ] **Step 6:** Save the confirmation or signed DPA in your compliance folder.

**Done when:** DPA confirmed/signed and saved. If Railway cannot provide one, a decision is made and documented (e.g., evaluate migrating database to a provider that offers a DPA, such as Supabase or Neon, both of which offer DPAs).

---

#### 8.1.5 — Data Processing Agreement with Vercel

**What the law requires:**
Vercel hosts your React frontend. While it is a static site, it serves your Indian users and Vercel's CDN infrastructure processes request data (IP addresses, headers). A DPA is required.

**Step-by-step:**

- [ ] **Step 1:** Navigate to `https://vercel.com/legal/dpa`.
- [ ] **Step 2:** Vercel provides a standard DPA. You must be on a **Pro or Enterprise plan** to access it. On the Hobby (free) plan, a DPA may not be available.
- [ ] **Step 3:** If on the Hobby plan: upgrade to Pro, or document that Vercel's Terms of Service (ToS) at `https://vercel.com/legal/terms` include the DPA provisions under GDPR/CCPA (check if these provisions adequately cover DPDP obligations — this needs legal review).
- [ ] **Step 4:** Accept the DPA in your Vercel account settings and download the confirmation.
- [ ] **Step 5:** Save in your compliance folder.

**Done when:** DPA accepted and saved, or documented alternative approach reviewed by legal counsel.

---

#### 8.1.6 — Data Processing Agreement with Razorpay (Pre-emptive — before flag is enabled)

**What the law requires:**
Razorpay will process payment data (which links to user identity) once `UPI_PAYMENT_ENABLED` or `CARD_PAYMENT_ENABLED` feature flags are turned on. The DPA must be in place *before* the flag is enabled — not after.

**Step-by-step:**

- [ ] **Step 1:** Log in to your Razorpay Dashboard at `https://dashboard.razorpay.com`.
- [ ] **Step 2:** Navigate to **Settings** → **Legal** → look for a DPA option.
- [ ] **Step 3:** If not present, email `support@razorpay.com` requesting a DPA for DPDP Act 2023 compliance (use the same template as 8.1.3). Razorpay is an Indian company — they are familiar with DPDP.
- [ ] **Step 4:** Save the response or signed DPA in your compliance folder.
- [ ] **Step 5:** Add a comment in `feature-flag.repository.ts` on the `UPI_PAYMENT_ENABLED` and `CARD_PAYMENT_ENABLED` flags:
  ```typescript
  // DPDP-NOTE: Do not enable this flag in production until Razorpay DPA is on file.
  // See: CONTEXT/compliance/dpa-razorpay.pdf
  ```

**Done when:** DPA on file and code comment added.

---

#### 8.1.7 — Create a Private Compliance Folder

**What the law requires:**
Demonstrating compliance requires documentation. If the Data Protection Board investigates, you must be able to produce records.

**Step-by-step:**

- [ ] **Step 1:** Create a private folder in your team's cloud storage (Google Drive, Notion, or equivalent): `GoRola Legal / DPDP Compliance`.
- [ ] **Step 2:** Create the following sub-folders and populate them as you complete this phase:
  - `DPAs/` — all signed Data Processing Agreements
  - `Consent-Records-Policy/` — your documented consent collection policy
  - `Data-Inventory/` — the data inventory from Section 8.9
  - `Breach-Response-Plan/` — the DBRP from Section 8.10
  - `Grievance-Log/` — a running log of any grievances received, their nature, and resolution date
  - `TRAI-DLT/` — PE ID, Template ID, and registration screenshots
- [ ] **Step 3:** Share access with all founding team members.

**Done when:** Folder structure created and accessible to the team.

---

### 8.2 — Privacy Policy & Legal Pages (Frontend)

> **Type: Frontend only. No backend changes needed. No TDD required — these are static content pages.**
> These pages must be live before any real user data is collected. Without a Privacy Policy, every piece of data you collect is being processed without lawful disclosure.

---

**Root Cause / Goal:**
GoRola has no Privacy Policy page. The DPDP Act requires that users be informed — in plain language — of what data is collected, why, how long it is retained, who it is shared with, their rights, and how to exercise them. Additionally, the Grievance Officer contact must be publicly accessible. Without this page, no consent collected in Section 8.3 is legally valid, because consent requires users to have been informed of what they are consenting to.

**Approach:**
Create two new static pages in `apps/web/src/pages/legal/`:
1. `PrivacyPolicyPage.tsx` — the full Privacy Policy
2. Update the site footer (`Footer.tsx` or equivalent) to add links to `/privacy` and the Grievance Officer contact

There are no API calls on these pages. No TDD required. These are content pages.

---

- [ ] **Create `apps/web/src/pages/legal/PrivacyPolicyPage.tsx`** routed at `/privacy`

  The page must include ALL of the following sections in plain English (no legalese). Use your actual data from the Data Inventory (Section 8.9) to fill in the details. Below is the exact required content structure:

  **Section 1 — Who we are**
  - [ ] Company/brand name: GoRola
  - [ ] Nature of service: quick-commerce delivery platform, Mussoorie, India
  - [ ] Contact email for privacy matters: `privacy@gorola.in` (or your designated address)

  **Section 2 — What personal data we collect**
  - [ ] Mobile phone number — collected at login for OTP authentication
  - [ ] Full name — collected at profile setup for order addressing
  - [ ] Delivery address (landmark, area, optional GPS coordinates) — collected at checkout
  - [ ] Order history — created when orders are placed
  - [ ] Device IP address — collected automatically by our servers on every request
  - [ ] Note: We do NOT collect biometric data, government ID numbers, financial account details, or health records directly.

  **Section 3 — Why we collect it (purpose for each data field)**
  - [ ] Phone number: OTP authentication only. Not added to marketing lists without separate consent.
  - [ ] Name + address: fulfilling your delivery orders.
  - [ ] Order history: providing you access to past orders and enabling store owners to fulfil orders.
  - [ ] IP address: server security, rate limiting, fraud prevention. Not linked to your profile.

  **Section 4 — How long we keep it**
  - [ ] Phone number: retained while your account is active. Deleted within 30 days of account deletion.
  - [ ] Name + address: retained while your account is active. Deleted within 30 days of account deletion.
  - [ ] Order history: retained for 3 years from order date for legal/tax record purposes, then deleted.
  - [ ] OTP logs: deleted automatically after 90 days.
  - [ ] Server/application logs (containing IP): deleted after 90 days.

  **Section 5 — Who we share your data with**
  - [ ] Fast2SMS (SMS gateway, India): receives your phone number to deliver OTP messages. Governed by a Data Processing Agreement.
  - [ ] Railway.app (USA): hosts our database and API servers. Your data is stored on their infrastructure. Governed by a Data Processing Agreement.
  - [ ] Vercel (USA): hosts our web application. Governed by a Data Processing Agreement.
  - [ ] Razorpay (India): processes payments if you pay by UPI or card. Only activated when payment features are enabled. Governed by a Data Processing Agreement.
  - [ ] We do not sell your data. We do not share your data with advertisers.

  **Section 6 — Your rights under DPDP Act 2023**
  - [ ] **Right to Information:** You can view a summary of all data we hold about you from your Account page → "My Data".
  - [ ] **Right to Correction:** You can update your name, phone number, and addresses from your Account page at any time.
  - [ ] **Right to Erasure:** You can delete your account and all associated data from your Account page → "Delete my account". Your data will be purged within 30 days.
  - [ ] **Right to Withdraw Consent:** You can withdraw consent for any non-essential data processing at any time from your Account page → "Privacy Settings". Withdrawal does not affect the lawfulness of processing before withdrawal.
  - [ ] **Right to Nominate:** You may nominate a person to exercise your data rights in the event of your death or incapacity. To register a nominee, email `privacy@gorola.in`.

  **Section 7 — Children's data**
  - [ ] GoRola is intended for users aged 18 and above. We do not knowingly collect data from anyone under 18.
  - [ ] If you believe a person under 18 has created an account, email `privacy@gorola.in` immediately.

  **Section 8 — Data breach notification**
  - [ ] In the event of a data breach affecting your personal data, we will notify you as soon as possible and report to the Data Protection Board within 72 hours of becoming aware.

  **Section 9 — Grievance Officer**
  - [ ] **Name:** [GRIEVANCE_OFFICER_FULL_NAME] (from Section 8.1.1)
  - [ ] **Email:** `privacy@gorola.in`
  - [ ] **Response time:** We will acknowledge your grievance within 48 hours and resolve it within 30 days.
  - [ ] **How to file a grievance:** Email us at `privacy@gorola.in` with the subject "Privacy Grievance" and describe your concern.

  **Section 10 — Changes to this policy**
  - [ ] We will notify you in-app when this policy changes materially. Continued use after notification constitutes re-consent only for changes that do not require fresh explicit consent.

  **Section 11 — Governing law**
  - [ ] This policy is governed by the Digital Personal Data Protection Act 2023 (India) and the Information Technology Act 2000.
  - [ ] Last updated: [DATE]

- [ ] **Add `/privacy` route** to `App.tsx` (public route, no auth required)

- [ ] **Update site footer** to include:
  - [ ] Link: "Privacy Policy" → `/privacy`
  - [ ] Text: "Grievance Officer: [NAME] — privacy@gorola.in"

- [ ] **Verification chain:**
  - [ ] Navigate to `gorola.in/privacy` → full Privacy Policy renders with all 11 sections → Grievance Officer name and email are visible → Links in footer work → ✅ Done.

---

### 8.3 — Consent Collection Flow

**Root Cause / Goal:**
The DPDP Act requires that explicit, specific, and informed consent is obtained *before* any personal data is processed. Currently, the OTP login flow in GoRola presents the phone number input field without any prior consent notice. The user's phone number is personal data. Collecting it — even to send an OTP — requires consent first.

Additionally, consent must be:
- Specific per purpose (account creation ≠ marketing ≠ analytics)
- In plain language
- Freely given (no consent wall blocking essential functionality)
- Withdrawable as easily as it was given

**Approach:**
1. Add a `ConsentLog` table to the database to store consent events.
2. Add a `POST /api/v1/consent` endpoint that records a consent event.
3. Add a `GET /api/v1/consent` endpoint that returns the user's current consent state.
4. Modify the OTP login flow: before showing the phone number input, show a consent notice screen with a "Continue" button. Tapping "Continue" is the consent event.
5. Add a "Privacy Settings" section to `/account` where users can view and withdraw non-essential consents.

---

#### 8.3.1 — ConsentLog Schema & Record Consent Endpoint

**Root Cause / Goal:**
No consent is legally valid unless it is recorded. The record must store: who consented, to what purpose, when, what version of the notice they saw, and from which IP/device. Without this record, you cannot demonstrate compliance.

**Fix / Approach:**
Create a `ConsentLog` model in `schema.prisma`. Create `consent.repository.ts`, `consent.service.ts`, `consent.controller.ts`, and routes. One endpoint to record consent, one to retrieve a user's consents.

---

- [ ] **RED — Integration (`consent.controller.test.ts`):**
  - [ ] Test setup: Authenticated buyer JWT. ConsentLog table empty.
  - [ ] Test: `POST /api/v1/consent` with body `{ purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: 'We collect your phone number to send a one-time password.' }` with valid buyer JWT → HTTP 201 with `{ success: true, data: { id, purpose, consentVersion, givenAt } }`.
  - [ ] Test: After the above POST, query the DB and assert exactly ONE `ConsentLog` row exists with `userId = <buyer id>`, `purpose = 'OTP_AUTH'`, `consentVersion = '1.0'`, `isWithdrawn = false`, `ipAddress` is not null.
  - [ ] Test: `POST /api/v1/consent` without a JWT → HTTP 401 `UNAUTHORIZED`.
  - [ ] Test: `POST /api/v1/consent` with an invalid `purpose` value (e.g., `purpose: 'HACK'`) → HTTP 400 `VALIDATION_ERROR`.
  - [ ] Test: `GET /api/v1/consent` with valid buyer JWT → HTTP 200 with `{ success: true, data: [{ purpose, consentVersion, givenAt, isWithdrawn }] }` listing all the user's consent records.
  - [ ] Test: `DELETE /api/v1/consent/:purpose` with valid buyer JWT and `purpose = 'MARKETING_EMAIL'` → HTTP 200; the corresponding `ConsentLog` row has `isWithdrawn = true` and `withdrawnAt` is set.
  - [ ] Test: `DELETE /api/v1/consent/OTP_AUTH` → HTTP 400 `CANNOT_WITHDRAW_ESSENTIAL_CONSENT` (OTP auth is essential — cannot be withdrawn without deleting the account).
  - [ ] **Run — confirm RED (no consent routes exist).**

- [ ] **GREEN — Backend (Schema → Repository → Service → Controller):**
  - [ ] [Schema] Add to `schema.prisma`:
    ```prisma
    model ConsentLog {
      id              String   @id @default(cuid())
      userId          String
      user            User     @relation(fields: [userId], references: [id])
      purpose         ConsentPurpose
      consentVersion  String
      noticeText      String
      ipAddress       String
      isWithdrawn     Boolean  @default(false)
      withdrawnAt     DateTime?
      givenAt         DateTime @default(now())

      @@index([userId, purpose])
    }

    enum ConsentPurpose {
      OTP_AUTH
      ORDER_PROCESSING
      MARKETING_EMAIL
      ANALYTICS
    }
    ```
  - [ ] Run `pnpm --filter @gorola/api prisma migrate dev --name add-consent-log`. Apply to test DB.
  - [ ] [Repository] Create `apps/api/src/modules/consent/consent.repository.ts`:
    - `create(data: CreateConsentInput, tx?)` — inserts a ConsentLog row
    - `findAllByUserId(userId: string)` — returns all consent records for a user
    - `findByUserIdAndPurpose(userId: string, purpose: ConsentPurpose)` — returns the most recent consent record
    - `withdraw(userId: string, purpose: ConsentPurpose, tx?)` — sets `isWithdrawn = true`, `withdrawnAt = now()`
  - [ ] [Service] Create `apps/api/src/modules/consent/consent.service.ts`:
    - `recordConsent(userId, purpose, consentVersion, noticeText, ipAddress)` — calls repository `create`
    - `getUserConsents(userId)` — calls repository `findAllByUserId`
    - `withdrawConsent(userId, purpose)`:
      - If `purpose === 'OTP_AUTH'` or `purpose === 'ORDER_PROCESSING'`, throw `CannotWithdrawEssentialConsentError`
      - Otherwise, call repository `withdraw`
  - [ ] [Errors] Create `apps/api/src/modules/consent/consent.errors.ts`:
    - `class CannotWithdrawEssentialConsentError extends AppError` with code `CANNOT_WITHDRAW_ESSENTIAL_CONSENT` and HTTP 400
  - [ ] [Schema/Zod] Create `apps/api/src/modules/consent/consent.schema.ts`:
    - `RecordConsentSchema`: validates `purpose` is a valid `ConsentPurpose` enum value, `consentVersion` is a non-empty string, `noticeText` is a non-empty string
  - [ ] [Controller] Create `apps/api/src/modules/consent/consent.controller.ts`:
    - `POST /api/v1/consent`: extract `userId` from `req.user`, extract `ipAddress` from `req.ip`, call `consentService.recordConsent`, return 201
    - `GET /api/v1/consent`: call `consentService.getUserConsents`, return 200
    - `DELETE /api/v1/consent/:purpose`: call `consentService.withdrawConsent`, return 200
  - [ ] [Routes] Register consent routes in the main Fastify app bootstrap. Apply buyer JWT auth middleware to all three routes.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Make `POST /api/v1/consent` with valid JWT → 201 response → DB row created with correct userId, purpose, IP, timestamp → `GET /api/v1/consent` returns it → `DELETE /api/v1/consent/OTP_AUTH` returns 400 → `DELETE /api/v1/consent/MARKETING_EMAIL` returns 200 and sets `isWithdrawn = true` in DB → ✅ Done.

---

#### 8.3.2 — Consent Notice Screen in OTP Login Flow

**Root Cause / Goal:**
Before a user enters their phone number on `LoginPage.tsx`, they must see a consent notice explaining what their phone number will be used for and who it will be shared with. Tapping "Continue" records this as their consent for `OTP_AUTH`. This is a single new screen (or modal step) at the start of the login flow.

**Fix / Approach:**
Add a "step 0" to the login flow: a consent notice screen. Only when the user taps "Continue & Accept" do they advance to the phone input step. On advancing, call `POST /api/v1/consent` (after the OTP is verified and the user has a JWT — store the consent intent client-side temporarily and record it server-side on successful auth).

Note on timing: Consent must be obtained before data collection. The phone number IS the data. Therefore, the notice must appear before the phone number field. The actual server-side recording happens after auth (because you need a userId), but the user's affirmative action occurs before the phone field is shown.

---

- [ ] **RED — Unit (`LoginPage.test.tsx`):**
  - [ ] Test: On initial render, the component shows a consent notice step (element with `data-testid="consent-notice-step"`), NOT the phone number input (`data-testid="phone-input"`).
  - [ ] Test: Consent notice step contains the text "We collect your phone number to send you a one-time password (OTP) for login" and a link to `/privacy`.
  - [ ] Test: Clicking "Continue & Accept" button on the consent step advances to the phone input step (`data-testid="phone-input"` becomes visible, consent step is gone).
  - [ ] Test: After successful OTP verification, `POST /api/v1/consent` is called with `{ purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: '...' }`.
  - [ ] Test: If the `POST /api/v1/consent` call fails (network error), the login still completes — consent recording failure must not block authentication (log the failure, but don't break the user journey).
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Types → Component):**
  - [ ] [State] In `LoginPage.tsx`, add a `step` state: `'consent' | 'phone' | 'otp' | 'done'`. Initial value: `'consent'`.
  - [ ] [Component] Add a new `ConsentNoticeStep` sub-component (inline in `LoginPage.tsx`):
    - Renders the notice text: "To log in, we need your phone number to send a one-time password. Your number will be sent to Fast2SMS (our SMS partner) for delivery only and will not be used for marketing. See our [Privacy Policy](/privacy)."
    - Renders a "Continue & Accept" button with `data-testid="consent-continue-btn"`.
    - On click: sets `step` to `'phone'`.
  - [ ] [Component] Wrap the existing phone input + OTP input sections to only render when `step !== 'consent'`.
  - [ ] [Post-auth] After successful OTP verification, in the `handleOTPSuccess` callback, fire-and-forget `apiClient.post('/api/v1/consent', { purpose: 'OTP_AUTH', consentVersion: '1.0', noticeText: CONSENT_NOTICE_TEXT })`. Wrap in try/catch — do not let failure block the login redirect.
  - [ ] [Constant] Define `CONSENT_NOTICE_TEXT` as a module-level constant in `LoginPage.tsx` — it must match the text shown on screen exactly (this is what gets stored in the DB).
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] User navigates to `/login` → sees consent notice with "Continue & Accept" button and Privacy Policy link → taps "Continue & Accept" → phone number field appears → user enters phone and OTP → on successful auth, `ConsentLog` row created in DB for this user with `purpose = OTP_AUTH` → user is redirected to home → ✅ Done.

---

#### 8.3.3 — Consent Withdrawal in Account Privacy Settings

**Root Cause / Goal:**
Consent withdrawal must be as easy as giving consent. Currently, there is no such mechanism in the `/account` page. The DPDP Act requires a single-click withdrawal option visible in account settings.

**Fix / Approach:**
Add a "Privacy Settings" sub-section to the `/account` page showing the user's active consents and a withdraw button for non-essential ones.

---

- [ ] **RED — Unit (`AccountPage.test.tsx` or `PrivacySettingsSection.test.tsx`):**
  - [ ] Test: When `GET /api/v1/consent` returns two records — `OTP_AUTH` (essential) and `MARKETING_EMAIL` (non-essential) — the component renders the `MARKETING_EMAIL` row with a "Withdraw consent" button and the `OTP_AUTH` row WITHOUT a withdraw button (labelled "Essential — cannot be withdrawn").
  - [ ] Test: Clicking "Withdraw consent" on `MARKETING_EMAIL` calls `DELETE /api/v1/consent/MARKETING_EMAIL`.
  - [ ] Test: After a successful withdrawal, the row shows "Withdrawn on [date]" and the withdraw button is no longer visible.
  - [ ] Test: While the withdrawal API call is in flight, the button shows a loading state and is disabled (prevents double-click).
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Types → Component):**
  - [ ] [Types] Create `ConsentRecord` type: `{ purpose: string; consentVersion: string; givenAt: string; isWithdrawn: boolean; withdrawnAt?: string }`.
  - [ ] [Component] Add a `PrivacySettingsSection` component to the `/account` page (new file: `apps/web/src/components/account/PrivacySettingsSection.tsx`):
    - On mount, call `GET /api/v1/consent` and display the list.
    - For each consent record where `isWithdrawn = false`:
      - If `purpose` is `OTP_AUTH` or `ORDER_PROCESSING`: render with label "Essential" and no withdraw button.
      - Otherwise: render a "Withdraw" button.
    - Withdraw button calls `DELETE /api/v1/consent/:purpose`, then re-fetches the list.
  - [ ] [Route] Add this section to the existing `/account` page under a "Privacy & Data" heading.
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] User goes to `/account` → scrolls to "Privacy & Data" section → sees their active consents → taps "Withdraw" on MARKETING_EMAIL → button shows loading → API call completes → row shows "Withdrawn" → refresh page → row still shows withdrawn state from DB → ✅ Done.

---

### 8.4 — User Rights: Erasure & Data Access

**Root Cause / Goal:**
The DPDP Act grants users two enforceable rights that must be technically implemented — not just stated in policy:
1. **Right to Erasure**: "Delete My Account & All My Data" — must trigger deletion across all systems.
2. **Right to Information**: "Download My Data" — a self-serve summary of all data held about the user.

Neither exists in GoRola today. Both must be self-serve from the `/account` page. A user must not need to email support to exercise these rights.

---

#### 8.4.1 — Right to Erasure: Account Deletion Endpoint

**Root Cause / Goal:**
No account deletion endpoint exists. The DPDP Act requires it to be self-serve and to trigger deletion of all personal data across all systems. GoRola uses soft deletes — the existing pattern must be extended to also clear personal data fields (replace name, phone, addresses with anonymised values) while retaining non-personal records (e.g., aggregated order counts for store analytics).

**Fix / Approach:**
Create `DELETE /api/v1/user/account` endpoint. This endpoint:
1. Marks the user as deleted (existing soft delete)
2. Overwrites personal data fields with anonymised values (`name = '[deleted]'`, `phone = 'DELETED_<userId>'`)
3. Soft-deletes all `Address` records for the user
4. Sets `isWithdrawn = true` on all `ConsentLog` records for the user
5. Invalidates all active JWTs (delete all `refresh:{token}` keys for this user from Redis)
6. Enqueues a BullMQ job (`UserDataPurgeJob`) to run 30 days later and hard-delete the anonymised user row (30-day grace period allows recovery if this was a mistake)

**Note on order data:** Orders must be retained for 3 years for GST/tax purposes. Personal data in orders (buyer name, delivery address text) should be anonymised. The `Order` records themselves are kept. This is documented in the Privacy Policy.

---

- [ ] **RED — Integration (`user.account-deletion.test.ts` — new file):**
  - [ ] Test setup: Seed a buyer with name "Test User", phone "+911234567890", 2 addresses, 1 order, 1 ConsentLog row. Generate a valid JWT for this user.
  - [ ] Test: `DELETE /api/v1/user/account` with valid buyer JWT → HTTP 200 with `{ success: true, data: { message: 'Your account has been scheduled for deletion. All personal data will be purged within 30 days.' } }`.
  - [ ] Test: After the above DELETE, query the DB: `User` row has `name = '[deleted]'`, `phone` starts with `'DELETED_'`, `isDeleted = true`.
  - [ ] Test: After the above DELETE, query the DB: both `Address` rows for this user have `deletedAt` set (soft-deleted).
  - [ ] Test: After the above DELETE, query the DB: the `ConsentLog` row has `isWithdrawn = true`.
  - [ ] Test: After the above DELETE, `POST /api/v1/auth/refresh` with the user's old refresh token → HTTP 401 (token invalidated).
  - [ ] Test: After the above DELETE, a `UserDataPurgeJob` has been enqueued in BullMQ (check the job queue in the test environment).
  - [ ] Test: `DELETE /api/v1/user/account` without a JWT → HTTP 401.
  - [ ] **Run — confirm RED (endpoint does not exist).**

- [ ] **GREEN — Backend (Repository → Service → Controller):**
  - [ ] [Repository] In `user.repository.ts`, add `anonymiseAndSoftDelete(userId: string, tx?)`:
    - Updates `User` row: `name = '[deleted]'`, `phone = 'DELETED_${userId}'`, `isDeleted = true`, `deletedAt = now()`
    - Soft-deletes all `Address` rows for this user: `updateMany({ where: { userId }, data: { deletedAt: now() } })`
  - [ ] [Repository] In `consent.repository.ts`, add `withdrawAllForUser(userId: string, tx?)`:
    - `updateMany({ where: { userId, isWithdrawn: false }, data: { isWithdrawn: true, withdrawnAt: now() } })`
  - [ ] [Service] In `user.service.ts`, add `requestAccountDeletion(userId: string, allUserRefreshTokens: string[])`:
    - Run in a `prisma.$transaction`:
      1. Call `userRepository.anonymiseAndSoftDelete(userId, tx)`
      2. Call `consentRepository.withdrawAllForUser(userId, tx)`
    - Outside the transaction:
      3. For each refresh token belonging to this user: `redis.del('refresh:${token}')`
      4. Enqueue `UserDataPurgeJob` with `{ userId, scheduledFor: now() + 30 days }` in BullMQ
    - Return `{ message: '...' }`
  - [ ] [BullMQ Worker] Create `apps/api/src/workers/user-data-purge.worker.ts`:
    - Processes `UserDataPurgeJob`
    - Hard-deletes the `User` row if `isDeleted = true` and `deletedAt` is > 30 days ago (safety check)
    - Logs the deletion with `logger.info({ userId }, 'User data hard-deleted per DPDP purge job')`
  - [ ] [Controller] In `user.controller.ts`, add handler for `DELETE /api/v1/user/account`:
    - Requires buyer JWT
    - Retrieves all refresh tokens for this user from Redis (use `redis.keys('refresh:*')` filtered by userId, or store a reverse index — see note below)
    - Calls `userService.requestAccountDeletion(userId, refreshTokens)`
    - Returns 200

  > **Implementation note on refresh token lookup:** The current Redis schema `refresh:{token} → userId` makes reverse lookup (userId → tokens) expensive. Add a Redis set `user_sessions:{userId}` that stores all refresh token keys for a user. Update `auth.service.ts` to add to this set on login and remove on logout. Then `requestAccountDeletion` can use `redis.smembers('user_sessions:${userId}')` to get all tokens.

  - [ ] [Routes] Register `DELETE /api/v1/user/account` with buyer JWT middleware.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **RED — Unit (`AccountPage.test.tsx`):**
  - [ ] Test: The `/account` page renders a "Delete my account" button with `data-testid="delete-account-btn"`.
  - [ ] Test: Clicking "Delete my account" opens a confirmation dialog with `data-testid="delete-account-confirm-dialog"` containing text "This action cannot be undone. All your personal data will be permanently deleted within 30 days."
  - [ ] Test: In the confirmation dialog, clicking "Cancel" closes the dialog and no API call is made.
  - [ ] Test: In the confirmation dialog, clicking "Confirm deletion" calls `DELETE /api/v1/user/account` and then calls `authStore.logout()` (redirect to home/login).
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Component):**
  - [ ] [Component] In `apps/web/src/pages/buyer/AccountPage.tsx`, add a "Danger Zone" section at the bottom.
  - [ ] Add "Delete my account" button (styled with danger/destructive variant — red outline).
  - [ ] On click, show a `<ConfirmationDialog>` using shadcn/ui `AlertDialog` component with the exact warning text.
  - [ ] On confirm: call `apiClient.delete('/api/v1/user/account')`, then call auth store logout, then `navigate('/')`.
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] User goes to `/account` → scrolls to bottom "Danger Zone" section → clicks "Delete my account" → confirmation dialog appears with warning text → user clicks "Confirm deletion" → API call → user is logged out and redirected to `/` → DB shows anonymised user with `isDeleted = true` → refresh tokens no longer work → BullMQ job queued for 30-day hard delete → ✅ Done.

---

#### 8.4.2 — Right to Information: Data Export Endpoint

**Root Cause / Goal:**
Users have the right to access a summary of all personal data GoRola holds about them. This must be self-serve — not require emailing support. The summary should cover: profile data, addresses, order history, and consent records.

**Fix / Approach:**
Create `GET /api/v1/user/my-data` endpoint returning a structured JSON summary of all data held about the authenticated user.

---

- [ ] **RED — Integration (`user.my-data.test.ts` — new file):**
  - [ ] Test setup: Seed a buyer with 1 address, 2 orders, 1 ConsentLog row.
  - [ ] Test: `GET /api/v1/user/my-data` with valid buyer JWT → HTTP 200 with `{ success: true, data: { profile: { name, phone, createdAt }, addresses: [...], orders: [{ id, status, totalAmount, createdAt }], consents: [{ purpose, givenAt, isWithdrawn }] } }`.
  - [ ] Test: The response does NOT include `passwordHash` or any internal fields.
  - [ ] Test: `GET /api/v1/user/my-data` without a JWT → HTTP 401.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Repository → Service → Controller):**
  - [ ] [Repository] In `user.repository.ts`, add `findFullProfileByUserId(userId: string)`:
    - Returns user with addresses, recent orders (last 50, `createdAt` desc), and consent logs — all in a single Prisma query with `include`.
    - Explicitly selects only non-sensitive fields: `select: { id: true, name: true, phone: true, createdAt: true }` on the user itself.
  - [ ] [Service] In `user.service.ts`, add `getMyData(userId: string)`:
    - Calls `userRepository.findFullProfileByUserId`
    - Maps the result to the public response shape — never include `passwordHash` or internal Prisma fields
  - [ ] [Controller] In `user.controller.ts`, add handler for `GET /api/v1/user/my-data` calling `userService.getMyData`.
  - [ ] [Routes] Register `GET /api/v1/user/my-data` with buyer JWT middleware.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **RED — Unit (`AccountPage.test.tsx` — additional tests):**
  - [ ] Test: The `/account` page renders a "Download my data" button with `data-testid="download-my-data-btn"`.
  - [ ] Test: Clicking the button calls `GET /api/v1/user/my-data` and downloads the response as a JSON file named `gorola-my-data-[date].json`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Component):**
  - [ ] Add a "Download my data" button to the `/account` page under the "Privacy & Data" section.
  - [ ] On click: call `GET /api/v1/user/my-data`, convert the JSON response to a Blob, trigger a browser download using `URL.createObjectURL`.
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] User goes to `/account` → Privacy & Data section → clicks "Download my data" → browser downloads `gorola-my-data-2026-06-09.json` → file contains profile, addresses, orders, and consents → no sensitive internal fields present → ✅ Done.

---

### 8.5 — Age Verification

**Root Cause / Goal:**
GoRola sells medical tests. Any user under 18 who places a medical test order triggers a serious DPDP violation (up to ₹200 Crore penalty for children's data). An "I am 18+" checkbox is explicitly NOT valid under DPDP. GoRola must either (a) enforce a meaningful age gate, or (b) explicitly state in Terms of Service that under-18 users are prohibited and implement a best-effort verification mechanism.

**Approach chosen (pragmatic for v1):**
Implement a two-layer approach:
1. **Explicit ToS acknowledgement at registration**: Add a checkbox "I confirm I am 18 years of age or older" to the OTP login flow (after consent notice, before phone input). This is not sufficient alone, but establishes a documented user declaration.
2. **Card-payment implication**: Require a debit/credit card for medical test orders. Card ownership implies 18+ (accepted verification method under DPDP Module 5). This gates the highest-risk category.
3. **Explicit ToS and Privacy Policy statement**: State that the platform is for 18+ only (already included in Section 8.2).

Note: Full government ID verification or Aadhaar-linked verification is the gold standard but requires significant infrastructure investment and is deferred to v2. This plan implements the best practical v1 posture and must be reviewed by legal counsel.

---

#### 8.5.1 — Age Declaration Checkbox at Login

**Root Cause / Goal:**
Add a mandatory "I confirm I am 18 or older" checkbox to the consent notice step of the login flow. Without this, there is no user-facing age gate at all.

---

- [ ] **RED — Unit (`LoginPage.test.tsx` — additional tests):**
  - [ ] Test: The consent notice step renders a checkbox with `data-testid="age-confirmation-checkbox"` labelled "I confirm I am 18 years of age or older".
  - [ ] Test: The "Continue & Accept" button is **disabled** when the checkbox is unchecked.
  - [ ] Test: The "Continue & Accept" button is **enabled** when the checkbox is checked.
  - [ ] Test: If the user somehow bypasses the UI and submits without the checkbox, the flow does not advance (test the state machine, not just the button).
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Component):**
  - [ ] In `ConsentNoticeStep` sub-component of `LoginPage.tsx`, add a controlled checkbox with local state `isAgeConfirmed: boolean`.
  - [ ] Disable the "Continue & Accept" button when `!isAgeConfirmed`.
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] User navigates to `/login` → sees consent notice → "Continue & Accept" is greyed out → checks "I confirm I am 18 or older" → button becomes active → user taps it → phone input appears → ✅ Done.

---

#### 8.5.2 — ToS Page and Explicit Under-18 Exclusion

- [ ] Create `apps/web/src/pages/legal/TermsOfServicePage.tsx` routed at `/terms`.
  - [ ] Include a clear section: "Eligibility: GoRola is intended for users aged 18 and above. By using this platform, you confirm you are 18 or older. If you are under 18, you must not use GoRola. If we discover an account belongs to a person under 18, we will immediately suspend the account and delete all associated data."
  - [ ] Add `/terms` to the footer alongside `/privacy`.
  - [ ] Add a "Terms of Service" link to the consent notice step in the login flow.

- [ ] **Verification chain:**
  - [ ] Navigate to `gorola.in/terms` → Terms of Service renders with explicit 18+ eligibility clause → link works from login consent screen and from footer → ✅ Done.

---

### 8.6 — Consent Records & Audit Trail Integrity

**Root Cause / Goal:**
Consent records must be tamper-evident. A malicious actor (or a code bug) must not be able to delete or modify a consent record — only mark it as withdrawn. The existing `AuditLog` table provides a model; consent logs must follow the same append-only discipline.

**Approach:**
Add a database-level constraint preventing hard-deletes on `ConsentLog`. All consent operations are append-only writes or `isWithdrawn = true` updates. Add an audit trail entry to `AuditLog` on every consent event.

---

- [ ] **RED — Integration (`consent.audit.test.ts` — new file):**
  - [ ] Test: After `POST /api/v1/consent`, an `AuditLog` row exists with `action = 'CONSENT_GIVEN'`, `entityId = <consentLogId>`, `userId = <buyer userId>`, `metadata` contains `{ purpose, consentVersion }`.
  - [ ] Test: After `DELETE /api/v1/consent/MARKETING_EMAIL`, an `AuditLog` row exists with `action = 'CONSENT_WITHDRAWN'` and the correct `entityId`.
  - [ ] Test: Attempt to directly call `prisma.consentLog.delete({ where: { id } })` in a test → the row is NOT deleted (this tests that the Prisma middleware or DB constraint blocks hard-deletes). If using Prisma middleware, mock it and verify the middleware throws. If using a DB trigger, verify the constraint violation.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend:**
  - [ ] [Prisma Middleware] In `apps/api/src/lib/prisma.ts`, add a Prisma middleware that intercepts `delete` and `deleteMany` operations on the `ConsentLog` model and throws an `AppError` with code `CONSENT_LOG_IMMUTABLE`. (This is a soft guard at the application layer; a DB-level trigger is the harder guard but more complex to add.)
  - [ ] [Service] In `consent.service.ts`, update `recordConsent` to also call `auditRepository.create({ action: 'CONSENT_GIVEN', entityType: 'ConsentLog', entityId: newLog.id, userId, metadata: { purpose, consentVersion } })`.
  - [ ] [Service] In `consent.service.ts`, update `withdrawConsent` to also call `auditRepository.create({ action: 'CONSENT_WITHDRAWN', ... })`.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Give consent → AuditLog row `CONSENT_GIVEN` created → Withdraw consent → AuditLog row `CONSENT_WITHDRAWN` created → Attempt programmatic delete of ConsentLog → middleware throws → ConsentLog row intact → ✅ Done.

---

### 8.7 — Session Transparency (Active Sessions List)

**Root Cause / Goal:**
DPDP Act Module 2.2 (Medium priority): Users should be able to see their active sessions (device, approximate location, last seen) and remotely terminate all sessions. This supports the Right to Information and gives users control over their account security.

**Approach:**
Extend the `user_sessions:{userId}` Redis set introduced in Section 8.4.1. When a session is created (login), store not just the token but a small metadata object: `{ token, createdAt, deviceHint, ipAddress }`. Display this list in `/account`.

---

- [ ] **RED — Integration (`auth.sessions.test.ts` — new file):**
  - [ ] Test setup: A buyer logs in twice (simulating two devices) — two refresh tokens issued.
  - [ ] Test: `GET /api/v1/auth/sessions` with valid buyer JWT → HTTP 200 with `{ success: true, data: { sessions: [{ sessionId, createdAt, ipAddress, isCurrent: true/false }] } }` — exactly 2 sessions.
  - [ ] Test: `DELETE /api/v1/auth/sessions` (terminate all) with valid buyer JWT → HTTP 200 → all refresh tokens for this user invalidated in Redis → subsequent `POST /api/v1/auth/refresh` with either old token → HTTP 401.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Backend (Auth Service → Controller):**
  - [ ] [Schema — Redis] Update `auth.service.ts` login: when storing `refresh:{token} → userId`, also add the token to `user_sessions:{userId}` Redis set: `redis.sadd('user_sessions:${userId}', token)`. Store session metadata as `session_meta:{token} → JSON { createdAt, ipAddress }` with TTL matching refresh token TTL (7 days).
  - [ ] [Service] In `auth.service.ts`, add `getActiveSessions(userId, currentToken)`:
    - `redis.smembers('user_sessions:${userId}')` → list of tokens
    - For each token, fetch `session_meta:{token}` from Redis
    - Mark the one matching `currentToken` as `isCurrent: true`
    - Filter out expired tokens (where `session_meta:{token}` no longer exists)
  - [ ] [Service] In `auth.service.ts`, add `terminateAllSessions(userId)`:
    - `redis.smembers('user_sessions:${userId}')` → list of tokens
    - For each token: `redis.del('refresh:${token}')`, `redis.del('session_meta:${token}')`
    - `redis.del('user_sessions:${userId}')`
  - [ ] [Controller] Add `GET /api/v1/auth/sessions` and `DELETE /api/v1/auth/sessions` handlers to `auth.controller.ts`.
  - [ ] [Routes] Register both routes with buyer JWT middleware.
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] **RED — Unit (`AccountPage.test.tsx` — additional tests):**
  - [ ] Test: "Active sessions" section renders a list of sessions from the API response. The current session row has a "Current session" badge. Other sessions have a no-op label (no per-session terminate in v1).
  - [ ] Test: "Sign out all devices" button calls `DELETE /api/v1/auth/sessions` and then calls `authStore.logout()`.
  - [ ] **Run — confirm RED.**

- [ ] **GREEN — Frontend (Component):**
  - [ ] Add "Active sessions" section to `/account` under "Privacy & Data".
  - [ ] On mount, call `GET /api/v1/auth/sessions` and render the list with `createdAt` formatted as "Jun 9, 2026" and `ipAddress` shown.
  - [ ] Add "Sign out all devices" button calling `DELETE /api/v1/auth/sessions`, then logout.
  - [ ] Run unit tests — **confirm GREEN.**

- [ ] **Verification chain:**
  - [ ] Log in on two browser tabs (simulating two sessions) → go to `/account` → Active Sessions section shows 2 sessions, current one marked → click "Sign out all devices" → both sessions invalidated → redirect to `/login` → previous session cookie no longer works → ✅ Done.

---

### 8.8 — Data Retention & Automated Purge Jobs

**Root Cause / Goal:**
The DPDP Act requires that personal data is deleted or anonymised once its stated purpose is fulfilled. Retention periods must be enforced by automated processes — not manual cleanup. Currently no automated purge jobs exist in GoRola. Pino logs containing `userId` and IP addresses accumulate indefinitely.

**Approach:**
Create BullMQ repeatable (cron) jobs for each retention-bound data category. Register them in the app bootstrap.

---

- [ ] **RED — Integration (`data-retention.test.ts` — new file):**
  - [ ] Test: Seed an `OTPLog` row with `createdAt = 91 days ago`. Run the `OtpLogPurgeJob` processor. Assert the row no longer exists in the DB.
  - [ ] Test: Seed an `OTPLog` row with `createdAt = 89 days ago`. Run the `OtpLogPurgeJob` processor. Assert the row STILL exists (not yet eligible for purge).
  - [ ] Test: Seed a `ConsentLog` row with `isWithdrawn = true` and `withdrawnAt = 31 days ago`, associated with a user that is `isDeleted = true`. Run the `DeletedUserPurgeJob`. Assert the user's `ConsentLog` rows are also deleted.
  - [ ] Test: Seed an `AuditLog` row with `createdAt = 366 days ago`. Run the `AuditLogArchiveJob`. Assert the row has been either deleted or moved to an archive table (choose one approach and state it in the decision log).
  - [ ] **Run — confirm RED (no purge jobs exist).**

- [ ] **GREEN — Backend (BullMQ Workers):**
  - [ ] [Worker] Create `apps/api/src/workers/otp-log-purge.worker.ts`:
    - Processes `OtpLogPurgeJob`
    - Deletes all `OTPLog` rows where `createdAt < now() - 90 days`
    - Logs: `logger.info({ deletedCount }, 'OTP log purge complete')`
  - [ ] [Worker] Create `apps/api/src/workers/audit-log-archive.worker.ts`:
    - Processes `AuditLogArchiveJob`
    - Deletes (or moves to a cold archive table) `AuditLog` rows older than 1 year
    - Log the count of archived rows
  - [ ] [Worker] The `UserDataPurgeJob` worker created in Section 8.4.1 handles the 30-day grace period hard-delete. Ensure it is registered here too.
  - [ ] [Bootstrap] In `apps/api/src/app.ts` (or a dedicated `workers/index.ts`), register all three workers as **repeatable BullMQ jobs** with cron schedules:
    - `OtpLogPurgeJob`: `cron: '0 3 * * *'` (daily at 3 AM)
    - `AuditLogArchiveJob`: `cron: '0 4 1 * *'` (first of every month at 4 AM)
    - `UserDataPurgeJob`: `cron: '0 2 * * *'` (daily at 2 AM — processes any queued purge jobs)
  - [ ] Run integration tests — **confirm GREEN.**

- [ ] [Application log retention] Configure Railway's log retention:
  - [ ] In Railway dashboard → your API service → Settings → **Log Retention**: set to 90 days (or the lowest available setting ≤ 90 days). Screenshot and save to your compliance folder.
  - [ ] Document: "Railway application logs retained for 90 days per DPDP Act requirement. Setting confirmed on [DATE] by [NAME]."

- [ ] **Verification chain:**
  - [ ] Seed an expired OTP log (91 days old) → manually trigger `OtpLogPurgeJob` in the dev environment → log shows "OTP log purge complete, deletedCount: 1" → query DB → row is gone → ✅ Done.

---

### 8.9 — Data Inventory Document

> **Type: Internal document. No code. Must be completed before launch.**
> This document is what you present to a regulator or legal counsel if investigated.
> Without it, you cannot demonstrate compliance.

---

**Goal:**
Create a complete Data Inventory — a map of every piece of personal data GoRola processes, with purpose, retention period, storage location, and third-party sharing.

**Step-by-step:**

- [ ] **Step 1:** Create a new document in your compliance folder: `GoRola Legal / DPDP Compliance / Data-Inventory / data-inventory-v1.md` (or a spreadsheet).

- [ ] **Step 2:** Fill in the following table completely. Use your actual schema, architecture.md, and Privacy Policy as sources of truth.

| Data Field | Collection Point | Purpose | Retention Period | Storage Location | Shared With | Legal Basis |
|---|---|---|---|---|---|---|
| Phone number | OTP login | Authentication | Duration of account + 30 days post-deletion | PostgreSQL (Railway, USA) | Fast2SMS (SMS delivery) | Consent (OTP_AUTH) |
| Full name | Profile setup | Order addressing & display | Duration of account + 30 days post-deletion | PostgreSQL (Railway, USA) | None | Consent (ORDER_PROCESSING) |
| Delivery address (landmark, area, lat/lng) | Checkout | Order fulfilment | Duration of account + 30 days post-deletion | PostgreSQL (Railway, USA) | None | Consent (ORDER_PROCESSING) |
| Order history (items, amounts, status) | Order placement | Fulfilment, buyer history, store analytics | 3 years from order date (GST/tax legal basis) | PostgreSQL (Railway, USA) | Store owners (their own store's orders) | Contractual obligation + Consent |
| OTP codes (hashed) | Auth flow | Security & rate limiting | 90 days | PostgreSQL (Railway, USA) | None | Consent (OTP_AUTH) |
| IP address | Every API request | Security, rate limiting, fraud prevention | 90 days (in application logs) | Railway log storage (USA) | None | Contractual obligation (security) |
| JWT session tokens | Login | Authentication session | 15 minutes (access) / 7 days (refresh) | Redis (Railway, USA) | None | Consent (OTP_AUTH) |
| Consent records | Login flow | Compliance demonstration | Duration of account + 30 days post-deletion | PostgreSQL (Railway, USA) | None | Legal obligation (DPDP Act) |
| Audit logs (admin/store actions) | System events | Accountability & fraud prevention | 1 year | PostgreSQL (Railway, USA) | None | Contractual obligation |

- [ ] **Step 3:** Add a "Sub-processors" section listing Fast2SMS, Railway, Vercel, and Razorpay (when enabled), with their country and the DPA status.

- [ ] **Step 4:** Add a "Review Schedule" note: this inventory must be reviewed and updated every 6 months or when a new data field or vendor is added.

- [ ] **Step 5:** Have your legal counsel review this document before launch.

**Done when:** Document is complete, reviewed, and saved in the compliance folder.

---

### 8.10 — Data Breach Response Plan

> **Type: Internal document. No code. Complete before launch.**

---

**Goal:**
Create a one-page Data Breach Response Plan (DBRP). If a breach occurs, this document tells the team exactly what to do, in what order, within what timeframe.

**Step-by-step:**

- [ ] **Step 1:** Create `GoRola Legal / DPDP Compliance / Breach-Response-Plan / dbrp-v1.md`.

- [ ] **Step 2:** Write the plan using the following template:

```markdown
# GoRola — Data Breach Response Plan v1
**Last reviewed:** [DATE]
**Owner:** [GRIEVANCE_OFFICER_NAME]

## What counts as a breach
Any unauthorised access to, disclosure of, or loss of personal data. Examples:
- Database credentials leaked or exposed in a public repo
- Railway/Vercel infrastructure compromised
- API endpoint returning another user's data (authorisation bug)
- OTP codes or tokens exposed in logs

## Step 1 — Detect & Contain (0–2 hours)
- [ ] Whoever discovers the breach immediately contacts [GRIEVANCE_OFFICER_NAME] at [email/phone]
- [ ] If the breach is ongoing: immediately rotate the affected credentials / revoke the compromised tokens
- [ ] If a Railway/Vercel infrastructure issue: contact Railway/Vercel support and request incident details
- [ ] Preserve all logs related to the incident — do NOT delete anything

## Step 2 — Assess (2–6 hours)
- [ ] Determine: what data was accessed? Whose? How many users affected? What time window?
- [ ] Classify severity:
  - Level 1 (low): < 10 users, no financial/health data, no indication of malicious intent
  - Level 2 (medium): 10–1,000 users OR any financial/health data
  - Level 3 (high): > 1,000 users OR credentials, tokens, or sensitive data exposed

## Step 3 — Notify (within 72 hours of confirmed breach)
- [ ] **Data Protection Board:** Once constituted, notify via the official portal (monitor dpdpboard.gov.in). Until the Board is constituted, document your notification intent and timeline.
- [ ] **Affected users:** Send an in-app notification and/or email/SMS to all affected users explaining:
  - What happened
  - What data was affected
  - What the likely consequences are
  - What GoRola is doing to fix it
  - What the user should do (e.g., change password if applicable, monitor for fraud)

## Step 4 — Remediate
- [ ] Fix the root cause
- [ ] Run a security audit of adjacent systems
- [ ] Update the DBRP with lessons learned

## Step 5 — Document
- [ ] Write an incident report: discovery timestamp, affected record count, data categories, root cause, remediation actions, notification timeline
- [ ] Save in Grievance-Log/ folder
```

- [ ] **Step 3:** Review this plan with the full founding team so everyone knows their role.

**Done when:** Document written, reviewed by all team members, saved in compliance folder.

---

## Launch Readiness Checklist

Before any real user data is collected in production, ALL of the following must be `[x]`:

### Legal / Operational Prerequisites
- [ ] 8.1.1 — Grievance Officer designated, email address live
- [ ] 8.1.2 — TRAI DLT registration complete, OTP template approved
- [ ] 8.1.3 — DPA with Fast2SMS on file
- [ ] 8.1.4 — DPA with Railway on file
- [ ] 8.1.5 — DPA with Vercel on file
- [ ] 8.1.7 — Compliance folder created and populated

### Legal Pages
- [ ] 8.2 — `/privacy` page live with all 11 sections
- [ ] 8.5.2 — `/terms` page live with explicit 18+ eligibility clause
- [ ] Footer links to `/privacy` and `/terms` working

### Code — Backend
- [ ] 8.3.1 — `ConsentLog` table migrated and consent API endpoints live
- [ ] 8.4.1 — `DELETE /api/v1/user/account` endpoint live
- [ ] 8.4.2 — `GET /api/v1/user/my-data` endpoint live

### Code — Frontend
- [ ] 8.3.2 — Consent notice screen in OTP login flow
- [ ] 8.3.3 — Consent withdrawal in `/account`
- [ ] 8.4.1 — "Delete my account" button in `/account`
- [ ] 8.4.2 — "Download my data" button in `/account`
- [ ] 8.5.1 — Age confirmation checkbox at login

### Documentation
- [ ] 8.9 — Data Inventory document complete
- [ ] 8.10 — Data Breach Response Plan written and reviewed

### Before enabling Razorpay (separately gated)
- [ ] 8.1.6 — DPA with Razorpay on file
- [ ] Code comment on UPI/Card feature flags confirmed

---

## Session Notes (Phase 8)

_(Append new entries here — never delete old entries.)_