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
Buyer OTP verify succeeded but browser console showed: refresh cookie rejected in cross-site context because `SameSite` was `Lax`. Frontend and API are on different sites (`*.vercel.app` and `*.railway.app`), so refresh cookie writes happen in a cross-site request path. Follow-up checks confirmed this is concentrated in auth refresh-token cookie handling (buyer/store-owner/admin), not a broader non-auth cookie issue.

**Decision:**
Set refresh-token cookie attributes by environment in auth controllers:
- **Production:** `SameSite=None` + `Secure=true` + `Partitioned=true` (cross-site compatible over HTTPS and aligned with Chrome third-party cookie deprecation / CHIPS warning).
- **Non-production:** keep `SameSite=Lax` for local same-site dev behavior.

Applied in `auth.controller.ts` through shared `refreshCookieOptions()` used by buyer/store-owner/admin login + refresh handlers, and mirrored clear options in logout via `refreshCookieClearOptions()` so cookie deletion works under the same cross-site policy.

**Rationale:**
- Required for cross-site cookie persistence in modern browsers.
- `Partitioned` addresses Chrome warning (`cookie ... is foreign and does not have the "Partitioned" attribute`) for third-party cookie hardening.
- Keeps secure defaults in production while minimizing local-dev friction.
- Removes misleading downstream symptoms where auth appears to fail even when OTP verify itself succeeds.
- Matching clear attributes avoids stale refresh cookies when logout executes in cross-site contexts.

**Tradeoffs:**
- Cross-site cookies increase CSRF exposure surface and require tighter origin controls.
- Depends on HTTPS in production (`Secure` mandatory when `SameSite=None`).
- `Partitioned` behavior support is browser-dependent and should be monitored across target clients.

**Alternatives Considered:**
1. Keep `SameSite=Lax` and rely only on refresh token in JSON body — rejected for now: inconsistent with intended HttpOnly cookie refresh posture (DECISION-008).
2. Move web and API under one same-site domain immediately — deferred: infra/domain work outside current phase scope.
3. Disable cookie usage and keep refresh strictly client-managed — rejected: weaker security posture vs HttpOnly design intent.

---

## [DECISION-021] Phase 2.11.1 — Dedicated Wiring Hardening Slice Before 2.12

**Date:** 2026-04-30  
**Status:** Accepted

**Context:**
After Phase 2.11 checkout delivery, runtime smoke testing exposed cross-layer wiring defects that were not feature-logic bugs: missing buyer route landing (`/orders/:id`), category response shape drift (`productCount` expectation), route discoverability dead-ends (`/about`, `/support`), placeholder-route exposure, and auth bootstrap/guard timing races. These issues created user-facing inconsistency despite green feature tests.

**Decision:**
Introduce **Phase 2.11.1** as a strict-TDD wiring hardening slice before/alongside Phase 2.12:
- Track wiring issues explicitly in `current_state.md` with API/route/identity contract gates.
- Fix each issue via RED→GREEN regression tests first, then implementation.
- Mark already-fixed wiring regressions (category page wrong-category flash) as completed under 2.11.1.
- Prioritize P0 wiring defects that break primary buyer journey continuity ahead of new feature depth.

**Rationale:**
- Preserves vertical-slice integrity by treating wiring contracts as first-class deliverables, not incidental cleanup.
- Prevents “green tests, broken journey” drift between frontend UI assumptions and runtime backend behavior.
- Reduces compounding risk before 2.12 confirmation flow depends on correct post-checkout navigation.

**Tradeoffs:**
- Adds a short hardening phase and slows immediate feature progression.
- Expands checklist and regression surface area in the near term.
- Requires disciplined issue triage to avoid turning 2.11.1 into an open-ended backlog.

**Alternatives Considered:**
1. Fold wiring fixes ad hoc into 2.12 implementation — rejected: high risk of mixing regression causes with new confirmation logic.
2. Defer wiring cleanup to a later QA sweep — rejected: user journey breakages are already visible in active buyer flow.
3. Fix only critical route bugs, ignore contract/discoverability issues — rejected: partial cleanup would leave repeated edge-case failures.

---

## [DECISION-022] 2.11.1 End-to-End Wiring Closure Matrix (UI -> API -> Route -> Service/Repo -> DB)

**Date:** 2026-04-30  
**Status:** Accepted

**Context:**
Phase 2.11.1 began as a wiring hardening effort after runtime smoke findings (navigation dead-ends, API shape drift, guard/bootstrap race, and consistency issues). A simple issue list is not sufficient: several defects look fixed at UI level while backend/runtime/DB expectations can still drift. Team requested explicit end-to-end closure criteria for every listed issue.

**Decision:**
For every 2.11.1 wiring issue, completion requires a mandatory closure matrix:
1. **UI trigger/assertion** (component/router behavior),
2. **Network contract assertion** (path/method/payload/auth),
3. **Runtime route coverage** (`App.tsx` or API route graph registration),
4. **Service/repository behavior assertion** (integration/unit as appropriate),
5. **DB state assertion** (read/write invariants),
6. **Strict TDD sequence** (RED regression first, then GREEN implementation).

Additionally, 2.11.1 tracks the full wiring register (`W-001`..`W-009`) and marks only verifiable closures as checked.

**Rationale:**
- Prevents partial fixes where frontend appears corrected but backend/DB semantics remain inconsistent.
- Aligns with DECISION-016/017 API Contract Gate intent by extending from endpoint reachability to full journey integrity.
- Provides auditable traceability from user symptom to root cause to persistent-state correctness.

**Tradeoffs:**
- Higher implementation and test overhead per issue.
- Slower short-term feature throughput while hardening is in progress.
- Requires disciplined test design to avoid brittle over-specification.

**Alternatives Considered:**
1. UI-only regression closure for 2.11.1 — rejected: previously allowed runtime/DB drift to survive.
2. API-only contract checks without DB assertions — rejected: insufficient for identity/pricing/order ownership issues.
3. Postpone matrix discipline until later phases — rejected: buyer flow is live and already affected by wiring inconsistencies.

---

## [DECISION-023] — Prisma Transaction Timeout & Order Flow Optimization

**Date:** 2026-05-01
**Status:** Accepted

**Context:** 
In cloud deployments (Railway), users reported an `INTERNAL_SERVER_ERROR` (P2028: Transaction not found) on the first "Place Order" attempt. Investigation revealed a "chatty" transaction logic performing 40+ sequential database calls inside a 5-second timeout window, which is easily exceeded during infrastructure cold starts.

**Decision:**
1.  Increase the global transaction timeout for **all core order flows** (Placement and Cancellation) to **15 seconds**.
2.  Optimize `OrderService.placeOrderWithStock` and `OrderService.cancelOrderWithStockRestore` to use **Bulk-Fetching** (`findMany`) instead of sequential loops.
3.  Optimize `OrderRepository.create` to use Prisma's `include` feature for single-round-trip creation + hydration.
4.  Update `ProductVariantRepository` (`decrementStock` and `incrementStock`) to support pre-fetched data, eliminating redundant reads.

**Rationale:**
- Checkout and Cancellation latency for a multi-item cart is reduced by **~75%**.
- High resilience to cold starts on Railway/Vercel.
- Unit tests added/updated to verify optimized call sequences and `findMany` usage.

**Tradeoffs:**
- Service layer must now map IDs and pass data to repositories, slightly increasing code length for significant performance gains.

---

## [DECISION-024] Order Rating Model (Thumbs Up/Down + Optional Comment)

**Date:** 2026-05-02
**Status:** Accepted

**Context:**
For Phase 2.15 (Order History + Reorder), we needed a way for buyers to rate completed orders. The initial requirement was "no stars, just thumbs up / thumbs down".

**Decision:**
Add `rating Boolean?` and `ratingComment String?` to the `Order` model in Prisma.
- `rating`: `true` means thumbs up, `false` means thumbs down, `null` means unrated.
- `ratingComment`: Optional text feedback provided alongside the rating.

**Rationale:**
- A boolean perfectly captures the binary "thumbs up/down" requirement without the complexity of a 5-star scale.
- Adding the `ratingComment` field proactively allows users to leave qualitative feedback (e.g., "Food was cold", "Driver was polite"), which is highly valuable for store owners.
- Keeping these on the `Order` model avoids creating a separate `Review` table, simplifying the schema and reducing join overhead for order history queries.

**Tradeoffs:**
- A boolean cannot support a "neutral" rating if requested in the future. If a 3-tier system (happy, neutral, sad) is ever needed, we will have to migrate `rating` to an `Int` or `Enum`.
- Storing text comments on the `Order` table slightly increases row size, but this is negligible in PostgreSQL.

---

## [DECISION-025] CI/CD Test Stabilization (Explicit Serialization & API Fallback)

**Date:** 2026-05-02
**Status:** Accepted

**Context:**
After implementing Phase 2.15 (Order Rating), the project's CI/CD pipeline failed due to:
1.  **"Ghost Feedback" Bug**: The UI incorrectly showed "Rating submitted" for unrated orders because the backend was excluding the `rating` field (returning `undefined` instead of `null`).
2.  **TypeError in Tests**: Frontend tests crashed in GitHub Actions because the `api` singleton was `null` due to missing environment variables.
3.  **FK Violations**: Integration tests failed during database cleanup because newly added `Advertisement` records blocked the deletion of `Store` records.

**Decision:**
1.  **Explicit Serialization**: Update `order.controller.ts` to explicitly include `rating: order.rating` and `ratingComment: order.ratingComment` in the serialized response.
2.  **Test-Safe API**: Modify `apps/web/src/lib/api.ts` to provide a fallback URL (`http://test-api`) if `import.meta.env.MODE === 'test'`, ensuring the `api` instance is never `null` during tests.
3.  **Hierarchical Cleanup**: Update all integration test cleanup functions to follow a strict "Leaf-to-Root" deletion order (e.g., delete `Advertisement` before `Store`).

**Rationale:**
- Explicitly mapping fields in the controller ensures the API contract is reliable and never dependent on Prisma's default omit/include behavior.
- Providing a fallback URL during tests prevents infrastructure dependencies (like environment variables) from blocking purely functional unit tests.
- Hierarchical cleanup is a best practice for integration testing with relational databases to maintain isolation without violating referential integrity.

**Tradeoffs:**
- Manually mapping fields adds a few lines to the controller but prevents "magic" bugs where fields disappear.
- The dummy test URL prevents real network calls during tests (which is usually desired) but could hide configuration issues that only surface at runtime.

**Alternatives Considered:**
1.  Using a global database trigger for cascade deletes — rejected: too complex for test-only cleanup.
---

## [DECISION-026] State-Aware Order Details UI

**Date:** 2026-05-02
**Status:** Accepted

**Context:**
The `OrderConfirmationPage` was originally designed as a high-fidelity "Success" screen with cinematic GSAP animations (the "bloom" effect) and hardcoded "Thank you" messaging. However, this same page is used as the primary view for tracking order status and viewing order details from history. Seeing a "Thank you for ordering" bloom on a 3-day-old delivered order creates a confusing and unprofessional user experience.

**Decision:**
Implement a status-driven UI state machine within the `OrderConfirmationPage`. The page will dynamically adjust visibility and content based on the `status` payload from the API:

1.  **Fresh Success (`PLACED`)**: High-fidelity bloom animation, "Thank you" header, and active status tracking.
2.  **In-Progress (`PREPARING` / `OUT_FOR_DELIVERY`)**: Utility-focused view. Hide "Thank you" (switch to "Store is picking items" or "On the way"). Keep ETA trust copy and Store Contact cards visible for active assistance.
3.  **Completion (`DELIVERED`)**: "Success" state focused on history and feedback.
    *   **Hide**: Bloom, Store Contact card, ETA trust copy, and Drop-off cues.
    *   **Show**: "Order Delivered" header, a new **"Delivered in XXm" duration badge**, and Rating UI.
4.  **Failure (`CANCELLED`)**: Neutral informational state.
    *   **Hide**: Bloom, Status Stepper (or grey it out), Contact cards, and ETA text.
    *   **Show**: "Order Cancelled" header and clear cancellation notice.

**Rationale:**
- Improves the transition from "Post-Checkout" (excitement-focused) to "Tracking/History" (utility-focused).
- Prevents animation fatigue by showing the expensive cinematic entrance only once (at the moment of success).
- Better aligns the UI with the real-world state of the order.
- As a quick-commerce app, GoRola must feel reliable. Historical views should emphasize utility (receipt/feedback), while active orders should emphasize status and support.

**Tradeoffs:**
- Adds complexity to the component's internal logic (conditional rendering and timeline control).
- Requires careful handling of the transition states to ensure the page doesn't "flicker" while fetching the status.

**Alternatives Considered:**
1.  **Separate Pages:** Create a `OrderDetailPage` separate from `OrderConfirmationPage`. Rejected: This would duplicate significant amounts of layout and logic (items list, totals, store info).
2.  **Stateless Redirects:** Redirect to a different component within the same route based on status. Rejected: Harder to handle entry animations consistently.

---

## [DECISION-027] Cinematic Animation Timing for Order Success

**Date:** 2026-05-02
**Status:** Accepted

**Context:**
The "green bloom" animation on the `OrderConfirmationPage` was reported as feeling "jittery" or too fast. The initial implementation began the fade-out immediately upon mount, not allowing the user to register the success state before the transition to the content began.

**Decision:**
Introduce a "hold" phase and slow down the GSAP timeline:
1.  **Hold Time:** Add a 0.5s–0.8s pause where the green bloom is at full opacity to signify the "Success" impact.
2.  **Slower Reveal:** Extend the bloom fade duration and stagger the checkmark drawing more deliberately.
3.  **Easing:** Shift to `power3.out` for the reveal to create a more premium, "braking" feel as the content settles.

**Rationale:**
- High-fidelity animations require a clear beginning, middle, and end. The current version skipped the "beginning" (the impact) and went straight to the "end" (the reveal).
- Slower transitions feel more expensive and deliberate, reducing the perception of technical glitches or frame drops.

---

## [DECISION-028] Address Snapshoting for Order History

**Date:** 2026-05-02
**Status:** Accepted

**Context:**
Currently, the `Order` model only stores the `landmarkDescription`. It does not store the user-provided `addressLabel` (e.g., "Home") or `flatRoom` number. Additionally, if an order were to simply link to the user's `Address` record, deleting or editing that address profile later would break the historical record of where the order was actually delivered.

**Decision:**
Instead of linking to the `Address` table, we will **snapshot** (copy) the address details into the `Order` record at the time of purchase. We will add `addressLabel` and `flatRoom` (optional) fields to the `Order` model.

**Rationale:**
- **Immutability**: Historical orders must reflect exactly where they were delivered at the time of the transaction. If a user moves house, their old orders should still show their old address details.
- **Robustness**: If a user deletes an address profile, the order history remains intact.
- **Uniformity**: Allows the same UI to handle both saved addresses and "one-time" addresses that were never saved to a profile.

**Tradeoffs:**
- Small amount of data duplication (denormalization).
- Requires a database migration.

---

## [DECISION-029] Three-Tier Catalog Hierarchy (Category -> SubCategory -> Product)

**Date:** 2026-05-04
**Status:** Accepted

**Context:**
Initially, the GoRola catalog was a flat two-tier system (`Category -> Product`). However, as the product range expanded (e.g., Groceries containing Rice, Snacks, Beverages), the UI became cluttered. A middle tier was needed to organize products more logically for buyers.

**Decision:**
Introduce a `SubCategory` model and enforce a mandatory relationship at the database level.
- `SubCategory` belongs to a `Category` (`1:N`).
- `Product` belongs to a `SubCategory` (`N:1`).
- `subCategoryId` on the `Product` model is **non-nullable** (mandatory).
- Replace `emoji` field on `Category` and `SubCategory` with `imageUrl` for a more premium visual experience.

**Rationale:**
- **Better UX:** Allows buyers to drill down into specific niches (e.g., "Medical -> Pain Relief") instead of scrolling through hundreds of unrelated items.
- **Data Integrity:** Making `subCategoryId` non-nullable ensures that every product is strictly categorized, preventing "orphan" products from appearing in search or category results.
- **Visual Consistency:** Moving from emojis to high-quality images aligns with the premium "GoRola" aesthetic established in Phase 2.

**Tradeoffs:**
- **Constraint Hell:** Making the relationship mandatory broke all existing test data and seeding scripts across the entire repository. Every integration test that seeds a product now requires a sub-category setup.
- **Migration Complexity:** Required a complete database reset for both dev and test environments as existing products could not be automatically backfilled with a mandatory FK.

**Alternatives Considered:**
1. Optional `subCategoryId` — Rejected: Leads to inconsistent UI where some products are grouped and others are not.
2. Tagging system — Rejected: Overly complex for a local commerce app where hierarchical navigation is the expected standard.
3. JSON metadata for sub-categories — Rejected: Prevents database-level referential integrity and makes filtering queries significantly slower.
---

## [DECISION-030] Guest-to-User Cart Synchronization (Reconciliation Strategy)

**Date:** 2026-05-05
**Status:** Accepted

**Context:**
During the checkout flow, guest users (not logged in) add items to their local cart. When they log in to complete the purchase, the application was erroneously clearing the local cart if the server-side cart was empty, leading to a "Empty Cart" error at the final payment step.

**Decision:**
Implement a "Push-on-Empty" reconciliation strategy in `buyer-cart-sync.ts`:
1. If an authenticated user has an empty server cart BUT has items in their local guest cart, push all guest items to the server.
2. If both carts have items, the server cart remains the source of truth (to prevent duplication across devices).
3. Local state is strictly updated from the server response AFTER the reconciliation attempt.

**Rationale:**
- **Prevents Conversion Drop-off:** Ensures that users don't lose their selected items the moment they sign in to pay.
- **Data Integrity:** Avoids complex merging logic (e.g., summing quantities) which can lead to desyncs. The server remains the ultimate source of truth.
- **Simplicity:** High reliability with minimal background network overhead.

**Tradeoffs:**
- If a user intentionally wants to discard their local cart in favor of an empty server cart, they cannot (the local items will be "restored" to the server). However, this is an extreme edge case compared to the common bug of losing items.

**Alternatives Considered:**
1. **Aggressive Merge:** Always sum local + server quantities. Rejected: Risk of exceeding stock limits silently and creates complex race conditions.
2. **Clear Local Always:** Rejected: Caused the original bug.

---

## [DECISION-031] CI/CD Security Hardening (Backend Scrutiny vs. Frontend/Test Exclusions)

**Date:** 2026-05-07
**Status:** Accepted

**Context:**
The GoRola monorepo uses `eslint-plugin-security` to detect common Node.js vulnerabilities. However, applying these rules indiscriminately across the entire monorepo caused significant "noise" (false positives) in the React frontend and Vitest suites, where the server-side attack vectors (like path traversal or server memory injection) are physically impossible or contextually irrelevant.

**Decision:**
1. **Enforce Strict Quality Gates:** Updated `ci:quality` and GitHub workflows to use `pnpm lint --max-warnings 0`. Any warning now breaks the build.
2. **Backend Strictness:** Keep security rules 100% active for `apps/api`. Silencing is only allowed via `// eslint-disable-next-line` on verified, line-by-line false positives.
3. **Frontend & Test Exclusions:** Explicitly disable security rules in `eslint.config.ts` for all files matching `apps/web/**` and `**/*.test.ts`.

**Rationale:**
- **Risk Mitigation:** The Backend (`apps/api`) is the only environment where these vulnerabilities (path traversal, server-side object injection) present a real threat. Strict, line-level auditing ensures the server remains a fortress.
- **Eliminating Alert Fatigue:** Frontend React code runs in a client browser and has no server access. Forcing backend rules onto the frontend leads to "alert fatigue," where developers learn to ignore security warnings because they are "always false."
- **Focus:** By removing the noise in the frontend and tests, we ensure that when a security warning *does* appear in the backend, it receives immediate and high-priority attention from the team.

**Tradeoffs:**
- Frontend code is no longer scanned for these specific security rules. However, React and Vite have their own built-in protections for frontend-specific threats like XSS (via JSX auto-escaping).

**Alternatives Considered:**
1. **Line-by-line silencing for the whole repo:** Rejected. Adding 50+ disable comments in React components just to handle basic state access is unmaintainable and reduces developer velocity without adding security value.
2. **Disable the plugin entirely:** Rejected. We need the protection for the backend API.

---

## [DECISION-032] Phase 7 Booking Commerce Architecture & Hybrid Schema

**Date:** 2026-05-18
**Status:** Accepted

**Context:**
GoRola is expanding from purely "Quick Commerce" (instant checkout, immediate rider delivery, physical inventory deduction) to support "Booking Commerce" services (e.g., medical test appointments, home appliance/hardware repairs). This requires a schema and ordering flow that supports calendar-date scheduling, buyer-selected timeslots, fasting constraints, merchant-side approval queues, and field technician dispatch, all while completely isolating and preserving the existing quick-commerce flow.

**Decision:**
Extend the Prisma schema and business logic under a unified, hybrid architecture:
1. **DB Schema Extensions**:
   - Introduce `StoreType` enum (`QUICK_COMMERCE`, `BOOKING_COMMERCE`) on the `Store` model to control the overall workflow.
   - Introduce `OrderType` enum (`QUICK`, `BOOKING`) on the `Order` model.
   - Introduce `BookingOrder` model (one-to-one relationship with `Order`) to house booking-specific fields (`scheduledDate`, `timeslot`, `requiresFasting`, `approvalStatus`, `rejectionReason`, `assignedTechnicianId`).
   - Add new `BookingApprovalStatus` enum: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`.
   - Add new `RiderType` enum (`DELIVERY`, `FIELD_TECHNICIAN`) on the `DeliveryRider` model to support field technician dispatch.
   - Extend `OrderStatus` enum to include `PENDING_APPROVAL` and `APPROVED` status options for booking orders.
2. **Strict Flow Isolation & Core Rules**:
   - **Cart Bypass**: Booking order products bypass the shopping cart entirely. The buyer clicks "Book Now" on a product detail page, which redirects to the booking scheduler flow.
   - **No Stock Deduction**: Booking orders represent services rather than physical inventory. They bypass the quick commerce stock movements (`StockMovement`) and stock depletion locks.
   - **Fasting Regulations**: Fasting tests (`requiresFasting: true`) only permit selecting the early morning slot `"06:00-09:00"`; other slots are filtered out.
   - **Booking Lead Days**: Ensure calendar scheduling respects the store's `bookingLeadDays` configuration (e.g. if `leadDays = 1`, today is disabled).
   - **Merchant Approval Gate**: Placed bookings enter `PENDING_APPROVAL` state, requiring the store owner to explicitly approve (`APPROVED`) or reject (`REJECTED` with a non-empty reason). Buyers can cancel pending bookings at any time, but cannot cancel approved bookings without store owner action.
3. **Dual-Aware Frontend Components**:
   - The product detail page, grid cards, and category views are updated to handle both store types seamlessly. A `storeType` property is serialized in all product and category API responses.
   - Separate dashboards/views are maintained under `/bookings/new` for scheduling and `/store/bookings` for merchants, so that booking-specific scheduling controls do not clutter the standard checkout interfaces.

**Rationale:**
- **Zero-Regression Guarantee**: Keeping standard quick commerce fully separated and unchanged means existing user paths and tests remain 100% functional.
- **Relational Integrity**: Placing booking metadata in a dedicated `BookingOrder` model keeps the `Order` table clean, avoids massive null columns on standard quick orders, and enforces clean foreign key referential constraints.
- **Improved UX & Conversion**: Bypassing the cart for bookings maps to standard service-hiring behaviors, eliminating confusion and reducing the steps needed to confirm an appointment.

**Tradeoffs:**
- Adds schema complexity (additional enums, tables, and conditional logic branches).
- The `OrderStatus` enum is shared, meaning quick commerce orders technically have access to status values like `PENDING_APPROVAL`, though this is strictly blocked at the application service/validation layers.

**Alternatives Considered:**
- **Separate Microservices / Repositories**: Rejected. The modular monolith structure handles both domains beautifully and enables sharing core user identity, addresses, and layout systems.
- **Polymorphic Table Inheritance**: Rejected. Prisma does not support model polymorphism easily, and creating completely separate Order tables for quick vs booking would break the shared history pages, order status tracking, and shared analytical reporting.

---

## [DECISION-033] No Separate `Service` Table — Reuse `Product` + `ProductVariant` for Booking Commerce

**Date:** 2026-05-18
**Status:** Accepted

**Context:**
When designing the Booking Commerce schema (Phase 7), the question arose: should medical tests and repair services live in their own `Service` / `ServiceVariant` table, or should they reuse the existing `Product` / `ProductVariant` models?

**Decision:**
Reuse `Product` and `ProductVariant` for all booking commerce catalog items (medical tests, repairs). Do NOT create a separate `Service` table.

The only booking-specific fields — `allowedTimeslots String[]` and `requiresFasting Boolean` — are added directly onto `ProductVariant`. Everything else that makes a service "different" from a physical product (the approval gate, no stock deduction, the timeslot picker UI, the `BookingOrder` record) is handled at the **order layer**, not the catalog layer.

**Rationale:**
- **Structural equivalence at catalog level:** A "service" and a "product" are identical at the catalog level — both have a `name`, `description`, `imageUrl`, `price`, `categoryId`, `subCategoryId`, and `storeId`. Creating a `Service` table would duplicate ~90% of the `Product` schema.
- **Minimal extension needed:** Only two fields differ — `allowedTimeslots` and `requiresFasting`. Adding two nullable fields to `ProductVariant` is far cheaper than a new table with new repositories, new controllers, new routes, new frontend types, and new admin CRUD.
- **Single buyer browse experience:** The buyer catalog (category grid → product list → product detail) works identically for both store types. The `storeType` discriminator on `Store` is what changes the CTA from "Add to Cart" to "Book Now" — not a different catalog entity.
- **Single admin CRUD:** Store owners manage tests and services using the same product CRUD panel they use for physical goods. No second admin interface needed.
- **Order layer handles the difference:** The `BookingOrder` table + `OrderType` enum is where booking commerce diverges from quick commerce. The catalog layer stays clean and unified.

**Tradeoffs:**
- `ProductVariant` grows two new fields (`allowedTimeslots`, `requiresFasting`) that are always `null` / `[]` for quick-commerce products. This is a small schema denormalization acceptable at our scale.
- A developer unfamiliar with the codebase might not immediately understand that a `Product` in a `BOOKING_COMMERCE` store is really a "service" — mitigated by the `storeType` discriminator and this decision log entry.

**Alternatives Considered:**
1. Separate `Service` + `ServiceVariant` tables — rejected: ~90% field duplication, doubles repository/service/controller/frontend-type surface area, breaks the unified buyer browse experience.
2. Abstract base table with `Product` and `Service` inheriting from it — rejected: Prisma does not support table inheritance; would require complex manual joins or union queries.
3. JSON `metadata` field on `Product` for booking-specific config — rejected: loses type safety, makes Prisma queries against `allowedTimeslots` impossible, harder to validate in Zod.

---

## [DECISION-034] Strict Store Type Isolation (No Hybrid Stores)

**Date:** 2026-05-19
**Status:** Accepted

**Context:**
A business or merchant (e.g., "Electrico" or a pharmacy/clinic) may offer both physical products suitable for immediate delivery (like light bulbs, chargers, standard painkillers) and appointment-based services (like AC repair, home electrical troubleshooting, home diagnostic lab tests). We needed to decide if a single `Store` record could act as a "hybrid" (supporting both `QUICK_COMMERCE` and `BOOKING_COMMERCE` simultaneously) or if stores must be strictly separated.

**Decision:**
Enforce strict store type isolation at the database and application levels. A single `Store` entity must have exactly one `storeType` (`QUICK_COMMERCE` or `BOOKING_COMMERCE`). If a merchant offers both physical items and scheduled services, they register **two separate stores** under the GoRola catalog:
1. **Electrico** (Store Type: `QUICK_COMMERCE`): Manage quick physical deliveries (chargers, cords, plugs).
2. **Electrico Services** (Store Type: `BOOKING_COMMERCE`): Manage appointment scheduling and dispatch field technicians (AC repair, rewiring).

**Rationale:**
- **Operational & Dashboard Clarity**: The merchant interface needs to support entirely different operational workflows for quick-commerce (packaging, matching with active riders, immediate stock updates) vs. booking-commerce (calendar views, technician availability, slot assignment, manual approval queues). Combining these would clutter the store dashboard under conflicting paradigms.
- **Cart & Checkout Simplicity**: A hybrid store introduces major cart collision risks. If a buyer places a physical light bulb and an AC repair service in the same cart, the checkout pipeline would have to calculate dynamic delivery fees for the bulb (quick) while zeroing fees and gathering a date/time for the repair (booking). This would require splitting a single order into multiple delivery pipelines, introducing massive database tracking and state machine overhead.
- **Buyer UX Gating**: By using separate stores, the buyer is guided into the correct visual flow: clicking "Electronics" shows a retail shop interface, whereas clicking "Repairs" shows a calendar scheduling interface.

**Tradeoffs:**
- Merchants must manage two profiles/dashboards if they provide both physical items and home services.
  - *Mitigation (Plus-Addressing):* Because the `StoreOwner` database schema enforces a strict `@unique` email constraint, merchants running two stores must register with two separate emails. To prevent the friction of setting up and paying for two distinct email inboxes, merchants can use standard subaddressing (e.g., `merchant+quick@gmail.com` and `merchant+services@gmail.com`). All notification and 2FA emails will automatically route to their single primary inbox (`merchant@gmail.com`), satisfying database constraints with zero administrative overhead.
- Slight data redundancy (e.g. duplicate merchant bank details, store locations, or contact information across both store profiles).

**Alternatives Considered:**
1. **Hybrid Stores with Order Splitting**: Allow a single store to list both types of variants. During checkout, if a mixed cart is detected, split it into separate `QUICK` and `BOOKING` orders. Rejected: massive overhead in the checkout service, complicates order matching, and increases developer cognitive load and bug rate.
2. **Cart Blockers**: Allow hybrid stores, but reject checkout if the buyer has a mixed cart. Rejected: poor UX, as it doesn't solve the messy combined merchant dashboard problem.

---

## [DECISION-035] Privacy-First Buyer Identity Masking & Twilio Proxy Communication

**Date:** 2026-05-20
**Status:** Accepted

**Context:**
For regulatory compliance, user data security, and platform disintermediation prevention, store partners must not have direct access to a buyer's private information (such as their unmasked phone number or full name). However, in real-world quick commerce operations, store owners or delivery personnel occasionally need to contact the buyer (e.g., if a substitute item is required, or for last-mile delivery navigation).

**Decision:**
1. **Masked Phone Numbers**: Only expose masked phone numbers (e.g., `*********7890`) in the merchant dashboard and store owner API responses.
2. **Static Buyer Profile**: Hide the buyer's real name under the generic identifier `"Registered User"` or `"Guest"` on the store owner panel.
3. **Proxy Voice Routing (Twilio Proxy)**: Wire any outgoing phone calls through an automated proxy call routing system (such as Twilio Masked Call Routing). The merchant or rider clicks a "Call" trigger in the UI or dials the virtual proxy number displayed, and the proxy server dynamically redirects the audio channel to the buyer's real mobile phone without exposing private contact numbers.

**Rationale:**
- **Regulatory Compliance**: Prevents harvesting of buyer phone databases by third-party merchant employees, ensuring tight alignment with modern consumer privacy regulations (such as GDPR or regional IT acts).
- **Customer Retention**: Prevents merchant disintermediation (merchants taking order transaction flows off-platform to avoid commissions).
- **Physical Safety**: Protects both customers and delivery agents from unsolicited or inappropriate contact after order completion.

**Tradeoffs:**
- Adds infrastructure overhead and API integration costs for Twilio/masked proxy calls.
- Store owners cannot manually type out the buyer's actual number into a traditional phone keypad; all contact must be initiated through the platform's routed channels.

---

## [DECISION-036] Subdomain Routing over Separate Monorepo Packages (Option A vs. Option B)

**Date:** 2026-05-20
**Status:** Accepted

**Context:**
The platform needs to support dedicated subdomains for Store Owners (`store.gorola.com`) and Administrators (`admin.gorola.com`) instead of relying purely on subpaths (e.g. `/store` and `/admin`) under the main domain (`gorola.com`). We needed to decide between implementing client-side routing based on hostnames within a single Vite SPA (Option A) versus refactoring the monorepo to split the frontend into separate Vite application packages (Option B).

**Decision:**
Start by implementing **Option A (Subdomain Routing inside a Single Vite SPA)**, with a clear evolutionary roadmap to transition to **Option B (Separate Monorepo Micro-Frontends)** when scaling constraints or strict bundle auditing requirements warrant it.

Under Option A:
- Add custom domains (`store.gorola.com`, `admin.gorola.com`) to the single Vercel deployment.
- Read `window.location.hostname` in the React frontend entrypoint (`App.tsx`).
- Conditionally render/mount separate react-router-dom route trees (buyer routes, store owner routes, or admin routes) based on the matching host subdomain.
- In development/testing environments, local routing falls back to standard subpaths OR local host headers (e.g., `admin.localhost`) to maintain maximum testing velocity without breaking any existing E2E or unit tests.

**Rationale:**
- **Zero Deployment Overhead**: Avoids orchestrating three separate deployment pipelines and configuration environments on Vercel during the early launch phase.
- **Unified Development Ergonomics**: Running `pnpm dev` boots a single development server, keeping manual developer iteration extremely fast.
- **Future-Proof Structure**: Because the project is already a pnpm monorepo with core logic split into `packages/shared` and `packages/ui`, all business logic, design tokens, and components are completely decoupled. Migrating from Option A to Option B in the future will be a trivial file-moving exercise (copying folders into new app packages) rather than a complex refactoring of coupled code.
- **Risk Mitigation**: Implementing Option A has almost zero impact on existing E2E/Playwright test flows (which target standard `/store` and `/admin` subpaths) since we can allow fallback routing.

**Tradeoffs:**
- In Option A, admin/merchant-specific code chunks are theoretically downloadable in the buyer's browser assets, though React code splitting and bundler optimization minimize this. Gated authentication and route guards prevent actual unauthorized API access or UI usage.
- Requires standard cookie configuration (e.g. `SameSite=None`, `Domain=.gorola.com`) to allow credential sharing across subdomains where required, which is already aligned with existing cross-site cookie decisions (DECISION-020).

**Alternatives Considered:**
1. **Option B (Separate Monorepo Packages from Day 1)** - Rejected for now: premature operational complexity. Splitting packages requires duplicating boilerplate configurations, managing multiple Vercel environment sets, and rewriting automated E2E pipelines, which would slow down active Phase 3/4 feature development.

---

## [DECISION-037] Query-based Subdomain Override for Non-Production Wildcard Environments

**Date:** 2026-05-20
**Status:** Accepted

**Context:**
Vercel's default `.vercel.app` staging domains do not support wildcard SSL certificates (e.g. `*.vercel.app` or `store.*.vercel.app` is blocked by browser security policies). Because of this, it is impossible to resolve or load actual custom subdomains natively (like `store.gorola-staging.vercel.app`) on standard staging deployments without buying and linking a custom domain. We need a way for developers, stakeholders, and QA teams to manually test the full, native subdomain layouts, route guards, and dashboards directly on their default Vercel staging URL.

**Decision:**
Implement a secure **Query-based Subdomain Override with Session Storage Persistence** in our hostname resolver (`subdomain-resolver.ts`):
1. **Trigger:** If the URL query contains `?_subdomain=store` or `?_subdomain=admin`, the app immediately stores this override in the browser's `sessionStorage`.
2. **Persistence:** The resolver reads from `sessionStorage` on all subsequent page views/clicks, ensuring that navigation, redirect guards, and dashboards function smoothly under that subdomain mode even when browsing the root `vercel.app` URL.
3. **Reset:** Visiting `?_subdomain=clear` or closing the browser tab removes the override, restoring the shopper experience.

**Rationale:**
- **Zero Configuration:** Allows immediate E2E/manual testing of subdomain routing on Vercel staging and local dev without requiring local hosts file edits or buying custom domains.
- **High Fidelity:** Simulates the exact production routing behavior, unmounting non-matching route branches with 100% security parity.
- **Zero Production Footprint:** Live production domains (e.g. `store.gorola.com`) still resolve subdomains natively and automatically using the hostname without requiring any query params.

**Tradeoffs:**
- Adds a small query-parsing logic in our front-end resolver, but it is lightweight and completely isolated inside `subdomain-resolver.ts`.

---

## [DECISION-038] getScopedPath Convention for All In-App navigate() Calls in Scoped Panels

**Date:** 2026-05-20
**Status:** Accepted

**Context:**
Phase 6.2 introduced `getScopedPath()` and `resolveSubdomain()` in `apps/web/src/lib/subdomain-resolver.ts` to support production subdomain routing (`store.gorola.com`, `admin.gorola.com`, and, when built, `rider.gorola.com`). Under subdomain mode the `/store`, `/admin`, and `/rider` path prefixes are stripped — the merchant dashboard lives at `/dashboard`, not `/store/dashboard`. Any hardcoded `navigate('/store/...')`, `navigate('/admin/...')`, or `navigate('/rider/...')` call written in a future phase will silently break navigation when running under the respective subdomain.

**Decision:**
**All `navigate()` calls inside store, admin, and rider pages and route guards must use `getScopedPath()` from `@/lib/subdomain-resolver` instead of hardcoded absolute path strings.**

Pattern to follow:

```typescript
import { getScopedPath, resolveSubdomain } from "@/lib/subdomain-resolver";

const { isSubdomainMode, subdomain } = resolveSubdomain(window.location.hostname);
navigate(getScopedPath("/store/dashboard", "store", isSubdomainMode));
```

This applies to:
- All pages under `apps/web/src/pages/store/`
- All pages under `apps/web/src/pages/admin/` (when built)
- All pages under `apps/web/src/pages/rider/` (Phase 5)
- Route guards: `StoreRoute`, `AdminRoute`, `RiderRoute` (any `<Navigate>` or `navigate()` call)

Buyer pages (`apps/web/src/pages/buyer/`) are **exempt** — they never navigate into scoped paths.

**Note on Rider:** When Phase 6.3 extends `getScopedPath` to support the `'rider'` scope, the same rule applies to all rider pages and the `RiderRoute` guard. Until Phase 6.3 is complete, rider pages use `/rider/` paths in fallback mode only (Phase 5 does not implement subdomain routing for riders).

**Rationale:**
- Prevents silent routing regressions in subdomain mode as new store/admin/rider pages are added in Phases 5 and 7.
- A single function call replaces error-prone string concatenation across every panel.
- Without this convention, a future agent will write hardcoded paths by default because that is what the existing non-scoped buyer code does.

**Tradeoffs:**
- Slightly more verbose than a bare string literal. Acceptable given the correctness guarantee.
- Requires importing from `subdomain-resolver` in every affected component — a one-liner import.

**Alternatives Considered:**
1. Rely on agent memory or code review to catch hardcoded paths — rejected: agents have no cross-session memory; this will silently regress.
2. Add a lint rule to ban raw `navigate('/store')` strings — possible future improvement, but the decision log + phase plan notes provide sufficient guardrails for now.

---

## [DECISION-039] Unique Variant Label Validation over SKU Field in Phase 3.4

**Date:** 2026-05-20
**Status:** Accepted

**Context:**
Phase 3.4 (Product Management) requirements in the active phase checklist specify TDD cases verifying that creating/updating products with duplicate SKUs across variants throws a `409 Conflict` error. However, the database schema in `schema.prisma` does not have a `sku` column on `ProductVariant`. We need to decide whether to introduce a schema migration to add a `sku` field, or satisfy the duplicate validation requirement using existing database fields.

**Decision:**
Do not introduce a new `sku` database column or run a database schema migration. Instead, enforce **unique variant label validation within the product** at the service/controller level. The backend and frontend forms will treat the variant `label` (e.g., `"500ml"`, `"1kg"`, `"Single Service"`) as the unique identifier for a variant under a given product. Submitting a product with multiple variants sharing the exact same label will fail with an HTTP 409 Conflict error.

**Rationale:**
- **No unnecessary schema bloat:** Avoids adding a new column that isn't functionally required by the current application features.
- **Maintains existing database integrity:** Keeps the schema lean and preserves reference rules.
- **Frictionless local/QA setups:** Prevents the need to execute database migrations in local/staging environments, minimizing integration churn.
- **Equivalent functional validation:** From a user experience and business standpoint, having two variants of the same product with the exact same label (e.g., two `"500ml"` variants) is a logical duplication. Validating label uniqueness under a product achieves the exact same business objective.

**Tradeoffs:**
- Store owners cannot assign arbitrary non-unique labels to different physical items if they wanted to distinguish them solely by a hypothetical hidden SKU. However, under GoRola, variants are shown to buyers directly by their labels, so labels must be unique and descriptive by definition.

**Alternatives Considered:**
1. **Prisma Schema Migration (Option A)**: Add `sku String?` to `ProductVariant` and run `prisma migrate dev`. Rejected as it introduces unnecessary database complexity when variant labels are already customer-facing unique identifiers under a product.

---

## [DECISION-040] Variant Active/Inactive Toggle for Soft-Deletes to Prevent Label Conflicts

**Date:** 2026-05-21
**Status:** Accepted

**Context:**
Phase 3.4.1 implements deactivating (soft-deleting) active variants and adding new variants in product Edit Mode. 

In relational database systems, executing a hard SQL deletion (`DELETE FROM "ProductVariant"`) is strongly prohibited once a variant is linked to historical transactions. Past buyer orders contain relation fields (`productVariantId`) pointing directly to these variants. A hard deletion would violate SQL foreign key constraints, throw database errors, or completely orphan/crash past customer invoices and analytics dashboards.

Therefore, we must use a **Soft Delete** mechanism. However, if a merchant soft-deletes a variant (e.g. by setting `isDeleted: true` or completely deleting the row) and later wants to recreate it, it poses a major constraint conflict under [DECISION-039] (unique variant label constraint). Since the soft-deleted variant still exists in the database, attempting to recreate a variant with the exact same label (e.g. `"500ml"`) would trigger a `409 Conflict` duplicate label validation error.

**Decision:**
Implement an **Active/Inactive Toggle** switch in the UI for pre-existing variants instead of a hard deletion button. Toggling a variant to inactive sets `isActive: false` on the backend, which:
1. Greys out the variant card in the merchant form, signaling that it is deactivated.
2. Automatically filters it out from the buyer-facing product listings and storefront search.
3. Allows the merchant to reactivate it instantly with a single toggle, preventing duplicate variant label creation conflicts and keeping the database clean.

**Rationale:**
- **Prevents Referential Integrity Violations:** Because the product or variant is never physically deleted (`DELETE`) from the database, all historical purchases, order items, invoice files, and store performance reports remain fully linked and completely safe from SQL constraint crashes.
- **Zero Constraint Conflicts:** Avoids unique-label validation issues since the merchant simply reactivates the existing row rather than trying to insert a new row with a conflicting label.
- **Superior User Experience:** Merchants can temporarily suspend a size or flavor (e.g., "Out of Stock" or "Seasonal") and reactivate it later with one click without re-entering standard prices, units, and details.
- **Refined Security:** Keeps past transaction logs completely intact.

**Tradeoffs:**
- Adds toggling logic in the UI and a visual "greyed out" state, which is easily achieved with styling utilities.

---

## [DECISION-041] Product Price/Name Modification Auditing via OrderItem Textual Snapshots

**Date:** 2026-05-21
**Status:** Accepted

**Context:**
When a merchant modifies product properties (such as changing the product name or the image URL) or changes individual variant price points, there is a risk that past order historical displays (receipts, checkout records, user profiles) will display the updated information, breaking transaction auditing. We need to decide if updating these details requires versioned schema models or snapshot captures.

**Decision:**
Rely on **OrderItem Textual Snapshots** already built into the database schema (`schema.prisma`):
1. **Snapshots:** The `OrderItem` table stores plain-text snapshots of transaction details (`productName` and `variantLabel`) along with the specific historical purchase `price` at checkout.
2. **Display:** Past receipts, invoice details, and order history pages render from these static snapshot fields, guaranteeing 100% correct financial and transaction audit trails.
3. **Links:** Historical receipt items link to the live, current product page via their relational `productVariantId` foreign key. If a buyer clicks the historical order item, they navigate to the updated product page showing the new name and image.

**Rationale:**
- **Industry Standard:** This is the gold standard for e-commerce design—receipts preserve static transactional truth, while details page navigation points to the current active catalog.
- **Zero Database Overhead:** No extra versioning schemas or event-sourcing records are needed because the schema already has snapshot columns built into `OrderItem`.

---

## [DECISION-042] Universal Soft-Delete Toggles for Catalog Entities

**Date:** 2026-05-21
**Status:** Accepted

**Context:**
Following [DECISION-040], we identified that destructive hard-deletions of database records lead to critical database foreign key constraint violations and break historical transactional logs (orders, analytics). To prevent this, we use Soft Deletes. However, if a user physically deletes a record and later wants to create an identical entity (e.g. recreating a product with the same name, or a subcategory with the same name), it causes constraint conflicts with unique name validations. 

**Decision:**
Standardize on the **Active/Inactive Toggle (Soft-Delete Toggle)** pattern for all catalog-related entities across both the Store Owner Panel (products) and Admin Panel (categories, subcategories). Instead of presenting a destructive "Delete" action:
1. **Product Level:** Product actions will feature an "Active / Inactive" toggle. Deactivating a product will set its status to inactive, greying it out in the store list and hiding it completely from the buyer storefront.
2. **Category & Subcategory Level:** In the Admin Panel, categories and subcategories will be managed via active/inactive toggles. Deactivating a category or subcategory will hide it and its child products from storefront discovery, while maintaining pristine relationship mappings for existing past orders.
3. **UX Behavior:** Inactive items will visually render as greyed-out (`opacity-60`) in administrative dashboards, allowing instant toggling back to active without requiring redundant object recreation.

**Rationale:**
- **Perfect consistency:** Unifies the catalog lifecycle UI/UX across products, variants, categories, and subcategories.
- **Protects transactional integrity:** Prevents the database from throwing SQL violations due to cascade rules on active foreign keys in orders.
- **Prevents redundant data entry:** Users can easily close/open stores or categories temporarily (e.g. seasonally) and reactivate them with one click without recreating all nested objects.

**Tradeoffs:**
- Requires implementing active/inactive styling and toggle switch states across multiple lists, which is easily managed.

---

## [DECISION-043] Pay-on-Service Default for Booking Commerce

**Date:** 2026-05-23
**Status:** Accepted

**Context:**
Quick Commerce orders (groceries, medicines, electronics) allow buyers to select their payment method (e.g., Credit Card, Online Payment, or Cash on Delivery) immediately at checkout. However, Booking Commerce (medical diagnostic tests, doorstep device repairs) is fundamentally different: appointments are scheduled for future timeslots and require manual merchant approval first. We need to document why the system defaults booking flows to Cash on Delivery (COD) / Pay-on-Service and maps this cleanly in UI receipts.

**Decision:**
1. Default all checkout requests under `BOOKING_COMMERCE` strictly to the `COD` database state, bypassing up-front online payment choices at checkout.
2. Render the checkout/confirmation payment label dynamically as **"Pay on Service"** (instead of retail jargon like "COD" or "Cash on Delivery") on buyer booking receipts.

**Rationale:**
- **Avoids Refund Gateway Overhead:** Bookings are *requests* that store owners can decline (e.g., if a technician is sick or a doctor is booked). Taking payments up-front would lead to massive financial losses on non-refundable payment gateway transaction fees (2-3%) and constant customer support tickets for failed/rejected appointments.
- **Support for Price Adjustments:** Technical repairs frequently discover secondary issues on-site (e.g., an AC service discovering a leakage that requires a replacement valve). Pay-on-service allows the final invoice to be adjusted and settled directly at the doorstep based on actual services rendered.
- **Industry Standard for On-Demand Services:** Matches the mental model of on-demand home services (e.g., Urban Company or local field services) where payment is processed only after successful job completion.

**Tradeoffs:**
- Increased risk of buyer "no-shows" since no deposit is taken. This is mitigated by giving store owners the phone numbers of buyers to confirm beforehand and allowing them to cancel/reschedule requests easily.

---

## [DECISION-044] Deterministic Test Seed Pathing & Category Segregation Strategy

**Date:** 2026-05-23
**Status:** Accepted

**Context:**
With the addition of Booking Commerce (Phase 7), storefront categories are split into two sections: "Instant Delivery" and "Book a Service". Currently, this grouping is achieved in the frontend `CategoryGrid.tsx` using a hardcoded array of category slugs (`["groceries", "medical", "electronics"]`). 
Furthermore, Playwright E2E tests for Quick Commerce are written with hardcoded catalog paths (e.g. `/categories/groceries` or `/categories/groceries/rice-atta`). We need to document the architectural justification for these implementations and detail the long-term resolution strategy.

**Decision:**
1. **Testing Stability via Hardcoded Paths:** Retain hardcoded catalog paths in the Playwright E2E tests. Because the E2E suite runs against an isolated, predictable database initialized by the global test seed (`bootstrap-test-db.cjs`), these specific paths are guaranteed to exist, ensuring fast and deterministic test runs.
2. **Transition from Hardcoded Slugs to Dynamic Enums (Phase 4.1):** The current client-side slug filtering in `CategoryGrid.tsx` is accepted only as a temporary, quick-to-ship POC. As part of **Phase 4.1 (Admin Catalog & Category Management)**, we will deprecate the hardcoded client-side array and introduce a structural database upgrade:
   - Add a `commerceType` enum (`QUICK_COMMERCE` | `BOOKING_COMMERCE`) on the Prisma `Category` model.
   - Update category management APIs to serialize `commerceType`.
   - Update the buyer frontend (`CategoryGrid.tsx`) to dynamically partition categories into "Instant Delivery" and "Book a Service" sections based on the API response, eliminating all hardcoded frontend slug lists.

**Rationale:**
- **Zero Test Churn:** Keeps current E2E tests highly performant, robust, and readable without requiring runtime API discovery overhead inside simple browser test files.
- **Perfect Scalability:** The database-driven discriminator guarantees that when new categories are created dynamically by admins, they automatically render in the correct visual container on the storefront with zero code modifications.
- **Decoupled Architecture:** Defers schema additions until Phase 4, when the full admin category management dashboard and control systems are engineered.

**Tradeoffs:**
- E2E tests are coupled to the seed dataset's naming convention; any changes to the default test categories will require updating the corresponding test selectors (a standard trade-off in E2E automation).

---

## [DECISION-045] SPA History Stack Replacement (replace: true) for Checkout Confirmation Redirects

**Date:** 2026-05-26
**Status:** Accepted

**Context:**
In both Quick Commerce and Booking Commerce checkout/scheduling flows, once a user successfully creates an order or booking, they are redirected to a final receipt/confirmation page (e.g. `/orders/:id` or `/bookings/:id`). Standard browser navigation allows users to click the browser "Back" button on this receipt page, returning them to the `/checkout` or `/bookings/new` scheduling forms. If they submit the form again, it could lead to duplicate orders, server-side stock issues, and bad user experiences.

**Decision:**
Implement a mandatory **"History Stack Replacement"** pattern for all successful transaction page redirects. Instead of pushing the confirmation route onto the history stack, the navigation callback must replace the active checkout history entry using `replace: true`:
1. **Quick Commerce (`CheckoutPage.tsx`)**:
   `navigate(`/orders/${orderId}`, { replace: true });`
2. **Booking Commerce (`BookingTimeslotPage.tsx`)**:
   `navigate(`/bookings/${res.data.data.orderId}`, { replace: true });`

Additionally, confirmation pages must display a clear, high-fidelity on-screen primary button (e.g., "Track Order in History" or "Go to Bookings Dashboard") that explicitly navigates users forward into their respective history panels.

**Rationale:**
- **Eliminates Double-Orders**: It physically prevents users from backing up into the checkout/scheduling views where they could resubmit the form.
- **Natural Back Navigation**: When the user clicks the browser back button, the browser skips the checkout entry (since it was replaced) and takes them directly to the last page they visited before checkout (e.g., the store storefront or subcategory landing page). Since their cart has been cleared on placement, this is completely safe and logical.
- **Zero Overhead**: This is a standard single-parameter change (`{ replace: true }`) in React Router, carrying absolutely no performance, database, or DOM-rendering footprint.
- **No Trap Behavior**: Avoids fragile browser history hacks (`popstate` blocking) which Chrome and modern browsers block as malicious patterns.

**Tradeoffs:**
- The user cannot go back to review the exact checkout form inputs they submitted. This is mitigated because the order details card on the confirmation/receipt screen already displays a fully populated summary of their selected items, prices, scheduled slots, and address landmarks.

**Alternatives Considered:**
1. **History Popstate Interception**: Intercepting back-clicks on the confirmation page and forcing a redirect. Rejected due to browser security restrictions and high fragility across different device viewports.
2. **Checkout State Preservation**: Leaving the history alone, but checking on checkout mount if the cart is empty, and automatically redirecting the user. Rejected because it allows a confusing flash of the checkout screen before the redirect occurs.

---

## [DECISION-046] Store-Scoped Discount Codes & Applied Code Persistence on Orders

**Date:** 2026-05-28
**Status:** Accepted

**Context:**
The original `Discount` model was designed with a globally unique `code` field (`code String @unique`) and a nullable `storeId` (`String?`). This was intended to allow both platform-wide and store-specific discount codes. Two problems emerged from this design:

1. **Tenant-isolation bug:** Because the `code` column is globally unique, two independent merchants cannot both create a coupon named `SAVE10`. This is a hard database-level conflict that has no valid business justification — two separate stores' coupon namespaces should never interfere with each other.
2. **Discount code name is lost after order placement:** When a buyer applies a coupon code (e.g., `SAVE10`) at checkout, the code string is validated and used to compute the discount amount. However, neither the `Order` nor `BookingOrder` record saves the code name — only the final calculated totals are persisted. This means all downstream UIs (order receipt, store-owner order detail modal, booking dashboard) have no way to retrieve which code was applied. They are forced to fall back to a generic `"Discount"` label in the collapsible discount breakdown dropdown, which is a data transparency failure for both buyers and store owners.

**Decision:**
Two schema changes are implemented together as a single atomic migration:

1. **Make `storeId` required on `Discount`:** Remove the nullable `String?` and promote it to a required `String`. Every discount code must belong to exactly one store. Platform-wide discount codes are out of scope for this phase and will be revisited under Phase 4 (Admin Panel) if needed.

2. **Replace the global unique constraint with a per-store composite unique:** Remove `code String @unique` and add `@@unique([storeId, code])`. This means a code is unique within a store's own namespace, but Store A and Store B are completely free to each have their own `SAVE10` without conflict.

3. **Add `appliedDiscountCode String?` to the `Order` model:** This field is written exactly once — at the moment the order is placed — and is never modified. It stores the normalized (uppercased, trimmed) code string that was applied. It is `null` when no coupon code was used.

4. **Expose `appliedDiscountCode` through all order and booking API serializers:** All endpoints that return order or booking data (`GET /api/v1/orders/:id`, `GET /api/v1/store/orders`, `GET /api/v1/store/bookings`, `GET /api/v1/bookings/:orderId`) must include this field in their response payload.

5. **Update all frontend discount breakdown functions:** The `getAppliedDiscounts` helper in `StoreOrdersPage.tsx`, `StoreBookingsPage.tsx`, `OrderConfirmationPage.tsx`, and `BookingConfirmationPage.tsx` must use the persisted `appliedDiscountCode` field as the label for the coupon line item in the collapsible discount dropdown instead of the `"Discount"` fallback.

**Rationale:**
- **Correct tenant isolation:** Merchant A's coupon namespace must never conflict with Merchant B's. This is a fundamental multi-tenant data isolation requirement.
- **Data transparency:** Buyers and store owners are entitled to see the exact coupon code name that was applied to an order. Displaying `"Discount"` is a UX failure that undermines trust in the discount system.
- **Immutable audit trail:** Persisting the code name on the order creates a permanent, immutable financial record. Even if the discount code is later deactivated or deleted (soft), the order history correctly reflects what was applied at the time of purchase.
- **Simplifies validation logic:** With `storeId` now always required, the conditional check `if (discount.storeId !== null && discount.storeId !== storeId)` simplifies to `if (discount.storeId !== storeId)`, removing a branch that previously allowed accidental platform-wide coupon application.

**Tradeoffs:**
- Existing discount records in the database with `storeId = null` (platform-wide) must be backfilled or removed before the migration can run. This is acceptable as no production data exists in this state.
- The `appliedDiscountCode` column adds a small amount of storage per order row, which is negligible.

**Alternatives Considered:**
1. **Keep global uniqueness, enforce store-scoping only in the service layer:** Rejected. Service-layer-only enforcement is fragile — a future developer could bypass it. The database constraint is the correct place to enforce this invariant.
2. **Store offer-to-order links in a junction table (`OrderAppliedOffer`):** Rejected for this phase. Offers are already reconstructed retroactively via the `getAppliedDiscounts` time-based matching logic, which works correctly. Only the coupon code name — which has no equivalent retroactive mechanism — needs to be persisted.

---

## [DECISION-047] Store Status Toggles (Online/Offline) & Dashboard Granular Charts

**Date:** 2026-05-29
**Status:** Accepted

**Context:**
Store owners need a direct, high-visibility mechanism on their dashboard to control their operational availability in real time. If a store is overwhelmed, runs out of raw materials, or experiences a local emergency, the merchant must be able to temporarily stop accepting new orders/bookings immediately without waiting for an administrator. Furthermore, the store owner dashboard needs to display granular sales trends (daily/hourly charts) to help merchants optimize staffing and inventory.

**Decision:**
1. **Database Schema Support:** Add `isAcceptingOrders Boolean @default(true)` and `isAcceptingBookings Boolean @default(true)` to the `Store` model.
2. **Dashboard Availability Toggles:** Implement high-visibility toggle buttons ("Online / Offline") directly in the header of the store owner dashboard (`StoreDashboardPage.tsx`). Toggling updates the store's status via a new endpoint `PUT /api/v1/store/availability` (with validation that the owner owns the store).
3. **Storefront Gating:** Update buyer-facing endpoints and page guards:
   - If a store has `isAcceptingOrders = false`, buyers cannot place new quick-commerce orders (checkout throws `STORE_NOT_ACCEPTING_ORDERS`).
   - If `isAcceptingBookings = false`, scheduling a service booking is blocked (throws `STORE_NOT_ACCEPTING_BOOKINGS`).
   - The buyer UI displays clean, descriptive warnings (e.g. "Store is temporarily offline and not accepting orders").
4. **Dashboard Granular Charts:** Wire granular sales aggregation in `StoreOwnerService.getDashboard` and display a dynamic bar chart (using Recharts) to render daily revenue tracking for the store owner.

**Rationale:**
- **Merchant Autonomy:** Gives store owners immediate control over their operations, preventing customer frustration from unfulfillable orders.
- **Dry-run/Graceful Degradation:** Toggling status does not deactivate the store in the catalog search or hide its products; it simply disables the checkout/scheduling triggers. Buyers can still browse menus and services.
- **Improved Analytics:** Granular charts provide actionable business intelligence directly on the home screen.

**Tradeoffs:**
- Adds two boolean flags to the `Store` model and requires additional validation guards in both quick checkout and booking placement services.


---

## [DECISION-048] Bulk Insert & Restock Scope: Store-Scoped Only, Two-Phase Validate/Confirm, Skip over Upsert

**Date:** 2026-06-08
**Status:** Accepted

**Context:**
Phase 6.10 introduces bulk insert of products+variants (store owner), bulk insert of categories+subcategories (admin), and bulk restock (store owner). Three key design decisions were made during planning:

1. **Scope boundary** — Who inserts what?
2. **Conflict resolution** — What happens when a row conflicts with existing data?
3. **Restock identity** — How do we identify which variant to update, without a SKU field?

**Decision:**
1. **Scope boundary:** Store owners can bulk insert their own products/variants and bulk restock their own variants. Admin can bulk insert categories/subcategories only. Admin does **not** bulk insert products on behalf of stores — store owners own their own catalog. This eliminates any need for `storeId` in request bodies for store owner operations (it is always sourced from the JWT). It also eliminates cross-store ambiguity from the restock identity problem.
2. **Conflict resolution — Two-Phase Validate/Confirm with strict-first, skip-as-option:** The API exposes two endpoints per operation: `validate` (dry-run, no DB writes, returns conflict report) and `confirm?mode=strict|skip` (actual write). The validate endpoint is always called first. If conflicts are found, the frontend shows the user a conflict table and presents two choices: "Fix my file" (return to upload, no confirm call) or "Skip conflicts & continue" (call confirm with `mode=skip`). `mode=skip` inserts only non-conflicting rows. `mode=upsert` (overwrite existing records) is explicitly **not** supported — overwriting live production data from a bulk file is a high-risk destructive operation unsuitable for a v1 implementation. `mode=strict` (reject all if any conflict exists) is the default.
3. **Restock identity without SKU:** Since restock is scoped to a single store (storeId from JWT), the compound key `(storeId + productName + variantLabel)` is sufficient to uniquely identify a variant for update. Per DECISION-039, variant labels are unique within a product. Product names are practically unique within a store (enforced by the store owner themselves). If ambiguity is detected (two products with the same name in the same store), the row is rejected with `AMBIGUOUS_PRODUCT_NAME` — a loud, safe failure that prevents silent data corruption. This eliminates the need for a `sku` field on `ProductVariant` for this use case.

**Rationale:**
- Store-scoped boundaries respect the existing authorization model (DECISION-039, DECISION-034) without introducing any schema changes.
- Two-phase validate/confirm is an established UX pattern (used by Shopify product imports, GitHub PR checks) that prevents partial data corruption and gives users full visibility into conflicts before any write occurs.
- Skip (not upsert) is safer: it leaves existing records untouched. If an admin or store owner wants to update an existing category or product, they use the existing single-edit UI — that is the correct context for intentional updates.
- Compound key `(storeId + productName + variantLabel)` avoids any schema migration and works within existing DECISION-039 constraints.

**Tradeoffs:**
- Two API calls per operation increases latency for the happy path (no conflicts). Acceptable: bulk operations are not latency-sensitive — the user is uploading a file and waiting anyway.
- `mode=skip` can silently succeed while leaving some rows unprocessed. Mitigated by the explicit response body (`{ inserted: N, skipped: M }`) and UI toast showing both counts.
- Compound key approach is fragile if a store owner has two products with the same name. Mitigated by the `AMBIGUOUS_PRODUCT_NAME` error, which forces the store owner to resolve the naming collision before bulk restocking those products.

**Alternatives Considered:**
1. Single-endpoint upsert — rejected: too destructive for bulk operations on live production data.
2. Admin bulk-inserts products on behalf of stores — rejected: violates store ownership principle (DECISION-034), adds storeId auth complexity.
3. Add `sku` field to `ProductVariant` for restock identity — rejected (for this phase): unnecessary complexity when store-scope + compound key is sufficient. Deferred to a future phase if bulk cross-store admin restock ever becomes a requirement.
4. Require slug in bulk category Excel — rejected: slugs are a technical implementation detail. Auto-generation from name follows the existing single-create flow and removes all technical knowledge from the user-facing sheet.

---

## [DECISION-049] No E2E (Playwright) Tests for Phase 6.10 Bulk Operations

**Date:** 2026-06-08
**Status:** Accepted

**Context:**
The project follows a strict TDD approach (TDD_INSTRUCTIONS.md) requiring both unit/component tests and integration tests. The question for Phase 6.10 is whether bulk insert/restock operations also require E2E Playwright tests.

**Decision:**
No new E2E Playwright tests are written for Phase 6.10 bulk operations. Coverage is provided entirely by:
- **Integration tests** (Vitest, `src/__tests__/integration/`) — hit real HTTP routes with a real test database. Cover validate/confirm endpoint contracts, auth guards, conflict detection, DB state assertions, StockMovement creation, and AuditLog entries.
- **Unit/component tests** (Vitest + Testing Library) — cover modal open/close behavior, conflict table rendering, file input interactions, and toast messages with mocked API responses.

**Rationale:**
- Bulk insert is an **operational tool** (admin catalog setup, store onboarding) not a **buyer-facing flow**. Playwright E2E is optimized for buyer journeys and primary happy paths.
- File upload interactions in Playwright (`page.setInputFiles`) require fixture `.xlsx` files on the filesystem and are brittle to modal state changes. Integration + unit tests provide equivalent and more reliable coverage.
- The validate/confirm API contract is already 100% covered by integration tests hitting real routes — there is no "phantom feature" risk (the concern that TDD_INSTRUCTIONS.md warns against) because the HTTP contract is directly verified against a real DB.
- Existing E2E tests (home page category counts, product listings) act as an implicit regression check: if bulk-inserted data is malformed, those tests will catch it if the data is seeded into the test fixture.

**Tradeoffs:**
- If a future regression occurs specifically in the frontend modal wiring (not caught by unit tests), it would not be caught by E2E. Mitigated by hyper-specific unit test assertions for the modal's API call sequence.
- The decision is consciously documented so a future engineer can add E2E coverage using `page.setInputFiles('input[data-testid="bulk-file-input"]', '/path/to/fixture/sample.xlsx')` without interacting with the OS file dialog.

**Alternatives Considered:**
1. Add Playwright E2E tests for bulk insert modal — rejected: file upload dialog interactions are flaky without `setInputFiles`, and the coverage is duplicative of integration tests that already prove the HTTP contract.
2. Add E2E smoke test only (no file upload, just assert button exists) — rejected: too low value to justify the maintenance burden.

---

## [DECISION-050] Password-Based Authentication for Delivery Riders

**Date:** 2026-06-09
**Status:** Accepted

**Context:**
Delivery riders need to log in to their mobile web interface quickly and reliably. Unlike buyers (who use SMS OTP to avoid passwords) or admins/store owners (who use passwords + TOTP 2FA for high security), riders are pre-registered staff and need an optimized, frictionless authentication loop.

**Decision:**
Implement email + password authentication (using bcryptjs hashing) for the Rider interface. Do not require SMS OTP or TOTP 2FA. Access is gated by the `RiderRoute` React guard, which checks for the `RIDER` role in the JWT.

**Rationale:**
- **Friction Reduction:** Riders are active on the road and log in repeatedly from mobile browsers. Requiring SMS OTP introduces latency, relies on cellular network stability, and incurs SMS costs for every login.
- **Security Balance:** Riders do not have access to administrative settings or cross-store financials; their access is limited strictly to orders assigned to their store. Standard password validation is sufficient.
- **Administrative Control:** Rider accounts are created by administrators or seeded via scripts, allowing passwords to be managed or reset by store/admin managers.

**Tradeoffs:**
- Riders must remember a password (mitigated by modern password managers and mobile autocomplete).
- Lower security posture compared to TOTP 2FA, but appropriate for the RIDER role's limited access scope.

---

## [DECISION-051] Customer Phone Number Masking on Rider Active Feed

**Date:** 2026-06-09
**Status:** Accepted

**Context:**
Riders need to view active orders assigned to their store. While riders may need to contact buyers for delivery coordination, exposing unmasked customer phone numbers directly on the active orders feed creates privacy risks and potential data harvesting issues, violating our privacy-first principles (DECISION-035).

**Decision:**
Implement customer phone number masking (`maskPhone` helper: e.g. `*********7890`) at the API controller level in `rider.controller.ts` before returning active orders.

**Rationale:**
- **Data Protection:** Follows the principle of least privilege, preventing unnecessary exposure of PII (Personally Identifiable Information) in plain-text API responses.
- **Preparation for Proxy Calls:** Aligns with DECISION-035, where direct voice calls will be routed through a Twilio proxy rather than direct dialing. The UI displays the masked phone number and a "Call" trigger, preventing the rider from seeing the actual customer number.

**Tradeoffs:**
- If the proxy communication system fails or is not yet implemented, riders cannot manually dial customers using their real numbers. However, this is an acceptable privacy constraint.

---

## [DECISION-052] Consent Auditing via Immutable ConsentLog Ledger

**Date:** 2026-06-09
**Status:** Accepted

**Context:**
India's DPDP Act 2023 mandates that personal data (such as phone numbers, names, and addresses) can only be processed based on explicit, specific, and informed consent. We must be able to prove that consent was given, when it was given, under what terms/notices, and from what IP address. Additionally, users must be able to view and withdraw consent for non-essential purposes as easily as they gave it.

**Decision:**
1. **Consent Ledger Schema:** Implement a \`ConsentLog\` model in PostgreSQL containing \`userId\`, \`purpose\` (an enum of \`OTP_AUTH\`, \`ORDER_PROCESSING\`, \`MARKETING_EMAIL\`, \`ANALYTICS\`), \`consentVersion\`, \`noticeText\` (the exact text displayed to the user), \`ipAddress\`, \`isWithdrawn\`, and \`withdrawnAt\`.
2. **Consent Gating & Gating Endpoints:**
   - Create \`POST /api/v1/consent\` to record consent events.
   - Create \`GET /api/v1/consent\` to fetch the user's current consent registry.
   - Create \`DELETE /api/v1/consent/:purpose\` to withdraw a specific consent.
3. **Essential Consent Blocking:** The service layer blocks withdrawal of essential operational consents (\`OTP_AUTH\` and \`ORDER_PROCESSING\`) with a \`CANNOT_WITHDRAW_ESSENTIAL_CONSENT\` error. Essential consent withdrawal requires complete account deletion (Right to Erasure).

**Rationale:**
- **Regulatory Proof:** Storing the exact notice text and version alongside the IP address provides an audit trail that can be produced to the Data Protection Board of India in the event of an investigation.
- **Purpose Limitation:** Scoping consent to specific purposes ensures GoRola is in compliance with the DPDP principle of purpose limitation (i.e. using phone numbers for login delivery, not marketing, unless separately consented to).

**Tradeoffs:**
- Adds database write overhead on login and profile updates. This is negligible compared to the massive compliance security.

---

## [DECISION-053] Anonymization (Pseudonymization) Over Hard-Deletion for User Erasure & Redis Session Tracking

**Date:** 2026-06-09
**Status:** Accepted

**Context:**
The DPDP Act's Right to Erasure requires us to delete all user personal data upon request. However, Indian tax and GST laws require us to preserve financial transaction logs (Order history) for 3 years. A simple hard-deletion of a user record breaks foreign key constraints, compromises sales analytics, and violates financial audit laws. Additionally, we need to ensure that when a user deletes their account, all active authentication sessions are instantly revoked.

**Decision:**
1. **Anonymization Strategy (Pseudonymization):** When a user requests account deletion (\`DELETE /api/v1/user/account\`), we immediately soft-delete the user record, overwrite all direct PII fields with anonymized strings (\`name = '[deleted]'\`, \`phone = 'DELETED_<userId>'\`), and soft-delete all \`Address\` records for the user.
2. **Order History Retention:** The \`Order\` records are retained in their original schema structure for 3 years. Any personal data in the orders is anonymized so that the sales logs are preserved without leaking buyer PII.
3. **Session Revocation via Redis Sets:** Introduce a Redis set \`user_sessions:{userId}\` which stores all active refresh tokens for the user. On account deletion, the system queries this set and deletes all corresponding \`refresh:{token}\` keys, instantly invalidating all active sessions.
4. **BullMQ Grace Period Jobs:** Enqueue a \`UserDataPurgeJob\` via BullMQ scheduled to run 30 days after deletion. This 30-day grace period allows for account recovery if deletion was requested in error. After 30 days, the job executes a database hard-delete of the anonymized User row.

**Rationale:**
- **Legal Parity:** Retaining raw financial data under tax obligation is a lawful basis for processing that overrides the DPDP erasure right, provided the data is stripped of active user linkage.
- **Immediate Security Containment:** Invalidating tokens immediately prevents subsequent API access.

**Tradeoffs:**
- Requires managing background queue workers (BullMQ) and maintaining dual data lifecycles (immediate anonymization vs. 30-day hard deletion vs. 3-year financial retention).

---

## [DECISION-054] Card Payment & Implicit Age Declaration for Medical Diagnostic Orders

**Date:** 2026-06-09
**Status:** Accepted

**Context:**
Processing children's data under the DPDP Act carries strict verification requirements and massive penalties (up to ₹200 Crore) for violations. Because GoRola offers diagnostic medical tests (e.g. via Aarna Diagnostic Centre), we must ensure that minors (under 18) do not independently schedule field diagnostic tests without parental authorization.

**Decision:**
1. **Explicit Age Declaration Checkbox:** Add a mandatory age confirmation checkbox ("I confirm I am 18 years of age or older") to the registration flow before a phone number is entered.
2. **Payment Gate Verification:** Require credit/debit card payment methods for all diagnostic medical orders. Card ownership acts as an implicit, best-effort age verification step under DPDP Module 5, gating medical commerce from unauthorized minors.

**Rationale:**
- **Friction-vs-Compliance Balance:** Full Aadhaar or government ID age-verification adds immense user friction and costs. Card ownership is a legally accepted indicator of legal age or parental consent (i.e. parent letting a minor use their card).

**Tradeoffs:**
- Gating diagnostic medical orders to card payments prevents Cash-on-Delivery (COD) or simple UPI payments for these services, which may reduce conversion rates. This is an acceptable tradeoff to protect the platform from children's data violations.

---

## [DECISION-055] Standardizing Status Log Actor Prefixes in Database

**Date:** 2026-06-17
**Status:** Accepted

**Context:**
Rider, store owner, and admin status transitions were logged using mixed conventions (e.g. `"STORE_OWNER"`, `"ADMIN"`, or raw IDs). This created formatting complexity, inconsistent data modeling, and exposed raw database IDs to users in the UI timeline.

**Decision:**
1. Storing rider-initiated status logs as `rider:${riderId}` in the database.
2. Storing quick-commerce store owner status logs as `store-owner:${ownerId}` in the database.
3. Storing admin-initiated force status updates as `admin:${adminId}` in the database.
4. Standardizing frontend parsing via `formatChangedBy()` in `StoreOrdersPage.tsx` and `StoreBookingsPage.tsx` to handle new prefixes while maintaining backward compatibility with legacy and mock data formats (e.g., `"BUYER"` and `"RIDER"`).

**Rationale:**
- **Audit Trails:** Provides a uniform, human-verifiable, and machine-parsable format for status change actors, complying with DPDP log auditing.
- **Privacy Gating:** Decouples database record identification from the frontend UI presentation layer, preventing the leaking of entity IDs to other platform roles.
- **Uniformity:** Establishes a predictable data standard across the modular monolith modules.

**Tradeoffs:**
- Requires parsing strings on the frontend client to map prefixes to display labels. However, this keeps the storage schema simple and performs optimally.

**Alternatives Considered:**
1. Changing the database schema to store a JSON object of the actor details — rejected: too invasive.
2. Storing raw database IDs without entity prefixes — rejected: requires searching multiple tables (User, Store, Rider) to identify the actor type.
