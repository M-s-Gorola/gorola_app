# Deployment Configuration & Architecture Guide

This document explains the technical configuration of the GoRola deployment pipeline, including the purpose of specific config files and platform-level settings.

> [!TIP]
> For instructions on setting up GitHub Secrets and Environments, see the **[Secrets & Environment Setup Guide](../.github/workflows/SECRETS.md)**.

---

## 1. Disabling Platform Git Autodeploy

To ensure that only our GitHub Actions CI/CD pipeline triggers deployments, we intentionally disable the native "push-to-deploy" features of Vercel and Railway.

| Platform    | How to disable                                                                                                                                                                                                    | "As Code" implementation                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Vercel**  | Project → **Settings** → _Build and Deployment_ → **Ignored build step** → **Behavior: Don’t build anything** (command: `exit 0`).                                                                                | Root `vercel.json` includes `"git": { "deploymentEnabled": false }`.                                     |
| **Railway** | API service → **Settings** → **Source** (or **Git**): **Disconnect** the GitHub repository. New commits will no longer trigger automatic builds.                                                                 | Not available in `railway.toml`. Disconnection is a platform-level setting.                              |

---

## 2. Monorepo Root Directory

**CRITICAL:** Both Vercel and Railway must have their **Root Directory** set to the repository root (`GoRola_app`), NOT a sub-folder like `apps/api`.
- This allows `pnpm` to resolve the workspace-wide lockfile and shared packages (`@gorola/shared`, etc.).
- Build commands use `--filter` to target specific apps while including all necessary dependencies.

---

## 3. Configuration Files Breakdown

### Vercel (`vercel.json`)
Controls the deployment of the buyer web app.
- `installCommand`: `pnpm install` (installs workspace dependencies).
- `buildCommand`: Builds shared packages first, then the web app.
- `outputDirectory`: Points to `apps/web/dist` (the result of the Vite build).

### Railway (`railway.toml`)
Controls the deployment of the Fastify API.
- `[build].builder`: Set to `NIXPACKS`.
- `[build].buildCommand`: Installs dependencies and builds the shared package + API.
- `[deploy].startCommand`: Runs `pnpm --filter @gorola/api start`.

### Node Environment (`nixpacks.toml` & `Procfile`)
- `nixpacks.toml`: Pins the Node version to `22` for Railway’s Nixpacks builder.
- `Procfile`: Explicitly defines the `web` process to ensure Railway starts the server correctly.

---

## 4. Production Runtime Behavior

### Prisma Migrations
The API's start command (in `apps/api/package.json`) is:
```bash
"start": "prisma migrate deploy && node dist/app.js"
```
This ensures that every deployment automatically applies any new database migrations before the server starts.

### CORS Policy
The `CORS_ALLOWED_ORIGINS` variable on the API must include:
1. Your production Vercel domain.
2. Your Vercel Preview/Staging domains (if testing against the production API).
This prevents the browser from blocking requests from the frontend to the backend.

---

## 5. Deployment CLI Logic

Our GitHub Actions use CLI tools rather than raw API calls for better reliability:
- **Vercel**: Uses `npx vercel deploy --prod`. This uploads the monorepo and triggers the build on Vercel using the local `vercel.json`.
- **Railway**: Uses `npx @railway/cli@latest up --ci`. This uploads the checked-out monorepo. Build runs on Railway using Nixpacks.
- **Why not GraphQL?**: Using the CLI tools provides better logging in GitHub Actions and ensures the deployment reflects the current state of the checked-out code exactly.

---

## 6. CI/CD Filtering Logic (`paths-filter`)

To optimize build times and prevent unnecessary deployments, our GitHub Actions use `dorny/paths-filter`. This ensures that:
- **Vercel** only redeploys when `apps/web` or shared dependencies change.
- **Railway** only redeploys when `apps/api` or shared dependencies change.
- **Shared changes** (like `packages/shared` or the lockfile) trigger both deployments.

This logic is defined in `.github/workflows/paths.yml` and utilized by the `staging.yml` and `production.yml` workflows.

---

## 7. App Scripts Reference (`apps/api`)

The following scripts are used by the deployment pipeline:
- `build`: `prisma generate && tsc -p tsconfig.json`
- `start`: `prisma migrate deploy && node dist/app.js`

---

---

## 8. Railway Least-Privilege Database Role Setup (DPDP Act Compliance)

To satisfy DPDP Act 2023 Sec 8(5) least-privilege security requirements, the production Railway PostgreSQL instance must use two distinct database roles:

### Step 1: Execute Role Setup SQL in Railway Query Editor
Log into Railway → Open your PostgreSQL Service → Open **Data / Query Editor** (or connect via `psql`) and run:

```sql
-- 1. Create db_owner role (DDL owner for migrations)
CREATE ROLE db_owner WITH LOGIN PASSWORD 'your_secure_owner_password';
GRANT ALL PRIVILEGES ON DATABASE railway TO db_owner;

-- 2. Create app_service role (DML restricted role for API runtime)
CREATE ROLE app_service WITH LOGIN PASSWORD 'your_secure_app_password';
GRANT CONNECT ON DATABASE railway TO app_service;
GRANT USAGE ON SCHEMA public TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_service;
```

### Step 2: Configure Railway Environment Variables
In Railway → API Service → **Variables**, set:

```env
# Runtime API connection (app_service DML role)
DATABASE_URL="postgresql://app_service:your_secure_app_password@<host>:<port>/railway"

# Migration & Direct connection (db_owner DDL role)
DIRECT_URL="postgresql://db_owner:your_secure_owner_password@<host>:<port>/railway"
MIGRATION_DATABASE_URL="postgresql://db_owner:your_secure_owner_password@<host>:<port>/railway"
```

### Step 3: Configure GitHub Actions Secrets for Migration Pipeline
In GitHub → Repository **Settings** → **Secrets and variables** → **Actions** (or Environment Secrets):
1. Add a secret named **`MIGRATION_DATABASE_URL`** containing the `db_owner` DDL connection string:
   `postgresql://db_owner:your_secure_owner_password@<public_host>:<port>/railway`
2. In deployment workflows (`.github/workflows/deploy-railway.yml` or API startup scripts), ensure `prisma migrate deploy` executes with `MIGRATION_DATABASE_URL` / `db_owner` permissions:

```yaml
- name: Deploy Database Migrations
  env:
    DATABASE_URL: ${{ secrets.MIGRATION_DATABASE_URL }}
    MIGRATION_DATABASE_URL: ${{ secrets.MIGRATION_DATABASE_URL }}
  run: pnpm --filter @gorola/api prisma migrate deploy
```

---

GoRola - Infrastructure as Code.


