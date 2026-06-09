# GoRola — Architecture

> How everything connects. The system map.
> Read this when you need to understand where a piece fits, what calls what, or how data flows.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                         │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
              ┌────────────────────┼───────────────────┐
              │                    │                   │
     ┌────────▼────────┐  ┌───────▼───────┐  ┌───────▼───────┐
     │   BUYER WEB     │  │  STORE PANEL  │  │  ADMIN PANEL  │
     │  (React/Vite)   │  │  (React/Vite) │  │  (React/Vite) │
     │  Vercel CDN     │  │  Vercel CDN   │  │  Vercel CDN   │
     └────────┬────────┘  └───────┬───────┘  └───────┬───────┘
              │                    │                   │
              └────────────────────┼───────────────────┘
                                   │ HTTPS + WebSocket
                         ┌─────────▼─────────┐
                         │   FASTIFY API     │
                         │   (Node.js 22)    │
                         │   Railway.app     │
                         │                   │
                         │  ┌─────────────┐  │
                         │  │  Auth MW    │  │
                         │  │  Rate Limit │  │
                         │  │  Helmet     │  │
                         │  │  CORS       │  │
                         │  └─────────────┘  │
                         └────────┬──────────┘
                    ┌─────────────┼──────────────┐
                    │             │              │
           ┌────────▼───┐  ┌─────▼─────┐  ┌────▼──────┐
           │ PostgreSQL │  │   Redis   │  │  BullMQ   │
           │    15      │  │     7     │  │  Workers  │
           │ Railway    │  │ Railway   │  │           │
           └────────────┘  └───────────┘  └────┬──────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  External Services  │
                                    │  - Fast2SMS (OTP)   │
                                    │  - Razorpay (pay)   │
                                    └─────────────────────┘
```

### Deployment: Vercel & Railway (`GoRola_app` repo root)

**Single rule:** Anything that should **not change on every deploy** — **install command**, **build command**, **output directory** (Vercel), **build/start/restart** (Railway), **Node major** — is **defined in committed config files** in the repo. **Do not** re-type those in the Vercel or Railway UI unless you intentionally override (that override will diverge from the repo and confuse the next person).

**What is *not* in those files (and never should be in git):** API keys, JWT private material, database passwords, `CORS_ALLOWED_ORIGINS` values for real URLs, Fast2SMS keys, etc. Those are set **once per environment** in each platform’s dashboard. The **contract** for required names is in repo root **`.env.example`** and **`project_data.json`**.

**Turning off Git-driven autodeploy (current practice):** We do **not** rely on “every push to GitHub runs a new production build” from Vercel or Railway. That avoids duplicate or accidental releases and makes **GitHub Actions** the quality gate and trigger for production deploys.

| Platform | In the UI | In repo (optional) |
|----------|-----------|-------------------|
| **Vercel** | *Settings* → *Build and Deployment* → **Ignored build step** → **Don’t build anything** (runs `exit 0`, so Vercel skips the build for Git events). The GitHub repo can stay **connected** for PR integration. | Root `vercel.json` sets `git.deploymentEnabled: false` so the policy is recorded next to `install` / `build` / `output`. |
| **Railway** | API service → *Settings* (Source / **Git**): **Disconnect** the repository. Commits no longer start deploys. | There is no `railway.toml` flag for this; autodeploy is a **Git connection** setting. |

**CD from GitHub:** File `.github/workflows/ci-cd.yml` defines `ci`, **`paths`**, then in parallel **deploy-vercel** and **deploy-railway** (gated on `main` and path outputs). **Vercel:** `npx vercel deploy --prod` (remote build; `VERCEL_*` job env). **Railway:** `npx @railway/cli@latest up --ci` with `--message` = branch + short SHA and `--service` (not legacy GraphQL). Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID` (see `GoRola_app/README.md`).

---

### Vercel — buyer web (static site)

#### In plain language

- **`vercel.json`** (monorepo root) is the **only** file that locks Vercel’s **install**, **build**, and **output directory** for production. Vercel reads it when the project is linked to this repo; you should **not** have to copy the same three strings into the project settings every time. If the dashboard shows different values, clear them or align with the file so the repo stays the source of truth.
- **Node 22** for the build is implied by the repo (see **`.nvmrc`** at the monorepo root and **`package.json` → `engines.node`**). Vercel often picks that up automatically.
- **`apps/web/.env.example`** is **not** a deploy config file for Vercel; it only documents which **public** `VITE_*` variable names the frontend expects. You set real values in Vercel → *Environment Variables* (e.g. `VITE_API_BASE_URL` for Production).

`apps/web` is **Vite + React + TypeScript** and **Tailwind CSS v4**.

#### What each file carries

| File | Role |
|------|------|
| **`vercel.json`** | Declares `installCommand`, `buildCommand`, and `outputDirectory` for the static buyer app. This is the authoritative place for those three. |
| **`.nvmrc`** (repo root) | Suggests Node **22** for runtimes that read it. |
| **Root `package.json`** | `packageManager: "pnpm@…"` so CI/Vercel use **pnpm** consistently. `engines` constrains Node. |
| **`apps/web/.env.example`** | Lists **public** env var **names** for local dev and for what to add in Vercel (no secrets in git). |

#### Committed config — `vercel.json`

Path: `vercel.json` (repository root, same as `GoRola_app`).

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm --filter @gorola/shared build && pnpm --filter @gorola/web build",
  "outputDirectory": "apps/web/dist",
  "git": { "deploymentEnabled": false }
}
```

#### Vercel dashboard (still required; not in `vercel.json`)

| You do in the UI | Why |
|------------------|-----|
| **Connect** this GitHub repo (optional if you only deploy via CI or CLI, but common for PR comments / collaboration). | With **Ignored build step** and `git.deploymentEnabled`, **pushes** do not build until GitHub Actions runs `vercel deploy --prod` (or you deploy manually). |
| **Root Directory** = empty / **repository root** (not `apps/web`). | The build commands assume `pnpm-workspace` at the monorepo root. |
| **Environment variables** (e.g. `VITE_API_BASE_URL` for Production/Preview). | Public URL of the API; not committed. |
| **Ignored build step** = *Don’t build anything* (or equivalent) | Stops Vercel from building on every Git push; CD runs from Actions. |
| **Optional:** custom domain, team, preview settings. | Operational. |

---

### Railway — Fastify API (Node)

#### In plain language

- **`railway.toml`** (monorepo root) tells Railway **how to build** the API and **how to start** it after a successful build: Nixpacks builder, full `buildCommand`, `startCommand`, and restart policy. It does **not** store secrets or provision databases.
- **`nixpacks.toml`** only pins **Node major 22** for the Nixpacks Node build image (matches CI and local `.nvmrc`).
- **`Procfile`** declares a **`web`** process with the same start command as `railway.toml` so the default process type is unambiguous.
- **`apps/api/package.json` → `scripts.build` and `scripts.start`** are the **last mile**: what `pnpm --filter @gorola/api run build` and `pnpm --filter @gorola/api start` actually run (Prisma generate, `tsc`, migrate deploy, `node dist/app.js`). If you change API startup, you change these scripts (and usually leave `railway.toml`’s *wrapper* as `pnpm --filter @gorola/api …`).

**Root directory for the service:** the **Git repo root** (`GoRola_app`). Do **not** set the deploy root to `apps/api` only — the monorepo needs `pnpm-workspace.yaml` and filters.

#### What each file carries

| File | Role |
|------|------|
| **`railway.toml`** | `builder`, **full `buildCommand`**, **deploy `startCommand`**, `restartPolicyType`. This is the authoritative place for how Railway builds and runs the API service. |
| **`nixpacks.toml`** | `NODE_VERSION` for Nixpacks (Node 22). |
| **`Procfile`** | `web: …` process line; matches the intended start. |
| **`apps/api/package.json` → `scripts`** | `build` = Prisma client + TypeScript emit to `dist/`. `start` = migrate then listen. |
| **Repo root `.env.example` / `project_data.json`** | **Documentation only** — list of variable **names** Railway must have; not the values. |

#### Committed config — `railway.toml`

Path: `railway.toml` (repository root).

```toml
# GoRola API on Railway (monorepo root). In dashboard: set PostgreSQL 15 + Redis 7, link vars (DATABASE_URL, REDIS_URL, etc.).
# Node: 22+ on Nixpacks/Railway (see nixpacks.toml, .nvmrc) and >=22 in root package.json "engines" (CI uses 22).
# https://docs.railway.com/deploy/config-as-code

[build]
builder = "NIXPACKS"
buildCommand = "pnpm install --frozen-lockfile && pnpm --filter @gorola/shared build && pnpm --filter @gorola/api run build"

[deploy]
startCommand = "pnpm --filter @gorola/api start"
restartPolicyType = "on_failure"
```

#### Committed config — `nixpacks.toml`

Path: `nixpacks.toml` (repository root).

```toml
# Nixpacks (Railway with builder NIXPACKS). Major 22 matches CI; local dev may use newer Node if package.json engines allows it.
# https://nixpacks.com/docs/providers/node

[variables]
NODE_VERSION = "22"
```

#### Committed config — `Procfile`

Path: `Procfile` (repository root).

```
web: pnpm --filter @gorola/api start
```

#### Committed config — `apps/api` npm scripts (invoked by `railway.toml`)

The Railway `startCommand` runs `pnpm --filter @gorola/api start`, which uses these scripts in `apps/api/package.json`:

```json
"build": "prisma generate && tsc -p tsconfig.json",
"start": "prisma migrate deploy && node dist/app.js"
```

So every deploy: **migrations run**, then the server **listens** on the port Railway provides (see `PORT` in `.env.example`).

#### Railway dashboard (still required; not in the files above)

| You do in the UI | Why |
|------------------|-----|
| **Git:** **Disconnect** the repo if you use GitHub Actions (or only manual/CLI) to trigger deploys. | Stops auto-deploy on every commit; the workflow runs **`railway up --ci`** (CLI upload + build on Railway) with `RAILWAY_TOKEN` + `RAILWAY_SERVICE_ID` after CI passes. |
| **Create** PostgreSQL 15 and Redis 7 **plugin** services. | Runtimes, not in git. |
| **Link** `DATABASE_URL`, `REDIS_URL`, and any other **reference** variables into the API service. | Connection strings. |
| **Set** all **secrets and config** from the `.env.example` / `project_data` contract: JWT keys, `CORS_ALLOWED_ORIGINS` (include your Vercel URLs), `FAST2SMS_API_KEY`, OTEL, `PORT` if needed, etc. | Never committed. |
| **Optional:** custom domain, scaling, health checks. | Operational. |

`CORS_ALLOWED_ORIGINS` must include the **Vercel** production (and **Preview** URLs if the browser calls the API from those hosts).

**Further reading:** [Railway config as code](https://docs.railway.com/deploy/config-as-code), [Nixpacks Node](https://nixpacks.com/docs/providers/node).

---

## Request Lifecycle

```
Browser Request
       │
       ▼
1. fastify-helmet (security headers)
       │
       ▼
2. @fastify/cors (origin whitelist check)
       │
       ▼
3. @fastify/rate-limit (per IP / per user)
       │
       ▼
4. Request ID middleware (generates UUID, sets X-Request-ID header)
       │
       ▼
5. Pino request logger (logs method, url, requestId)
       │
       ▼
6. Route matching
       │
       ▼
7. requireAuth middleware (if protected route)
   - Reads JWT from HttpOnly cookie OR Authorization header
   - Verifies RS256 signature
   - Checks jti in Redis allowlist (revocation check)
   - Attaches { userId, role, storeId? } to req.user
       │
       ▼
8. requireRole middleware (if role-restricted)
       │
       ▼
9. Controller function
   - Parses body/query/params
   - Validates with Zod schema (throws 400 on failure)
   - Calls service method
       │
       ▼
10. Service function (business logic)
    - Calls repository methods
    - Applies business rules
    - Throws typed domain errors on failure
        │
        ▼
11. Repository function (data access)
    - Prisma query
    - Returns domain objects (never raw Prisma types)
        │
        ▼
12. Response assembly
    - Service returns domain object to controller
    - Controller formats { success: true, data: ..., meta: { requestId } }
    - HTTP response sent
        │
        ▼
13. Pino response logger (logs status, duration)
        │
        ▼
14. OpenTelemetry span ends (duration, attributes recorded)
```

---

## Module Map

```
apps/api/src/modules/
│
├── auth/                    ← ALWAYS LOADED FIRST
│   ├── buyer OTP flow       ← POST /api/v1/auth/buyer/send-otp
│   │                           POST /api/v1/auth/buyer/verify-otp
│   │                           POST /api/v1/auth/buyer/refresh
│   │                           POST /api/v1/auth/buyer/logout
│   ├── store-owner auth     ← POST /api/v1/auth/store/login
│   │                           POST /api/v1/auth/store/setup-2fa
│   │                           POST /api/v1/auth/store/verify-2fa
│   │                           POST /api/v1/auth/store/refresh
│   └── admin auth           ← POST /api/v1/auth/admin/login
│                               POST /api/v1/auth/admin/verify-2fa
│                               POST /api/v1/auth/admin/refresh
│
├── catalog/                 ← READ-HEAVY, CACHED IN REDIS
│   ├── categories           ← GET /api/v1/categories
│   ├── subcategories        ← GET /api/v1/categories/:slug/subcategories
│   ├── products             ← GET /api/v1/products?categoryId=&subCategoryId=&storeId=&search=
│   └── variants             ← GET /api/v1/products/:id (includes variants with allowedTimeslots/requiresFasting)
│
├── booking/                 ← HYBRID BOOKING COMMERCE WORKFLOW (PHASE 7)
│   ├── place booking request← POST /api/v1/bookings
│   ├── list store bookings  ← GET  /api/v1/store/bookings
│   ├── approve booking      ← PUT  /api/v1/store/bookings/:orderId/approve
│   ├── reject booking       ← PUT  /api/v1/store/bookings/:orderId/reject
│   ├── complete booking     ← PUT  /api/v1/store/bookings/:orderId/complete
│   ├── cancel booking       ← DELETE /api/v1/bookings/:orderId
│   └── get booking status   ← GET  /api/v1/bookings/:orderId
│
├── cart/                    ← PER-USER, SESSION-LIKE
│   ├── view cart            ← GET  /api/v1/cart
│   ├── add item             ← POST /api/v1/cart/items
│   ├── update quantity      ← PUT  /api/v1/cart/items/:variantId
│   └── remove item          ← DELETE /api/v1/cart/items/:variantId
│
├── order/                   ← CRITICAL PATH — ALL OPERATIONS TRANSACTIONAL
│   ├── place order          ← POST /api/v1/orders (orderType = QUICK)
│   ├── get order            ← GET  /api/v1/orders/:id
│   ├── list my orders       ← GET  /api/v1/orders (buyer's orders)
│   └── reorder              ← POST /api/v1/orders/:id/reorder
│
├── user/                    ← BUYER PROFILE
│   ├── my profile           ← GET  /api/v1/me
│   ├── update profile       ← PUT  /api/v1/me
│   ├── my addresses         ← GET  /api/v1/me/addresses
│   ├── add address          ← POST /api/v1/me/addresses
│   ├── update address       ← PUT  /api/v1/me/addresses/:id
│   └── delete address       ← DELETE /api/v1/me/addresses/:id
│
├── store/                   ← PUBLIC STORE INFO
│   ├── list stores          ← GET /api/v1/stores
│   └── get store            ← GET /api/v1/stores/:id
│
├── store-owner/             ← AUTHENTICATED STORE OWNER PANEL
│   ├── dashboard            ← GET /api/v1/store/dashboard
│   ├── pending orders       ← GET /api/v1/store/orders?status=PLACED
│   ├── update order status  ← PUT /api/v1/store/orders/:id/status
│   ├── products             ← CRUD /api/v1/store/products
│   ├── product variants     ← CRUD /api/v1/store/products/:id/variants
│   ├── bulk products        ← POST /api/v1/store/bulk/products/validate | /confirm
│   ├── bulk restock         ← POST /api/v1/store/bulk/restock/validate | /confirm
│   ├── advertisements       ← CRUD /api/v1/store/advertisements
│   ├── offers               ← CRUD /api/v1/store/offers
│   └── discounts            ← CRUD /api/v1/store/discounts
│
├── promotion/               ← BUYER-FACING PROMOTIONS (READ)
│   ├── active ads           ← GET /api/v1/promotions/advertisements
│   ├── active offers        ← GET /api/v1/promotions/offers
│   └── validate discount    ← POST /api/v1/promotions/discounts/validate
│
├── admin/                   ← SUPER ADMIN — ALL DATA ACCESS
│   ├── dashboard            ← GET /api/v1/admin/dashboard
│   ├── all orders           ← GET /api/v1/admin/orders
│   ├── store management     ← CRUD /api/v1/admin/stores
│   ├── user management      ← GET/PUT /api/v1/admin/users
│   ├── category management  ← CRUD /api/v1/admin/categories
│   ├── bulk categories      ← POST /api/v1/admin/bulk/categories/validate | /confirm
│   ├── feature flags        ← GET/PUT /api/v1/admin/feature-flags
│   ├── ad approval          ← PUT /api/v1/admin/advertisements/:id/approve
│   └── audit logs           ← GET /api/v1/admin/audit-logs
│
├── feature-flag/            ← INTERNAL — NO PUBLIC ROUTES
│   └── Used by all modules to check flags: featureFlagService.isEnabled('WEATHER_MODE_ACTIVE')
│
├── audit/                   ← INTERNAL — NO PUBLIC ROUTES
│   └── Called by service layer after any state-changing admin/store-owner action
│
├── delivery/                ← IN PROGRESS (PARTIALLY IMPLEMENTED)
│   ├── rider auth           ← POST /api/v1/rider/auth/login (Implemented)
│   ├── active orders        ← GET  /api/v1/rider/orders/active (Implemented)
│   ├── update order status  ← PUT  /api/v1/rider/orders/:id/status → 501
│   └── update location      ← PUT  /api/v1/rider/location → 501
│
└── health/                  ← PUBLIC — NO AUTH
    └── health check         ← GET /api/health
```

---

## Database Schema (Entity-Relationship Summary)

```
User (buyer)
  │
  ├── has many → Address
  ├── has one  → Cart
  │               └── has many → CartItem → ProductVariant
  └── has many → Order (orderType = QUICK | BOOKING)
                  ├── belongs to → Store (storeType = QUICK_COMMERCE | BOOKING_COMMERCE)
                  ├── has many  → OrderItem → ProductVariant
                  ├── has many  → OrderStatusHistory
                  └── has one   → BookingOrder (only for orderType = BOOKING)
                                  └── scheduledDate, timeslot, requiresFasting, approvalStatus

Store (storeType = QUICK_COMMERCE | BOOKING_COMMERCE)
  │
  ├── has many → StoreOwner
  ├── has many → Product
  │               └── has many → ProductVariant (allowedTimeslots, requiresFasting)
  ├── has many → Order
  ├── has many → Advertisement
  ├── has many → Offer
  ├── has many → Discount
  └── has many → DeliveryRider (riderType = DELIVERY | FIELD_TECHNICIAN)

Category
  └── has many → SubCategory
                  └── has many → Product

Admin (standalone — no store association)

FeatureFlag (key-value store, admin-controlled)

AuditLog (append-only, references actorId by string — not FK, so log survives deletion)

DeliveryRider (riderType = DELIVERY | FIELD_TECHNICIAN)
  └── has many → RiderLocation [STUB]
```

---

## Data Flow: Placing an Order

```
1. Buyer clicks "Place Order" on checkout page
   └── POST /api/v1/orders
       body: { cartId, addressId, paymentMethod, discountCode? }

2. Auth middleware verifies JWT → req.user = { userId: 'u_...', role: 'BUYER' }

3. OrderController.createOrder(req, reply)
   └── Validates body with OrderCreateSchema (Zod)
   └── Calls orderService.createOrder(userId, dto)

4. OrderService.createOrder(userId, dto)
   └── cartRepository.findByUserId(userId) → validates cart not empty
   └── addressRepository.findById(dto.addressId) → validates belongs to user
   └── If discountCode: discountRepository.findByCode → validates active + not expired + usage limit
   └── productVariantRepository.findManyByIds(cartItemVariantIds) → validates stock
   └── Calculates: subtotal, deliveryFee, discountAmount, total
   └── prisma.$transaction([
         cartRepository.clear(cartId, tx),
         orderRepository.create({ userId, storeId, items, total... }, tx),
         discountRepository.incrementUsage(discountId, tx),      ← if discount used
         orderStatusRepository.create({ orderId, status: 'PLACED' }, tx)
       ])
   └── Emits event: 'order.placed' → OrderEventHandler
   └── Returns created order

5. OrderEventHandler (listens for 'order.placed')
   └── notificationQueue.add('notify-store', { orderId, storeId })
   └── [Future] Socket.IO emit to store owner's room

6. BullMQ Worker: notify-store job
   └── Fetches order details
   └── [Future] Sends push notification / SMS to store owner
   └── For v1: Store owner manually refreshes their dashboard

7. OrderController receives service result
   └── reply.code(201).send({ success: true, data: order, meta: { requestId } })

8. Frontend receives 201
   └── React Query invalidates 'orders' cache
   └── Router navigates to /orders/:id (confirmation page)
   └── GSAP: green bloom animation plays
```

---

## Data Flow: Buyer Authentication (OTP)

```
1. POST /api/v1/auth/buyer/send-otp  { phone: '+911234567890' }
   └── AuthController.sendOTP(req, reply)
   └── AuthService.sendOTP(phone)
       ├── Validates phone format (Zod: E.164 format for India)
       ├── Checks Redis: key 'otp_rate:{phone}' — if count >= 5: throw RateLimitError
       ├── Generates 6-digit OTP (crypto.randomInt)
       ├── Hashes OTP: bcrypt(otp, 10)
       ├── Redis SET 'otp:{phone}' { hash, attempts: 0 } EX 300 (5 min)
       ├── Redis INCR 'otp_rate:{phone}' EX 900 (15 min window)
       └── otpQueue.add('send-sms', { phone, otp }) → BullMQ
           └── Worker calls Fast2SMS API
   └── Reply 200: { message: 'OTP sent' }

2. POST /api/v1/auth/buyer/verify-otp  { phone, otp }
   └── AuthService.verifyOTP(phone, otp)
       ├── Redis GET 'otp:{phone}' → { hash, attempts }
       ├── If null: throw NotFoundError ('OTP expired or not requested')
       ├── If attempts >= 3: throw TooManyAttemptsError
       ├── bcrypt.compare(otp, hash):
       │   ├── False: Redis HINCRBY attempts, throw InvalidOTPError
       │   └── True:
       │       ├── Redis DEL 'otp:{phone}'
       │       ├── userRepository.findByPhone or create new User
       │       ├── Generate access token (RS256 JWT, 15m)
       │       ├── Generate refresh token (cuid2, store in Redis 'refresh:{token}' = userId, EX 7d)
       │       └── Return { accessToken, user }
   └── Set HttpOnly cookie: refresh_token
   └── Reply 200: { success: true, data: { user, accessToken } }

3. POST /api/v1/auth/buyer/refresh  (reads refresh_token cookie)
   └── AuthService.refreshToken(refreshToken)
       ├── Redis GET 'refresh:{token}' → userId (if null: throw UnauthorizedError)
       ├── userRepository.findById(userId) → user
       ├── Redis DEL 'refresh:{token}'  ← rotate: invalidate old
       ├── Generate new refresh token → Redis SET 'refresh:{newToken}' = userId EX 7d
       ├── Generate new access token
       └── Return { accessToken }
   └── Set new HttpOnly cookie: refresh_token
   └── Reply 200: { success: true, data: { accessToken } }
```

---

## Data Flow: Stock Deduction on Order Placement

Within OrderService.createOrder(), inside prisma.$transaction():

1. For each cart item:
   └── SELECT stockQty FROM product_variants WHERE id = variantId FOR UPDATE
   (Prisma: findUniqueOrThrow with a lock — prevents concurrent oversell)

2. Validate ALL items first before touching anything:
   └── If any item: requestedQty > stockQty → collect failures
   └── If any failures: throw InsufficientStockError({ items: failures }) → 422, nothing written

3. All items valid → execute atomically:
   └── order = orderRepository.create(...)
   └── For each item:
   ├── productVariantRepository.decrementStock(variantId, qty, tx)
   │ └── prisma.productVariant.update({ where: { id }, data: { stockQty: { decrement: qty } } })
   └── stockMovementRepository.create({
   variantId, changeType: 'SALE', quantityBefore, quantityChange: -qty,
   quantityAfter, referenceId: order.id
   }, tx)

4. After transaction commits:
   └── For each decremented variant: check if stockQty <= lowStockThreshold
   └── If yes: stockQueue.add('check-low-stock', { variantId })
   └── Worker: update isLowStock = true, isInStock = (stockQty > 0)

## Data Flow: Stock Restoration on Order Cancellation

Within OrderService.cancelOrder(), inside prisma.$transaction():

1. Fetch all OrderItems for the order
2. Update order status to CANCELLED
3. For each OrderItem:
   └── productVariantRepository.incrementStock(variantId, qty, tx)
   └── stockMovementRepository.create({
   variantId, changeType: 'CANCELLATION_RESTORE', quantityChange: +qty,
   referenceId: orderId
   }, tx)

## Data Flow: Store Owner Restocks (Refill)

PUT /api/v1/store/products/:productId/variants/:variantId/stock
body: { quantityToAdd: number, note?: string }

1. StoreOwnerService.restockVariant(storeId, variantId, qty, note)
   └── Verify variant belongs to storeId (security — never skip)
   └── prisma.$transaction():
   ├── productVariantRepository.incrementStock(variantId, qty, tx)
   └── stockMovementRepository.create({
   variantId, changeType: 'REFILL', quantityChange: +qty,
   referenceId: null, note, createdBy: storeOwnerId
   }, tx)
   └── If isInStock was false and now stockQty > 0: set isInStock = true, isLowStock = false

## Data Flow: Manual Stock Adjustment (Admin / Store Owner)

PUT /api/v1/store/products/:productId/variants/:variantId/stock/adjust
body: { newAbsoluteQty: number, reason: string } ← sets TO a value, not adds

Used for: physical inventory count correction, damaged goods write-off

1. Calculate quantityChange = newAbsoluteQty - currentStockQty
2. prisma.$transaction():
   ├── Set stockQty = newAbsoluteQty
   └── stockMovementRepository.create({ changeType: 'ADJUSTMENT', quantityChange, note: reason })
3. Creates audit log entry (adjustment with reason is an auditable event)

---

## Redis Key Schema

```
otp:{phone}                 → { hash: string, attempts: number }  TTL: 300s (5 min)
otp_rate:{phone}            → count (number)                      TTL: 900s (15 min)
refresh:{token}             → userId                              TTL: 604800s (7 days)
jti:{jwtId}                 → '1'                                 TTL: matches access token (900s)
                              (JWT allowlist — if key missing, token is revoked)
feature_flags               → JSON object of all flags            TTL: 60s (reloaded every minute)
catalog:categories          → JSON array                          TTL: 300s (5 min)
catalog:products:{storeId}  → JSON array                          TTL: 60s
session:{sessionId}         → store owner / admin session data    TTL: 3600s
```

---

## WebSocket Architecture (Socket.IO)

```
Namespaces:
  /buyer  — Buyer receives order status updates
  /store  — Store owner receives new order notifications
  /rider  — STUB — not implemented in v1

Authentication:
  - On connection: client sends access token in auth handshake
  - Server verifies JWT and attaches userId/role to socket
  - Invalid auth: socket.disconnect()

Rooms:
  - Buyers join room: 'order:{orderId}' on order confirmation page
  - Store owners join room: 'store:{storeId}' on login

Events (v1 — store-side only):
  Server → Store: 'new_order' { orderId, summary }
  Server → Store: 'order_update_confirmed' { orderId }
  Store → Server: 'order_accepted' { orderId }
  Store → Server: 'order_ready' { orderId }
  Store → Server: 'order_dispatched' { orderId }

Events (v1 — buyer-side):
  Server → Buyer: 'order_status_changed' { orderId, status, message }

Events (STUB — rider-side):
  [All defined as TypeScript interfaces but handlers throw NotImplementedError]
  STUB: 'rider_location_update' { riderId, lat, lng }
  STUB: 'order_picked_up' { orderId, riderId }
```

---

## Frontend Routing Structure

```
/ (public)
├── / → Buyer Home (Hero + Categories + Featured Products)
├── /categories/:slug → Category product listing
├── /products/:id → Product detail
├── /cart → Cart page
├── /checkout → Checkout (address + payment)
├── /login → OTP login flow
├── /orders/:id → Order confirmation + status tracking
├── /account → Buyer profile (auth required)
│   ├── /account/addresses → Saved addresses
│   └── /account/orders → Order history

/store (store owner — auth required, role: STORE_OWNER)
├── /store/login → Store owner login
├── /store/2fa → TOTP setup/verify
├── /store/dashboard → Overview
├── /store/orders → Order management
├── /store/products → Product catalog management
│   └── /store/products/:id/edit → Edit product + variants
├── /store/promotions/advertisements → Ad management
├── /store/promotions/offers → Offer management
└── /store/promotions/discounts → Discount/coupon management

/admin (admin — auth required, role: ADMIN)
├── /admin/login → Admin login
├── /admin/2fa → Mandatory TOTP verify
├── /admin/dashboard → All-stores overview
├── /admin/orders → All orders across stores
├── /admin/stores → Store management
│   └── /admin/stores/:id → Store detail + analytics
├── /admin/users → Buyer management
├── /admin/categories → Category management
├── /admin/feature-flags → Feature flag toggles
├── /admin/advertisements → Ad approval queue
└── /admin/audit-logs → Audit trail viewer
```

---

## Environment-to-Module Dependency Map

```
Module          | PostgreSQL | Redis | Fast2SMS | Razorpay | Socket.IO
────────────────────────────────────────────────────────────────────────
auth            |     ✓     |   ✓   |    ✓    |    ✗    |     ✗
catalog         |     ✓     |   ✓   |    ✗    |    ✗    |     ✗
cart            |     ✓     |   ✗   |    ✗    |    ✗    |     ✗
order           |     ✓     |   ✗   |    ✗    |    ✓*   |     ✓
user            |     ✓     |   ✗   |    ✗    |    ✗    |     ✗
store           |     ✓     |   ✗   |    ✗    |    ✗    |     ✓
store-owner     |     ✓     |   ✓   |    ✗    |    ✗    |     ✗
admin           |     ✓     |   ✓   |    ✗    |    ✗    |     ✗
promotion       |     ✓     |   ✓   |    ✗    |    ✗    |     ✗
feature-flag    |     ✓     |   ✓   |    ✗    |    ✗    |     ✗
audit           |     ✓     |   ✗   |    ✗    |    ✗    |     ✗
delivery        |     ✓     |   ✓   |    ✗    |    ✗    |     ✗
health          |     ✓     |   ✓   |    ✗    |    ✗    |     ✗

* = flag-gated, not active in v1
```

---

## Feature Flag Evaluation Pattern

```typescript
// Pattern used in every service that checks a flag:

// In any service method:
const isWeatherMode = await featureFlagService.isEnabled("WEATHER_MODE_ACTIVE");
if (isWeatherMode) {
  // adjust ETA, delivery window, UI messaging
}

// Feature flags are cached in Redis (60s TTL) — NOT queried per-request from DB
// This means: flag changes take effect within 60 seconds without a deploy

// Rider interface check pattern (all rider routes):
const isRiderEnabled = await featureFlagService.isEnabled(
  "RIDER_INTERFACE_ENABLED",
);
if (!isRiderEnabled) {
  throw new NotImplementedError("Rider interface not yet available");
}
```

---

## Scalability Path (When Revenue Justifies It)

```
Current (v1):              Future (when needed):
─────────────────────────────────────────────────────────────
Modular Monolith     →     Extract catalog service (high read volume)
Single DB            →     Read replicas for PostgreSQL
Redis single node    →     Redis Cluster
BullMQ               →     Stay (or move to SQS if AWS migration)
Railway              →     AWS ECS (Fargate) or GCP Cloud Run
Vercel               →     Stay (CDN is already global)
Manual notifications →     Firebase FCM (push) + WhatsApp Business
Rider stub           →     Implement rider module (sockets, location, app)
2 stores             →     N stores (schema already supports it)
COD dominant         →     Full UPI + Card (Razorpay already integrated)
```
