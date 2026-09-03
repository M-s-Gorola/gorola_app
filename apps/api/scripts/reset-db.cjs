/**
 * Resets local PostgreSQL database using DDL owner credentials (DIRECT_URL / db_owner),
 * re-applies all migrations from scratch, grants least-privilege permissions to app_service,
 * and seeds fresh data using app_service runtime credentials.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const workspaceRoot = path.resolve(__dirname, "../..", "..");
const envPath = path.join(workspaceRoot, ".env");
const envVars = { ...process.env };

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
}

const ddlUrl =
  envVars.MIGRATION_DATABASE_URL ||
  envVars.DIRECT_URL ||
  "postgresql://db_owner:postgres_owner_123@localhost:5432/gorola_dev";

const appUrl =
  envVars.DATABASE_URL ||
  "postgresql://app_service:postgres_app_123@localhost:5432/gorola_dev";

const apiRoot = path.join(__dirname, "..");

console.log("--> Resetting database migrations...");
const ddlEnv = { ...envVars, DATABASE_URL: ddlUrl, DIRECT_URL: ddlUrl };

execSync("npx prisma migrate reset --force --skip-seed", {
  stdio: "inherit",
  cwd: apiRoot,
  env: ddlEnv
});

async function applyPermissions() {
  console.log("--> Applying least-privilege roles & permissions...");
  const prisma = new PrismaClient({
    datasources: { db: { url: ddlUrl } }
  });
  try {
    const queries = [
      `DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'db_owner') THEN
          CREATE ROLE db_owner WITH LOGIN CREATEDB PASSWORD 'postgres_owner_123';
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_service') THEN
          CREATE ROLE app_service WITH LOGIN PASSWORD 'postgres_app_123';
        END IF;
      END $$;`,
      "GRANT ALL PRIVILEGES ON DATABASE gorola_dev TO db_owner",
      "GRANT ALL ON SCHEMA public TO db_owner",
      "ALTER SCHEMA public OWNER TO db_owner",
      "GRANT CONNECT ON DATABASE gorola_dev TO app_service",
      "GRANT USAGE ON SCHEMA public TO app_service",
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_service",
      "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_service",
      "ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_service",
      "ALTER DEFAULT PRIVILEGES FOR ROLE db_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO app_service"
    ];
    for (const q of queries) {
      await prisma.$executeRawUnsafe(q).catch((err) => {
        console.warn(`[grant warning] ${err.message}`);
      });
    }
    console.log("✔ Applied least-privilege roles and permissions for app_service & db_owner");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await applyPermissions();

  console.log("--> Seeding database under app_service runtime credentials...");
  const appEnv = { ...envVars, DATABASE_URL: appUrl };
  execSync("npx prisma db seed", {
    stdio: "inherit",
    cwd: apiRoot,
    env: appEnv
  });
  console.log("✔ Database reset and seeded successfully.");
}

main().catch((err) => {
  console.error("❌ Reset DB failed:", err);
  process.exit(1);
});
