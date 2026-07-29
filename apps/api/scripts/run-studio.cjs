const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const workspaceRoot = path.resolve(__dirname, "../../..");
loadEnvFile(path.join(workspaceRoot, ".env"));
loadEnvFile(path.resolve(__dirname, "../.env"));

const studioUrl = process.env.DIRECT_URL || process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
process.env.DATABASE_URL = studioUrl;

execSync("npx prisma studio", { stdio: "inherit", env: process.env });
