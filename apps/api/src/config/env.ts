import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import dotenvSafe from "dotenv-safe";

import { getMonorepoRootFromThisFilePath } from "./monorepoRoot.js";
import { primeMissingKeysFromExample } from "./primeEnvFromExample.js";

const currentFilePath = fileURLToPath(import.meta.url);
const workspaceRoot = getMonorepoRootFromThisFilePath(currentFilePath);
const envPath = path.resolve(workspaceRoot, ".env");
const examplePath = path.resolve(workspaceRoot, ".env.example");

// PaaS (Railway, etc.): there is no committed `.env`; variables come from the host environment.
// dotenv still tries to read `path` — use an empty file if missing so validation runs against
// `process.env` (already populated by the platform) instead of failing with ENOENT.
// eslint-disable-next-line security/detect-non-literal-fs-filename
if (!existsSync(envPath)) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(envPath, "", { encoding: "utf8" });
}

dotenv.config({ path: envPath });
primeMissingKeysFromExample(examplePath);

dotenvSafe.config({
  allowEmptyValues: true,
  path: envPath,
  example: examplePath
});

export {};
