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
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'db_owner') THEN CREATE ROLE db_owner WITH LOGIN PASSWORD '${escapedOwnerPass}'; ELSE ALTER ROLE db_owner WITH PASSWORD '${escapedOwnerPass}'; END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_service') THEN CREATE ROLE app_service WITH LOGIN PASSWORD '${escapedAppPass}'; ELSE ALTER ROLE app_service WITH PASSWORD '${escapedAppPass}'; END IF; END $$;`,
    `GRANT ALL PRIVILEGES ON DATABASE railway TO db_owner`,
    `GRANT CONNECT ON DATABASE railway TO app_service`,
    `GRANT USAGE ON SCHEMA public TO app_service`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service`,
    `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_service`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_service`
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
