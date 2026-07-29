# PostgreSQL Least-Privilege Role Setup: Common Gotchas & Lessons

> **Applicability:** Any project using PostgreSQL (Railway, RDS, Supabase, self-hosted) that separates a DDL migration role from a DML application role.
> **Prisma-specific sections are marked.** The core PostgreSQL concepts apply universally.

---

## Context

A security best practice (and legal requirement under frameworks like India''s DPDP Act Sec 8(5)) is to run your application with a **restricted database user** (`app_service`) that can only execute DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), while a separate **DDL owner** (`db_owner`) handles schema migrations. This prevents SQL injection from causing structural damage (`DROP TABLE`, `ALTER TABLE`, etc.).

Setting this up sounds straightforward but has several non-obvious failure modes, especially when the database already has objects created by a superuser.

---

## Failure Mode 1: Missing `CREATEDB` on the Migration Role

### Symptom
```
Error: P3014
Prisma Migrate could not create the shadow database.
Original error: ERROR: permission denied to create database
```

### Root Cause
Prisma''s `migrate dev` command creates a **temporary shadow database** — an entire new PostgreSQL database (not just a table) — to safely calculate migration diffs. This requires the `CREATEDB` privilege on the role running the migration.

`CREATEDB` is a **role-level attribute** (global to the PostgreSQL instance). Granting it is separate from any database- or schema-level grants.

### Fix
```sql
-- When creating the role:
CREATE ROLE db_owner WITH LOGIN CREATEDB PASSWORD 'your_password';

-- If the role already exists without CREATEDB:
ALTER ROLE db_owner CREATEDB;
```

### Key Facts
- `CREATEDB` is **global** — you only need to grant it once, not per-database.
- Only affects `prisma migrate dev` (which creates a shadow DB). `prisma migrate deploy` (production) does not create a shadow DB.
- `app_service` should NEVER have `CREATEDB`.

---

## Failure Mode 2: PostgreSQL 15 Revoked Default `CREATE` on `public` Schema

### Symptom
```
Error: permission denied for schema public
```

### Root Cause
PostgreSQL 15 removed the default `CREATE` privilege on the `public` schema that all prior versions granted automatically. Before PG15, any logged-in user could create tables in `public`. After PG15, you must explicitly grant it.

### Fix
```sql
GRANT ALL ON SCHEMA public TO db_owner;
ALTER SCHEMA public OWNER TO db_owner;
```

Both commands are needed:
- `GRANT ALL ON SCHEMA public` gives `db_owner` the ability to create objects.
- `ALTER SCHEMA public OWNER TO db_owner` makes `db_owner` the schema owner, which is required for certain DDL operations.

> **GoRola example:** All local dev setup and Railway setup failed with this error until these two lines were added to every role setup script and doc.

---

## Failure Mode 3: `ALTER DEFAULT PRIVILEGES` Missing `FOR ROLE`

### Symptom
```
Error: permission denied for table Store  (or any application table)
```
This occurs **after** migrations succeed — seeding or API queries fail on tables that look like they should be accessible.

### Root Cause
`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ... TO app_service` sets up **auto-grants** for future tables. But critically: it only auto-grants for tables created by **the current user executing the command** (typically `postgres`).

Since migrations create tables as `db_owner`, the auto-grant never fires — `app_service` gets no access to any migrated table.

### Fix
```sql
-- Wrong: auto-grants for tables created by postgres only
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service;

-- Correct: auto-grants for tables created by db_owner
ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service;
ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public
  GRANT ALL ON SEQUENCES TO app_service;
```

The `FOR ROLE db_owner` clause is the critical difference.

---

## Failure Mode 4: Pre-Existing Tables Owned by Superuser Block `db_owner`

### Symptom
```
Error: permission denied for table _prisma_migrations
Error: must be owner of table DeliveryRider
```
This occurs on a database that already had migrations applied by a superuser (`postgres`) before the least-privilege roles were set up.

### Root Cause
`ALTER SCHEMA public OWNER TO db_owner` transfers ownership of the **schema object** itself. It does **not** cascade to tables, sequences, or views already inside that schema. Each object retains whatever owner created it.

### Fix — Transfer ALL existing tables to `db_owner`

Run as a superuser (e.g., `postgres`):

```sql
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO db_owner';
  END LOOP;
END $$;
```

Safe to run on a fresh database — the loop finds nothing and is a no-op.

> **GoRola example:** `_prisma_migrations` and all application tables (`DeliveryRider`, `User`, etc.) were created by `postgres` during the initial Railway deploy. Switching to `db_owner` for CI/CD migrations failed on each table in sequence. The ownership loop was added to `setup-railway-roles.cjs` so re-running the script covers this automatically.

---

## Failure Mode 5: Stuck Failed Migration Record (P3009)

### Symptom
```
Error: P3009
migrate found failed migrations in the target database.
The `20260729192300_init` migration started at 2026-07-29 21:25:20 UTC failed.
```

### Root Cause
When `prisma migrate deploy` starts applying a migration and fails midway (e.g., due to a permissions error), it writes a row to `_prisma_migrations` with no `finished_at` timestamp — marking it as "failed". On subsequent runs, Prisma detects this and **refuses to apply any new migrations** until the failed state is resolved.

### Fix
```bash
# Use export — inline KEY=value can be overridden by Prisma .env loading on Windows
export DATABASE_URL="postgresql://db_owner:password@host:port/dbname"
export DIRECT_URL="postgresql://db_owner:password@host:port/dbname"

prisma migrate resolve --applied <migration_name>

# Restore local env vars
unset DATABASE_URL DIRECT_URL
```

> Use `--applied` if the migration actually succeeded (just recorded incorrectly). Use `--rolled-back` if it was intentionally reverted.

---

## Failure Mode 6: Inline `KEY=value` Env Var Overridden by `.env` File

### Symptom
The command runs against the wrong database (e.g., local instead of production). Prisma output shows a different datasource than expected.

### Root Cause
Prisma CLI loads `.env` automatically. On Windows with Git Bash + pnpm, inline `KEY=value pnpm exec ...` syntax can be overridden because `pnpm exec` spawns a subprocess through Node, and Prisma''s dotenv loading may overwrite the shell-level inline var.

### Fix
```bash
# Git Bash / Linux / macOS
export DATABASE_URL="postgresql://..."
export DIRECT_URL="postgresql://..."
pnpm exec prisma migrate resolve --applied my_migration
unset DATABASE_URL DIRECT_URL

# PowerShell (Windows)
$env:DATABASE_URL = "postgresql://..."
$env:DIRECT_URL = "postgresql://..."
pnpm exec prisma migrate resolve --applied my_migration
Remove-Item Env:DATABASE_URL, Env:DIRECT_URL
```

---

## Complete Role Setup SQL Template

```sql
-- 1. Create db_owner (DDL migration role)
CREATE ROLE db_owner WITH LOGIN CREATEDB PASSWORD 'strong_owner_password';
GRANT ALL PRIVILEGES ON DATABASE your_database TO db_owner;

-- 2. PostgreSQL 15+ schema public fix
GRANT ALL ON SCHEMA public TO db_owner;
ALTER SCHEMA public OWNER TO db_owner;

-- 3. Transfer ownership of ALL existing tables to db_owner (idempotent)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO db_owner';
  END LOOP;
END $$;

-- 4. Create app_service (DML-only runtime role)
CREATE ROLE app_service WITH LOGIN PASSWORD 'strong_app_password';
GRANT CONNECT ON DATABASE your_database TO app_service;
GRANT USAGE ON SCHEMA public TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_service;

-- 5. Auto-grant on future tables created by db_owner during migrations
ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service;
ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public
  GRANT ALL ON SEQUENCES TO app_service;
```

---

## CI/CD Checklist (GitHub Actions + pnpm)

Before running `prisma migrate deploy` in a GitHub Actions job:

- [ ] Install pnpm: `pnpm/action-setup@v4` (NOT pre-installed on runners)
- [ ] Install Node: `actions/setup-node@v4` with `cache: pnpm`
- [ ] Install deps: `pnpm install --frozen-lockfile --prefer-offline` (prisma is a devDependency)
- [ ] Set `DATABASE_URL` and `DIRECT_URL` to `MIGRATION_DATABASE_URL` (db_owner credentials)
- [ ] Store `MIGRATION_DATABASE_URL` as a GitHub Actions **environment** secret (not repo secret — so staging vs production use different DB credentials)

Without `pnpm install`, the runner fails with `pnpm: command not found` (exit 127).

---

## Recovery Cheat Sheet

| Symptom | Fix |
|---|---|
| `P3014: permission denied to create database` | `ALTER ROLE db_owner CREATEDB;` |
| `permission denied for schema public` | `GRANT ALL ON SCHEMA public TO db_owner; ALTER SCHEMA public OWNER TO db_owner;` |
| `permission denied for table Store` (seeding/queries) | Re-run role setup with `ALTER DEFAULT PRIVILEGES FOR ROLE db_owner ...` |
| `must be owner of table X` (migration ALTER) | Run the ownership loop to transfer all tables to db_owner |
| `permission denied for table _prisma_migrations` | Run the ownership loop (same fix as above) |
| `P3009: failed migration found` | `prisma migrate resolve --applied <migration_name>` (as db_owner) |
| `pnpm: command not found` in CI (exit 127) | Add pnpm/action-setup + setup-node + pnpm install steps |
| Inline `KEY=value pnpm exec` hits wrong DB | Use `export KEY=value` (bash) or `$env:KEY=value` (PowerShell) |
