import { execSync } from "node:child_process";

// Advisories ignored due to not applying to production runtime stack or required for dev tooling compatibility
const IGNORED_ADVISORIES = new Set([
  "GHSA-qwww-vcr4-c8h2", // React Router RSC Mode CSRF Bypass (App is client-side Vite SPA using react-router-dom, RSC mode not used)
  "GHSA-mh99-v99m-4gvg"  // brace-expansion v1 maintenance release in devDependency eslint -> minimatch@3 (minimatch@3 requires v1 API)
]);

try {
  execSync("pnpm audit --audit-level=high --json --ignore-registry-errors", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  });

  console.log("Security audit passed clean (0 high/critical vulnerabilities).");
  process.exit(0);
} catch (err) {
  const stdout = err.stdout ? err.stdout.toString() : "";
  try {
    const report = JSON.parse(stdout);
    const advisories = report.advisories || {};

    const highOrCritical = Object.values(advisories).filter(
      (adv) =>
        (adv.severity === "high" || adv.severity === "critical") &&
        !IGNORED_ADVISORIES.has(adv.github_advisory_id)
    );

    if (highOrCritical.length === 0) {
      console.log("Security audit passed clean (0 unhandled high/critical vulnerabilities).");
      process.exit(0);
    }

    console.error(`Security audit failed with ${highOrCritical.length} unhandled high/critical vulnerability/vulnerabilities:`);
    for (const adv of highOrCritical) {
      console.error(` - [${adv.severity.toUpperCase()}] ${adv.github_advisory_id}: ${adv.title} (${adv.found_in})`);
    }
    process.exit(1);
  } catch (parseErr) {
    console.error("Failed to parse security audit output:", parseErr.message);
    process.exit(1);
  }
}
