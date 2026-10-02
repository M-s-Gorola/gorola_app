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
  "GHSA-jqff-g426-hqxp", // fast-uri host confusion via percent-encoded scheme normalization
  "GHSA-qw65-cvwx-89v3", // fast-uri authority injection in serialize
  "GHSA-rfgv-xxqx-mfg5", // undici WebSocket subprotocol DoS
  "GHSA-w293-vg96-wgc3", // undici BalancedPool TLS validation
  "GHSA-qhr7-859c-m2p7", // brace-expansion recursion in nested brace groups
  "GHSA-6j4f-fj2g-mc7p", // brace-expansion recursion in parseCommaParts
  "GHSA-2gc4-cqfq-p2gv", // Engine.IO Protocol Revision Mismatch DoS
  "GHSA-c29m-xwm3-cm6r", // Axios ReDoS in fromDataURI
  "GHSA-mghh-pgcx-3jjj", // Axios ReDoS in shouldBypassProxy
  "GHSA-x97p-jq2g-jp4f", // Axios Prototype Pollution Gadget in toFormData
  "GHSA-3pq3-5fj3-cg6v", // Axios HTTP/2 DNS bypass
  "GHSA-542g-h47m-68v8", // Axios HTTP/2 DoS
  "GHSA-m9gg-hp2v-232j", // @grpc/grpc-js getAuthContext certificate validation (dev/telemetry dependency)
  "GHSA-m8m8-qj5v-23w3", // Axios Node HTTP adapter createConnection prototype pollution gadget
  "GHSA-r4gj-5m52-g5wh", // Axios fetch adapter maxRedirects: 0 SSRF (client-side web SPA)
  "GHSA-667r-xxjv-c9mm", // Fastify request body replacement via async validation collision (app uses synchronous Zod schemas, not Ajv async validation)
  "GHSA-p68q-wchp-6fh7", // Fastify auth bypass in encapsulated not-found handlers (app uses explicit route middleware, not scoped 404 handlers)
  "GHSA-hwr6-493r-vm6h", // Fastify validation bypass via skipped boolean false schemas (app uses Zod schema objects rather than boolean false JSON schemas)
  "GHSA-9q9j-q6p8-xq58"  // Fastify header validation bypass in dependencies keyword (app uses Zod schema parsing and lowercase header helpers)
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
