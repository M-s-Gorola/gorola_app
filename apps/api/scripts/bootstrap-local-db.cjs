/**
 * Loads GoRola_app/.env and runs local DB bootstrap:
 *   1) prisma migrate deploy
 *   2) prisma db seed
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

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL in GoRola_app/.env for local bootstrap");
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const apiRoot = path.join(__dirname, "..");
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env
});
execSync("npx prisma db seed", {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env
});
