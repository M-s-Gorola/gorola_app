# GoRola Local Setup Guide

This guide will help you set up the GoRola monorepo on your local machine using Docker for infrastructure (PostgreSQL & Redis).

## 1. Prerequisites

- **Node.js**: Version 22 or higher.
- **pnpm**: Version 10 or higher (`npm install -g pnpm`).
- **Docker**: For running the database and cache.

---

## 2. Infrastructure (Docker)

Run the following commands to start the required services in the background:

### Redis
```powershell
docker run -d --name gorola-redis -p 6379:6379 redis:7
```

### PostgreSQL
```powershell
docker run -d --name gorola-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gorola_dev -p 5432:5432 postgres:15
```

> [!TIP]
> **Database Credentials**: 
> - **User**: `postgres`
> - **Password**: `postgres`
> - **Database**: `gorola_dev`
> - **Host**: `localhost`
> - **Port**: `5432`

### 2.1 Database Least-Privilege Role Setup (DPDP Compliance)
To comply with DPDP Act Sec 8(5) least-privilege security, application connections must use `app_service` (DML only) while migrations use `db_owner` (DDL owner).

Run these `docker exec` commands to set up the roles on both `gorola_dev` and `gorola_test`:

```powershell
# 1. Set up roles on development database (gorola_dev)
docker exec -i gorola-postgres psql -U postgres -d gorola_dev -c "CREATE ROLE db_owner WITH LOGIN CREATEDB PASSWORD 'postgres_owner_123'; GRANT ALL PRIVILEGES ON DATABASE gorola_dev TO db_owner; GRANT ALL ON SCHEMA public TO db_owner; ALTER SCHEMA public OWNER TO db_owner; CREATE ROLE app_service WITH LOGIN PASSWORD 'postgres_app_123'; GRANT CONNECT ON DATABASE gorola_dev TO app_service; GRANT USAGE ON SCHEMA public TO app_service; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_service; ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service; ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO app_service;"

# 2. Set up permissions on test database (gorola_test)
docker exec -i gorola-postgres psql -U postgres -d gorola_test -c "GRANT ALL PRIVILEGES ON DATABASE gorola_test TO db_owner; GRANT ALL ON SCHEMA public TO db_owner; ALTER SCHEMA public OWNER TO db_owner; GRANT CONNECT ON DATABASE gorola_test TO app_service; GRANT USAGE ON SCHEMA public TO app_service; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_service; ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service; ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO app_service;"
```

> [!IMPORTANT]
> **`CREATEDB` is required for `db_owner`**: `prisma migrate dev` creates a temporary shadow database (a whole new PostgreSQL database, not just a table) to safely calculate migration diffs. `db_owner` must have the `CREATEDB` privilege for this to work. On PostgreSQL 15+, `GRANT ALL ON SCHEMA public` and `ALTER SCHEMA public OWNER TO db_owner` are also required — the public schema no longer grants `CREATE` by default.

> [!TIP]
> **`db_owner` already exists without `CREATEDB`?** If you ran an older version of this setup (or set up roles manually without `CREATEDB`), migrations will fail with `P3014`. Fix it with a single command — no need to recreate the container:
> ```powershell
> docker exec gorola-postgres psql -U postgres -c "ALTER ROLE db_owner CREATEDB;"
> ```

#### Remote Railway Database Role Setup
> ⚠️ Note: Railway's Web UI Query bar automatically appends `LIMIT 500` to all input, which causes `syntax error at or near "LIMIT"` on `GRANT` / `DO $$` statements.
> Where to find `<RAILWAY_POSTGRES_PUBLIC_URL>`: Log into Railway → Open your **PostgreSQL Service** → Click **Connect** (or **Variables** tab) → Copy the Public Connection URL.
> To configure remote Railway databases safely without committing secrets to Git, run the setup script passing URL and passwords as CLI arguments:

```bash
pnpm --filter @gorola/api setup:railway:roles \
  "<RAILWAY_POSTGRES_PUBLIC_URL>" \
  "<DB_OWNER_PASSWORD>" \
  "<APP_SERVICE_PASSWORD>"
```




## 3. Environment Variables

All `.env.example` files are pre-configured with the correct default values for local development (database roles, Redis, encryption keys, DPDP age gate settings, and offline Leaflet maps). You can copy the three example files directly into place:

```powershell
# Copy all 3 environment files from the project root:
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

> [!TIP]
> **Pre-Configured Defaults**: The default values in `.env.example` match the Docker database role setup in Section 2, so no manual edits to connection strings, encryption keys, or ports are required for local development.

> [!IMPORTANT]
> **Enable Dummy OTP for Local Development & Testing (`GOROLA_DUMMY_OTP`)**:
> In the root `.env` (or `apps/api/.env`), make sure `GOROLA_DUMMY_OTP` is **uncommented** for local development and manual testing:
> ```env
> GOROLA_DUMMY_OTP=123456
> ```
> This allows you to log in as any buyer by typing OTP `123456` without needing a live Fast2SMS/Exotel gateway.

### Optional Configurations:

#### JWT RS256 Keys *(Optional for local dev, Required for production)*
In local development, the API automatically generates ephemeral RSA keys if left blank. However, if you want persistent keys, generate a 2048-bit RSA pair:
```powershell
node -e "const crypto = require('crypto'); const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, modulusLength: 2048 }); console.log('JWT_PRIVATE_KEY:\n' + privateKey); console.log('JWT_PUBLIC_KEY:\n' + publicKey);"
```
Paste the multiline PEM output into `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` in `.env`.

> [!IMPORTANT]
> In production/PaaS environments (like Railway), `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` are **mandatory**. Missing JWT keys in production will cause the API startup to fail.


---

## 4. Installation & Setup

Run these commands from the `GoRola_app` root:

1.  **Install dependencies**:
    ```powershell
    pnpm install
    ```
2.  **Generate Prisma client**:
    ```powershell
    pnpm --filter @gorola/api prisma:generate
    ```
3.  **Apply migrations**:
    ```powershell
    pnpm --filter @gorola/api prisma:migrate:dev --name init
    ```
4.  **Seed data**:
    ```powershell
    pnpm --filter @gorola/api prisma:seed
    ```
5.  **Build shared packages**:
    ```powershell
    pnpm --filter @gorola/shared build
    ```

---

## 5. Setting Up the Test Database (Mandatory for E2E)

The Quality Gate (`pnpm ci:quality`) and E2E tests run against a separate isolated database (`gorola_test`) to prevent data corruption in your dev environment.

1.  **Create the test database** (if not already existing in Docker):
    ```powershell
    docker exec -it gorola-postgres psql -U postgres -c "CREATE DATABASE gorola_test;"
    ```
1b. **Grant Least-Privilege Roles on Test DB** (DPDP Compliance):
    ```powershell
    docker exec -i gorola-postgres psql -U postgres -d gorola_test -c "GRANT ALL PRIVILEGES ON DATABASE gorola_test TO db_owner; GRANT ALL ON SCHEMA public TO db_owner; ALTER SCHEMA public OWNER TO db_owner; GRANT CONNECT ON DATABASE gorola_test TO app_service; GRANT USAGE ON SCHEMA public TO app_service; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_service; ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service; ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO app_service;"
    ```

    > [!IMPORTANT]
    > **PostgreSQL 15+ Requirement**: PostgreSQL 15 removed the default `CREATE` privilege on the `public` schema. The `GRANT ALL ON SCHEMA public TO db_owner` and `ALTER SCHEMA public OWNER TO db_owner` commands above are required so `db_owner` can create and alter tables during `prisma migrate dev` (shadow database creation). Without these, migrations fail with `permission denied for schema public`.

    > [!IMPORTANT]
    > **`FOR ROLE db_owner` is critical in `ALTER DEFAULT PRIVILEGES`**: Tables are created by `db_owner` during migrations. Without `FOR ROLE db_owner`, the auto-grant only fires for tables created by `postgres`, so `app_service` gets no access to migrated tables and seeding/queries fail with `permission denied for table`.
2.  **Initialize and Seed the Test DB**:

    ```powershell
    pnpm db:test:prepare
    ```
    *This runs the cross-platform bootstrap script that auto-migrates and double-seeds (Catalog + E2E) the test database.*

---

## 6. Running the Application

### Start the Backend (API)
```powershell
pnpm --filter @gorola/api dev
```
*(If `dev` is not defined, use `pnpm --filter @gorola/api start`)*

### Start the Frontend (Web)
```powershell
pnpm --filter @gorola/web dev
```

The app will be available at:
- **Frontend**: http://localhost:5180
- **API**: http://localhost:3001

---

## 7. Database Management (Prisma Studio)

To view and edit your local database data via GUI with administrative privileges, run:

```powershell
pnpm --filter @gorola/api prisma:studio
```
*(This automatically connects Prisma Studio using `DIRECT_URL` / `db_owner` credentials, giving full read/write management access to all tables).*


### Common Development Uses:
- **Testing Order States**: Manually change an order's `status` to `DELIVERED` to trigger the Feedback/Rating UI.
- **Manual Verification**: Mark a new user as `isVerified: true` if you want to skip OTP flows during testing.
- **Stock Tracking**: Check `stockQty` in `ProductVariant` after placing or cancelling orders to verify stock logic.
- **Data Cleanup**: Quickly delete test orders or addresses without resetting the whole database.
- **Feature Flags**: Toggle system-wide flags in the `FeatureFlag` table (e.g., enabling/disabling payment methods).

---

### 7.1 Truncate Database (Data-Only Reset)

> [!CAUTION]
> # ⚠️ DESTRUCTIVE — ALL DATA WILL BE PERMANENTLY DELETED
> This command **immediately and irreversibly wipes every row** from every table in the target database. There is no undo. Use only when you intentionally want a clean slate.
> - **Only use this on dev/test databases. Never point at Railway production unless you are 100% certain.**
> - If you want a full schema + data reset locally, use `pnpm --filter @gorola/api exec prisma migrate reset` instead (drops DB, re-applies all migrations, and auto-seeds).
> - Must run as `postgres` superuser — `app_service` does not have `TRUNCATE` privilege by design.

**Dev DB (`gorola_dev`):**
```powershell
docker exec -i gorola-postgres psql -U postgres -d gorola_dev -c "DO \$\$ DECLARE r RECORD; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations' LOOP EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END \$\$;"
```

**Test DB (`gorola_test`):**
```powershell
docker exec -i gorola-postgres psql -U postgres -d gorola_test -c "DO \$\$ DECLARE r RECORD; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations' LOOP EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END \$\$;"
```

After truncating the dev DB, re-seed:
```powershell
pnpm --filter @gorola/api prisma:seed
```

After truncating the test DB, re-bootstrap:
```powershell
pnpm db:test:prepare
```

---

## 8. Alternative: Using Docker Compose
If you prefer, you can create a `docker-compose.yml` in the root and run `docker-compose up -d` to start both services at once:

```yaml
services:
  postgres:
    image: postgres:15
    container_name: gorola-postgres
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: gorola_dev
    ports:
      - "5432:5432"
  redis:
    image: redis:7
    container_name: gorola-redis
    ports:
      - "6379:6379"
```
