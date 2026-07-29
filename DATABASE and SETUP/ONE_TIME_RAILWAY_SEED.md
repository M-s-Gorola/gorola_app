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

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Railway **public** Postgres URL (`app_service` DML role or `db_owner` role). |
| `DIRECT_URL` / `MIGRATION_DATABASE_URL` | Railway **public** Postgres URL (`db_owner` DDL owner role). Required for `prisma migrate deploy` and administrative seeding. |

**Example shape (never commit real URLs):**

```env
DATABASE_URL="postgresql://app_service:password@<host>:<port>/railway"
DIRECT_URL="postgresql://db_owner:password@<host>:<port>/railway"
MIGRATION_DATABASE_URL="postgresql://db_owner:password@<host>:<port>/railway"
```

> [!NOTE]
> **PII Encryption at Rest (DPDP Compliance)**: `prisma/seed.ts` automatically encrypts phone numbers (`encryptPII`) and generates HMAC-SHA256 blind indices (`hashPII`) for seeded riders and buyers, ensuring sample data conforms to DPDP Act Section 8.1 standards.


---

## Commands (run from monorepo root)

### 1. Troubleshooting Migration Conflicts (Schema Changes vs. Existing Data)

If `pnpm --filter @gorola/api exec prisma migrate deploy` fails with database error code `23502` (e.g., `column "storeId" of relation "Discount" contains null values` because a new required column is being added to a table containing legacy data), choose one of the following recovery options:

* **Option A: Clear only the conflicting table (Preserves other data)**:
  Truncate the problematic table to clean out the legacy rows:
  - **Bash / Linux / macOS:**
    ```bash
    echo 'TRUNCATE TABLE "Discount" CASCADE;' | pnpm --filter @gorola/api exec prisma db execute --stdin
    ```
  - **PowerShell (Windows):**
    ```powershell
    "TRUNCATE TABLE `"Discount`" CASCADE;" | pnpm --filter @gorola/api exec prisma db execute --stdin
    ```

* **Option B: Reset the entire database (Wipes all data — Railway)**:

  > [!CAUTION]
  > **`prisma migrate reset` no longer works for Railway** after the `db_owner` / `app_service` role separation.
  > Previously (when `apps/api/.env` pointed directly to the `postgres` superuser URL), swapping the `.env` to Railway and running `prisma migrate reset` worked because `postgres` owns the `railway` database and has `DROPDB` rights. Now, `db_owner` has `CREATEDB` but does **not** own the `railway` database — Railway's infrastructure created it — so `DROP DATABASE` is refused.
  >
  > **Use the full truncate approach instead** (see *Truncate Railway Database* section below):
  > 1. Truncate all tables via Docker psql → Railway public URL.
  > 2. Re-apply any pending migrations: `pnpm --filter @gorola/api exec prisma migrate deploy` (with `MIGRATION_DATABASE_URL` exported).
  > 3. Re-seed: `pnpm --filter @gorola/api prisma:seed` (with `DATABASE_URL` exported pointing to Railway).

Once cleared (using Option A), run the migration command below.

### 2. Main Catalog Seed
Runs `apps/api/prisma/seed.ts` (Stores, Categories, and a small sample of products).
```bash
pnpm --filter @gorola/api exec prisma migrate deploy
pnpm --filter @gorola/api prisma:seed
```

### 3. Specialized Medical Tests Seed
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

## Truncate Railway Database (Data-Only Reset)

Use this when you want to **wipe all row data on Railway** but keep the schema and migrations intact.

> [!CAUTION]
> # ⚠️ DESTRUCTIVE — ALL RAILWAY DATA WILL BE PERMANENTLY DELETED
> This command **immediately and irreversibly wipes every row** from the live Railway database. There is no undo and no backup unless you made one manually.
> - **Never run `pnpm --filter @gorola/api exec prisma migrate reset` against Railway** — that command tries to `DROP DATABASE` which Railway does not allow for `db_owner`, and could corrupt the database state.
> - The truncate commands below are the only safe data-reset method for Railway.
> - `psql` is likely not installed locally. Use the `psql` client **inside your already-running local Docker container** — it can connect to Railway's public URL externally.
> - Must run as `postgres` superuser — `app_service` does not have `TRUNCATE` privilege by design.

**Step 1 — Truncate all tables (keeps schema & migration history):**
```bash
docker exec -i gorola-postgres psql "postgresql://postgres:<RAILWAY_POSTGRES_PASSWORD>@<RAILWAY_HOST>:<RAILWAY_PORT>/railway" -c "DO \$\$ DECLARE r RECORD; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations' LOOP EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END \$\$;"
```

Replace `<RAILWAY_POSTGRES_PASSWORD>`, `<RAILWAY_HOST>`, and `<RAILWAY_PORT>` with the values from your Railway PostgreSQL service → **Connect** tab → Public URL.

**Step 2 — Re-seed catalog data:**
```bash
# Set DATABASE_URL to Railway (app_service or db_owner) — use export to avoid .env override
export DATABASE_URL="postgresql://app_service:<APP_SERVICE_PASSWORD>@<RAILWAY_HOST>:<RAILWAY_PORT>/railway"
pnpm --filter @gorola/api prisma:seed
unset DATABASE_URL
```

**Step 3 (optional) — Re-seed medical tests:**
```bash
export DATABASE_URL="postgresql://app_service:<APP_SERVICE_PASSWORD>@<RAILWAY_HOST>:<RAILWAY_PORT>/railway"
pnpm --filter @gorola/api exec tsx prisma/seed-medical-tests.ts
unset DATABASE_URL
```

---

## Quick checklist

- [ ] Public Railway Postgres URL copied (not internal-only).
- [ ] `DATABASE_URL` and `DIRECT_URL` set in **`apps/api/.env`** (same public URL unless you use a split pool/direct setup).
- [ ] `pnpm --filter @gorola/api exec prisma migrate deploy`
- [ ] `pnpm --filter @gorola/api prisma:seed`
