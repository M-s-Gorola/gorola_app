/**
 * Loads GoRola_app/.env and runs Test DB bootstrap:
 *   1) prisma migrate deploy (on DATABASE_URL_TEST)
 *   2) prisma db seed (Standard Catalog)
 *   3) tsx scripts/seed-e2e.ts (E2E Identities)
 *
 * This ensures the local test DB is perfectly synced with CI expectations.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "../..", "..");
const envPath = path.join(workspaceRoot, ".env");

const env = { ...process.env };

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

// FORCE DATABASE_URL to use the MIGRATION TEST URL (db_owner) for migrations.
// app_service (DATABASE_URL_TEST) lacks CREATE privilege on the schema, so
// `prisma migrate deploy` fails with "permission denied for schema public".
if (!env.MIGRATION_DATABASE_URL_TEST) {
  throw new Error("MIGRATION_DATABASE_URL_TEST missing in .env. Cannot bootstrap test database.");
}

const migrationUrl = env.MIGRATION_DATABASE_URL_TEST;
env.DATABASE_URL = migrationUrl;
env.DIRECT_URL = migrationUrl;
env.NODE_ENV = 'test';

const apiRoot = path.join(__dirname, "..");

console.info("--- [TEST DB BOOTSTRAP START] ---");
console.info(`Target: ${env.DATABASE_URL.split('@')[1] || 'Internal URL'}`);

try {
  console.info("1/3: Deploying migrations...");
  execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: apiRoot, env });

  // Switch to app_service for seeding (runtime role, least privilege)
  env.DATABASE_URL = env.DATABASE_URL_TEST || migrationUrl;
  env.DIRECT_URL = env.DATABASE_URL_TEST || migrationUrl;

  console.info("2/3: Seeding standard catalog...");
  execSync("npx prisma db seed", { stdio: "inherit", cwd: apiRoot, env });

  console.info("3/3: Seeding E2E identities...");
  execSync("npx tsx scripts/seed-e2e.ts", { stdio: "inherit", cwd: apiRoot, env });

  console.info("--- [TEST DB BOOTSTRAP COMPLETE] ---");
} catch (error) {
  console.error("!!! [TEST DB BOOTSTRAP FAILED] !!!");
  process.exit(1);
}
