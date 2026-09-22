/**
 * migrate-dev.cjs
 *
 * Wrapper for `prisma migrate dev` that uses MIGRATION_DATABASE_URL (db_owner)
 * instead of DATABASE_URL (app_service) so Prisma can create the shadow database.
 *
 * Usage (from workspace root):
 *   pnpm --filter @gorola/api prisma:migrate:dev --name <migration-name>
 *
 * Why this exists:
 *   Prisma uses the `url` field in schema.prisma (DATABASE_URL = app_service) to
 *   create the shadow database during `migrate dev`. app_service lacks CREATEDB
 *   permission by design (least privilege). This script temporarily overrides
 *   DATABASE_URL with MIGRATION_DATABASE_URL (db_owner) which has CREATEDB,
 *   without touching the schema file.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// Load workspace root .env (GoRola_app/.env) if env vars are not already set
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const envPath = path.join(workspaceRoot, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error(
    "MIGRATION_DATABASE_URL is not set. Add it to GoRola_app/.env or your environment."
  );
}

// Override DATABASE_URL and DIRECT_URL with the db_owner migration URL
process.env.DATABASE_URL = migrationUrl;
process.env.DIRECT_URL = migrationUrl;

// Forward any extra args (e.g. --name init) to prisma migrate dev
const extraArgs = process.argv.slice(2).join(" ");

const apiRoot = path.join(__dirname, "..");
execSync(`npx prisma migrate dev ${extraArgs}`, {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env,
});
