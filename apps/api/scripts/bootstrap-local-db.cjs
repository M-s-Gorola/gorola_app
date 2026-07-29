/**
 * Loads GoRola_app/.env and runs local DB bootstrap:
 *   1) prisma migrate deploy  — runs as db_owner (MIGRATION_DATABASE_URL)
 *   2) prisma db seed         — runs as app_service (DATABASE_URL)
 *
 * This is intended for local development to ensure dummy data exists.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "../..", "..");
const envPath = path.join(workspaceRoot, ".env");
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
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

// Use db_owner for migrations — app_service lacks CREATE privilege on the schema.
// prisma migrate deploy fails with "permission denied for schema public" as app_service.
const migrationUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DIRECT_URL ||
  "postgresql://db_owner:postgres_owner_123@localhost:5432/gorola_dev";

const appUrl = process.env.DATABASE_URL || migrationUrl;

const apiRoot = path.join(__dirname, "..");

// Step 1: Migrate as db_owner
process.env.DATABASE_URL = migrationUrl;
process.env.DIRECT_URL = migrationUrl;
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env
});

// Step 2: Seed as app_service (runtime role, least privilege)
process.env.DATABASE_URL = appUrl;
process.env.DIRECT_URL = appUrl;
execSync("npx prisma db seed", {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env
});
