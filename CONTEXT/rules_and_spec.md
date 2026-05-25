# GoRola — Rules & Specification

> Standards, constraints, and non-negotiables. Every line here is LAW.
> If a rule conflicts with "being faster", the rule wins.

---

## 0. The Prime Directives

1. **TDD is non-negotiable.** Write the failing test first. Always. The sequence is: failing test → minimal code to pass → refactor. No exceptions.
2. **TypeScript strict mode everywhere.** `"strict": true` in all tsconfigs. No `any`. No `// @ts-ignore`. No `as unknown as X`.
3. **Security is a feature, not an afterthought.** Every input is untrusted. Every output is escaped. Every endpoint is authenticated unless explicitly marked public.
4. **Modular Monolith.** One deployable unit. Clean internal module boundaries. `import` from your module's public interface only — never reach into another module's internals.

---

## 1. TypeScript Rules

```
- "strict": true — always
- "noImplicitAny": true
- "strictNullChecks": true
- "noUncheckedIndexedAccess": true
- No 'any' type — use 'unknown' and narrow it, or create the proper type
- No barrel re-exports that create circular deps — trace with madge before every PR
- All function parameters and return types must be explicitly typed (no inference on public APIs)
- Use Zod for all external data validation (API inputs, env vars, config)
- Enums: use const enums or string union types — never numeric enums (they're a footgun)
- Use branded types for IDs: type UserId = string & { readonly brand: 'UserId' }
```

---

## 2. Test-Driven Development Rules

```
MANDATORY SEQUENCE FOR EVERY FEATURE:
  1. Write test file first (describe/it blocks with descriptive names)
  2. Write ALL test cases before any implementation:
     a. Normal / happy path cases
     b. ALL edge cases (empty arrays, zero values, max values, boundary conditions)
     c. ALL error cases (invalid input, missing required fields, DB errors, network failures)
     d. ALL security cases (SQL injection strings, XSS payloads, unauthorized access, JWT tampering)
  3. Run tests — confirm they all FAIL (red)
  4. Write minimal implementation to make tests pass (green)
  5. Refactor without breaking tests (refactor)
  6. PR blocked if coverage drops below 80% overall or below 100% on auth/payment

TEST NAMING CONVENTION:
  describe('ServiceName', () => {
    describe('methodName', () => {
      it('should [expected behavior] when [condition]', () => { ... })
      it('should throw [ErrorType] when [invalid condition]', () => { ... })
      it('should reject [security threat]', () => { ... })
    })
  })

TEST FILES LOCATION:
  - Unit tests: src/__tests__/unit/[module]/[file].test.ts
  - Integration tests: src/__tests__/integration/[module]/[file].test.ts
  - E2E tests: tests/e2e/[journey].spec.ts

MOCKING RULES:
  - Unit tests: mock ALL I/O (DB, Redis, external APIs, clock)
  - Integration tests: real DB (gorola_test schema), real Redis, mock external APIs only
  - Never mock the system under test
  - Use vi.useFakeTimers() for time-sensitive tests (OTP expiry, JWT expiry)
```

### 2.1 Universal Phase Completion Gate (API Contract Gate)

This gate applies to **every product phase** (buyer, store, admin, rider) whenever the phase depends on API data.

**A checklist item is NOT complete until all are true:**
1. Frontend/UI behavior for that item is implemented.
2. Required backend endpoint(s) are implemented.
3. Backend integration tests verify endpoint contract (success + error/edge/security where relevant).
4. Endpoints are registered in **runtime app wiring** (not only invoked in module-local test registration).
5. Frontend tests validate expected API envelope and loading/empty/error behavior.

**Non-negotiable rule:** never mark a phase done with UI-only progress when API contract work is part of that item.

---

## 3. Architecture Rules

### 3.1 Module Boundaries

```
Each domain module (auth, buyer, store, admin, catalog, order, cart, delivery [stub]) has:

  src/modules/[domain]/
    ├── [domain].controller.ts     # HTTP layer only — parse req, call service, format res
    ├── [domain].service.ts        # Business logic — pure, testable, no HTTP concepts
    ├── [domain].repository.ts     # Data access — Prisma calls only, no business logic
    ├── [domain].schema.ts         # Zod schemas for input validation
    ├── [domain].types.ts          # TypeScript types/interfaces for this domain
    ├── [domain].errors.ts         # Domain-specific error classes
    └── __tests__/
        ├── [domain].service.test.ts
        ├── [domain].repository.test.ts
        └── [domain].controller.test.ts

RULES:
  - Controller NEVER touches Prisma or the DB directly
  - Service NEVER imports from another service directly — use events or inject dependency
  - Repository NEVER contains business logic — it's a thin data access layer
  - Cross-module communication: through well-typed interfaces or domain events (EventEmitter)
```

### 3.2 Controller Rules

```
- Parse and validate request with Zod schema — reject with 400 before hitting service
- Extract authenticated user from req.user (set by auth middleware)
- Call ONE service method
- Map service result to HTTP response
- Never put if/else business logic in controllers
- Controllers are not unit tested directly — use integration tests with Supertest
```

### 3.3 Service Rules

```
- Pure business logic only
- Accept typed domain objects — not raw HTTP request objects
- Return typed domain objects — not Prisma models (map to domain types)
- Throw typed domain errors (AppError subclasses) — never raw Error
- All async operations must be properly awaited — no floating promises
- Transactions: use prisma.$transaction for multi-step DB operations
```

### 3.4 Repository Rules

```
- One repository per Prisma model (roughly)
- Methods named semantically: findById, findByPhoneNumber, create, update, delete, findManyByStoreId
- Always accept a transaction client (tx?) parameter for use inside transactions
- Never throw — return null for not-found, let service decide what that means
- Pagination: always use cursor-based pagination (not offset) for large collections
```

---

## 4. API Design Rules

```
BASE URL: /api/v1

RESPONSE ENVELOPE:
  Success: { "success": true, "data": { ... }, "meta": { "requestId": "..." } }
  Error:   { "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [...] } }

HTTP STATUS CODES (strict):
  200 — OK (GET, successful mutation with response body)
  201 — Created (POST that creates a resource)
  204 — No Content (DELETE, or mutation with no response body)
  400 — Bad Request (validation error — include Zod error details)
  401 — Unauthorized (no valid token)
  403 — Forbidden (valid token, wrong role/permission)
  404 — Not Found
  409 — Conflict (duplicate, already exists)
  422 — Unprocessable Entity (valid format but semantic error — e.g., cart item qty > stock)
  429 — Too Many Requests (rate limit hit)
  500 — Internal Server Error (never expose internals — log full error, return generic message)

PAGINATION: Cursor-based. Query params: ?cursor=<lastId>&limit=20
SORTING: ?sortBy=createdAt&order=desc
FILTERING: ?categoryId=...&storeId=...&minPrice=...&maxPrice=...

VERSIONING: URL prefix only. When breaking changes needed: /api/v2/...

IDEMPOTENCY: All POST endpoints for orders and payments MUST accept and honor X-Idempotency-Key header
```

---

## 5. Database Rules

```
ORM: Prisma v5/v6 — ONLY. No raw SQL unless performance-critical and fully reviewed.
     If raw SQL is used: it MUST be in a dedicated .sql file, parameterized, and reviewed.

HYBRID COMMERCE ENGINE:
  - Supports both Quick Commerce and Booking Commerce store flows.
  - StoreType enum: QUICK_COMMERCE, BOOKING_COMMERCE
  - OrderType enum: QUICK, BOOKING
  - BookingApprovalStatus enum: PENDING_APPROVAL, APPROVED, REJECTED, COMPLETED, CANCELLED
  - RiderType enum: DELIVERY, FIELD_TECHNICIAN

MIGRATIONS:
  - Always use 'prisma migrate dev' — never edit migration files manually
  - Every migration must be reversible — include down migration comments
  - Migrations run automatically in CI before integration tests
  - Never drop a column without a deprecation cycle (rename → dual-write → drop)

NAMING CONVENTIONS:
  - Tables: PascalCase (defaults directly to Prisma model names)
  - Columns: camelCase (e.g. createdAt, storeId, isDeleted)
  - Prisma model names: PascalCase (User, StoreOwner, OrderItem, SubCategory, BookingOrder)
  - Indexes: idx_[table]_[column(s)] or auto-generated relational indexes (@@index, @@unique)

IDs: Use cuid (@default(cuid())) for all primary key IDs

REQUIRED COLUMNS ON ALL ENTITIES (where appropriate):
  - id: String @id @default(cuid())
  - createdAt: DateTime @default(now())
  - updatedAt: DateTime @updatedAt

SOFT DELETE RULE: All deletes on User, Store, StoreOwner, Admin, Product, and DeliveryRider are soft deletes via an `isDeleted` boolean.
                  Repositories filter out isDeleted=true by default.

SENSITIVE DATA:
  - Passwords: bcrypt (cost factor 10-12)
  - Phone numbers: stored as-is (needed for OTP) — mask in logs
  - Payment data: NEVER stored — Razorpay / Pay-on-Service handles it

TRANSACTIONS:
  - Use prisma.$transaction for any operation touching >1 table
  - Timeout: 10 seconds max per transaction

CRITICAL COMMERCE ENTITIES & SCHEMA RELATIONSHIPS:
  - SubCategory: Nesting entity between Category and Product to support precise catalog subdivisions.
  - BookingOrder: Secondary table linked 1:1 with Order, storing appointment scheduledDate, timeslot, requiresFasting, approvalStatus, and technician assignments.
  - ProductVariant: Carrying allowedTimeslots (String[]) and requiresFasting (Boolean) for booking configuration parameters.
  - Store: Carrying storeType, bookingLeadDays, and isAcceptingBookings to govern booking limitations.
```

---

## 6. Authentication & Authorization Rules

```
BUYER AUTH:
  - Phone number + OTP (6 digits, 5 min TTL, max 3 attempts per OTP, 5 OTPs per 15 min per phone)
  - OTP stored as bcrypt hash in Redis (not DB) — key: otp:{phoneNumber}
  - On success: issue access token (15m) + refresh token (7d, stored in HttpOnly cookie)
  - Access token: in Authorization: Bearer header (or HttpOnly cookie — prefer cookie)

STORE OWNER / ADMIN AUTH:
  - Email + bcrypt password + TOTP 2FA (mandatory for admin, optional for store owner in v1)
  - TOTP: otplib library, 30s window, ±1 step tolerance
  - Same JWT pattern as buyer

JWT:
  - RS256 algorithm (asymmetric — public key can be distributed)
  - Payload: { sub: userId, role: 'buyer'|'store_owner'|'admin', storeId?: string, jti: string }
  - jti (JWT ID): stored in Redis as allowlist — revoked on logout, on password change, on 2FA enable
  - Refresh token rotation: issue new refresh token on every use, invalidate old one

RBAC:
  - Roles: BUYER, STORE_OWNER, ADMIN
  - Middleware: requireAuth(role?: Role) — attach to route
  - Store owners can ONLY access data for their own storeId (enforced in service layer)
  - Admins can access everything

NEVER:
  - Never store tokens in localStorage (XSS risk)
  - Never log tokens or OTPs (even partially)
  - Never return password hashes in API responses
  - Never skip authentication on "just for now" basis
```

---

## 7. Security Rules

```
INPUT VALIDATION:
  - ALL inputs validated with Zod at the controller boundary, before service call
  - String length limits on ALL string fields
  - Numeric range validation on ALL numeric fields (price, quantity, etc.)
  - File uploads: type whitelist (jpg, png, webp only), max 5MB, store on S3/Cloudinary (not local disk)

CORS:
  - Whitelist only: process.env.CORS_ALLOWED_ORIGINS (comma-separated)
  - credentials: true
  - No wildcard (*) origins — ever

HEADERS (via fastify-helmet):
  - Content-Security-Policy: strict — no unsafe-inline, no unsafe-eval
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: geolocation=(), microphone=(), camera=()

RATE LIMITING:
  - OTP send: 5 per 15min per phone number
  - Login: 10 per 15min per IP
  - General API: 100 per minute per IP
  - Store API: 200 per minute per storeId
  - Admin API: 500 per minute per adminId

LOGGING RULES (CRITICAL):
  - NEVER log: passwords, OTPs, JWT tokens, full credit card numbers, full phone numbers
  - Phone numbers in logs: mask to +91*****1234
  - All logs must include: requestId, userId (if authed), timestamp, level
  - Log at WARN or above for security events (failed auth, rate limit hit, permission denied)

AUDIT LOG:
  - All state-changing operations by admin and store owners go to audit_logs table
  - Fields: actorId, actorRole, action, entityType, entityId, oldValue (JSON), newValue (JSON), ip, userAgent, timestamp
  - Audit logs are IMMUTABLE — no update or delete
```

---

## 8. Frontend Rules

```
FRAMEWORK: React 18 + Vite + TypeScript (strict)
STYLING: Tailwind CSS v4 + shadcn/ui (Radix primitives)
ANIMATIONS: GSAP v3 with ScrollTrigger — for all scroll-based animations, hero sequences
SMOOTH SCROLL: Lenis — initialize once in App.tsx, sync with GSAP ticker
STATE: Zustand (global) + React Query / TanStack Query (server state)
FORMS: React Hook Form + Zod resolver
ROUTING: React Router v6

DESIGN TOKENS (as CSS custom properties — use these, never hardcode):
  --gorola-pine: #1D3D2F
  --gorola-pine-dark: #162E23
  --gorola-pine-light: #2D5A40
  --gorola-saffron: #E8833A
  --gorola-fog: #F4F1EC
  --gorola-charcoal: #1C1C1E
  --gorola-amber: #F5A623
  --gorola-slate: #3A4A5C
  --gorola-slate-mist: #E8ECF0

TYPOGRAPHY (always use these classes, never hardcode):
  .font-playfair — Playfair Display (display/headings)
  .font-dm-sans — DM Sans (body, all UI)
  .font-devanagari — Noto Sans Devanagari (Hindi)

COMPONENT RULES:
  - Every component that takes data must have a loading skeleton variant
  - Every component that can have no data must have an empty state
  - Every component that can error must have an error state
  - Components are typed — no implicit props
  - No inline styles except for GSAP-driven dynamic values
  - Responsive: mobile-first (390px → 768px → 1440px breakpoints)

ACCESSIBILITY:
  - All interactive elements: keyboard navigable, focus-visible ring
  - Images: always alt text
  - Color contrast: WCAG AA minimum
  - ARIA labels on icon-only buttons

GSAP RULES:
  - All GSAP animations use refs — never querySelector in React components
  - Clean up all GSAP contexts in useEffect cleanup (ctx.revert())
  - Use gsap.context() for scoped animations in components
  - ScrollTrigger.refresh() after dynamic content loads

PREMIUM FEEL CHECKLIST (required for every page):
  □ Topographic SVG background (subtle, low opacity)
  □ Smooth page entry animation (fade up, 0.4s)
  □ Hover states on all interactive cards (subtle lift + shadow)
  □ Loading skeletons match the shape of real content
  □ Lenis smooth scroll active
  □ No layout shifts on load
  □ ETA amber pulse animation on live banner
```

---

## 9. Observability Rules

```
STRUCTURED LOGGING (Pino):
  - Every log entry: { level, time, requestId, userId?, module, message, ...context }
  - Log levels: error (5xx), warn (4xx security events), info (business events), debug (dev only)
  - Production log level: info
  - Test log level: warn (suppress noise)
  - Never log in a hot path without checking log.isLevelEnabled() first

TRACING (OpenTelemetry):
  - Trace every incoming HTTP request (auto via Fastify plugin)
  - Trace every DB call (auto via Prisma OTel plugin)
  - Trace every Redis call (manual spans for critical operations)
  - Add span attributes: userId, storeId, orderId where relevant
  - Propagate trace context to async jobs (BullMQ workers)

HEALTH CHECK (/api/health — public, no auth):
  Response: {
    "status": "ok" | "degraded" | "down",
    "version": "0.1.0",
    "timestamp": "ISO8601",
    "checks": {
      "database": "ok" | "error",
      "redis": "ok" | "error"
    }
  }
  - Status 200 if status=ok
  - Status 200 if status=degraded (degraded = non-critical dependency down)
  - Status 503 if status=down (critical dependency down)

METRICS (Prometheus — /api/metrics — internal only, not public):
  - http_requests_total (by method, route, status)
  - http_request_duration_seconds (histogram)
  - active_orders_total (by store)
  - otp_sends_total (by result: success/rate_limited/failed)
```

---

## 10. CI/CD Rules

```
GITHUB ACTIONS — every PR triggers:
  1. Lint (eslint + prettier check)
  2. Type check (tsc --noEmit)
  3. Unit tests (vitest run)
  4. Integration tests (vitest run --integration, with test DB)
  5. Build (tsc + vite build)
  6. Coverage report — PR blocked if below thresholds

BRANCH STRATEGY:
  - main: production-ready always
  - develop: integration branch
  - feature/[ticket-id]-[short-desc]: feature branches
  - PRs require: all CI checks passing + 1 reviewer approval

DEPLOYMENT (Railway):
  - Auto-deploy to production on merge to main
  - Prisma migrations run automatically on deploy (prisma migrate deploy)
  - Environment variables managed in Railway dashboard — never in repo
  - Zero-downtime: Railway handles rolling deploys for Node.js

NEVER:
  - Never commit secrets or API keys
  - Never commit .env files (only .env.example with placeholder values)
  - Never skip CI checks with --force push
  - Never deploy on a Friday (golden rule)
```

---

## 11. Code Style Rules

```
FORMATTING: Prettier (enforced via CI)
  - printWidth: 100
  - tabWidth: 2
  - singleQuote: true
  - trailingComma: 'all'
  - semi: true

NAMING:
  - Variables/functions: camelCase
  - Types/Interfaces/Classes: PascalCase
  - Constants: SCREAMING_SNAKE_CASE (for truly immutable module-level constants)
  - Files: kebab-case.ts (no PascalCase files except React components: ProductCard.tsx)
  - Test files: [filename].test.ts or [filename].spec.ts

IMPORTS ORDER (enforced via eslint-plugin-import):
  1. Node built-ins
  2. External packages
  3. Internal packages (@gorola/shared, @gorola/ui)
  4. Internal modules (relative)

COMMENTS:
  - Code should be self-documenting — comments explain WHY, not WHAT
  - TODO comments: format // TODO(2024-Q2): [description] — always dated and explained
  - STUB comments for rider interface: // STUB: Rider interface — implement in Phase 5

ERROR HANDLING:
  - Use typed error classes: class OrderNotFoundError extends AppError { ... }
  - Global Fastify error handler formats ALL errors into the response envelope
  - Unhandled promise rejections: crash the process (let Railway restart it) — never swallow
  - Never use catch without handling: catch (err) { logger.error(err); throw err; } minimum
```

---

## 12. The "Rider Interface" Scaffolding Rule

```
The rider delivery interface is NOT built in v1. However:

REQUIRED STUBS:
  - DB tables: delivery_riders, rider_locations (migrations exist, tables empty)
  - API routes registered but return 501 Not Implemented:
    POST /api/v1/rider/auth/login → 501
    GET  /api/v1/rider/orders/active → 501
    PUT  /api/v1/rider/orders/:id/status → 501
    PUT  /api/v1/rider/location → 501
  - Socket.IO namespace: /rider — registered, events defined as interface but handler throws NotImplementedError
  - Feature flag: RIDER_INTERFACE_ENABLED = false — all rider endpoints check this flag
  - RiderService class exists with all method signatures typed but bodies throw NotImplementedError
  - RiderRepository class exists, all methods typed, bodies throw NotImplementedError

This way, Phase 5 implementation is:
  1. Set RIDER_INTERFACE_ENABLED = true
  2. Implement the service and repository bodies
  3. No schema changes needed
  4. No routing changes needed
```

---

## 13. Inventory Rules

INVENTORY IS SACRED:

- Stock quantity MUST be decremented atomically within the same DB transaction as order creation
- Never decrement stock outside of a transaction — race conditions will oversell
- If any item in the cart has insufficient stock at order placement time: reject the ENTIRE order with 422
  and return which items failed: { code: 'INSUFFICIENT_STOCK', items: [{ variantId, requested, available }] }
- Stock is per ProductVariant — not per Product

OVERSELL PREVENTION:

- Use Prisma's atomic increment/decrement: prisma.productVariant.update({ data: { stockQty: { decrement: qty } } })
- Add a DB-level constraint: stockQty >= 0 (CHECK constraint in migration)
- If the decrement would make stockQty < 0, Prisma throws — catch it, return 422

ON ORDER CANCELLATION:

- If order is cancelled (by store owner or admin): stock MUST be restored
- Same transaction: update order status + increment stockQty for each OrderItem

LOW STOCK THRESHOLD:

- Each ProductVariant has a lowStockThreshold (default: 5, store owner configurable)
- After every stock decrement: check if stockQty <= lowStockThreshold
- If yes: create a low-stock event → BullMQ job → (v1) marks variant with isLowStock flag
- Store dashboard shows low-stock items as a priority alert

OUT OF STOCK:

- When stockQty reaches 0: variant is automatically marked isInStock = false
- Buyer API filters out isInStock = false variants from product listings
- If ALL variants of a product are out of stock: product shows as "Out of Stock" (not hidden)
- Store owner can still see and manage out-of-stock products in their panel

STOCK HISTORY:

- Every stock change is recorded in stock_movements table (append-only, like audit log)
- Fields: id, variantId, changeType (SALE | REFILL | ADJUSTMENT | CANCELLATION_RESTORE | INITIAL),
  quantityBefore, quantityChange, quantityAfter, referenceId (orderId or null), note, createdBy, createdAt
- This table is the source of truth for inventory audits

---
