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

GoRola - Infrastructure as Code.
