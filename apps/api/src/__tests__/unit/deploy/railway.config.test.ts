import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// From .../api/src/__tests__/unit/deploy → 6×.. = monorepo root; 4×.. = apps/api
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(thisDir, "..", "..", "..", "..");
const repoRoot = path.join(thisDir, "..", "..", "..", "..", "..", "..");

const nixpacksToml = path.join(repoRoot, "nixpacks.toml");
const nvmrc = path.join(repoRoot, ".nvmrc");
const rootPackageJson = path.join(repoRoot, "package.json");
const procfile = path.join(repoRoot, "Procfile");

// Railway IaC (.railway/railway.ts + railway config apply) has been removed.
// Build settings (builder, buildCommand, startCommand, healthcheckPath,
// restartPolicyType) are now configured directly in the Railway dashboard.
// This suite validates the remaining deployment config that lives in the repo.
describe("Phase 1.9 — Railway Deployment Config (Procfile / scripts / Node version)", () => {
  it("exposes a Procfile web process using the API start script", async () => {
    const text = await readFile(procfile, "utf8");
    expect(text).toMatch(/^web:\s*pnpm --filter @gorola\/api start/m);
  });

  it("keeps API start = migrate deploy + node on compiled app entry", async () => {
    const text = await readFile(path.join(apiRoot, "package.json"), "utf8");
    const apiPackage: { scripts?: { start?: string; build?: string } } = JSON.parse(text);
    expect(apiPackage.scripts?.start).toBe("prisma migrate deploy && node dist/app.js");
  });

  it("runs prisma generate in build so tsc and deploy have a client", async () => {
    const text = await readFile(path.join(apiRoot, "package.json"), "utf8");
    const apiPackage: { scripts?: { build?: string } } = JSON.parse(text);
    const build = String(apiPackage.scripts?.build ?? "");
    expect(build).toMatch(/prisma generate/);
    expect(build).toMatch(/tsc/);
  });

  it("keeps the Prisma CLI for migrate deploy (runtime, not only dev)", async () => {
    const text = await readFile(path.join(apiRoot, "package.json"), "utf8");
    const apiPackage: { dependencies?: Record<string, string> } = JSON.parse(text);
    const deps = apiPackage.dependencies;
    expect(deps).toBeDefined();
    expect(Object.keys(deps ?? {})).toContain("prisma");
  });

  it("pins Node 22 for Nixpacks and matches GitHub Actions (ci.yml node-version: 22)", async () => {
    const nvm = (await readFile(nvmrc, "utf8")).trim();
    expect(nvm).toBe("22");

    const np = await readFile(nixpacksToml, "utf8");
    expect(np).toMatch(/^\[variables\]/m);
    expect(np).toMatch(/NODE_VERSION\s*=\s*["']?22["']?/);

    const text = await readFile(rootPackageJson, "utf8");
    const root: { engines?: { node?: string } } = JSON.parse(text);
    expect(root.engines?.node).toMatch(/22/);
  });
});
