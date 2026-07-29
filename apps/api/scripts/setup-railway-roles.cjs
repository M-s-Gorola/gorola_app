/**
 * Script to execute Railway PostgreSQL role creation and least-privilege GRANTs
 * directly via Prisma Client ($executeRawUnsafe).
 *
 * Usage:
 *   node ./scripts/setup-railway-roles.cjs "<RAILWAY_POSTGRES_PUBLIC_URL>" "[DB_OWNER_PASSWORD]" "[APP_SERVICE_PASSWORD]"
 *   OR via environment variables:
 *   DB_OWNER_PASSWORD="..." APP_SERVICE_PASSWORD="..." node ./scripts/setup-railway-roles.cjs "<URL>"
 */
const { PrismaClient } = require("@prisma/client");

const targetUrl = process.argv[2] || process.env.TARGET_DB_URL || process.env.DATABASE_URL;
if (!targetUrl) {
  console.error("Usage: node ./scripts/setup-railway-roles.cjs <RAILWAY_POSTGRES_PUBLIC_URL> [DB_OWNER_PASSWORD] [APP_SERVICE_PASSWORD]");
  process.exit(1);
}

const dbOwnerPassword = process.argv[3] || process.env.DB_OWNER_PASSWORD;
const appServicePassword = process.argv[4] || process.env.APP_SERVICE_PASSWORD;

if (!dbOwnerPassword || !appServicePassword) {
  console.error("Error: DB_OWNER_PASSWORD and APP_SERVICE_PASSWORD must be provided as arguments or env variables.");
  console.error("Example: pnpm --filter @gorola/api setup:railway:roles \"<URL>\" \"<DB_OWNER_PASS>\" \"<APP_SERVICE_PASS>\"");
  process.exit(1);
}

// Escape single quotes for SQL insertion
const escapedOwnerPass = dbOwnerPassword.replace(/'/g, "''");
const escapedAppPass = appServicePassword.replace(/'/g, "''");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetUrl
    }
  }
});

async function main() {
  console.log("Connecting to PostgreSQL database...");

  const queries = [
    // CREATEDB is required: `prisma migrate dev` creates a temporary shadow database
    // (a whole new PostgreSQL database) to diff migrations. Without CREATEDB this fails with P3014.
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'db_owner') THEN CREATE ROLE db_owner WITH LOGIN CREATEDB PASSWORD '${escapedOwnerPass}'; ELSE ALTER ROLE db_owner WITH LOGIN CREATEDB PASSWORD '${escapedOwnerPass}'; END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_service') THEN CREATE ROLE app_service WITH LOGIN PASSWORD '${escapedAppPass}'; ELSE ALTER ROLE app_service WITH PASSWORD '${escapedAppPass}'; END IF; END $$;`,
    `GRANT ALL PRIVILEGES ON DATABASE railway TO db_owner`,
    // PostgreSQL 15+ removed the default CREATE privilege on the public schema.
    // Without these, `prisma migrate dev` fails with "permission denied for schema public".
    `GRANT ALL ON SCHEMA public TO db_owner`,
    `ALTER SCHEMA public OWNER TO db_owner`,
    // Transfer ownership of _prisma_migrations if it already exists (created by postgres on a
    // previous deploy). db_owner cannot read/write it otherwise → "permission denied for table _prisma_migrations".
    `DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations') THEN EXECUTE 'ALTER TABLE public._prisma_migrations OWNER TO db_owner'; END IF; END $$;`,
    // Transfer ownership of ALL existing tables to db_owner. Tables created by postgres before
    // role setup cannot be altered by db_owner otherwise → "must be owner of table <X>".
    // Safe to run on a fresh DB — the loop finds nothing and is a no-op.
    `DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO db_owner'; END LOOP; END $$;`,
    `GRANT CONNECT ON DATABASE railway TO app_service`,
    `GRANT USAGE ON SCHEMA public TO app_service`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service`,
    `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_service`,
    // FOR ROLE db_owner is critical: tables are created by db_owner during migrations.
    // Without it, auto-grants only fire for tables created by the current user,
    // so app_service gets no access to migrated tables → permission denied on seed/queries.
    `ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO app_service`
  ];

  for (const sql of queries) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("✔ Executed:", sql.slice(0, 60) + "...");
    } catch (err) {
      console.warn("⚠️ Note on query execution:", err.message);
    }
  }

  console.log("\n🎉 Successfully set up database roles (db_owner and app_service) and granted permissions!");
}

main()
  .catch((e) => {
    console.error("❌ Setup script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
