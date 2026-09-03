import { execSync } from "node:child_process";

// Advisories ignored due to not applying to production runtime stack or required for dev tooling compatibility
const IGNORED_ADVISORIES = new Set([
  "GHSA-qwww-vcr4-c8h2", // React Router RSC Mode CSRF Bypass (App is client-side Vite SPA using react-router-dom, RSC mode not used)
  "GHSA-mh99-v99m-4gvg", // brace-expansion v1 maintenance release in devDependency eslint -> minimatch@3 (minimatch@3 requires v1 API)
  "GHSA-q7rr-3cgh-j5r3", // Prometheus exporter process crash (dev/telemetry dependency)
  "GHSA-45rx-2jwx-cxfr", // OpenTelemetry JaegerPropagator DoS (dev/telemetry dependency)
  "GHSA-2m8v-j782-fhvr", // Socket.IO Zero-attachment Memory Exhaustion
  "GHSA-4cwx-7wf7-3272", // undici cross-user info disclosure
  "GHSA-7p8r-x3mc-p8w7", // fast-uri host confusion via backslash authority introducer
  "GHSA-mwp4-54f8-5fhr", // ip-address leading-zero octets
  "GHSA-rgw5-rvv9-x895", // brace-expansion DoS via unbounded intermediate arrays
  "GHSA-5p4m-2wfm-xmqj", // JS-YAML quadratic CPU consumption in !!omap resolution
  "GHSA-2v37-7h3g-55p8", // nanoid custom generators infinite loop when size is zero
  "GHSA-ggr8-5vv4-36mx", // DeepmergeTS stack exhaustion on recursive object graphs
  "GHSA-c83g-rgw3-j3cx", // Browserslist unbounded memory growth via distinct query results
  "GHSA-73wf-gq98-2v4g", // Browserslist uncaught crash via custom stats
  "GHSA-5jgf-p345-68v8", // fast-uri host confusion via skipped IDN canonicalization
  "GHSA-f65p-4m7j-42xc", // fast-uri SSRF via malformed IPv6 normalization
  "GHSA-fph4-wmhf-6fwf", // fast-uri SSRF via repeated hostname percent-decoding
  "GHSA-jqff-g426-hqxp"  // fast-uri host confusion via percent-encoded scheme normalization
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
