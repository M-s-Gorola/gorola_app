# One-time database seed (Railway Postgres)

Use this when the **Railway** PostgreSQL database exists but has **no catalog data** (stores, categories, sample products, feature flags). This runs the Prisma seed script once from your machine against the **live** remote database.

**What it is not:** This does not replace CI. GitHub Actions uses a **temporary** Postgres on the runner. This doc is only for **manual, one-off seeding** of Railway so you can exercise the buyer flow against real API + DB.

---

## Prerequisites

1. **Repo installed:** from the monorepo root (`GoRola_app`): `pnpm install`.
2. **Railway Postgres reachable from your PC:** enable **public networking** (or use the connection string Railway documents for **external** / TCP access). Your laptop cannot use the purely **internal** hostname.
3. **Migrations already applied** on that database. The API’s start command runs `prisma migrate deploy` on deploy; if the DB was never deployed against, running migrate below fixes schema first.

---

## Environment variables (`apps/api/.env`)

The Prisma CLI runs with working directory **`apps/api`**, so it loads **`GoRola_app/apps/api/.env`**. Define at least:

| Variable       | Purpose |
|----------------|---------|
| `DATABASE_URL` | Railway **public** Postgres URL (paste from Railway → Postgres → *Variables* / *Connect*). |
| `DIRECT_URL`   | Same value as **`DATABASE_URL`** when you use a **single direct** connection (no separate pooler). Prisma requires both; see `prisma/schema.prisma`. |

**Example shape (never commit real URLs):**

```env
DATABASE_URL="postgresql://…"
DIRECT_URL="postgresql://…"
```

Use the **`DATABASE_PUBLIC_URL`** (or equivalent **public**) string Railway exposes—**not** the internal-only URL—so `migrate`/`seed` from your machine can connect.

Optional: mirror the same `DATABASE_URL` / `DIRECT_URL` in the monorepo root **`GoRola_app/.env`** so `pnpm dev` for the API and seed stay aligned; the loader in `apps/api/src/config/env.ts` reads **root** `.env` at runtime.

**Security:** `.env` files must stay **out of git** (they are ignored). Rotate the DB password if a URL ever leaks.

---

## Commands (run from monorepo root)

### 1. Main Catalog Seed
Runs `apps/api/prisma/seed.ts` (Stores, Categories, and a small sample of products).
```bash
pnpm --filter @gorola/api exec prisma migrate deploy
pnpm --filter @gorola/api prisma:seed
```

### 2. Specialized Medical Tests Seed
Runs `apps/api/prisma/seed-medical-tests.ts` (Adds the 75+ diagnostic tests for manual verification).
```bash
pnpm --filter @gorola/api exec tsx prisma/seed-medical-tests.ts
```

Note: The **`prisma:seed`** command only covers the basic catalog. You must run the second command specifically to populate the large "Medical tests" inventory. You should see a **`Successfully seeded 75 medical tests`** log on success.

Equivalent root script for seed only:

```bash
pnpm db:local:seed
```

(`db:local:seed` still uses whichever `DATABASE_URL` / `DIRECT_URL` Prisma resolves—typically from **`apps/api/.env`** for CLI.)

---

## After seeding

1. Ensure the **buyer web** uses the deployed API base URL (e.g. Vercel **`VITE_API_BASE_URL`**), not localhost, when testing against Railway data.
2. Re-running seed may behave differently per table ( **`upsert`** vs **`createMany`** with `skipDuplicates` ). Treat the first successful run as the main goal; troubleshoot duplicate errors separately if you re-seed often.

---

## Reference

| Item | Location |
|------|----------|
| Seed logic | `apps/api/prisma/seed.ts` |
| Package script | `"prisma:seed": "tsx prisma/seed.ts"` in `apps/api/package.json` |
| Env contract | `.env.example` at monorepo root |

---

## Quick checklist

- [ ] Public Railway Postgres URL copied (not internal-only).
- [ ] `DATABASE_URL` and `DIRECT_URL` set in **`apps/api/.env`** (same public URL unless you use a split pool/direct setup).
- [ ] `pnpm --filter @gorola/api exec prisma migrate deploy`
- [ ] `pnpm --filter @gorola/api prisma:seed`
