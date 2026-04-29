# GoRola — Decision Log
> Why we chose what we chose. Every major architectural decision documented here with rationale and tradeoffs.
> Append new decisions — never modify or delete old ones.

---

## Format

```
## [DECISION-XXX] Short Title
**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded by DECISION-XXX | Reverted
**Context:** What problem were we solving?
**Decision:** What did we choose?
**Rationale:** Why this option over alternatives?
**Tradeoffs:** What did we give up?
**Alternatives Considered:** What else was evaluated?
```

---

## [DECISION-001] Modular Monolith over Microservices

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
GoRola is a 0-to-1 product in a niche geography (Mussoorie hills). The team is small (likely 1-2 developers). We need to move fast but not at the cost of future scalability.

**Decision:**
Build as a Modular Monolith — single deployable unit with strong internal module boundaries following Controller → Service → Repository.

**Rationale:**
- Microservices add enormous operational overhead (service discovery, network latency, distributed transactions, multiple deployments) that is unjustified at this scale.
- A well-structured modular monolith can be extracted into microservices later when needed — the module boundaries are the future service boundaries.
- Single deployment = simpler CI/CD, simpler debugging, simpler local dev.
- Railway free tier supports one Node.js service perfectly.

**Tradeoffs:**
- Cannot scale individual modules independently (e.g., scale the order service without scaling auth). Acceptable at current scale.
- If team grows to 10+ engineers working on the same repo, coordination overhead increases. At that point, extract to services.

**Alternatives Considered:**
1. Microservices from day 1 — rejected: premature complexity for 1-2 person team
2. Pure MVC monolith (no module boundaries) — rejected: becomes unmaintainable pasta after 3 months

---

## [DECISION-002] Fastify over Express for Backend

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
Need a Node.js HTTP framework. Express is the default choice. Fastify is newer.

**Decision:**
Fastify v4.

**Rationale:**
- 2-3x faster than Express (benchmarks: ~77,000 req/s vs ~25,000 req/s)
- Built-in schema validation and serialization (JSON Schema — though we use Zod at controller level)
- TypeScript-first design with better type inference
- Plugin system is more structured than Express middleware
- Pino logger is built-in (vs Express where you bolt it on)
- Built-in support for async/await without wrapper hacks

**Tradeoffs:**
- Smaller ecosystem than Express (fewer ready-made middleware packages)
- Less community knowledge — harder to find solutions to edge cases
- Plugin system has a different mental model (decorators, encapsulation)

**Alternatives Considered:**
1. Express — battle-tested but showing age, no TypeScript-first design
2. Hono — ultra-fast, edge-native, but less mature ecosystem for full apps
3. NestJS — framework with DI, very opinionated, adds significant boilerplate and abstraction layers

---

## [DECISION-003] Prisma over TypeORM/Drizzle for ORM

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
Need a TypeScript ORM for PostgreSQL with good migration support.

**Decision:**
Prisma v5.

**Rationale:**
- Best-in-class TypeScript type generation from schema (auto-generated, always in sync)
- Prisma Studio for visual data exploration during dev
- Migration workflow is simple and reliable (prisma migrate dev)
- Prisma Accelerate available for connection pooling when needed
- Most readable query API of any ORM

**Tradeoffs:**
- Prisma generates its own query engine binary (adds ~30MB to node_modules)
- Less flexible for complex raw SQL queries — must drop to `$queryRaw`
- Schema is in its own DSL (not TypeScript) — another thing to learn
- Not as thin as Drizzle — more "magic" happening

**Alternatives Considered:**
1. TypeORM — messy TypeScript decorators, history of bugs, harder migrations
2. Drizzle — very thin, TypeScript-first schema, but migrations less mature, smaller ecosystem
3. Raw SQL with pg — maximum control, but too much boilerplate for a team of 1-2

---

## [DECISION-004] cuid2 over UUID for Primary Keys

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
Need to choose a primary key strategy for all entities.

**Decision:**
cuid2 (via `@paralleldrive/cuid2` package).

**Rationale:**
- URL-safe characters (no hyphens) — cleaner in URLs
- Monotonically increasing (within same millisecond, random segment varies) — better B-tree index performance than random UUID
- Shorter than UUID v4 (24 chars vs 36)
- Collision-resistant (cryptographically random component)
- No sequential prediction (unlike auto-increment integers)

**Tradeoffs:**
- Not a standard — UUID is universally understood by all tools
- cuid2 is less widely known
- Not supported by some older database GUI tools

**Alternatives Considered:**
1. UUID v4 — universally supported but random (poor index performance at scale), longer
2. UUID v7 — monotonic UUID, good alternative, but still hyphenated and 36 chars
3. Auto-increment integer — simple but exposes record counts, makes sequential scraping trivial

---

## [DECISION-005] Soft Delete for All User Data

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
How to handle deletion of records (products, addresses, orders, users)?

**Decision:**
All deletes are soft deletes via `isDeleted: Boolean @default(false)`. Hard deletes never happen except for a specific PII purge flow (GDPR stub for future).

**Rationale:**
- Business needs: "Why did this order fail?" requires historical data
- Support needs: customer says "I deleted my address by mistake" — we can restore it
- Analytics: deleted products still appear in order history
- Audit trail: admin needs to see what was deleted and when

**Tradeoffs:**
- All queries must filter `WHERE is_deleted = false` by default (handled in repository layer)
- Tables grow larger over time — but not a problem at current scale
- Slightly more complex repository code

**Alternatives Considered:**
1. Hard delete with archive tables — complex, duplicates schema
2. Hard delete + event sourcing for history — massive over-engineering for v1

---

## [DECISION-006] Phone OTP (not Email OTP or Social Auth) for Buyers

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
How should buyers (customers) authenticate?

**Decision:**
Phone number + SMS OTP via Fast2SMS (India-specific, free tier).

**Rationale:**
- Target market: India, hills region. Phone numbers are universal. Email is NOT universal in this demographic.
- OTP on phone is the expected auth pattern for Indian consumer apps (Swiggy, Zomato, Blinkit all use this)
- Fast2SMS: India-focused, free tier (100 credits/day), reliable for low volume
- Lower friction than email (no mailbox to open, instant delivery)

**Tradeoffs:**
- Phone-dependent: if user changes number, account migration needed
- International buyers need different OTP providers (future: Twilio)
- Fast2SMS free tier limited (100 OTPs/day) — upgrade to paid when volume increases

**Alternatives Considered:**
1. Email OTP — not universal for target demographic
2. Google/Apple Social Auth — requires app store presence + privacy policy + developer accounts
3. WhatsApp OTP — good for India, but requires Meta Business account and API approval
4. Twilio — reliable but costs money from day 1

---

## [DECISION-007] RS256 JWT over HS256

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
JWT signing algorithm choice.

**Decision:**
RS256 (asymmetric: RSA private key signs, public key verifies).

**Rationale:**
- In a multi-service future (Phase 5+), services can verify tokens using only the public key — they don't need the private key
- Private key stays in API service only — reduced attack surface
- Industry standard for production applications

**Tradeoffs:**
- More complex key management (RSA key pair vs single secret)
- Slightly slower signing than HS256 (negligible at this scale)
- Requires generating and securely storing RSA key pair

**Alternatives Considered:**
1. HS256 — simpler, single secret, but every service that verifies tokens needs the secret (risk)

---

## [DECISION-008] No localStorage for Tokens

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
Where to store JWT access and refresh tokens on the frontend.

**Decision:**
HttpOnly Secure SameSite=Strict cookies only. No localStorage, no sessionStorage.

**Rationale:**
- localStorage is accessible to JavaScript — any XSS vulnerability exposes all tokens to theft
- HttpOnly cookies are inaccessible to JavaScript — XSS cannot steal them
- Secure flag: cookie only sent over HTTPS
- SameSite=Strict: prevents CSRF on navigation

**Tradeoffs:**
- Requires CSRF protection (double-submit cookie or SameSite=Strict handles most cases)
- Slightly more complex cross-origin setup (credentials: 'include' required)
- Not trivially accessible from JS (intentional)

**Alternatives Considered:**
1. localStorage — rejected: XSS-vulnerable
2. In-memory only (JS variable) — rejected: lost on page refresh, poor UX
3. sessionStorage — rejected: lost on tab close, still XSS-vulnerable

---

## [DECISION-009] Railway.app for Free Deployment

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
Need free hosting that supports Node.js + PostgreSQL + Redis in one platform.

**Decision:**
Railway.app for API + DB + Redis. Vercel for frontend.

**Rationale:**
- Railway free tier: $5 credit/month, PostgreSQL and Redis as managed services, zero-downtime deploys
- No cold start penalty (unlike serverless platforms)
- GitHub integration: auto-deploy on push to main
- Prisma migrations run as part of deploy command
- Vercel: best-in-class for React/Vite static sites, free tier generous, global CDN

**Tradeoffs:**
- Railway free tier has sleep after 30min inactivity (can cause slow first response)
- 512MB RAM limit on free tier (sufficient for our load)
- Not as scalable as AWS/GCP — but we'll migrate when revenue justifies it

**Alternatives Considered:**
1. Render.com — similar free tier, good alternative, but Railway has better PostgreSQL support
2. Heroku — once free, now paid only
3. Fly.io — great but more complex setup (Docker required)
4. Supabase — considered for DB only, but would split our stack

---

## [DECISION-010] Landmark-Based Addresses (No Pin Code)

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
How to collect delivery addresses in a hill town where formal addresses don't exist, streets are unnamed, and pin codes are irrelevant for last-mile navigation.

**Decision:**
Mandatory landmark description field ("near the red gate, behind Hotel Padmini") + optional flat/room number. No pin code field. Optional lat/lng from draggable map pin.

**Rationale:**
- Mussoorie has ~200,000 residents + significant tourist traffic. Formal addresses (D-45 Sector 3) are meaningless here.
- Local riders navigate by landmarks (everyone knows "the red gate" or "Clock Tower")
- Pin code-based systems fail in hill towns — multiple areas share the same pin code
- Tourist buyers won't know their own address — but they know the hotel name
- This is how Zomato/Swiggy actually work in smaller Indian cities: landmark fields

**Tradeoffs:**
- Cannot use automated routing or geocoding based on address text alone
- Requires riders to know the area (they do — that's the point)
- Harder for first-time buyers to know what to write (addressed by placeholder copy)

**Alternatives Considered:**
1. Standard address form (street, city, pin) — rejected: unusable in this geography
2. Lat/Lng only from GPS — rejected: tourists don't trust GPS accuracy in hills, buildings not mapped well
3. What3Words — considered but adds third-party dependency and learning curve

---

## [DECISION-011] BullMQ for Background Jobs

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
Some operations should be async: sending OTP SMS (don't make user wait for SMS API), sending order confirmation notifications, generating reports.

**Decision:**
BullMQ with Redis. Already have Redis for sessions, so no additional infrastructure.

**Rationale:**
- Redis-backed: persistent queues (jobs survive server restart)
- Rate limiting built in (matches our OTP rate limiting needs)
- Retry with backoff: if Fast2SMS is slow, job retries automatically
- Dashboard: Bull Board for monitoring (can add later)
- Already have Redis — no extra infra cost

**Tradeoffs:**
- Additional complexity in the codebase (workers, queues, job types)
- Debugging async failures is harder than synchronous failures

**Alternatives Considered:**
1. Synchronous OTP send — simpler but user waits for SMS API (can be 1-3 seconds)
2. pg-boss (PostgreSQL-backed queues) — good, but adds complexity when we have Redis anyway
3. In-memory queue (no persistence) — rejected: jobs lost on server restart

---

## [DECISION-012] GSAP over Framer Motion for Animations

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
The design calls for premium scroll-based animations and smooth page transitions. Which animation library?

**Decision:**
GSAP v3 with ScrollTrigger plugin for all scroll-based and timeline animations. Lenis for smooth scroll.

**Rationale:**
- GSAP is the industry standard for premium web animations (used by Apple, Netflix, etc.)
- ScrollTrigger is the best-in-class scroll animation tool
- Performance: GSAP uses requestAnimationFrame and optimizes painting
- Lenis + GSAP is the canonical pairing for "smooth scroll website" experiences
- The design system explicitly calls for topographic backgrounds, fog drift, ETA pulse — all well-suited to GSAP
- GSAP is free for non-commercial + many commercial uses (GreenSock standard license)

**Tradeoffs:**
- Heavier than CSS transitions or Framer Motion for simple animations
- GSAP + ScrollTrigger = ~70KB (minified+gzipped: ~25KB) — acceptable for a premium web app
- Requires imperative programming style (refs in React) vs Framer Motion's declarative

**Alternatives Considered:**
1. Framer Motion — good for component-level animations, but limited for complex scroll sequences
2. CSS animations only — cannot achieve the level of animation sophistication required
3. AOS (Animate on Scroll) — too simple, CSS-only, not customizable enough

---

## [DECISION-013] TanStack Query for Server State

**Date:** 2026-04-17
**Status:** Accepted

**Context:**
Managing server state (API data) in React. Options: Redux, Zustand, TanStack Query, SWR.

**Decision:**
TanStack Query (React Query) for server state. Zustand for pure client state (auth, cart UI, weather mode toggle).

**Rationale:**
- TanStack Query handles: caching, background refetch, stale-while-revalidate, optimistic updates, pagination, infinite scroll — all built in
- Separates server state from UI state — cleaner mental model
- Zustand is perfect for simple global UI state (is cart open? is weather mode on?)
- No Redux — too much boilerplate for what we need

**Tradeoffs:**
- Two state management solutions in one project — but they serve clearly different purposes
- TanStack Query has a learning curve

**Alternatives Considered:**
1. Redux Toolkit + RTK Query — good, but heavier than needed
2. SWR — similar to React Query but less feature-rich (no optimistic updates OOTB)
3. Zustand for everything — possible, but you'd reinvent React Query's caching logic

---

## [DECISION-014] Hybrid Env Bootstrap for Railway + dotenv-safe

**Date:** 2026-04-22
**Status:** Accepted

**Context:**
Production deploys on Railway failed at bootstrap with `MissingEnvVarsError` from `dotenv-safe` even after setting variables in the dashboard. Two concrete issues appeared:
- Monorepo root path resolution was off by one level, so `.env.example` was searched under `/app/apps/.env.example` instead of `/app/.env.example`.
- `dotenv-safe` checks key presence using `Object.keys(process.env)`; Railway may omit some keys entirely rather than set empty values, causing strict validation to fail.

**Decision:**
Adopt a hybrid bootstrap in `apps/api/src/config/env.ts`:
1. Resolve monorepo root correctly (4 levels above `config` directory).
2. Ensure `.env` file exists on PaaS (create empty file when missing).
3. Load `.env` with `dotenv` first.
4. Prime missing keys from `.env.example` into `process.env` (including `DATABASE_URL_TEST <- DATABASE_URL` fallback) before running `dotenv-safe`.
5. Keep `dotenv-safe` as the final contract validator.

**Rationale:**
- Preserves strict configuration contract semantics from `.env.example`.
- Avoids false negatives caused by platform-specific env injection behavior.
- Keeps local dev ergonomics unchanged while making production bootstrap deterministic.
- Minimizes invasive changes to the rest of the app.

**Tradeoffs:**
- Adds env bootstrap complexity (`dotenv` + priming helper + `dotenv-safe`).
- Placeholders can satisfy key-presence checks even when not production-grade values; operational discipline still required in Railway Variables.
- Slightly more code to test and maintain in config initialization.

**Alternatives Considered:**
1. Remove `dotenv-safe` in production — rejected: loses safety guarantees and schema contract.
2. Set `allowEmptyValues: false` and rely purely on platform vars — rejected: still fails when keys are omitted entirely by host behavior.
3. Maintain a committed production `.env` template in runtime image — rejected: operationally fragile and risks secrets handling mistakes.
4. Replace with a custom Zod env loader only — deferred: possible future refactor, but more scope than needed for immediate deployment unblock.

---

## [DECISION-015] ESLint: simple-import-sort vs import/order on `order.service.ts`

**Date:** 2026-04-23
**Status:** Accepted

**Context:**
While adding `apps/api/src/modules/order/order.service.ts`, ESLint reported import issues. Running `eslint --fix` produced `ESLintCircularFixesWarning: Circular fixes detected` — two rules kept undoing each other’s fixes until the run could not converge.

**Decision:**
Disable `import/order` only for that file via a top-of-file comment:

`/* eslint-disable import/order -- simple-import-sort groups conflict with newlines-between: always for parent imports */`

Leave `simple-import-sort/imports` as the authority for import order and grouping in that module. Longer term, the project may relax or remove `import/order` in favor of `simple-import-sort` only, or narrow `newlines-between`, to avoid repeats.

**Rationale:**
- The root conflict is **two different import policies**: `eslint-plugin-simple-import-sort` defines order and newlines in one way; `eslint-plugin-import`’s `import/order` with `newlines-between: "always"` enforces extra blank lines between *groups* (e.g. external vs parent `../` vs sibling `./`, and sometimes between adjacent parent modules).
- Those rules **disagree** for files that mix `../catalog/...`, `../inventory/...`, and `./order.repository.js` — satisfying one can violate the other, producing circular autofixes.
- A targeted disable documents the reason and unblocks CI without changing global lint policy in one go.

**Tradeoffs:**
- `import/order` is not enforced in that one file, so a future contributor could add imports that `import/order` would have nudged; `simple-import-sort` still normalizes order on save/CI.
- A file-level `eslint-disable` is slightly noisier than a single source of import rules for the whole repo.

**Alternatives Considered:**
1. Remove `newlines-between: "always"` from `import/order` globally — broader change, affects every package; deferred until a dedicated lint pass.
2. Drop `simple-import-sort` and use only `import/order` — rejected: the repo has standardized on `simple-import-sort` for sort order; larger churn.
3. Re-export catalog/inventory from a single `order`-local barrel to reduce import paths — overkill to fix lint only.

---

## [DECISION-016] Phase-Level API Contract Gates (Vertical Slice Rule)

**Date:** 2026-04-28
**Status:** Accepted

**Context:**
During Phase 2.6, the buyer categories UI was completed and tested on the frontend, but runtime backend exposure drifted (`GET /api/v1/categories` initially not wired in app route registration; credentialed CORS mismatch blocked browser calls). The issue was eventually fixed, but the gap showed that phase checklist items did not explicitly enforce backend endpoint exposure and runtime wiring in the same phase.

**Decision:**
Adopt a mandatory **API Contract Gate** for each buyer phase section (2.7+). A phase is not complete until:
- UI is implemented
- required backend endpoint(s) are implemented
- backend integration tests pass for those endpoint contracts
- routes are registered in runtime app wiring (not only tested through module-local registration)
- frontend tests validate expected API envelope and error/empty/loading behavior

Add an intermediate **Phase 2.61** checklist step for post-2.6 hardening (categories/CORS closure + auth runtime wiring verification) before proceeding deeper into catalog/checkout phases.

**Rationale:**
- Prevents repeating frontend/backend drift discovered in 2.6.
- Forces vertical-slice delivery (UI + API + tests + runtime wiring) instead of partial horizontal progress.
- Makes checklist completion criteria explicit for future sessions/agents.
- Improves deploy confidence since CI green better reflects real runtime behavior.

**Tradeoffs:**
- Slightly higher per-phase scope and sequencing discipline required.
- More integration tests per phase increases short-term implementation time.
- Checklist grows longer, but becomes clearer and safer.

**Alternatives Considered:**
1. Keep current checklist style and rely on agent memory — rejected: too error-prone.
2. Build all future APIs upfront in a dedicated backend phase — rejected: increases speculative work and disconnects API delivery from UI needs.
3. Add only a global note once — rejected: less enforceable than per-phase gates.

---

## [DECISION-017] Universal API Contract Gate Across Phases 2, 3, 4, and 5

**Date:** 2026-04-28
**Status:** Accepted

**Context:**
After adding API Contract Gates to buyer phases (2.7+), a follow-up concern identified the same drift risk for later areas: Phase 2.17+, Store Owner (Phase 3), Admin (Phase 4), and future Rider work (Phase 5). Keeping gates only in buyer sections would make enforcement inconsistent and agent-dependent.

**Decision:**
Make API Contract Gate policy universal:
- Add a global rule in `rules_and_spec.md` under TDD rules as a mandatory phase completion gate.
- Add explicit gate checklists at the beginning of Phase 3 and Phase 4 sections in `current_state.md`.
- Add explicit gate checklist placeholder for Phase 5 (deferred rider implementation) in `current_state.md`.
- Continue phase-level gate bullets in feature sections where practical (already done for Phase 2.7+).

**Rationale:**
- Ensures the same “UI + API + tests + runtime wiring” standard across buyer, store, admin, and rider work.
- Reduces chance of route-registration drift in later phases.
- Gives future sessions a single enforceable source of truth, not implied conventions.

**Tradeoffs:**
- Checklists become longer and more repetitive.
- Slightly more process overhead before marking tasks complete.
- Requires discipline to keep gate bullets updated as phases evolve.

**Alternatives Considered:**
1. Keep gates only in Phase 2 — rejected: inconsistent enforcement.
2. Keep only decision-log guidance without checklist updates — rejected: too implicit.
3. Enforce only through CI without checklist language — rejected: CI can pass while runtime wiring still drifts.

---

## [DECISION-018] Phase 2.10.1 — Auth Plumbing Before Live SMS OTP Provider

**Date:** 2026-04-29  
**Status:** Accepted

**Context:**
Phase 2.10 delivered buyer OTP **UX** + API contract gates, but runtime wiring still used **dev stubs** (e.g., placeholder token strings, non-persisted synthetic user ids, OTP sender no-op). Product discussion clarified that **production-grade auth plumbing** (DB user rows, consistent JWT/token lifecycle, swappable OTP delivery) **does not depend** on subscribing to Fast2SMS immediately.

**Decision:**
Add an explicit **`Phase 2.10.1` buyer auth plumbing slice** in `CONTEXT/current_state.md` that completes **before** checkout flows that rely on durable identity (`2.11+`), with:
- **`OtpProvider` interface** + **dev/stub provider** for local and automated tests (no outbound SMS required to mark GREEN).
- **Find-or-create buyer `User`** in PostgreSQL on successful `verify-otp` (phone unique, role `BUYER`).
- **Real `TokenService` wiring** per `rules_and_spec.md` §6 (RS256, `jti`, Redis allowlist, refresh rotation, logout revoke) — with a documented escape hatch only if an interim algorithm is strictly necessary.
- **Cryptographically random OTP** + existing Redis+bcrypt OTP storage semantics.
- **Full TDD / API Contract Gate**: backend integration + unit tests, frontend tests aligned to real verify envelope, `ci:quality` green.

**Rationale:**
- Unblocks **durable buyer identity** and token semantics without blocking on SMS vendor onboarding, API keys, or spend.
- Keeps **Fast2SMS (DECISION-006)** as a **drop-in implementation** of `OtpProvider` later, not a rewrite of auth core.
- Avoids false progress: checkout and orders need a stable `userId` in DB, not a client-generated placeholder.

**Tradeoffs:**
- Extra phase and checklist surface area before 2.11.
- Team must still budget time for **production SMS** integration + env hardening before go-live (separate from 2.10.1 “plumbing complete”).

**Alternatives Considered:**
1. Bundle DB + token plumbing into Phase 2.11 checkout — rejected: identity is prerequisite for checkout and order attribution; delaying it increases rework.
2. Require live Fast2SMS before any DB persistence — rejected: couples infrastructure procurement to core engineering milestones.
3. Implicit signup only via frontend state — rejected: violates data model and audit needs for orders.

---

## [DECISION-019] Temporary Production OTP Override for Railway QA (`GOROLA_DUMMY_OTP`)

**Date:** 2026-04-29  
**Status:** Accepted (Temporary)

**Context:**
After Phase 2.10.1, buyer OTP generation became random by default and SMS delivery remained a noop provider until Fast2SMS integration. On Railway, manual QA needed a deterministic OTP to exercise login/refresh/logout before real SMS wiring. Browser console reports showed CORS errors, but the primary issue was upstream API availability (`502`) during env/setup churn.

**Decision:**
Introduce a temporary environment variable override in `generateBuyerOtp`:
- `GOROLA_DUMMY_OTP` (must be exactly 6 digits) forces OTP value in all environments, including production.
- Keep `NODE_ENV=production` on Railway and continue requiring valid `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` PEMs for startup.
- Keep existing `GOROLA_TEST_OTP` behavior scoped to `NODE_ENV=test`.

**Rationale:**
- Enables manual OTP login verification on Railway immediately without changing auth route contracts.
- Avoids misusing `NODE_ENV` as a feature flag (e.g., switching production runtime to `test` or `development`).
- Keeps the temporary bridge explicit, env-gated, and easy to remove once Fast2SMS is wired.

**Tradeoffs:**
- Fixed OTP in production-like environment is insecure if left enabled.
- Adds another environment knob that can be forgotten without explicit cleanup.

**Alternatives Considered:**
1. Set `NODE_ENV=test` on Railway and use `GOROLA_TEST_OTP` — rejected: changes broader runtime behavior and diverges from production semantics.
2. Keep random OTP with noop provider — rejected: no practical way to complete manual auth QA.
3. Implement Fast2SMS immediately — deferred: outside current phase sequencing; checkout work should continue first.

---

## [DECISION-020] Cross-Site Refresh Cookie Policy for Vercel ↔ Railway

**Date:** 2026-04-29  
**Status:** Accepted

**Context:**
Buyer OTP verify succeeded but browser console showed: refresh cookie rejected in cross-site context because `SameSite` was `Lax`. Frontend and API are on different sites (`*.vercel.app` and `*.railway.app`), so refresh cookie writes happen in a cross-site request path.

**Decision:**
Set refresh-token cookie attributes by environment in auth controllers:
- **Production:** `SameSite=None` + `Secure=true` + `Partitioned=true` (cross-site compatible over HTTPS and aligned with Chrome third-party cookie deprecation / CHIPS warning).
- **Non-production:** keep `SameSite=Lax` for local same-site dev behavior.

Applied in `auth.controller.ts` through shared `refreshCookieOptions()` used by buyer/store-owner/admin login + refresh handlers.

**Rationale:**
- Required for cross-site cookie persistence in modern browsers.
- `Partitioned` addresses Chrome warning (`cookie ... is foreign and does not have the "Partitioned" attribute`) for third-party cookie hardening.
- Keeps secure defaults in production while minimizing local-dev friction.
- Removes misleading downstream symptoms where auth appears to fail even when OTP verify itself succeeds.

**Tradeoffs:**
- Cross-site cookies increase CSRF exposure surface and require tighter origin controls.
- Depends on HTTPS in production (`Secure` mandatory when `SameSite=None`).
- `Partitioned` behavior support is browser-dependent and should be monitored across target clients.

**Alternatives Considered:**
1. Keep `SameSite=Lax` and rely only on refresh token in JSON body — rejected for now: inconsistent with intended HttpOnly cookie refresh posture (DECISION-008).
2. Move web and API under one same-site domain immediately — deferred: infra/domain work outside current phase scope.
3. Disable cookie usage and keep refresh strictly client-managed — rejected: weaker security posture vs HttpOnly design intent.
