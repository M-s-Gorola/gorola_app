# GoRola DPDP Act 2023 — Comprehensive Consent & Data Processing Architecture Guide

> **Document Version:** 1.4  
> **Applicable Law:** Digital Personal Data Protection (DPDP) Act, 2023 (India)  
> **Entity (Data Fiduciary):** GoRola (Mountain Commerce Operations)  
> **Audience:** Product Engineering, Compliance, Legal & Operations  
> **Last Updated:** 2026-09-24 — Added Section 11: Dedicated Account Privacy Dashboard Architecture (`/account/privacy`), Universal Heading Standardization, Cross-Device Telemetry Synchronization, and Component Test Suite Mapping.

---

## 1. Executive Summary & Core Architectural Principles

The Digital Personal Data Protection Act (DPDP Act) 2023 establishes strict requirements for collecting, processing, storing, and managing personal data of Indian citizens (Data Principals). GoRola enforces DPDP compliance via five foundational tenets:

1. **Purpose Limitation (Section 5(1)):** Personal data must only be processed for specific, explicitly disclosed purposes. Data collected for one purpose (e.g., login OTP) cannot be reused for an unrelated purpose (e.g., marketing) without separate, unbundled consent.
2. **Clear & Prominent Notice (Section 5(2)):** Before or at the time of requesting consent, the user must receive an easily understandable notice describing the personal data collected, the purpose, and third-party processors.
3. **Unbundled & Non-Coercive Consent (Section 6(1)):** Essential services (order delivery) must never be conditioned on consenting to non-essential services (marketing or analytics).
4. **Explicit Opt-In (No Pre-Ticked Boxes):** Optional consents must default to **unchecked / opt-out**. The user must perform an active, affirmative action to opt in.
5. **Immutable Audit Trail:** All consent grants and withdrawals are recorded with UTC timestamps, consent version, notice text, and IP address in an append-only ledger (`ConsentLog`).

---

## 2. The 4 Consent Pipelines: Detailed Breakdown

```
+───────────────────────────────────────────────────────────────────────────+
|                      USER (DATA PRINCIPAL)                                |
+──────────────┬───────────────────┬───────────────────┬────────────────────+
               |                   |                   |                    |
        (Login / OTP)      (Address/Checkout)  (Checkout/Settings)   (First Visit)
               |                   |                   |                    |
               v                   v                   v                    v
     +──────────────────+ +─────────────────+ +─────────────────+ +────────────────+
     | 1. OTP_AUTH      | | 2. ORDER_       | | 3. MARKETING_   | | 4. ANALYTICS   |
     |                  | |    PROCESSING   | |    EMAIL        | |                |
     | (Essential)      | | (Essential)     | | (Optional)      | | (Optional)     |
     +────────┬─────────+ +────────┬────────+ +────────┬────────+ +────────┬───────+
              |                    |                   |                   |
              v                    v                   v                   v
     +──────────────────+ +─────────────────+ +─────────────────+ +────────────────+
     | SUB-PROCESSOR:   | | SUB-PROCESSORS: | | PROCESSOR:      | | PROCESSOR:     |
     | • Exotel SMS     | | • Ola Maps      | | • Marketing     | | • Anonymous    |
     |   Gateway        | | • Razorpay      | |   Mail Engine   | |   Route        |
     |                  | | • Store Partners| |                 | |   Telemetry    |
     |                  | | • Riders        | |                 | |                |
     +──────────────────+ +─────────────────+ +─────────────────+ +────────────────+
```

---

### Pipeline 1: `OTP_AUTH` (Authentication & Account Security)

| Property | Specification |
|---|---|
| **Consent Purpose Enum** | `OTP_AUTH` |
| **Legal Basis** | Consent / Necessary for Account Verification & Authentication |
| **Type** | **Essential** (Required to access buyer account) |
| **Data Collected** | Mobile phone number (`phone`, blind indexed as `phoneHash`, AES-256-GCM encrypted at rest) |
| **Third-Party Processors** | **Exotel** (DLT-registered telecommunications SMS gateway for sending 6-digit OTPs) |
| **Where it Appears in UI** | `/login` (Buyer Login Modal/Page — Step 1 Mobile Entry & Step 2 OTP Verification Notice) |
| **Checkbox vs Button** | **Affirmative Button Action:** *"Verify OTP & Continue"*. A checkbox is not legally mandatory here because requesting an OTP is an explicit user-initiated authentication request. |
| **Frequency** | Recorded on first successful phone verification (v1.0). Subsequent logins verify against the existing account without repeating blocking notices. |
| **Withdrawal / Deletion** | Tied to account existence. Withdrawn when user requests Account Deletion under DPDP Section 12 / 8.3 (`DELETE /api/v1/user/account`). |

---

### Pipeline 2: `ORDER_PROCESSING` (Order Fulfillment, Payments & Navigation)

| Property | Specification |
|---|---|
| **Consent Purpose Enum** | `ORDER_PROCESSING` |
| **Legal Basis** | Contractual Necessity & Explicit Consent for Fulfillment |
| **Type** | **Essential** (Required to fulfill grocery/medicine orders and home visits) |
| **Data Collected** | Full Name, Delivery Address, GPS Coordinates (`lat`, `lng`), Order Item Details, Payment Transaction Identifiers (online payment only) |
| **Third-Party Sub-processors & Partners** | 1. **Ola Maps (Navigation):** Geocoding and steep hill navigation routing — applies to ALL orders.<br>2. **Local Store Partners (Merchants):** Packing and preparing grocery/medicine items — applies to ALL orders.<br>3. **Assigned Delivery Riders:** Physical last-mile transport to user address — applies to ALL orders.<br>4. **Razorpay (Payment Gateway):** Payment processing, UPI, Card tokenization & refund handling — **applies ONLY when UPI or Card payment method is selected. Never invoked for Cash on Delivery (COD) orders.** |
| **Canonical Notice Text (used at ALL touchpoints)** | *"Your address, landmark notes, and GPS coordinates are shared with **Ola Maps** for location services, and with assigned store partners and delivery riders for order fulfillment. If you choose online payment, your transaction details are processed securely via **Razorpay**. Governed by India's DPDP Act 2023."* |
| **Why one notice covers COD and online payment users** | The **"if you choose online payment"** conditional clause is legally accurate for all users. COD users read it — the condition never triggers for them, Razorpay never processes their data. Online payment users read it — the condition applies and they are pre-disclosed before any payment occurs. See Section 8 for full rationale. |
| **Where it Appears in UI** | 1. **Saved Addresses Page (`/account/addresses`):** In the Add/Edit address dialog, above the Save button.<br>2. **Booking Timeslot Page (`/booking`):** In the Add Address dialog AND directly above the "Confirm Booking" button.<br>3. **Checkout Page (`/checkout`):** In the review step, directly above the "Place Order" button.<br>4. **Account Privacy Dashboard (`/account/privacy`):** Unified `ORDER_PROCESSING` status card (read-only, essential). |
| **Checkbox vs Button** | **Affirmative Action Button:** *"Save Address"* / *"Confirm Booking"* / *"Place Order"*. Because order placement and address saving are direct fulfillment requests, the prominent notice card above the button constitutes informed consent under DPDP Sec 6(1). No blocking checkbox required for essential services. |
| **Frequency** | Recorded **once** on first address save or checkout (whichever comes first). Subsequent checkouts, address edits, and repeat orders do **not** re-trigger consent. Reuse the established `ConsentLog` record unless the privacy policy version is bumped. |

---

### Pipeline 3: `MARKETING_EMAIL` (Promotions, Weather Sales & Offers)

| Property | Specification |
|---|---|
| **Consent Purpose Enum** | `MARKETING_EMAIL` |
| **Legal Basis** | Explicit Opt-In Consent (DPDP Section 6(1)) |
| **Type** | **Optional / Non-Essential** (Cannot block checkout or login) |
| **Data Collected** | Email address, User First Name, Preferred Store Category |
| **Third-Party Processors** | Transactional & marketing mail transport services |
| **Where it Appears in UI** | 1. **Checkout Page (`/checkout`):** Optional opt-in card with an **unchecked checkbox**.<br>2. **Account Privacy Dashboard (`/account/privacy`):** Interactive **Opt In** / **Withdraw** toggle card. |
| **Checkbox vs Button** | **Mandatory Un-ticked Checkbox / Toggle:** Must default to **OFF (Unchecked)**. Pre-checking this box violates DPDP Section 6. |
| **Frequency** | User can independently Opt-In (`POST /api/v1/consent`) or Withdraw (`DELETE /api/v1/consent/MARKETING_EMAIL`) at any time in real time. |
| **Withdrawal / Opt-Out** | 1-click self-serve withdrawal in `/account/privacy` Privacy Settings. Immediately stops promotional dispatches. |

---

### Pipeline 4: `ANALYTICS` (Anonymous Telemetry & App Performance)

| Property | Specification |
|---|---|
| **Consent Purpose Enum** | `ANALYTICS` |
| **Legal Basis** | Prior Notice & Opt-In Consent for Telemetry |
| **Type** | **Optional** |
| **Data Collected** | Route latency telemetry, client performance metrics, screen load timings. **Zero PII or personal identity is tracked.** |
| **Where it Appears in UI** | Floating **Analytics Consent Modal** at the bottom of the screen upon the buyer's first authenticated session. |
| **Role Gating** | **Buyer Role Only (`role === 'BUYER'`).** Never rendered for Riders, Store Owners, or Admins to prevent workflow interference. |
| **Actions** | Dual choice: **"Accept Analytics"** (`POST /api/v1/consent`) vs **"Decline / Essential Only"** (stores `declined` in `localStorage` with background `DELETE /api/v1/consent/ANALYTICS`). |
| **Self-Serve Control** | Can be toggled on/off in `/account/privacy` Privacy Settings. |

---

## 3. Merchants, Store Partners & Riders: Role Clarification

### Why are Merchants & Riders Included in `ORDER_PROCESSING`?
When a customer orders groceries from *Hillside Mart* or medicines from *Mountain Medico*:
1. **The Store Partner (Merchant)** must receive the customer's name, ordered items, and packaging requirements to prepare the package.
2. **The Delivery Rider** must receive the masked delivery coordinates and landmark instructions to execute the physical delivery.

### Notice Disclosure Requirement
At checkout and address collection, the notice explicitly states (canonical text — identical at every touchpoint):
> *"Your address, landmark notes, and GPS coordinates are shared with **Ola Maps** for location services, and with assigned store partners and delivery riders for order fulfillment. If you choose online payment, your transaction details are processed securely via **Razorpay**. Governed by India's DPDP Act 2023."*

Because this sharing is strictly necessary to deliver the order requested by the customer, it belongs under `ORDER_PROCESSING` and is not a separate marketing or commercial data sale. The conditional Razorpay clause ensures the notice is accurate for both COD and online-payment users without requiring different notice variants. See Section 8 for full rationale.

---

## 4. Infrastructure & Hosting Sub-Processors: Where are They Disclosed?

Data processing involves two distinct categories of third parties:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA PROCESSOR DISCLOSURES                      │
├───────────────────────────────────┬────────────────────────────────────┤
│   In-App Contextual UI Notices    │   Full Legal Privacy Policy        │
│   (Immediate Interaction Level)   │   (Page: /privacy — Section 5)     │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Ola Maps (Geocoding/Navigation) │ • Railway.app (Cloud Hosting & DB) │
│ • Razorpay (Payment Gateway)      │ • Vercel Inc. (Static CDN/Edge)    │
│ • Store Partners & Riders         │ • Upstash / Redis (Session Cache)  │
│ • Exotel (SMS OTP Delivery)       │ • Data Processing Agreements (DPAs)│
└───────────────────────────────────┴────────────────────────────────────┘
```

### 1. In-App Contextual Notices (At the point of action)
Disclose third parties that directly touch the user's action:
- **Ola Maps** — disclosed at address save and order placement (all order types).
- **Razorpay** — disclosed via the conditional phrase *"if you choose online payment"* at address save and order placement. This is accurate for both COD users (condition never triggers) and online-payment users (condition applies). Razorpay is **never disclosed as active** for COD-only users because it never processes their data.
- **Exotel** — disclosed at OTP login screen.
- **Store Partners & Rider** — disclosed at address save and order placement.

### 2. Global Legal Privacy Policy (`/privacy`)
Hosting and cloud infrastructure providers (such as **Railway.app** for PostgreSQL/API hosting and **Vercel** for frontend CDN) do not need to be listed on every small form button. Instead, they are formally disclosed in Section 5 of GoRola's Privacy Policy (`/privacy`):
- **Hosting Provider:** Railway.app (Infrastructure Data Processor).
- **Frontend CDN:** Vercel Inc. (Edge Asset Hosting).
- **Security & Data Retention:** 90-day log rotation, AES-256-GCM database encryption, least-privilege PostgreSQL access.

---

## 5. Checkboxes vs Affirmative Action Buttons

| Scenario | Legal DPDP Rule | GoRola Implementation |
|---|---|---|
| **Essential Service** (e.g. Login OTP, Saving Address, Placing Order) | Clear notice + affirmative click action (e.g., *"Save Address"*, *"Verify OTP"*) satisfies DPDP Sec 6(1). | **Prominent Notice Card + Clear Action Button** (No blocking checkbox required). |
| **Optional / Commercial** (e.g. Marketing emails, promotional WhatsApp) | **Strictly Prohibited from bundling or pre-ticking.** User must deliberately opt in. | **Un-ticked Checkbox** (defaults to false) or explicit **Toggle Switch**. |
| **Telemetry / Tracking** (e.g. Performance analytics) | Prior notice with equal Accept and Decline options. | **Accept vs Decline Modal Buttons**. |

---

## 6. Profile Privacy Settings UI: Grouping vs Raw Logs
 
### The Rule: 4 Clean Purpose Cards
The `/account/privacy` (Privacy & Consent Preferences) page must render **one unified card per distinct Purpose**:
 
1. **`OTP_AUTH`** → Status: `Essential (Active)`
2. **`ORDER_PROCESSING`** → Status: `Essential (Active)`
3. **`MARKETING_EMAIL`** → Status: `Active` / `Withdrawn` (Interactive Opt-In / Withdraw Button)
4. **`ANALYTICS`** → Status: `Active` / `Declined` (Interactive Opt-In / Withdraw Button)
 
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
| `apps/web/src/pages/buyer/PrivacySettingsPage.tsx` | Dedicated page for `/account/privacy` | `PrivacySettingsPage.test.tsx` | 3 tests |
| `apps/web/src/components/account/PrivacySettingsSection.tsx` | 4-card interactive consent dashboard | `PrivacySettingsSection.test.tsx` | 5 tests |
| `apps/web/src/pages/buyer/ProfilePage.tsx` | Profile overview with quick link to `/account/privacy` | `ProfilePage.test.tsx` | 5 tests |
| `apps/web/src/components/consent/AnalyticsConsentBanner.tsx` | Bottom banner with cross-device pre-fetch | `AnalyticsConsentBanner.test.tsx` | 8 tests |
| `apps/web/src/app/routes/buyer.tsx` | Protected route `/account/privacy` registered | End-to-end routing | Complete |

All test suites verify:
- Complete rendering of all 4 canonical purpose cards even if server logs are empty.
- Immediate 1-click mutation triggers for marketing and analytics opt-in / withdrawal.
- `localStorage` bi-directional synchronization with server consent logs.
- Profile page navigation links cleanly directing to `/account/privacy`.



