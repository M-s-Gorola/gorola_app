# The Tamper-Evident Cookie Pattern: Stateless Cooldowns & Abuse Prevention

When building web applications, engineers frequently encounter a difficult architectural challenge: **how do you temporarily restrict, rate-limit, or cool off an anonymous user who does not have an account yet, without creating database bloat or violating privacy laws?**

This guide defines the **Tamper-Evident Cookie Design Pattern**, explains the underlying cryptography, outlines general domain use cases across the industry, and provides a production-grade implementation blueprint.

---

## 1. The Core Problem: The Anonymous Abuser Dilemma

When an unauthenticated or anonymous visitor performs an action that requires a temporary block (e.g. failing age verification, failing password attempts, spamming free AI tokens, or claiming a single-use guest coupon), traditional mechanisms break down:

```
+───────────────────────────────────+─────────────────────────────────────────────────────────────────────────────+
| Traditional Approach              | Why It Breaks in Practice                                                   |
+───────────────────────────────────+─────────────────────────────────────────────────────────────────────────────+
| 1. Standard Cookie / LocalStorage | Easily bypassed. The user opens Chrome DevTools and deletes or edits the    |
|    (e.g., { blocked: true })      | value in 2 seconds.                                                         |
+───────────────────────────────────+─────────────────────────────────────────────────────────────────────────────+
| 2. Database Tracking Rows         | Database bloat & DDoS vector. Storing a database row for every anonymous    |
|    (PostgreSQL / Redis)           | bad actor wastes storage and allows attackers to flood your tables.         |
+───────────────────────────────────+─────────────────────────────────────────────────────────────────────────────+
| 3. IP-Address Blocking            | Collateral damage. Mobile carriers (CGNAT) and college campuses share single|
|                                   | IP addresses across thousands of legitimate users.                          |
+───────────────────────────────────+─────────────────────────────────────────────────────────────────────────────+
| 4. Hardware / Canvas Fingerprints | Illegal under modern privacy statutes (DPDP Act, GDPR, ePrivacy Directive). |
|                                   | Tracking hardware without explicit consent triggers massive legal fines.    |
+───────────────────────────────────+─────────────────────────────────────────────────────────────────────────────+
```

---

## 2. The Pattern Defined: "Data + Digital Wax Seal"

The **Tamper-Evident Cookie Pattern** offloads state storage entirely to the user's browser while using symmetric cryptography (**HMAC-SHA256**) to guarantee that the user cannot alter or fake the state.

### The Mental Model
Think of it like writing an expiration timestamp on a physical letter and stamping it with a **royal wax seal**. The user can hold the letter in their hands and read the date, but they cannot change the date because they do not possess the signet ring (the server's secret key). If they change the date, the seal breaks.

```
CLIENT (Browser)                                         SERVER (API)
──────┬─────────                                         ──────┬─────
      │                                                        │
      │  1. Triggers restricted action (e.g. Minor DOB)        │
      │ ──────────────────────────────────────────────────────>│
      │                                                        │ ── Compute expiry timestamp
      │                                                        │ ── Sign: HMAC_SHA256(timestamp, SECRET)
      │  2. 403 Refusal + Set-Cookie: ag_cooldown="<ts>.<hmac>"│
      │ <──────────────────────────────────────────────────────│
      │                                                        │
      │  3. BYPASS ATTEMPT: Retries with DAD'S Phone Number    │
      │     (Browser automatically attaches `ag_cooldown`)     │
      │ ──────────────────────────────────────────────────────>│
      │                                                        │ ── Verify HMAC signature: VALID
      │                                                        │ ── Check Clock: now < timestamp
      │  4. 403 Forbidden: "Device cooling-off active"         │
      │ <──────────────────────────────────────────────────────│ (Rejected without creating account)
      │                                                        │
      │  5. TAMPER ATTEMPT: User edits timestamp in DevTools   │
      │ ──────────────────────────────────────────────────────>│
      │                                                        │ ── Recompute HMAC on edited string
      │                                                        │ ── Signature Mismatch! (TAMPERED)
      │  6. 403 Forbidden: "Invalid signature / Cooldown"      │
      │ <──────────────────────────────────────────────────────│ (Rejected instantly)
      │                                                        │
```

---

## 3. The Browser Limitation: Cookie Deletion vs. Editing (Why Defense-in-Depth is Mandatory)

An essential engineering reality must be stated clearly: **no web technology can prevent a user from deleting cookies, clearing browser data, or opening an Incognito window.**

### Editing vs. Deleting

| User Action | Standard Cookie (`blocked=true`) | Tamper-Evident Cookie (`<expiry>.<hmac>`) |
| :--- | :--- | :--- |
| **Editing in DevTools** *(e.g. changing expiry)* | ❌ **Server fooled!** Blindly accepts client-edited value. | ✅ **Server detects tampering!** HMAC signature fails instantly. |
| **Deleting Cookie / Using Incognito** | Cookie is wiped. | Cookie is wiped. |

Because a determined user can wipe their browser cookies, the Tamper-Evident Cookie **must never be your only security barrier**. It is designed to function as the **client-side layer in a 3-tier Defense-in-Depth architecture**:

```
                       User Triggers Security / Refusal Event
                                         │
    ┌────────────────────────────────────┼────────────────────────────────────┐
    ▼                                    ▼                                    ▼
[ Tier 1: Server Database ]     [ Tier 2: Tamper-Evident Cookie ]    [ Tier 3: Redis IP / Abuse Counter ]
Identifier Lock (e.g. Phone/Email) Device Cooldown (e.g. 24h)         Rate-Limit / Anomaly Detection
(Stored in PostgreSQL)           (Stored on Client Browser)           (Stored in Redis Memory)
    │                                    │                                    │
    │ If user deletes cookies            │ If user stays in normal            │ If user opens Incognito
    │ and tries the SAME identity:       │ browser and tries a NEW identity:  │ and cycles MULTIPLE identities:
    ▼                                    ▼                                    ▼
🛑 100% BLOCKED by Database          🛑 100% BLOCKED by Cookie            🚨 Flagged / Rate-Limited
(Cookie deletion has zero effect!)   (Stops 90% casual number-hopping)   (Stops automated attack scripts)
```

### Why the Cookie Tier is Still Invaluable:
1. **Stops the 90% Casual Path:** The vast majority of standard users do not open DevTools, wipe site cookies, or switch to Incognito; they simply try typing another phone number or password in the same tab. The cookie stops them cold.
2. **Zero False-Positive Collateral Damage:** Unlike IP blocking, the cookie cleanly penalizes only the offending browser without affecting other innocent users sharing the same home Wi-Fi, office network, or mobile carrier (CGNAT).
3. **Guaranteed Anti-Forgery:** Even tech-savvy users who open DevTools cannot forge an approved status or edit their cooldown duration.

---

## 4. General Domain Use Cases

This pattern is a general software engineering tool that can be applied across numerous product domains:

| Domain / Scenario | Trigger Action | What the Cookie Protects Against |
| :--- | :--- | :--- |
| **1. Age & Eligibility Gates** | User enters a birthdate below the legal minimum age (e.g. <18). | Prevents the minor from immediately grabbing a parent's phone number and typing a fake adult date on the same device. |
| **2. Login Brute-Force & Credential Stuffing** | Client triggers 5 consecutive incorrect passwords. | Imposes an immediate 15-minute device-level backoff cooldown without locking the legitimate user's entire account globally. |
| **3. Guest Checkout Promo / Coupon Abuse** | Anonymous user redeems a *"10% Off First Guest Order"* discount code. | Prevents the guest from repeatedly applying the first-order discount code across multiple browser tabs or checkout sessions. |
| **4. Anonymous AI / LLM Token Drain** | Free tier user exhausts their daily quota of free generation credits. | Enforces a 24-hour rate limit without forcing the user to create an account first and without tracking IP addresses. |
| **5. Public Polls & Voting Widgets** | Visitor casts a vote on a public opinion poll or feedback widget. | Eliminates casual vote-stuffing on shared network environments (like universities or offices) where IP rate-limiting fails. |
| **6. Flash-Sale Waiting Rooms** | User is assigned a queue position or retry cooldown interval. | Prevents the client from manipulating their queue timestamp to jump ahead in line during high-concurrency ticket drops. |

---

## 5. Production-Grade Implementation Blueprint

Below is the complete, self-contained reference implementation in TypeScript / Node.js using standard `node:crypto`.

### A. Cryptographic Signing & Verification

```ts
import crypto from "node:crypto";

const HMAC_SECRET = process.env.HMAC_SECRET || "super_secret_server_signing_key_32bytes!";

// 1. Derive a consistent 256-bit key from the secret string
function getSigningKey(): Buffer {
  return crypto.createHash("sha256").update(HMAC_SECRET).digest();
}

/**
 * Signs a payload with an expiration timestamp: `<expiryEpochSeconds>.<hmacHex>`
 */
export function signTamperEvidentCookie(cooldownSeconds: number, now: Date = new Date()): string {
  const expiryEpoch = Math.floor(now.getTime() / 1000) + cooldownSeconds;
  const payload = `cooldown:${expiryEpoch}`;
  
  const hmacHex = crypto
    .createHmac("sha256", getSigningKey())
    .update(payload)
    .digest("hex");

  return `${expiryEpoch}.${hmacHex}`;
}

/**
 * Validates the cookie. Returns TRUE only if:
 * 1. The format is valid (<epoch>.<hash>)
 * 2. The cryptographic signature matches the server's key
 * 3. The current time is BEFORE the expiration epoch
 */
export function verifyTamperEvidentCookie(cookieValue: unknown, now: Date = new Date()): boolean {
  if (typeof cookieValue !== "string" || !cookieValue) {
    return false;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [expiryStr, providedHmacHex] = parts;
  const expiryEpoch = parseInt(expiryStr, 10);
  if (isNaN(expiryEpoch)) {
    return false;
  }

  // 1. Check expiration
  const currentEpoch = Math.floor(now.getTime() / 1000);
  if (expiryEpoch <= currentEpoch) {
    return false; // Cooldown has expired naturally
  }

  // 2. Cryptographic signature check
  try {
    const payload = `cooldown:${expiryEpoch}`;
    const expectedHmacHex = crypto
      .createHmac("sha256", getSigningKey())
      .update(payload)
      .digest("hex");

    const providedBuf = Buffer.from(providedHmacHex, "hex");
    const expectedBuf = Buffer.from(expectedHmacHex, "hex");

    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }

    // CRITICAL: Use timingSafeEqual to prevent side-channel timing attacks
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}
```

### B. Controller / Middleware Integration

```ts
import type { FastifyRequest, FastifyReply } from "fastify";

export async function handleAction(request: FastifyRequest, reply: FastifyReply) {
  const incomingCookie = request.cookies["ag_cooldown"];

  // 1. Enforce Cooldown Check
  if (incomingCookie && verifyTamperEvidentCookie(incomingCookie)) {
    return reply.status(403).send({
      success: false,
      error: {
        code: "DEVICE_COOLDOWN_ACTIVE",
        message: "This device is temporarily cooling off. Please try again later."
      }
    });
  }

  // 2. Execute business logic...
  const isInvalid = checkBusinessRules(request.body);

  if (isInvalid) {
    // 3. Issue Signed Cooldown Cookie (e.g., 24 hours = 86400 seconds)
    const signedCookie = signTamperEvidentCookie(86400);

    reply.setCookie("ag_cooldown", signedCookie, {
      httpOnly: true,                                       // Prevents JavaScript read access
      secure: process.env.NODE_ENV === "production",        // HTTPS only
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 86400
    });

    return reply.status(403).send({
      success: false,
      error: {
        code: "ACTION_REFUSED",
        message: "Action not permitted."
      }
    });
  }
}
```

---

## 6. Architectural Comparison Matrix

| Property | Tamper-Evident Cookie | Redis / Database Lockout | IP Rate-Limiting | Device Fingerprinting |
| :--- | :--- | :--- | :--- | :--- |
| **Server State / RAM** | **Zero (Stateless)** | High (stores row per actor) | Medium (stores IP buckets) | High (requires hash DB) |
| **Bypass by Identity Hopping** | **Blocked** (cookie stays on device) | Vulnerable (switches phone/email) | Vulnerable (switches proxy/VPN) | Blocked |
| **Risk of Collateral Damage** | **Zero** (targets exact browser) | Zero | **High** (blocks whole Wi-Fi / CGNAT) | Low |
| **DevTools Tampering** | **Impossible** (HMAC fails) | N/A (server-side) | N/A (server-side) | Medium (spoofable canvas) |
| **Privacy / DPDP / GDPR** | **100% Compliant** (temporary functional cookie) | 100% Compliant | 100% Compliant | **High Legal Risk** (statutory violation) |

---

## 7. Concrete Example: GoRola Age Eligibility Gate

In our quick-commerce application, this pattern is applied in **Phase 8.8 (Age Eligibility Gate)**:

1. **The Scenario:** When a user verifies their phone via OTP, they enter their Date of Birth on a neutral picker.
2. **The Violation:** If a minor enters a birthdate under 18, the system must refuse account creation.
3. **The Risk:** Without this pattern, the minor could immediately grab a parent's phone number on the same device, type a fake birth year (e.g., 1990), and bypass the gate.
4. **The Solution:** The server issues the `gorola_ag` tamper-evident cookie with a 24-hour expiration. If the minor attempts to sign up with a new phone number on that browser, the server detects the active cooldown signature and rejects the attempt (`403 AGE_GATE_LOCKED`), completely eliminating the circumvention vector.
