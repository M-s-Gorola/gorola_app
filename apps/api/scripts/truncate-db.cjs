/**
 * Truncates all tables in PostgreSQL public schema except _prisma_migrations.
 * Safe to run against remote databases like Railway PostgreSQL where `prisma migrate reset`
 * is disallowed because DROP DATABASE is prohibited by the platform.
 *
 * Usage:
 *   node ./scripts/truncate-db.cjs "<POSTGRES_PUBLIC_URL>"
 *   OR via environment variables:
 *   DATABASE_URL="<POSTGRES_PUBLIC_URL>" node ./scripts/truncate-db.cjs
 */
const { PrismaClient } = require("@prisma/client");

const targetUrl = process.argv[2] || process.env.TARGET_DB_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!targetUrl) {
  console.error("Usage: node ./scripts/truncate-db.cjs <POSTGRES_PUBLIC_URL>");
  console.error("   or: pnpm --filter @gorola/api truncate:db <POSTGRES_PUBLIC_URL>");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetUrl
    }
  }
});

async function main() {
  console.log("Connecting to PostgreSQL database...");

  const sql = `
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `;

  try {
    await prisma.$executeRawUnsafe(sql);
    console.log("✔ All table data successfully wiped (schema and _prisma_migrations history preserved).");
  } catch (err) {
    console.error("❌ Failed to truncate tables:", err.message);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("❌ Truncate script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
