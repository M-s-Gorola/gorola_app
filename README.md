# GoRola App

GoRola is a premium quick-commerce platform for Mussoorie, India. This repository contains the monorepo for the backend API, frontend web app, and shared packages.

## Current Status

- **Phase 1 (NFR Foundation)**: ✅ Completed.
- **Phase 2 (Buyer Web Experience)**: ✅ Completed.
  - Full E2E stability achieved (34/34 passing).
  - Hardened full-stack quality gate.
- **Phase 3 (Store Owner Foundation)**: 🕒 Next.

## Tech Stack

- **Backend**: Fastify (Node.js), Prisma ORM, PostgreSQL 15, Redis 7, Pino (Logging)
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS 4, GSAP/Lenis (Animations)
- **Tooling**: pnpm workspaces, ESLint 9, Prettier, TypeScript strict mode
- **Testing**: Vitest (Unit & API Integration tests)

## Implemented API Domains (Repository Layer)

- `user` & `auth` (OTP flow)
- `store` & `store-owner`
- `admin`
- `catalog` (categories, products, variants)
- `cart` & `order`
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
└── pnpm-workspace.yaml     # pnpm workspace definition
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
8. **E2E Tests**: 34 Playwright user-journey flows.

## Root Workspace Commands

Run these from `GoRola_app` root:

```bash
pnpm lint         # Lint all packages
pnpm typecheck    # Typecheck all packages
pnpm test         # Run all tests
pnpm build        # Build all packages
```

---

GoRola - Mussoorie, delivered.
