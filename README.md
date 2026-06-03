# GoRola App

GoRola is a premium quick-commerce platform for Mussoorie, India. This repository contains the monorepo for the backend API, frontend web app, and shared packages.

## Current Status

- **Phase 1 (NFR Foundation)**: ✅ Completed.
- **Phase 2 (Buyer Web Experience)**: ✅ Completed.
  - Full E2E stability achieved.
  - Hardened full-stack quality gate.
- **Phase 7 (Booking Commerce)**: ✅ Completed.
  - Hybrid Quick & Booking Commerce engines unified.
  - Automated morning/afternoon appointment slots, fasting requirements, lead days, and real-time dashboard status tracking.
- **Phase 3 & 4 (Store Owner & Admin Panel)**: 🕒 Next.

## Tech Stack

- **Backend**: Fastify (Node.js), Prisma ORM, PostgreSQL 15, Redis 7, Pino (Logging)
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS 4, GSAP/Lenis (Animations)
- **Tooling**: pnpm workspaces, ESLint 9, Prettier, TypeScript strict mode
- **Testing**: Vitest (Unit & API Integration tests), Playwright (E2E)

## Implemented API Domains (Repository Layer)

- `user` & `auth` (OTP flow with custom rate-limiting and device verification)
- `store` & `store-owner` (real-time WebSocket KPIs & Order status dashboards)
- `admin`
- `catalog` (categories, subcategories, products, variants)
- `cart` & `order` (Quick Commerce checkout)
- `booking` & `BookingOrder` (appointment scheduling, lead-days picker, fasting validations)
- `address` & `delivery` (stub)
- `promotion` (ads, offers, discounts)
- `feature-flag` & `audit`

## Monorepo Structure

```text
GoRola_app/
├── apps/
│   ├── api/                # Fastify + Prisma backend
│   └── web/                # React + Vite + TypeScript (buyer web)
├── packages/
│   ├── shared/             # Shared logic, types and domain errors
│   └── ui/                 # Shared UI components
├── .github/workflows/      # CI/CD pipelines and SECRETS guide
├── DATABASE and SETUP/     # Detailed guides for local setup and seeding
├── DEPLOYMENT INFO/        # Technical breakdown of Vercel/Railway config
├── vercel.json             # Vercel configuration (buyer web)
├── railway.toml            # Railway configuration (API)
├── .env.example            # Environment variables template
├── package.json            # Root workspace scripts
├── pnpm-workspace.yaml     # pnpm workspace definition
└── CONTEXT/                # Architecture design maps & rules specs
```

## Local Setup & Seeding

For detailed instructions on setting up the project locally (using Docker for Postgres/Redis) and seeding data, please refer to the specialized guides:

- 🛠️ **[Local Setup Guide](./DATABASE%20and%20SETUP/LOCAL_SETUP.md)**: Infrastructure, environment variables, and installation.
- 🌱 **[Seeding Guide](./DATABASE%20and%20SETUP/ONE_TIME_RAILWAY_SEED.md)**: How to seed local and remote (Railway) databases.

## CI/CD & Deployment

The project uses GitHub Actions for continuous integration and deployment.

### Branch Policy
- **Direct Pushes**: Blocked for `main` and `develop` branches.
- **Workflow**: All changes must be submitted via **Pull Request to the `develop` branch**.
- **Deployment**:
  - Pushes to `develop` deploy to **Staging**.
  - Pushes to `main` deploy to **Production** (requires manual approval).

### Deployment Infrastructure
- **Frontend**: [Vercel](https://vercel.com) (Buyer Web).
- **Backend**: [Railway](https://railway.app) (Fastify API + PostgreSQL + Redis).

### Secrets Management
Detailed instructions for configuring GitHub Environments, Vercel, and Railway secrets can be found here:
- 🔐 **[CI/CD Secrets Guide](./.github/workflows/SECRETS.md)**: Configuring GitHub, Vercel, and Railway secrets.
- ⚙️ **[Deployment Config Guide](./DEPLOYMENT%20INFO/DEPLOYMENT_CONFIG_GUIDE.md)**: Technical breakdown of `vercel.json`, `railway.toml`, and CORS policies.

## Development Quality Gate

Before pushing any code, you **MUST** run the quality gate check locally to ensure CI will pass:

```bash
pnpm ci:quality
```

This command runs the **exact** same sequence as the GitHub Actions CI pipeline:
1. **Build Shared Lib**: Compiles `@gorola/shared` (mandatory for type-safety).
2. **Security Audit**: High-level audit of all dependencies.
3. **Database Prepare**: Auto-migrates and Double-seeds the **Test DB** (Catalog + E2E).
4. **Linting**: Strict zero-warning enforcement.
5. **Typechecking**: Full-stack TypeScript validation.
6. **Build**: Verifies the production bundle.
7. **Unit/Integration Tests**: 500+ Vitest tests.
8. **E2E Tests**: 48 Playwright user-journey flows (covering quick commerce & booking engines across multiple viewports).

## Root Workspace Commands

Run these from `GoRola_app` root:

```bash
# Quality Gates
pnpm ci:quality   # Full pipeline: Lint -> Typecheck -> Build -> Unit -> E2E

# Testing
pnpm test         # Run all Vitest unit/integration tests
pnpm test:e2e     # Run all Playwright E2E tests

# Maintenance
pnpm lint         # Lint all packages
pnpm typecheck    # Typecheck all packages
pnpm build        # Build all packages

# Database
pnpm db:local:bootstrap   # Clean and seed local development DB
pnpm db:test:prepare      # Clean and seed test DB (used for E2E)
```

## ⚠️ Important E2E Development Guidelines

To prevent test flakiness and **accidental contamination of your development database (`gorola_dev`)**, adhere to the following rules when running E2E tests locally:

1. **Stop active development servers**: Always stop any running local development servers (Vite Frontend client on port `5180` and Dev Backend API on port `3001`) before triggering E2E tests (`pnpm test:e2e` or `pnpm ci:quality`). 
   - **Why?** Playwright is configured to reuse the existing frontend server running on port `5180` (Vite Frontend) if active. Since standard dev frontend servers proxy requests to the dev API (port `3001` connected to the `gorola_dev` database), reusing them causes Playwright to run tests against your active development database, polluting data and failing tests. Stopping the local servers forces Playwright to boot a clean Vite frontend server instance with the E2E proxy target configured to point to the isolated E2E Test Backend API (port `3002` connected to the `gorola_test` database).
2. **Do NOT interact with the application manually during E2E runs**: Avoid clicking around the app on `localhost:5180` (the frontend) or any mapped subdomains while the test suite is running in the background. Manual UI interaction collides with automated test scripts, leading to state race conditions and test failures.

For more details on E2E port mapping and proxy rules, refer to [e2e_environment_port_isolation.md](./ISSUES%20GUIDE/e2e_environment_port_isolation.md).

---

GoRola - Mussoorie, delivered.
