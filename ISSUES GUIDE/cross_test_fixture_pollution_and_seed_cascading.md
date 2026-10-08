# Cross-Test Fixture Pollution & Seed Cascading Guide

## Overview

In complex full-stack applications with multi-step security flows (e.g. DPDP compliance, age verification gates, account suspensions, rate limits, and lockout mechanisms), test suites frequently encounter **cascading phantom failures**. 

A test in Test Suite B fails with a completely unrelated error (e.g. `Enter OTP` never appears or `Expected URL / but was /login`) not because Test Suite B is broken, but because an earlier test in Test Suite A mutated a shared database record or left a security lockout record behind.

This guide provides universal architectural principles to prevent cross-test state pollution and seed cascading.

---

## 1. The Anatomy of the Failure

### **Failure Pattern 1: Incomplete Seed Flag Inheritance**
When a new gate or prerequisite is added to the application (such as age verification or privacy policy re-consent), existing seeded test fixtures often omit the new flags. When standard tests log in with those fixtures, the backend detects missing verification fields and diverts the flow to the new gate instead of landing on the expected home or dashboard page.

**Example:**
- Seeded user `+919876543210` had `ageConfirmedAt: null`.
- `auth.spec.ts` enters OTP for `9876543210`, expecting immediate login to `/`.
- The API returns `{ ageGateRequired: true, ageTicket }`, keeping the UI on `/login` at the Age Gate step.
- `expect(page).toHaveURL('/')` fails with a timeout.

### **Failure Pattern 2: Destructive Shared Identity Mutation**
When Test A performs a destructive or restrictive action (e.g., suspending an account, blocking a phone number, exhausting retry limits, or setting deletion schedules) on a shared user identity, any subsequent failure or teardown interruption in Test A leaves that user in a restricted state in the persistent test database.

**Example:**
- `admin-journey.spec.ts` (E2E-038) suspends `9876543210` to test administrative controls.
- The test experiences an assertion timeout or is interrupted before it can call "Unsuspend".
- `auth.spec.ts` runs next, attempting a normal login with `9876543210`.
- The API rejects the login with `403 Account suspended`, causing all subsequent authentication tests to fail.

### **Failure Pattern 3: Ephemeral Security Table Pollution**
Lockout mechanisms (such as IP blocks, phone hash lockouts, or rate limiter keys in Redis) persist across test boundaries. If Test A tests an under-18 refusal that inserts a 90-day lockout row for a phone number, that number remains permanently blocked across all future test runs until manually purged.

---

## 2. Core Architectural Principles

### **Principle 1: Explicit & Comprehensive Seed State**
Database seeders (`seed-e2e.ts`, test factories) must never rely on partial records. Every seeded fixture intended for happy-path testing must explicitly set all current statutory, verification, and policy version flags.

```typescript
// ❌ WRONG: Incomplete seed allows unhandled gates to trigger during tests
await prisma.user.create({
  data: {
    phone: encryptedPhone,
    phoneHash: piiHash,
    isVerified: true
  }
});

// ✅ CORRECT: Fully qualified seed bypasses onboarding gates for happy paths
await prisma.user.create({
  data: {
    phone: encryptedPhone,
    phoneHash: piiHash,
    isActive: true,
    isVerified: true,
    ageConfirmedAt: new Date(),
    ageConfirmedPolicyVersion: "1.1",
    privacyPolicyVersionAccepted: "1.1"
  }
});
```

---

### **Principle 2: Pre-Seed Ephemeral Security Cleanup (Idempotency)**
Before seeding test records, seed scripts must wipe ephemeral security tables (lockouts, failed attempt counters, active rate limits) for all test identities. This guarantees that every test run starts with a clean slate even if a previous run was abruptly aborted.

```typescript
// Clear stale age-gate lockouts for all seeded test numbers
const testPhoneHashes = seededPhones.map((p) => hashPII(p));

await prisma.ageGateLockout.deleteMany({
  where: {
    phoneHash: { in: testPhoneHashes }
  }
});
```

---

### **Principle 3: Dedicated Identities for Destructive Tests**
Never perform destructive actions (suspension, account deletion, underage lockout, failed OTP bursts) on the primary happy-path test identity. Assign dedicated, isolated test identities for destructive journeys:

| Identity | Dedicated Purpose | Expected Security State |
|---|---|---|
| `...10` | Standard Buyer Authentication & Profile | Active, Verified, Age Confirmed |
| `...11` | Cart, Checkout & Razorpay Payments | Active, Verified, Age Confirmed |
| `...12` | Address CRUD & Location Services | Active, Verified, Age Confirmed |
| `...20` | Admin Suspension & Account Ban Tests | Mutated during test; never used by other suites |
| `...21` | Account Deletion & Recovery Tests | Soft-deleted / Deletion scheduled |
| `...99` | Under-18 Refusal & Lockout Tests | Transient random numbers (`98${random}`) |

---

### **Principle 4: Resilient Client-Side Step Detection in E2E**
In single-page applications with multi-step auth or modals, E2E tests must never use bare `.isVisible()` without a timeout or DOM-readiness assertion when checking for optional or prerequisite steps (such as cookie consent or statutory notices).

```typescript
// ❌ WRONG: isVisible() evaluates immediately and returns false before hydration
if (await page.locator('[data-testid="consent-continue-btn"]').isVisible()) {
  await page.locator('[data-testid="consent-continue-btn"]').click();
}

// ✅ CORRECT: Explicit timeout gives the React hydration loop time to mount
const consentNotice = page.locator('[data-testid="consent-notice-step"]');
if (await consentNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.locator('[data-testid="consent-acknowledge-checkbox"]').click();
  await page.locator('[data-testid="consent-continue-btn"]').click();
}
```

---

## 3. Checklist for Adding New Gates or Security Features

When introducing a new gate, verification step, or security restriction to an existing system:

1. [ ] **Update Seeding Scripts:** Add the new verification/confirmation flags to `seed.ts` and `seed-e2e.ts`.
2. [ ] **Update Test Factories:** Ensure helper functions (e.g. `loginBuyer`, `createUserFactory`) set the new flags by default.
3. [ ] **Clear Lockouts on Bootstrap:** Ensure test bootstrap routines purge lockout/abuse records for seeded ranges.
4. [ ] **Use Dynamic Random Identities for Negative Tests:** Negative test cases (e.g. under-age refusal, invalid OTP rate-limiting) must generate dynamic random identifiers so they never lock out a static seeded user.
5. [ ] **Run Full Test Suite Cleanly:** Run unit, integration, and E2E suites sequentially to verify zero cross-test interference.
