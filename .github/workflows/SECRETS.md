# GitHub Actions — Secrets & Environment Setup

This file is the single source of truth for every secret and environment the
CI/CD pipelines need. Keep it next to the workflow files so anyone onboarding
can find it immediately.

---

## 1. GitHub Environments

The deploy workflows use **GitHub Environments** (not just repository secrets).
Environments let you scope secrets per deployment target and add protection
rules (e.g. a required-reviewer approval gate before production).

### Create the two environments

Repo → **Settings** → **Environments** → **New environment**

| Environment name | Branch restriction | Recommended protection |
|---|---|---|
| `staging` | `develop` | None (auto-deploy) |
| `production` | `main` | Required reviewers (your lead/you) |

For the `production` environment, add at least one **Required reviewer** under
*Deployment protection rules*. This means every push to `main` pauses and
waits for a manual approval click before Railway/Vercel actually deploy.

---

## 2. Secrets — where to add them

Each secret below must be added **inside its environment**, not at repository
level, so that staging and production each get the correct values:

`Repo → Settings → Environments → <environment name> → Add secret`

> ⚠️ Do NOT add these at repository level — they would be shared across both
> environments and you would lose the staging/prod isolation.

---

## 3. Vercel secrets

### `VERCEL_TOKEN`
- **What:** Vercel account (or team) API token used by the CLI in non-interactive mode.
- **Where to get it:** vercel.com → your avatar → **Account Settings** → **Tokens** → **Create**.
- **Scope:** Can be shared between staging and production environments (same token works for both projects).

### `VERCEL_ORG_ID`
- **What:** The team/scope ID that owns the Vercel project (the CLI calls this `orgId`).
- **Where to get it:**
  1. Switch to the correct team on vercel.com.
  2. **Team Settings** → **General** → copy the **Team ID** field.
  - *Alternatively:* run `vercel link` at the monorepo root — it writes `.vercel/project.json`; copy the `orgId` value from there.
- **Scope:** Same value for staging and production (same team owns both projects).

### `VERCEL_PROJECT_ID`
- **What:** The project ID of the buyer-web Vite app **for this environment**.
  Staging and production should be **two separate Vercel projects** so they
  have independent domains, environment variables, and deploy history.
- **Where to get it:**
  1. Open the Vercel project → **Settings** → **General** → **Project ID**.
  - *Alternatively:* read `projectId` from `.vercel/project.json` after `vercel link`.
- **Scope:** Different value per environment — set the staging project ID in the
  `staging` environment and the production project ID in `production`.

---

## 4. Railway secrets

> **Background:** Railway's GitHub auto-deploy is intentionally **disconnected**
> from the repo. GitHub Actions is the sole deploy trigger. This gives exact
> per-branch control: `develop` → staging environment, `main` → production.

### `RAILWAY_TOKEN`
- **What:** A project-scoped token used by the Railway CLI (`railway up --ci`).
  Project tokens are preferred over account tokens — they expire with the project
  and have a smaller blast radius if leaked.
- **Where to get it:**
  1. Open your Railway project.
  2. **Settings** (top bar) → **Tokens** → **Create project token**.
  3. Create **two tokens** — one labelled `staging`, one labelled `production`.
- **Scope:** Different token per environment — staging token in `staging`, prod token in `production`.
- **Regenerate if:** you see `"Invalid RAILWAY_TOKEN"` in CI logs.

### `RAILWAY_SERVICE_ID`
- **What:** The UUID of the **API service** inside your Railway project.
  This is NOT the project ID — a project contains multiple services (API,
  Postgres, Redis) and each has its own UUID.
- **Where to get it** (two options):
  1. **Browser URL bar** — in the Railway dashboard, click the API service.
     The URL becomes: `railway.app/project/.../service/<UUID>/...`
     Copy the UUID between `/service/` and the next `/`.
  2. **CLI** — from the monorepo root:
     ```
     npx @railway/cli@latest link
     ```
     Pick the project and then the API service when prompted.
     Railway writes a `.railway/` config — read `RAILWAY_SERVICE_ID` from it.
- **Scope:** Different UUID per environment — staging service ID in `staging`,
  production service ID in `production`.

---

## 5. App secrets (staging vs production)

Set these directly in the Railway dashboard per environment (Railway → your
project → switch environment dropdown → your service → Variables tab), **not**
in GitHub secrets. Railway injects them at runtime so the CLI doesn't need them.

Set the equivalent values in the Vercel project's **Environment Variables** tab,
scoped to Preview (staging) or Production as appropriate.

| Variable | Staging value | Production value |
|---|---|---|
| `DATABASE_URL` | Staging DB connection string (`app_service` DML role) | Prod DB connection string (`app_service` DML role) |
| `DIRECT_URL` | Staging DB direct DDL URL (`db_owner` role) | Prod DB direct DDL URL (`db_owner` role) |
| `MIGRATION_DATABASE_URL` | Staging DB migration URL (`db_owner` DDL owner role) | Prod DB migration URL (`db_owner` DDL owner role) |
| `REDIS_URL` | Staging Redis URL | Prod Redis URL |
| `JWT_SECRET` | Any strong random string | Different strong random string |
| `FRONTEND_URL` | Staging Vercel preview URL | Your production domain |
| `STRIPE_SECRET_KEY` | Stripe **test** mode key (`sk_test_...`) | Stripe **live** key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe test webhook secret | Stripe live webhook secret |
| *(other third-party keys)* | Sandbox / test credentials | Live credentials |

> ⚠️ **Prisma Migrations & Database Role Separation (DPDP Act Sec 8(5))**:
> - `DATABASE_URL` uses the restricted `app_service` user (DML operations: SELECT, INSERT, UPDATE, DELETE).
> - `DIRECT_URL` and `MIGRATION_DATABASE_URL` MUST use the `db_owner` database owner role so that `prisma migrate deploy` can execute DDL schema migrations (`CREATE`, `ALTER`, `DROP`) during API startup and deployment.


> ⚠️ **Never share a database between staging and production.**
> Run a separate Postgres and Redis instance per Railway environment.

---

## 6. Quick checklist before first deploy

- [ ] Created `staging` and `production` GitHub Environments
- [ ] Added required-reviewer rule to `production` environment
- [ ] Added `VERCEL_TOKEN`, `VERCEL_ORG_ID` to both environments
- [ ] Created two separate Vercel projects (staging + prod) — added their `VERCEL_PROJECT_ID` to the correct environment each
- [ ] Created two Railway project tokens — added as `RAILWAY_TOKEN` to the correct environment each
- [ ] Found the API service UUID for staging and prod — added as `RAILWAY_SERVICE_ID` to the correct environment each
- [ ] Added `MIGRATION_DATABASE_URL` (`db_owner` DDL owner connection string) to GitHub Repository / Environment Secrets for automated CI database migrations
- [ ] Set all app-level variables (DB, Redis, JWT, Stripe…) inside Railway per environment
- [ ] Set all frontend env vars inside each Vercel project
- [ ] Disconnected Railway GitHub auto-deploy (already done — do not re-enable)
- [ ] Pushed a commit to `develop` and verified the staging pipeline runs end-to-end

