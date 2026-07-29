/**
 * Resets local PostgreSQL database using DDL owner credentials (DIRECT_URL / db_owner),
 * re-applies all migrations from scratch, and seeds fresh data.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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

// For reset operations, use db_owner DDL connection (DIRECT_URL / MIGRATION_DATABASE_URL)
const ddlUrl =
  envVars.MIGRATION_DATABASE_URL ||
  envVars.DIRECT_URL ||
  "postgresql://db_owner:postgres_owner_123@localhost:5432/gorola_dev";

envVars.DATABASE_URL = ddlUrl;
envVars.DIRECT_URL = ddlUrl;

const apiRoot = path.join(__dirname, "..");
execSync("npx prisma migrate reset --force", {
  stdio: "inherit",
  cwd: apiRoot,
  env: envVars
});
