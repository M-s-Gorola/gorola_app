import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const setupDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(setupDir, "../../..");
const workspaceRoot = path.resolve(apiRoot, "../..");
loadEnvFile(path.join(workspaceRoot, ".env"));

const testUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "DATABASE_URL_TEST or DATABASE_URL must be set for integration tests (see GoRola_app/.env.example)."
  );
}

const testMigrationUrl =
  process.env.MIGRATION_DATABASE_URL_TEST ??
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DIRECT_URL ??
  testUrl;

process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testMigrationUrl;


