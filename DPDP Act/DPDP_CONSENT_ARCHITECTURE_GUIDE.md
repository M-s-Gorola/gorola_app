# GoRola DPDP Act 2023 — Comprehensive Consent & Data Processing Architecture Guide

> **Document Version:** 1.8  
> **Applicable Law:** Digital Personal Data Protection (DPDP) Act, 2023 (India)  
> **Entity (Data Fiduciary):** GoRola (Mountain Commerce Operations)  
> **Audience:** Product Engineering, Compliance, Legal & Operations  
> **Last Updated:** 2026-10-05 — Age Eligibility Gate (18+ only, `AGE_DECLARATION`, §15), server-side `OTP_AUTH` write at `confirm-age`, Vercel/Ola Maps corrections (§14.6). Previously: 2026-10-02 — Phase 8.3.4 DPDP Architecture Overhaul (Dynamic `ConsentPurposeConfig` Database Configuration Table, Multi-Channel `MARKETING_COMMS` Standardisation, Precise GPS/Display Name Statutory Notices, and Admin Consent Auditing Panel).

---

## 1. Executive Summary & Core Architectural Principles

The Digital Personal Data Protection Act (DPDP Act) 2023 establishes strict requirements for collecting, processing, storing, and managing personal data of Indian citizens (Data Principals). GoRola enforces DPDP compliance via five foundational tenets:

1. **Purpose Limitation (Section 5(1)):** Personal data must only be processed for specific, explicitly disclosed purposes. Data collected for one purpose (e.g., login OTP) cannot be reused for an unrelated purpose (e.g., marketing) without separate, unbundled consent.
2. **Clear & Prominent Notice (Section 5(2)):** Before or at the time of requesting consent, the user must receive an easily understandable notice describing the personal data collected, the purpose, third-party processors, retention periods, and DPBI complaint routes.
3. **Unbundled & Non-Coercive Consent (Section 6(1)):** Essential services (order delivery) must never be conditioned on consenting to non-essential services (marketing or analytics).
4. **Explicit Opt-In & Read Acknowledgement:** Optional consents must default to **unchecked / opt-out**. Essential consents require an explicit read-acknowledgement (`[ ] I have read and understood this notice`) at the point of data entry.
5. **Immutable Audit Trail:** All consent grants and withdrawals are recorded with UTC timestamps, consent version, notice text, and IP address in an append-only ledger (`ConsentLog`) referencing the `ConsentPurposeConfig` configuration table.

---

## 2. The 5 Consent Pipelines: Detailed Breakdown

```
      +──────────────────────────────────────────────────────────────────────────────────────────────────────+
      |                                        USER (DATA PRINCIPAL)                                         |
      +──────────────────────────────────────────────────────────────────────────────────────────────────────+
          (Login / OTP)     (Address/Checkout)  (Checkout/Settings)     (First Visit)     (Login, after OTP)
               |                    |                    |                    |                    |
               v                    v                    v                    v                    v
      +──────────────────+ +──────────────────+ +──────────────────+ +──────────────────+ +──────────────────+
      | 1. OTP_AUTH      | | 2. ORDER_        | | 3. MARKETING_    | | 4. ANALYTICS     | | 5. AGE_          |
      |                  | |    PROCESSING    | |    COMMS         | |                  | |    DECLARATION   |
      | (Essential)      | | (Essential)      | | (Optional)       | | (Optional)       | | (Essential)      |
      +──────────────────+ +──────────────────+ +──────────────────+ +──────────────────+ +──────────────────+
               |                    |                    |                    |                    |
               v                    v                    v                    v                    v
      +──────────────────+ +──────────────────+ +──────────────────+ +──────────────────+ +──────────────────+
      | SUB-PROCESSOR:   | | SUB-PROCESSORS:  | | PROCESSORS:      | | PROCESSOR:       | | INTERNAL ONLY:   |
      | • Exotel SMS     | | • Ola Maps       | | • Exotel SMS /   | | • Anonymous      | | • No third party |
      |   Gateway        | | • Razorpay       | |   DLT Gateways   | |   Route          | | • DOB never      |
      |                  | | • Store Partners | | • Internal Comms | |   Telemetry      | |   stored         |
      |                  | | • Riders         | |   Engine         | |                  | | • ageConfirmedAt |
      +──────────────────+ +──────────────────+ +──────────────────+ +──────────────────+ +──────────────────+
```

---

### Pipeline 1: `OTP_AUTH` (Authentication & Account Security)

| Property | Specification |
|---|---|
| **Consent Purpose Key** | `OTP_AUTH` (relational record in `ConsentPurposeConfig`) |
| **Legal Basis** | Consent / Necessary for Account Verification & Authentication (DPDP Sec 5(2)) |
| **Type** | **Essential** (Required to access buyer account) |
| **Data Collected** | Mobile phone number (`phone`, blind indexed as `phoneHash`, AES-256-GCM encrypted at rest) |
| **Third-Party Processors** | **Exotel** (DLT-registered telecommunications SMS gateway for sending 6-digit OTPs) |
| **Where it Appears in UI** | `/login` (Buyer Login Modal/Page — Step 1 Consent Notice Gate before mobile entry) |
| **Checkbox & Notice Structure** | **Inside-Card Read Acknowledgement Checkbox:** `[ ] I have read and understood this notice` embedded at the bottom of the white card container. "Continue & Accept" button is strictly disabled until checked. Also includes direct trigger for 5-section `<ConsentNoticeModal purpose="OTP_AUTH" />`. |
| **Frequency** | Recorded **server-side, atomically with account creation** at `POST /auth/confirm-age` (v1.1; replaces the earlier browser-posted write). The v1.1 notice includes the 18+ sentence. Subsequent logins verify against the existing account without repeating blocking notices. See §15. |
| **Withdrawal / Deletion** | Tied to account existence. Withdrawn when user requests Account Deletion under DPDP Section 12 / 8.3 (`DELETE /api/v1/user/account`). |

---

### Pipeline 2: `ORDER_PROCESSING` (Order Fulfillment, Payments & Navigation)

| Property | Specification |
|---|---|
| **Consent Purpose Key** | `ORDER_PROCESSING` (relational record in `ConsentPurposeConfig`) |
| **Legal Basis** | Contractual Necessity & Explicit Consent for Fulfillment |
| **Type** | **Essential** (Required to fulfill grocery/medicine orders and home visits) |
| **Data Collected** | Display Name (if provided by user), Delivery Address, GPS Coordinates (`lat`, `lng`), Order Item Details, Payment Transaction Identifiers (online payment only) |
| **Third-Party Sub-processors & Partners** | 1. **Ola Maps (Navigation):** Geocoding and steep hill navigation routing — applies to ALL orders.<br>2. **Local Store Partners (Merchants):** Packing and preparing grocery/medicine items — applies to ALL orders.<br>3. **Assigned Delivery Riders:** Physical last-mile transport to user address — applies to ALL orders.<br>4. **Razorpay (Payment Gateway):** Payment processing, UPI, Card tokenization & refund handling — **applies ONLY when UPI or Card payment method is selected. Never invoked for Cash on Delivery (COD) orders.** |
| **Canonical Notice Text (used at ALL touchpoints)** | *"Your address, landmark notes, and GPS coordinates are shared with **Ola Maps** for location services, and with assigned store partners and delivery riders for order fulfillment. If you choose online payment, your transaction details are processed securely via **Razorpay**. Governed by India's DPDP Act 2023."* |
| **Data Retention** | Saved addresses and associated GPS coordinates are stored until deleted by the user. Order fulfillment GPS coordinates (`deliveryLat`, `deliveryLng`) are nulled upon account erasure; financial transaction records (order items, GST totals) are retained for 7 years under Indian GST statutory mandates. |
| **Where it Appears in UI** | 1. **Saved Addresses Page (`/account/addresses`):** In the Add/Edit address dialog.<br>2. **Checkout Page (`/checkout`):** In the New Address entry card.<br>3. **Booking Timeslot Page (`/booking`):** In the Add Address dialog.<br>4. **Account Privacy Dashboard (`/account/privacy`):** Unified `ORDER_PROCESSING` status card (shows `🟢 Active` or `🟡 Pending — Activated when you save an address...`). |
| **Checkbox & Option 2 State Handling** | **First-Time / Unconsented State:** Full notice card with `[ ] I have read and understood this notice` checkbox inside the address dialog. "Save Address" button is disabled until checked.<br>**Consented State (Option 2):** When saving a subsequent address, the notice card displays `🟢 Consent Active • Permanent operational requirement` with `<ConsentNoticeModal purpose="ORDER_PROCESSING" />` and no blocking checkbox. Review steps omit redundant cards for frictionless repeat orders. |
| **Frequency** | Recorded **once** on first address save or checkout (whichever comes first). Subsequent checkouts, address edits, and repeat orders do **not** re-trigger consent. Reuse the established `ConsentLog` record unless the privacy policy version is bumped. |

---

### Pipeline 3: `MARKETING_COMMS` (Promotions, Seasonal Hill-Station Offers & Discounts)

| Property | Specification |
|---|---|
| **Consent Purpose Key** | `MARKETING_COMMS` (relational record in `ConsentPurposeConfig`) |
| **Legal Basis** | Explicit Opt-In Consent (DPDP Section 6(1)) |
| **Type** | **Optional / Non-Essential** (Cannot block checkout or login) |
| **Data Collected** | Mobile phone number, Display Name (if provided), Preferred Store Categories |
| **Third-Party Processors** | Internal Marketing Engine & Authorized DLT-Registered SMS Gateways (e.g. Exotel) for promotional SMS broadcasts. (Zero sharing with external programmatic ad networks). |
| **Where it Appears in UI** | 1. **Checkout & Booking Review Screens:** Rich card with `<ConsentNoticeModal purpose="MARKETING_COMMS" />` and un-ticked `[ ] Yes, send me seasonal Mussoorie harvest updates and discounts...` checkbox.<br>2. **Account Privacy Dashboard (`/account/privacy`):** Interactive **Opt In** / **Withdraw** toggle card. |
| **Checkbox vs Option 2 State** | **Unconsented:** Un-ticked checkbox defaulting to OFF.<br>**Consented (Option 2):** Card displays `🟢 Consent Active • Manage or withdraw in Privacy Settings`. |
| **Frequency** | User can independently Opt-In (`POST /api/v1/consent`) or Withdraw (`DELETE /api/v1/consent/MARKETING_COMMS`) at any time in real time. |
| **Withdrawal / Opt-Out** | 1-click self-serve withdrawal in `/account/privacy` Privacy Settings. Immediately scrubs user from all promotional distribution queues within 48 hours. |

---

### Pipeline 4: `ANALYTICS` (Anonymous Telemetry & App Performance)

| Property | Specification |
|---|---|
| **Consent Purpose Key** | `ANALYTICS` (relational record in `ConsentPurposeConfig`) |
| **Legal Basis** | Prior Notice & Opt-In Consent for Telemetry |
| **Type** | **Optional** |
| **Data Collected** | Route latency telemetry, client performance metrics, screen load timings. **Zero PII or personal identity is tracked.** |
| **Where it Appears in UI** | Floating **Analytics Consent Banner** at the bottom of the screen upon the buyer's first authenticated session, containing `<ConsentNoticeModal purpose="ANALYTICS" />`. |
| **Role Gating** | **Buyer Role Only (`role === 'BUYER'`).** Never rendered for Riders, Store Owners, or Admins to prevent workflow interference. |
| **Actions** | Dual choice: **"Accept Analytics"** (`POST /api/v1/consent`) vs **"Decline / Essential Only"** (stores `declined` in `localStorage` with background `DELETE /api/v1/consent/ANALYTICS`). |
| **Self-Serve Control** | Can be toggled on/off in `/account/privacy` Privacy Settings. |

### Pipeline 5: `AGE_DECLARATION` (Age Eligibility, 18+ Only)

Written together with `OTP_AUTH` in one server-side transaction at account creation. No date of birth is stored. Full specification, flow, parental-approval reasoning, admin handling and tests are in [Section 15](#15-age-eligibility-gate-age_declaration--18-only).

---

## 5. Checkboxes vs Affirmative Action Buttons

| Scenario | Legal DPDP Rule | GoRola Implementation (Phase 8.2.9 & 8.3.4) |
|---|---|---|
| **Essential Service (Initial Data Collection)** (e.g. Login OTP, First Address Save) | DPDP Sec 5(2) requires demonstrably seen notice prior to data collection. | **Embedded Inside-Card Checkbox** (`[ ] I have read and understood this notice`). Action button strictly disabled until checked. |
| **Essential Service (Subsequent / Already Consented)** (e.g. Saving a 2nd address, Re-login) | Consent remains valid across account lifetime unless withdrawn/deleted. | **Option 2 Active Status Card:** Displays `🟢 Consent Active • Permanent operational requirement` + `<ConsentNoticeModal />` (No blocking checkbox). |
| **Optional / Promotional** (e.g. Marketing communications, seasonal coupons) | **Strictly Prohibited from bundling or pre-ticking.** User must deliberately opt in. | **Un-ticked Opt-In Checkbox** (defaults to false) or explicit **Toggle Switch** in Profile. |
| **Telemetry / Tracking** (e.g. Performance analytics) | Prior notice with equal Accept and Decline options. | **Accept vs Decline Modal Banner Buttons** + `<ConsentNoticeModal />`. |

---

## 6. Profile Privacy Settings UI: Grouping vs Raw Logs

### The Rule: 4 Clean Purpose Cards with Complete Notice Modals

> `AGE_DECLARATION` is not a fifth card. It appears as one read-only line ("Age confirmed on [date]") because it cannot be withdrawn on its own; leaving means closing the account (Section 15).

The `/account/privacy` (Privacy & Consent Preferences) page renders **one unified card per distinct Purpose**, each equipped with direct `<ConsentNoticeModal />` triggers:

1. **`OTP_AUTH`** → Status: `🟢 Active (Essential)` — Active since account creation.
2. **`ORDER_PROCESSING`** → Status: `🟢 Active (Essential)` (or `🟡 Pending — Activated when you save an address or place your first order` for brand new accounts).
3. **`MARKETING_COMMS`** → Status: `Active` / `Withdrawn` (Interactive Opt-In / Withdraw Button + modal).
4. **`ANALYTICS`** → Status: `Active` / `Withdrawn` (Interactive Opt-In / Withdraw Button + modal).

### The Statutory 5-Section Notice Modal (`<ConsentNoticeModal />`)
Each card provides a `[📄 View Complete Notice]` button that opens an accessible modal containing the 5 statutory sections required by DPDP Section 5:
1. **Purpose of Processing**
2. **Categories of Personal Data Collected**
3. **Third-Party Recipients & Processors**
4. **Retention Period**
5. **Your Rights & Complaints (DPO: dpo@gorola.com & Data Protection Board of India)**

### Where Raw Logs Live:
- The backend `ConsentLog` table stores every historical grant, withdrawal, IP address, and timestamp.
- When the user downloads their complete archive via **"Download My Data"** (`GET /api/v1/user/my-data` in Phase 8.3), the complete chronological audit log JSON is exported for compliance with DPDP Section 11 (Right to Access).

---

## 7. Lifecycle, Re-Consent & Versioning Rules

1. **One-Time Consent:** Once a user consents to version `1.0` of `OTP_AUTH` or `ORDER_PROCESSING`, they do **not** need to re-consent on subsequent logins, address edits, or standard repeat orders.
2. **Statutory Re-Consent (Version Bumps):** If GoRola updates its data processing terms or introduces new sub-processors (e.g., moving to policy version `2.0`), the system checks:
   ```ts
   if (user.privacyPolicyVersionAccepted !== CURRENT_POLICY_VERSION) {
     // Trigger DPDP Section 5(2) Re-Consent Banner
   }
   ```
3. **Withdrawal Immediate Effect:** Withdrawing optional consent takes effect immediately across all background workers and notification queues.

---

## 8. Architectural Decision Record: Why Razorpay Lives Inside `ORDER_PROCESSING` (Not a Separate Purpose)

> **Status:** DECIDED — 2026-09-23  
> **Decision Makers:** Product Engineering & Compliance  
> **Trigger:** Design review of consent notice text discrepancy between address-save and checkout flows.

### 8.1 — The Problem That Was Identified

During design review, the following compliance gap was discovered:

```
Scenario (before fix):
  User saves address
    → Sees notice: "Shared with Ola Maps, Store Partners, Riders"
    → ORDER_PROCESSING ConsentLog row created in DB
    → noticeText stored: "...Ola Maps, store partners, riders..."

  User later places a UPI/Card order
    → System detects existing ORDER_PROCESSING consent → skips re-grant
    → Razorpay processes payment data
    → BUT the stored noticeText never mentioned Razorpay

Result: ConsentLog.noticeText is an incomplete disclosure.
A DPDP audit would flag this: the user's payment was processed by a
sub-processor that was not named in the notice they consented against.
```

This is a violation of **DPDP Act Section 5(2)**: the notice must disclose all third-party processors at the time of consent.

---

### 8.2 — Three Options Considered

#### Option A: Dynamic notice — show different text based on payment method at checkout

- Show Razorpay disclosure **only** when UPI/Card is selected at checkout.
- For COD checkout, show the notice without Razorpay.
- **Problem:** The consent is first recorded at address-save time — before the user has ever reached checkout or selected a payment method. The noticeText at address-save cannot conditionally include Razorpay because no payment method is known yet. This pushes all the complexity to the checkout step and still doesn't close the gap cleanly.

#### Option B: Create a separate `PAYMENT_PROCESSING` consent purpose

- New Prisma enum value, new migration, new consent pipeline.
- Trigger a modal when the user selects UPI/Card at checkout.
- **Rejected. Three fatal problems:**

  1. **The Withdrawal Paradox:** Every DPDP consent purpose must have meaningful withdrawal semantics. If a user withdraws `PAYMENT_PROCESSING`, what does GoRola do?
     - Block online payment → then it is essential, not withdrawable. A non-withdrawable consent purpose is not a meaningful consent purpose — it is just a notice.
     - Keep allowing COD → the user can already "opt out" of Razorpay by simply choosing COD. No separate consent withdrawal mechanism is needed for a payment method choice.
     - Block checkout entirely → violates DPDP Section 6(1): essential services cannot be conditioned on non-essential consent.
     - **There is no withdrawal scenario that makes legal or product sense.**

  2. **DPDP consent purposes map to user-facing processing activities, not to individual vendors.** The Act asks: *"Why are you collecting this person's data?"* The answer is *"to fulfill their order."* Razorpay is a sub-processor used to fulfill that purpose — it is required to be *disclosed in the notice*, not elevated to its own purpose category.

  3. **UX damage at the highest-friction moment:** Selecting UPI → consent modal → accept → Razorpay payment modal. Two blocking screens in sequence at the checkout submit step. Measurable checkout abandonment with zero legal upside.

#### Option C (CHOSEN): Single conditional notice text at all touchpoints ✅

The notice used at address-save, at booking confirmation, and at checkout is **identical** and reads:

> *"Your address, landmark notes, and GPS coordinates are shared with **Ola Maps** for location services, and with assigned store partners and delivery riders for order fulfillment. **If you choose online payment**, your transaction details are processed securely via **Razorpay**. Governed by India's DPDP Act 2023."*

---

### 8.3 — Why the Conditional Phrase Covers Every User Type Correctly

| User type | What they read | Is Razorpay disclosed? | Does Razorpay process their data? | Is this DPDP-compliant? |
|---|---|---|---|---|
| **COD user** | "...if you choose online payment, your details are processed via Razorpay" | ✅ Conditionally disclosed | ❌ No — Razorpay is never called | ✅ Yes — the condition in the notice is truthful. The "if" clause is accurate because the condition never applies to them. |
| **UPI / Card user** | "...if you choose online payment, your details are processed via Razorpay" | ✅ Disclosed before payment | ✅ Yes — Razorpay processes payment | ✅ Yes — sub-processor was disclosed in the notice they consented against. |

The conditional phrasing is legally truthful for both user types. Over-disclosure (informing a COD user that Razorpay *would* apply *if* they chose online payment) is **not a DPDP violation**. Under-disclosure (processing Razorpay payment without it being named in the consent notice) **is** a violation. The conditional clause eliminates under-disclosure without being misleading.

---

### 8.4 — Impact on `ConsentLog.noticeText`

Because the same canonical notice text is used at every touchpoint, the `noticeText` column in every `ORDER_PROCESSING` `ConsentLog` row is identical regardless of:
- Whether the consent was first recorded at address-save or checkout
- Whether the user ultimately pays by COD or online

This is the correct and auditable state. A Data Protection Board inspector who queries the `ConsentLog` table will find a single, consistent, complete notice for every user — one that accurately discloses all sub-processors that could ever be involved in their order.

---

### 8.5 — What Changed in the Codebase (Action Items)

| Location | Change Required |
|---|---|
| `BookingTimeslotPage.tsx` — Add Address dialog notice (line ~703) | Update `noticeText` to use canonical text including the conditional Razorpay clause |
| `BookingTimeslotPage.tsx` — Main flow, above "Confirm Booking" button | **Add** a consent notice card here — it was missing entirely |
| `SavedAddressesPage.tsx` — Add/Edit address dialog | Verify notice text uses canonical text including conditional Razorpay clause |
| `CheckoutPage.tsx` — Review step notice (lines 615–626) | Already correct. Verify `noticeText` passed to `POST /api/v1/consent` matches canonical text |
| `DPDP_CONSENT_ARCHITECTURE_GUIDE.md` | ✅ Updated (this document, v1.1) |

---

### 8.6 — Razorpay's Own Consent Layer (Supplementary, Not a Substitute)

When a user initiates UPI or Card payment, Razorpay's own payment modal presents its Terms of Service and Privacy Policy. Razorpay is an RBI-regulated Payment Aggregator and maintains its own data processing obligations independently.

**However:** This does not substitute GoRola's disclosure obligation. GoRola is the **Data Fiduciary** under DPDP. The responsibility to disclose Razorpay as a sub-processor in GoRola's own notice sits with GoRola, regardless of what Razorpay's own modal says. Both disclosures coexist and serve different legal obligations.

---

## 9. Architectural Decision Record: Why `ORDER_PROCESSING` Covers Booking Commerce (No Separate Purpose Needed)

> **Status:** DECIDED — 2026-09-23  
> **Decision Makers:** Product Engineering & Compliance  
> **Trigger:** Evaluating whether the booking timeslot flow (`BookingTimeslotPage`) requires its own consent purpose (e.g., `BOOKING_PROCESSING`) distinct from `ORDER_PROCESSING`.

### 9.1 — The Question

GoRola has two distinct fulfilment workflows:

1. **Standard Order** (`/checkout`) — Grocery or medicine delivery, near-immediate dispatch.
2. **Booking Commerce** (`/booking`) — Scheduled home-visit appointment (e.g., diagnostic tests, doctor visits, at-home services). Requires selecting a date, timeslot, and address.

The question: do these two workflows require separate DPDP consent purposes?

### 9.2 — Data Collected in Each Flow

| Data Field | Standard Order | Booking Commerce |
|---|---|---|
| Full Name | ✅ | ✅ |
| Delivery / Visit Address | ✅ | ✅ |
| GPS Coordinates (lat, lng) | ✅ | ✅ |
| Item details | ✅ | ✅ (service variant) |
| Payment method & transaction ID | ✅ | ✅ |
| Scheduled Date + Timeslot | ❌ | ✅ |

The **only** data point exclusive to the booking workflow is the scheduled date and timeslot. Scheduled time is appointment metadata — it is not personal data under DPDP (it does not identify, locate, or characterise a person in isolation). The fundamental personal data collected — name, address, GPS, payment — is **identical** in both flows.

### 9.3 — The DPDP Test: Matching Processing Purpose to Consent Purpose

The DPDP Act asks: *"Why are you processing this person's personal data?"* — not *"Which product feature triggered the processing?"*

| Question | Answer |
|---|---|
| Why do you need the user's address for a booking? | To dispatch a service provider to their location |
| Why do you need GPS? | For Ola Maps routing to the user |
| Why do you need payment details? | To process payment for the booked service |
| Why do you share data with store partners? | To prepare and dispatch the service |

In every case the answer is: **"to fulfil the service the user requested."** That is `ORDER_PROCESSING`. The delivery timeline (immediate vs. scheduled) is a logistics variation, not a different processing purpose.

### 9.4 — Why a Separate `BOOKING_PROCESSING` Purpose Would Be Wrong

1. **No meaningful withdrawal semantics.** Withdrawing `BOOKING_PROCESSING` would be identical in effect to withdrawing `ORDER_PROCESSING` — the user's booking would be cancelled. Two purposes cannot have the same withdrawal outcome without being redundant.

2. **Same sub-processor list.** A hypothetical `BOOKING_PROCESSING` notice would read word-for-word identically to the `ORDER_PROCESSING` notice (Ola Maps, store partners, riders, conditional Razorpay). Identical notices = same purpose. Creating a separate DB enum value and consent pipeline for an identical notice is consent-purpose inflation — it fragments the audit trail without adding legal protection.

3. **Universal Standardized Headings.** All touchpoints (standard checkout, address modal, booking address dialog, and booking confirmation card) now render the identical canonical heading: **Order Fulfillment & Location Services** (matching the card heading in `/account/privacy`). The underlying canonical `noticeText` stored in `ConsentLog` is identical across all touchpoints.

### 9.5 — What the Codebase Does (Current Correct State)

| Touchpoint | Consent Notice Shown | API Call on Action |
|---|---|---|
| `BookingTimeslotPage` — Add Address dialog | Canonical `ORDER_PROCESSING` notice | `POST /api/v1/consent { purpose: "ORDER_PROCESSING" }` on address save |
| `BookingTimeslotPage` — Above "Confirm Booking" button | Canonical `ORDER_PROCESSING` notice | `POST /api/v1/consent { purpose: "ORDER_PROCESSING" }` on booking confirm |
| `CheckoutPage` — Review step | Canonical `ORDER_PROCESSING` notice | `POST /api/v1/consent { purpose: "ORDER_PROCESSING" }` on order place |
| `SavedAddressesPage` — Add/Edit address dialog | Canonical `ORDER_PROCESSING` notice | `POST /api/v1/consent { purpose: "ORDER_PROCESSING" }` on address save |

All four touchpoints use the same canonical notice text and the same `ORDER_PROCESSING` purpose enum. The server-side idempotency guard (see Section 10) ensures only one `ConsentLog` row is ever written per user per purpose per policy version, regardless of how many of these touchpoints the user encounters.

---

## 10. Architectural Decision Record: `OTP_AUTH` Idempotency — No Re-Grant on Every Login

> **Status:** DECIDED & IMPLEMENTED — 2026-09-23  
> **Decision Makers:** Product Engineering & Compliance  
> **Trigger:** Observation that `ConsentLog` was accumulating duplicate `OTP_AUTH` rows — one per login session — instead of a single canonical record per user.

### 10.1 — The Problem

**Symptom:** Every time a user verified their OTP and logged in, a new `ConsentLog` row with `purpose: OTP_AUTH` was created. A user who logs in 50 times would have 50 `OTP_AUTH` rows.

**Root cause:** `ConsentRepository.create()` always executed `prisma.consentLog.create()` without first checking whether an active, same-version record already existed for that user and purpose.

**DPDP implication:** Duplicate rows do not violate the Act, but they pollute the audit trail and inflate the data export returned by `GET /api/v1/user/my-data`. A Data Protection Board inspector reviewing the `ConsentLog` table would correctly question why there are 50 identical rows for a single consent purpose.

### 10.2 — "Does the System Know the User Before Logging the OTP Consent?"

This is the correct question to ask. The answer is **yes** — here is the precise sequence:

```
User enters phone number
  → POST /api/v1/auth/send-otp  (no userId required — phone not yet verified)

User enters 6-digit OTP
  → POST /api/v1/auth/verify-otp
  → Server validates OTP, returns: { accessToken, refreshToken, userId, name, phone }
  → setBuyerSession({ userId, accessToken, ... })  ← userId is now known
  → POST /api/v1/consent { purpose: "OTP_AUTH" }   ← fired AFTER session established
```

The `OTP_AUTH` consent POST is dispatched **after** the verify-OTP response is processed and the session is set. The `userId` is always present in the auth header attached to the consent request. The system never logs consent without knowing who the user is.

The inline notice shown on the phone-entry screen ("Your phone number is shared with Exotel for OTP delivery") is a **transparency notice** shown before the phone number is submitted. The formal consent **record** is created only after the user successfully authenticates — which is the correct sequence under DPDP Section 5(2): notice before data collection, consent record tied to the verified identity.

### 10.3 — The Fix: Server-Side Idempotency Guard

A guard was added to `ConsentService.recordConsent()` in `consent.service.ts`:

```typescript
// Before creating a new row, check for an existing active record
const existing = await this.consentRepo.findLatestByUserIdAndPurpose(
  input.userId,
  input.purpose
);
if (
  existing !== null &&
  !existing.isWithdrawn &&
  existing.consentVersion === (input.consentVersion ?? "1.0")
) {
  return formatConsentDTO(existing);  // short-circuit — no DB write
}
// ... only reaches here if no active record exists
const record = await this.consentRepo.create(input);
```

**Logic:** If an active (non-withdrawn), same-version record already exists → return it, skip the INSERT. This eliminates duplicate rows for all purposes, not only `OTP_AUTH`.

### 10.4 — When a New Row IS Written

A new `ConsentLog` row is written in exactly two legitimate scenarios:

1. **First-time grant:** No prior record exists for this `userId + purpose + consentVersion`.
2. **Re-consent after withdrawal:** The user previously withdrew consent and is now re-granting. `existing.isWithdrawn === true`, so the guard does not short-circuit and a new record is created — preserving the full grant → withdrawal → re-grant audit trail.
3. **Policy version bump:** If `consentVersion` changes from `"1.0"` to `"2.0"` (when GoRola updates its privacy policy), the version mismatch means the guard does not short-circuit. A new row is created capturing the new version of the notice the user consented to.

### 10.5 — Frontend Layer (Defence in Depth)

In addition to the server-side guard, `CheckoutPage.tsx` now fetches the user's active consents via `GET /api/v1/consent` (cached by React Query with key `["consents"]`) and only fires the `ORDER_PROCESSING` POST if `hasOrderProcessingConsent === false`. This eliminates the redundant network round-trip entirely for returning users, not just the DB write.

---

## 11. Dedicated Account Privacy Dashboard Architecture (`/account/privacy`)

### 11.1 — The UX & Information Architecture Problem
Previously, the `PrivacySettingsSection` component was embedded at the very bottom of `/profile` below the Logout button. This presented three major usability and compliance challenges:
1. **Broken Action Hierarchy:** In modern application design, **Logout** must always be the terminal action on an overview page. Placing interactive settings below Logout causes confusion and poor discoverability.
2. **Page Clutter & Layout Imbalance:** Embedding 4 large consent cards on `/profile` caused the left column ("Personal Info") to artificially stretch, creating massive empty whitespace and making the profile overview clumsy.
3. **Lack of Space for User Rights (Phase 8.3):** India's DPDP Act mandates self-serve rights: **Right to Erasure** (`DELETE /api/v1/user/account`), **Right to Access / Data Portability** (`GET /api/v1/user/my-data`), and **Right to Nominate**. Cramming all these interactive workflows onto `/profile` would overload the screen.

### 11.2 — Dedicated Privacy Hub Architecture
We established `/account/privacy` as the dedicated, authenticated Data Subject Privacy & Rights Dashboard:

```
                                      [ /profile ] (Overview)
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
    [ /account/orders ]          [ /account/addresses ]         [ /account/privacy ]
     Order History & Tracking     Manage Delivery Locations     Privacy & Consent Center
                                                                 ├── 4 Canonical Consent Cards
                                                                 ├── Download My Data (Phase 8.3)
                                                                 └── Delete Account (Phase 8.3)
```

1. **On `/profile` (Quick Links):** Added a third quick link above Logout:
   * **Privacy & Consent** (`/account/privacy`): *"Manage your DPDP consent & data privacy."*
2. **On `/account/privacy` (Interactive Dashboard):**
   * Displays the 4 canonical purpose cards (`OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_EMAIL`, `ANALYTICS`).
   * Provides 1-click **Opt In** / **Withdraw** actions for optional purposes.
   * Houses upcoming Phase 8.3 self-serve buttons for **"Download My Data"** and **"Delete My Account"**.
3. **Contrast with Public `/privacy` Page (Phase 8.6):**
   * `/account/privacy` is an **interactive management dashboard** for logged-in users.
   * `/privacy` is the **static public legal policy document** accessible to guests, search engines, and regulators.

### 11.3 — Cross-Device Analytics Synchronisation
For the non-essential `ANALYTICS` purpose:
* **The Challenge:** Browsers need an instant 0ms check (`localStorage.getItem("gorola_analytics_consent")`) before running tracking telemetry scripts. However, a user logging into a new device starts with an empty `localStorage`.
* **The Solution:**
  1. On mount on a new device, `AnalyticsConsentBanner` checks `GET /api/v1/consent`.
  2. If the user previously accepted on another device $\rightarrow$ syncs `localStorage = "accepted"` and **suppresses the pop-up**.
  3. If the user previously withdrew or declined $\rightarrow$ syncs `localStorage = "declined"` and **suppresses the pop-up**.
  4. When a user clicks "Decline" or "Withdraw", the client updates `localStorage = "declined"` and dispatches `DELETE /api/v1/consent/ANALYTICS` in the background so all other devices stay in sync.

### 11.4 — Universal Heading Standardisation
To eliminate user confusion and ensure statutory transparency, every consent touchpoint in the application displays the exact same heading as the canonical card in `/account/privacy`:

| Purpose | Canonical Heading | Touchpoint in UI |
| :--- | :--- | :--- |
| **`OTP_AUTH`** | **Authentication & Account Security** | `/login` (Step 2 OTP Verification step) |
| **`ORDER_PROCESSING`** | **Order Fulfillment & Location Services** | `/checkout`, `/account/addresses` modal, `/booking` checkout |
| **`MARKETING_EMAIL`** | **Promotions & Seasonal Offers (Optional)** | `/checkout` (Opt-in checkbox) |
| **`ANALYTICS`** | **Usage & Performance Analytics** | First-visit bottom banner (`AnalyticsConsentBanner`) |

### 11.5 — Component Hierarchy & Test Suite Mapping

The Account Privacy architecture is organized into modular components and verified with rigorous unit and integration tests:

| File Path | Description | Test Suite | Test Count |
| :--- | :--- | :--- | :--- |
| `apps/web/src/pages/buyer/PrivacySettingsPage.tsx` | Dedicated page for `/account/privacy` | `PrivacySettingsPage.test.tsx` | 4 tests |
| `apps/web/src/components/account/PrivacySettingsSection.tsx` | 4-card interactive consent dashboard | `PrivacySettingsSection.test.tsx` | 5 tests |
| `apps/web/src/pages/buyer/ProfilePage.tsx` | Profile overview with quick link to `/account/privacy` | `ProfilePage.test.tsx` | 5 tests |
| `apps/web/src/components/consent/AnalyticsConsentBanner.tsx` | Bottom banner with cross-device pre-fetch | `AnalyticsConsentBanner.test.tsx` | 8 tests |
| `apps/web/src/app/routes/buyer.tsx` | Protected route `/account/privacy` registered | End-to-end routing | Complete |

All test suites verify:
- Complete rendering of all 4 canonical purpose cards even if server logs are empty.
- Immediate 1-click mutation triggers for marketing and analytics opt-in / withdrawal.
- `localStorage` bi-directional synchronization with server consent logs.
- Profile page navigation links cleanly directing to `/account/privacy`.

---

## 12. Phase 8.3 — User Rights Architecture: Erasure, Data Portability & Nomination

> **Statutory Basis:** DPDP Act 2023 Section 11 (Right to Access & Portability), Section 12 (Right to Correction and Erasure), Section 14 (Right to Nominate).  
> **Status:** FULLY IMPLEMENTED & TESTED.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      DPDP USER RIGHTS ARCHITECTURE (/account/privacy)            │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌───────────────────────────┐      ┌───────────────────────────┐               │
│   │ 1. DATA PORTABILITY       │      │ 2. RIGHT TO NOMINATE      │               │
│   │    (DPDP Section 11)      │      │    (DPDP Section 14)      │               │
│   │ • 1-Click JSON Export     │      │ • Nominee Name & Contact  │               │
│   │ • Profile, Addresses,     │      │ • Relationship Specifier  │               │
│   │   Orders, Consent Logs    │      │ • Real-time DB Update     │               │
│   └─────────────┬─────────────┘      └─────────────┬─────────────┘               │
│                 │                                  │                             │
│   ┌─────────────┴──────────────────────────────────┴─────────────┐               │
│   │ 3. TWO-STAGE ERASURE & ACCOUNT DELETION (DPDP Section 12)    │               │
│   │                                                              │               │
│   │  [User Requests Deletion] ──> 30-Day Soft-Delete Grace Period│               │
│   │                                      │                       │               │
│   │             ┌────────────────────────┴─────────────────────┐ │               │
│   │             ▼                                              ▼ │               │
│   │    [User Re-logs In via OTP]                    [30 Days Pass Without Login] │
│   │    Account Restored (<100ms)                    Automated Purge Worker Runs  │
│   │    (Reactivation Endpoint)                      (Permanent PII Anonymization)│
│   └──────────────────────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 12.1 — Right to Access & Data Portability (DPDP Section 11)

#### Statutory Mandate
Under DPDP Act Section 11, Data Principals have the affirmative right to receive a summary of personal data being processed, a list of third-party processors, and a machine-readable copy of their entire data footprint.

#### Implementation
- **API Endpoint:** `GET /api/v1/user/my-data` (Authenticated `BUYER`)
- **Repository Method:** `UserRepository.getMyData(userId)`
- **Data Payload Structure:**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "cuid...",
        "name": "Arjun Sharma",
        "phone": "+919876543210",
        "isVerified": true,
        "createdAt": "2026-09-20T10:00:00.000Z",
        "nomineeName": "Aarav Sharma",
        "nomineeContact": "+919876543211",
        "nomineeRelationship": "Sibling"
      },
      "addresses": [
        {
          "id": "cuid...",
          "label": "Home",
          "street": "12 Pine View",
          "landmark": "Near Mall Road",
          "lat": 31.1048,
          "lng": 77.1734
        }
      ],
      "orders": [
        {
          "id": "cuid...",
          "status": "DELIVERED",
          "totalAmount": 450,
          "items": [
            { "productName": "Organic Apples 1kg", "quantity": 1, "price": 450 }
          ]
        }
      ],
      "consentHistory": [
        {
          "purpose": "ORDER_PROCESSING",
          "consentVersion": "1.0",
          "isWithdrawn": false,
          "grantedAt": "2026-09-20T10:05:00.000Z"
        }
      ]
    }
  }
  ```
- **Frontend UI Component:** `<DataPortabilitySection />` mounted on `/account/privacy`. Generates an instant, client-side `.json` blob download (`gorola-my-data-<timestamp>.json`) when clicked.

---

### 12.2 — Right to Nominate (DPDP Section 14)

#### Statutory Mandate
DPDP Section 14 mandates that Data Principals can designate an individual who shall exercise data rights (access, erasure, transfer) in the event of the Data Principal's death or incapacity.

#### Schema Design & Database Layer
Fields added directly to table `User` with migration `20260924040500_add_user_nominee_and_deletion_fields`:
```prisma
model User {
  ...
  nomineeName         String?
  nomineeContact      String?
  nomineeRelationship String?
}
```

#### API Endpoints
1. `GET /api/v1/user/nominee` — Fetches current nominee details or nulls if none designated.
2. `PUT /api/v1/user/nominee` — Updates or clears nominee fields. Strict schema validation via `user.schema.ts` (`updateNomineeSchema`).
   - Supports clearing existing nominee records by submitting `null` values.
   - Fully type-safe under TypeScript `exactOptionalPropertyTypes: true`.

#### Frontend UI Component
`<DataNomineeSection />` mounted on `/account/privacy`:
- Prefills existing nominee info from server.
- Form inputs for Nominee Full Name, Phone / Email, and Relationship (e.g., Spouse, Parent, Sibling, Legal Representative).
- "Save Nominee" with loading states and "Clear Nominee" secondary action.

---

### 12.3 — Two-Stage Right to Erasure & Account Deletion (DPDP Section 12)

#### Core Design Decision: Two-Stage Erasure vs Immediate Scrubbing
Under DPDP Section 12, a Data Principal may request erasure of their personal data. However, immediate hard-deletion on Day 0 creates severe operational, security, and user-experience issues:
1. **Accidental Deletion & Account Recovery:** If a user accidentally triggers deletion or changes their mind, an immediate hard-delete permanently destroys their order history and loyalty points with zero recovery option.
2. **Phone OTP Friction:** Because GoRola uses Phone OTP authentication without passwords or emails, an immediate PII wipe means if the user attempts to log back in the next day, the system cannot detect they were an existing customer in a grace period.
3. **Statutory Grace Period Standard:** Leading consumer platforms (Apple, Google, WhatsApp) provide a 30-day grace period where the account is soft-deleted, sessions revoked, and hidden from services, before background jobs execute irrevocable permanent erasure.

#### Stage 1: Soft-Deletion & Grace Period Trigger
- **Endpoint:** `DELETE /api/v1/user/account` (Authenticated `BUYER`)
- **Action:**
  1. Sets `deletedAt = now()` and `deletionScheduledFor = now() + 30 days`.
  2. Calls `tokenVerifier.revokeAllUserTokens(userId)` to invalidate all active JWTs and refresh tokens.
  3. Returns confirmation with `deletionScheduledFor` timestamp.
  4. Frontend UI (`<DangerZoneSection />`) renders an explicit confirmation modal detailing the 30-day recovery window, logs the user out upon confirmation, and redirects to `/login`.

#### Stage 2: Interactive Re-Login Restoration (Within 30 Days)
- When a user whose account is in the grace period enters their Phone OTP on `/login`:
  - `POST /api/v1/auth/buyer/verify-otp` returns `{ isPendingDeletion: true, deletionScheduledFor: "..." }`.
  - The login flow halts standard redirection and renders an interactive **Account Scheduled for Deletion** step (`<LoginPage />`).
  - **Unambiguous Action Controls:**
    - **"Restore My Account" (Primary):** Calls `POST /api/v1/user/reactivate-account`, resets:
      - `deletedAt = null`
      - `deletionScheduledFor = null`
      - `isDeleted = false`
      - `isActive = true`
      - Instantly restores account access, addresses, and order history, and logs the user in.
    - **"Proceed with Deletion & Exit" (Secondary):** Leaves the 30-day countdown running in PostgreSQL, discards tokens, and signs out back to the phone entry screen without altering the deletion schedule.

---

### 12.4 — Automated Data Purge & Anonymization Engine (`purgeExpiredUsers`)

When 30 days elapse without account reactivation, the automated background worker (`apps/api/src/workers/user-data-purge.worker.ts`) processes expired records.

#### Complete Data Scrubbing vs Retention Matrix

| Table / Entity | Action Taken by Purge Worker | Rationale & Legal Basis |
| :--- | :--- | :--- |
| **`User` (Profile)** | **Irreversibly Anonymized:**<br>`name = '[deleted]'`<br>`phone = 'DELETED_${userId}'`<br>`phoneHash = null`<br>`nomineeName = null`<br>`nomineeContact = null`<br>`nomineeRelationship = null`<br>`isActive = false`<br>`isDeleted = true` | Erases all direct and indirect PII so user cannot be re-identified under DPDP Sec 12. |
| **`Address`** | **Hard Deleted (`deleteMany`)** | All physical addresses, street names, and door numbers are permanently wiped. |
| **`Cart` & `CartItem`** | **Hard Deleted (`deleteMany`)** | Temporary shopping cart state is scrubbed. |
| **`Order` (Delivery Notes & GPS)** | **Sanitized / Stripped:**<br>`landmarkDescription = '[deleted]'`<br>`flatRoom = null`<br>`deliveryNote = null`<br>`deliveryLat = null`<br>`deliveryLng = null`<br>`addressLabel = null` | Cleanses physical navigation and home location PII from past deliveries. |
| **`Order` (Financial Totals & Items)** | **Preserved Intact:**<br>`totalAmount`, `subtotal`, `taxAmount`, `items`, `paymentStatus`, `invoiceNumber` | **Statutory Retention:** Indian GST Act and Companies Act (2013) mandate retaining transaction records and tax books for 7–8 years for financial audit compliance. |
| **`ConsentLog`** | **Marked Withdrawn:**<br>`isWithdrawn = true`<br>`withdrawnAt = now()` | Preserves immutable proof that consent existed and was subsequently terminated upon account erasure. |

---

### 12.5 — Clarifications to Key Architectural Questions

#### Q1: Why not delete the user profile row completely from the database?
**Answer:** Foreign key integrity. Past orders reference `userId`. If the `User` row were hard deleted, historical financial ledger entries and tax invoices would violate foreign key constraints or require cascading deletes that wipe mandatory financial records. Setting `phone = 'DELETED_${userId}'`, `phoneHash = null`, `name = '[deleted]'`, and stripping all address fields guarantees 100% anonymization while preserving relational tax integrity.

#### Q2: What happens if a user enters their phone number again after the 30-day purge?
**Answer:** Because `phoneHash` was set to `null` and `phone` was anonymized, the system treats the phone number as brand new. The user goes through standard first-time onboarding with clean, empty state and fresh DPDP consent notices.

#### Q3: How is nominee contact information protected?
**Answer:** Nominee details (`nomineeName`, `nomineeContact`, `nomineeRelationship`) are treated as Data Principal PII. They are encrypted at rest where applicable, accessible only to the authenticated user, and automatically wiped during the permanent purge.

#### Q4: What prevents unauthorized access during the 30-day deletion window?
**Answer:** As soon as deletion is requested, `revokeAllUserTokens` clears all active session IDs in Redis / JWT blacklist. Any attempt to access protected APIs without re-authenticating with fresh Phone OTP yields an immediate `401 Unauthorized`.

---

### 12.6 — Phase 8.3 Verification & Test Coverage Matrix

| Test Suite File | Layer | Scope & Assertions | Status |
| :--- | :--- | :--- | :--- |
| `user.my-data.test.ts` | API Integration | `GET /api/v1/user/my-data` returns decrypted profile, addresses, orders, items, and consent history. Rejects unauthenticated requests with 401. | ✅ PASS |
| `user.nominee.test.ts` | API Integration | `PUT /api/v1/user/nominee` updates and clears nominee fields. `GET /api/v1/user/nominee` retrieves active nominee. | ✅ PASS |
| `user.account-deletion.test.ts` | API Integration | `DELETE /api/v1/user/account` marks 30-day grace period and triggers token revocation. | ✅ PASS |
| `user.account-reactivation.test.ts` | API Integration | `POST /api/v1/user/reactivate-account` resets deletion timestamps and restores active flags. | ✅ PASS |
| `user-data-purge.worker.test.ts` | Worker Unit | `purgeExpiredUsers` identifies expired non-reactivated accounts, invokes `permanentPurgeAndAnonymize`, and skips unexpired users. | ✅ PASS |
| `DataPortabilitySection.test.tsx` | Web Component | Renders portability card and triggers JSON blob download on button click. | ✅ PASS |
| `DataNomineeSection.test.tsx` | Web Component | Fetches existing nominee, validates form inputs, saves mutations, and handles 1-click clearing. | ✅ PASS |
| `DangerZoneSection.test.tsx` | Web Component | Displays destructive deletion card, opens confirmation dialog with 30-day notice, and logs out on confirm. | ✅ PASS |
| `PrivacySettingsPage.test.tsx` | Web Page | Renders all 4 DPDP cards + Portability + Nominee + Danger Zone in responsive layout. | ✅ PASS |

---

## 13. Phase 8.3.4 — Consent Architecture Overhaul & Admin Consent Auditing Panel

> **Statutory Basis:** DPDP Act 2023 Section 5 (Notice & Purpose Specification), Section 6 (Consent Validity & Withdrawal), Section 9 (Processing of Personal Data), Section 11 (Auditability & Access).  
> **Status:** IMPLEMENTED & TESTED (TDD Order).

### 13.1 — Transition from Postgres Enum to `ConsentPurposeConfig` Relational Table

```
+─────────────────────────────────────────+        +─────────────────────────────────────────+
|         ConsentPurposeConfig            |        |               ConsentLog                |
+─────────────────────────────────────────+        +─────────────────────────────────────────+
| key (PK)              TEXT              |<───────| purpose (FK)          TEXT              |
| displayName           TEXT              | 1    N | id (PK)               TEXT              |
| description           TEXT              |        | userId (FK User)      TEXT              |
| isEssential           BOOLEAN           |        | consentVersion        TEXT              |
| retentionSummary      TEXT              |        | noticeText            TEXT              |
| createdAt             TIMESTAMP         |        | ipAddress             TEXT              |
| updatedAt             TIMESTAMP         |        | isWithdrawn           BOOLEAN           |
+─────────────────────────────────────────+        | withdrawnAt           TIMESTAMP?        |
                                                   | createdAt             TIMESTAMP         |
                                                   +─────────────────────────────────────────+
```

1. **Why Table over Enum:**  
   PostgreSQL ENUM types create significant deployment friction and DDL table locks when adding or modifying purpose configurations. Storing consent purposes in the `ConsentPurposeConfig` relational table allows zero-downtime additions, dynamic descriptions, and flexible retention duration tracking without database migrations.
2. **Canonical Seeded Configuration:**
   - `'OTP_AUTH'`: Essential authentication consent.
   - `'ORDER_PROCESSING'`: Essential fulfillment & navigation consent.
   - `'MARKETING_COMMS'`: Optional multi-channel promotional consent (renamed from `MARKETING_EMAIL`).
   - `'ANALYTICS'`: Optional telemetry & performance consent.
3. **Foreign Key Integrity:**  
   `ConsentLog.purpose` is constrained by a relational Foreign Key to `ConsentPurposeConfig.key`, guaranteeing that invalid or unregistered purpose strings cannot be inserted into the immutable ledger.

---

### 13.2 — Multi-Channel Standardisation: `MARKETING_COMMS`

GoRola delivers hill-station discounts, seasonal flash sales, and order confirmations through **SMS** (via DLT-registered Exotel gateways) and transactional notifications. The legacy identifier `MARKETING_EMAIL` was an inaccurate misnomer for a mobile-first platform without marketing email newsletters.  
All database records, API routes, Zod schemas, React components, and test suites have been standardized on `MARKETING_COMMS`.

---

### 13.3 — Precision Statutory Notice Text

Statutory notices at all touchpoints have been audited and updated to ensure strict truth-in-disclosure:
1. **GPS & Location Retention:** Clarified that delivery address and landmark GPS coordinates are stored until user address deletion, while order fulfillment GPS markers (`deliveryLat/Lng`) are retained during the account lifecycle and nulled upon account erasure. Tax transaction records are preserved for 7 years under Indian GST obligations.
2. **Display Name Disclosure:** Clarified that display names are optional ("Display Name (if you have set one)"). If a user does not configure a name, only their verified mobile phone number is processed.
3. **DLT SMS Gateways:** Disclosed that SMS verification and promotional communications are transmitted via DLT-authorized telecom gateways.

---

### 13.4 — Admin Consent Auditing API (`GET /api/v1/admin/users/:id/consents`)

To satisfy administrative inquiry requirements and Data Protection Board compliance requests, a dedicated auditing endpoint is exposed:
- **Route:** `GET /api/v1/admin/users/:id/consents?page=1&limit=20`
- **RBAC:** Strictly restricted to authenticated `ADMIN` role (`authenticateToken`, `requireRole(ActorRole.ADMIN)`).
- **Response Structure:**
  ```json
  {
    "success": true,
    "data": {
      "summary": [
        { "purpose": "OTP_AUTH", "displayName": "Authentication & Account Security", "isEssential": true, "status": "Active" },
        { "purpose": "ORDER_PROCESSING", "displayName": "Order Fulfillment & Location Services", "isEssential": true, "status": "Active" },
        { "purpose": "MARKETING_COMMS", "displayName": "Promotions & Seasonal Offers", "isEssential": false, "status": "Withdrawn" },
        { "purpose": "ANALYTICS", "displayName": "Usage & Performance Analytics", "isEssential": false, "status": "Never Given" }
      ],
      "logs": [
        {
          "id": "cuid...",
          "purpose": "MARKETING_COMMS",
          "consentVersion": "1.0",
          "noticeText": "...",
          "ipAddress": "192.168.1.1",
          "isWithdrawn": true,
          "withdrawnAt": "2026-10-01T20:00:00.000Z",
          "createdAt": "2026-10-01T19:00:00.000Z"
        }
      ],
      "total": 12,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
  ```

---

### 13.5 — Admin Platform Users Detail Drawer: Consent & Privacy Section

Mounted directly inside the Admin Panel Platform Users detail drawer (`apps/web/src/pages/admin/AdminUsersPage.tsx`):
1. **Summary Status Table (`data-testid="consent-summary-section"`):**  
   4-row status summary for `OTP_AUTH`, `ORDER_PROCESSING`, `MARKETING_COMMS`, `ANALYTICS` displaying `Active` (green badge), `Withdrawn` (amber badge), or `Never Given` (gray badge).
2. **Expandable Audit Log (`data-testid="consent-log-toggle"` & `data-testid="consent-log-table"`):**  
   Clicking "Show full log (N events)" reveals the paginated history of all `ConsentLog` mutations with purpose, event type (Granted / Withdrawn), formatted UTC date, and masked IP address.

---

## 14. Infrastructure Data-Flow Architecture & DPDP Compliance Perimeter

> **Status:** DECIDED & DOCUMENTED — 2026-10-03 (see also DECISION-061 in decision_log.md)  
> **Trigger:** Explicit DPDP risk review of the split Vercel (frontend) + Railway (backend) deployment architecture.

### 14.1 — The Two-Platform Architecture

GoRola intentionally runs on two deployment platforms with distinct responsibilities:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (User's Device)                              │
│                                                                              │
│  1. Browser fetches app bundle from Vercel CDN (one-time per deploy)         │
│  2. For ALL data requests, browser speaks DIRECTLY to Railway API            │
└──────────────────────────┬──────────────────────┬───────────────────────────┘
                           │                      │
          ① Static files   │                      │ ② All authenticated API calls
          (HTML/JS/CSS)    │                      │   (OTP, login, orders, consents,
          No personal data │                      │   addresses, profile data, etc.)
                           │                      │
                           ▼                      ▼
          ┌─────────────────────┐    ┌────────────────────────────────────────┐
          │  VERCEL (CDN)       │    │  RAILWAY                               │
          │                     │    │                                        │
          │  • Hosts static     │    │  ┌──────────────┐  ┌───────────────┐  │
          │    dist/ folder     │    │  │  Fastify API  │  │  PostgreSQL   │  │
          │  • No server-side   │    │  │  (Node.js)    │  │  (All PII)    │  │
          │    code             │    │  └──────┬───────┘  └───────────────┘  │
          │  • No personal data │    │         │                              │
          │  • No cookies       │    │  ┌──────┴───────┐                     │
          │  • No DB access     │    │  │   Redis       │                     │
          │  • No logging of    │    │  │ (OTP cache,   │                     │
          │    user activity    │    │  │  sessions)    │                     │
          └─────────────────────┘    │  └──────────────┘                     │
                                     └────────────────────────────────────────┘
          NOT a Data Processor               ← DPDP COMPLIANCE PERIMETER →
          under DPDP Act 2023
```

### 14.2 — Personal Data Inventory by Vendor

The DPDP Act 2023 imposes obligations at the point where personal data is collected, stored, or processed. The following table maps every category of personal data to its physical location:

| Personal Data Category | DPDP Classification | Physical Location | Does Vercel Touch It? | Does Railway Touch It? |
|---|---|---|---|---|
| Mobile phone number (AES-256-GCM encrypted) | Sensitive Personal Data | Railway PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |
| Phone hash (HMAC blind index) | Personal Data | Railway PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |
| Display Name | Personal Data | Railway PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |
| Delivery address + landmark notes | Personal Data | Railway PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |
| GPS coordinates (lat/lng) | Personal Data / Location Data | Railway PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |
| OTP codes (bcrypt-hashed, 10-min TTL) | Transient Personal Data | Railway Redis | ❌ Never | ✅ Yes — Data Fiduciary |
| JWT refresh tokens (hashed) | Transient Personal Data | Railway Redis / PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |
| Access tokens (in-memory Zustand only) | Transient Personal Data | Browser RAM — never persisted | ❌ Never | ❌ Never (in-memory) |
| ConsentLog records (IP, purpose, timestamp) | Compliance Data | Railway PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |
| Order history, item details, prices | Personal Data | Railway PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |
| Payment transaction references | Financial Personal Data | Railway PostgreSQL + Razorpay | ❌ Never | ✅ Yes — Data Fiduciary |
| Nominee contact details | Sensitive Personal Data | Railway PostgreSQL (encrypted) | ❌ Never | ✅ Yes — Data Fiduciary |
| Grievance submissions | Personal Data | Railway PostgreSQL | ❌ Never | ✅ Yes — Data Fiduciary |

**Conclusion: Vercel's DPDP classification is "Not a Data Processor."** It holds no personal data and performs no processing on GoRola's behalf. The DPDP compliance perimeter is 100% contained within Railway.

---

### 14.3 — Why Vercel Is Not a Data Processor Under DPDP

The DPDP Act 2023 defines a **Data Processor** as an entity that processes personal data on behalf of a Data Fiduciary. The operative word is *processes personal data*.

Vercel's function for GoRola is:
1. **Build:** Execute `vite build` to compile TypeScript, React, and CSS into static files. This build happens in a sandboxed CI environment — no user data, no DB access, no API calls to Railway.
2. **Serve:** Deliver the compiled `dist/` folder to browsers over HTTPS from edge CDN nodes.

Neither function involves personal data. A JavaScript bundle is application source code — it contains no information about any Data Principal. Vercel is, from a DPDP perspective, equivalent to a **file hosting service for non-sensitive software artifacts.**

This is categorically different from Railway, Razorpay, Ola Maps, or the SMS gateway — all of which either store or transmit personal data on GoRola's behalf and are therefore properly classified as sub-processors with corresponding disclosure obligations in GoRola's consent notices.

> **Note on SMS Provider Status:** The OTP SMS provider is currently a **noop stub** (`noop-otp-provider.ts`). The planned provider is **Exotel** (a DLT-registered SMS gateway), accessed via the `OtpProvider` interface. Until Exotel (or equivalent) is integrated and live, no OTP SMS leaves GoRola's infrastructure — the current production workaround is `GOROLA_DUMMY_OTP` (DECISION-019). When the provider is activated, it will transmit phone numbers for OTP delivery and must remain disclosed in the `OTP_AUTH` consent notice.

---

### 14.4 — The One Rule That Must Never Be Broken

**Vercel Analytics must never be enabled.**

Vercel offers a proprietary analytics product that, when enabled, would cause Vercel's edge network to collect: page URLs visited, referrer headers, browser/device metadata, and IP-derived country/region data. This data is associated with individual visitor sessions and constitutes personal data under the DPDP Act (location-derived data, behavioural profiling).

Enabling it without updating GoRola's consent architecture would:
1. Make Vercel a **Data Processor** for GoRola without a Data Processing Agreement (DPA), violating DPDP Section 8(1).
2. Introduce an undisclosed third-party sub-processor into the `ANALYTICS` consent pipeline, violating the disclosure requirements of Section 5(2).
3. Require a consent architecture update — adding Vercel to the `ANALYTICS` `ConsentNoticeModal`, bumping the policy version, and triggering re-consent for all existing users.

**If anyone ever considers enabling Vercel Analytics:** Stop. Read this section. Update the consent architecture first, sign a Railway/Vercel DPA equivalent, update the `ANALYTICS` consent notice, bump `CURRENT_POLICY_VERSION`, and only then enable it.

---

### 14.5 — Cross-Border Transfer Assessment (DPDP Section 16)

DPDP Section 16 empowers the central government to restrict transfer of personal data to specified countries. As of the date of this document (October 2026), no negative list has been notified by the Government of India.

**Even if restrictions were notified in the future, they would not affect Vercel's current role** — because no personal data is transferred to Vercel. CDN delivery of a compiled JavaScript bundle to a browser is not a cross-border personal data transfer. The bundle's content is application code, not user data.

Railway's infrastructure region should be confirmed as `ap-south-1` (Mumbai, India) or equivalent India-region where available, to minimise latency for Mussoorie users and provide a defensible data-residency posture for the personal data that *does* sit on Railway.

---

### 14.6 — Compliance Perimeter Summary Table

| Vendor | Role | Holds Personal Data? | DPDP Classification | DPA Required? | Disclosed in Consent Notices? |
|---|---|---|---|---|---|
| **Railway** (API, PostgreSQL, Redis) | Core Infrastructure — GoRola is Data Fiduciary here | ✅ Yes — all PII | Data Processor on GoRola's behalf | ✅ Yes (Railway DPA — see Phase 8.7.2) | ✅ Covered — GoRola is the Fiduciary; Railway processes under GoRola's instructions |
| **Vercel** (Frontend CDN) | Static File Delivery only | ❌ No application personal data (edge request IP logs only) | Not a Data Processor for DPDP purposes | ❌ Not needed for DPDP. ⚠️ **But Pro plan is required before launch**: Hobby is non-commercial only (ToS), and the DPA applies to Pro/Enterprise. Verify on vercel.com/legal | ❌ Not required |
| **Razorpay** | Payment Gateway (UPI/Card only) | ✅ Yes — payment data | Data Processor (RBI-regulated PA) | ✅ Yes (Razorpay ToS/DPA) | ✅ Yes — `ORDER_PROCESSING` notice (conditional Razorpay clause) |
| **Ola Maps** | Navigation / Geocoding | ✅ Yes — GPS coordinates | Data Processor (per Krutrim terms) | ⚠️ No separate DPA is published and no plan unlocks one. Accept the terms, confirm free-tier commercial use and quota in writing (maps-support@olakrutrim.com), keep the reply on file | ✅ Yes — `ORDER_PROCESSING` notice |
| **Exotel / SMS Gateway** (planned — noop stub currently active) | OTP & Marketing SMS | ✅ Yes — phone numbers (when live) | Data Processor (DLT-registered gateway required) | ✅ Yes — required before go-live | ✅ Yes — `OTP_AUTH` notice. When `MARKETING_COMMS` SMS is activated, must also appear in that notice. |
| **GitHub Actions** | CI/CD Build & Migration Runners | ❌ No personal data — receives DB connection credentials (secrets) only; runs `prisma migrate deploy` (schema DDL, not data queries) | Not a Data Processor | ❌ Not required | ❌ Not required |







---

## 15. Age Eligibility Gate (`AGE_DECLARATION`) — 18+ Only

> Not legal advice. Every legal point below needs counsel review before launch (⚠️ verify). Implementation plan: `CONTEXT/phase8_state.md` §8.8. Decision: DECISION-062.

### 15.1 Pipeline 5 Specification

| Property | Specification |
|---|---|
| **Consent Purpose Key** | `AGE_DECLARATION` (row in `ConsentPurposeConfig`) |
| **Type** | **Essential** (no account without it) |
| **Data Stored** | **None about age.** The DOB is used in memory to compute age and is discarded. Stored: `User.ageConfirmedAt` and one `ConsentLog` row |
| **Legal Basis** | Consent / compliance with DPDP s.2(f) (child = under 18) and s.9 |
| **UI Location** | `/login`, after OTP verification and before account creation, **new phone numbers only** |
| **Frequency** | Once per account. Legacy users are gated once on next refresh |
| **Withdrawal** | Account erasure (same as `OTP_AUTH`) |

### 15.2 Flow

```
Notice (OTP_AUTH v1.1, includes 18+ sentence)
  -> Phone -> OTP verify -> short-lived ticket (no user created yet)
  -> DOB screen (3 numeric boxes: DD / MM / YYYY)
  -> "You entered 14 March 2001. Correct?" confirm step
       |-- age >= 18 -> POST /auth/confirm-age
       |                 ONE transaction: create User (ageConfirmedAt)
       |                 + ConsentLog OTP_AUTH v1.1 + ConsentLog AGE_DECLARATION v1.1
       |                 -> session issued
       '-- age < 18  -> refusal screen; AgeGateLockout(phoneHash, 90 days)
                         + 24h cookie gorola_ag; no User, no ConsentLog, no DOB stored
```

### 15.3 How it fits with `OTP_AUTH`

- Both consents are written **server-side in the same transaction** as user creation. If any write fails, nothing is created.
- Both are versioned 1.1 (policy bump from 1.0). The idempotency guard (userId + purpose + version) still applies.
- The OTP is verified first so the phone is proven, and lockout is keyed to a verified `phoneHash` (HMAC via `hashPII`).

### 15.4 Design Reasoning

| Question | Answer |
|---|---|
| Why 18? | DPDP s.2(f) defines a child as under 18. One number, no tiers |
| Why DOB, not a checkbox? | A checkbox is a one-click lie. A neutral DOB plus a confirm step forces a deliberate false entry, which is stronger evidence of good faith |
| Why after OTP? | Proves the phone, enables lockout by `phoneHash`, avoids creating minors' records |
| Why not store the DOB? | Data minimisation (s.6, s.8(7)). `ageConfirmedAt` plus the consent row proves the declaration |
| Lockout table? | New `AgeGateLockout`. `ConsentLog` is unsuitable: `userId` is mandatory and rows cascade-delete |

### 15.5 Parental Approval — Why Not Now

DPDP Rule 10 verifiable parental consent applies from 13 May 2027 (⚠️ verify). GoRola serves adults only and refuses under-18s, so it does not process a child's data knowingly and Rule 10 is not triggered by design.

| Complication of building it | Impact |
|---|---|
| Proving the adult is the parent | Needs held data, DigiLocker-style virtual token, or similar. Heavy integration |
| Collecting a second person's data | Parent's phone/ID becomes new personal data with its own notice and retention |
| Verified-guardian register | Ongoing storage and revocation handling |
| Restrictions on tracking, profiling and targeted ads for children | Would constrain product features |
| Cost and drop-off | High friction for a quick-commerce flow |

**How it would work if built:** child identifies a parent, who verifies via a token or held-data check, and the consent is logged against the child's account.

**Revisit triggers:** a business need for under-18 users, a legal requirement, or counsel advice.

### 15.6 Why It Is Safe If a Minor Lies

| Layer | Protection |
|---|---|
| Neutral DOB plus confirm step | No hint of the threshold; a lie is deliberate |
| Notice states 18+ only | User is told before entering |
| `AGE_DECLARATION` row | Auditable evidence of reasonable steps |
| Lockout (90 days, phone + cookie) | Blocks retry-until-pass |
| Admin erase-underage | Removes an account once discovered |

**Residual risk:** a determined minor can enter a false adult DOB. This is accepted as a reasonable-steps posture, mitigated by the layers above. Counsel to confirm.

### 15.7 Operations: How an Admin Handles an Age Complaint

A complaint arrives as a normal e-mail at `privacy@gorola.in`. **The system sends and receives no e-mail**; the Grievance Officer reads the mailbox, decides the case, and an admin acts on the **Admin → Age Gate** screen (`/admin/age-gate`). A refused person has no `User` row and the lockout stores only a hash, so the screen looks up by phone number.

```
E-mail at privacy@gorola.in
   |
   v
Grievance Officer: which case?  (adult locked out: call the number back first)
   |
   v
Admin -> Age Gate -> type phone -> Look up
   |
   |-- Lock card ------> [Unlock this number]  (approve)   -> lock deleted, audit AGE_GATE_LOCKOUT_CLEARED
   |                 `-> [Decline appeal]      (disapprove) -> no change, audit AGE_GATE_APPEAL_DECLINED
   |
   |-- Account card ---> [Suspend]  (freeze, signs the person out everywhere, reversible)
   |                 `-> [Erase underage account] (permanent) -> PII removed, sessions revoked,
   |                                                  number locked, audit USER_ERASED_UNDERAGE
   `-- Nothing found --> no action; device cooldown (24 hours) ends by itself
   |
   v
Officer sends the template reply and logs it in Grievance-Log/  (target 7 days, ceiling 30)
```

| Admin decision | Button | Effect | Reason required | Audit action |
|---|---|---|---|---|
| Approve (adult mistyped, call-back confirmed) | Unlock this number | Lock row deleted; the person can sign up again | Yes, 10 characters or more, plus a tick that the call-back was done | `AGE_GATE_LOCKOUT_CLEARED` |
| Disapprove | Decline appeal | No data change; lock runs to its end date | Yes | `AGE_GATE_APPEAL_DECLINED` |
| Freeze while checking | Suspend | `isActive=false`, all sessions revoked | Yes (screen), optional (API) | `ADMIN_USER_SUSPEND` |
| Ban permanently (minor found, or parent's request) | Erase underage account | Anonymised exactly like the purge worker, sessions revoked, number locked for 90 days, order totals kept for tax law | Yes, plus typing `ERASE` | `USER_ERASED_UNDERAGE` |

- Lockout: 90 days, one strike, then it ends. The daily purge worker deletes expired rows. Unlock is the only early exit.
- The screen also lists recent refusals (reference, dates, refusal count, status; **no phone number**) and two counters, so volume and abuse are visible. Abuse alerts (5 refusals from one IP in 24 hours) go to the log only.
- No audit row ever contains a phone number, hash or date of birth.
- Errors: distinct codes for locked-out and underage refusals, with no age leaked beyond "18+".
- **UI guard:** the only age number shown anywhere in the UI, including the admin screens, is **18**. A test scans the copy for any other age figure.

### 15.8 Test Coverage

See `CONTEXT/phase8_state.md` §8.8.1–8.8.14 for the RED/GREEN test files per tier (schema, age util, lockout, send/verify-otp ticket, confirm-age, minor path, legacy gate, admin endpoints, purge, frontend, copy guard, admin Age Gate screen and Playwright journeys).
