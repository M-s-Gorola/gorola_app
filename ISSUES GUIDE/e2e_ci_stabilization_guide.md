# Production-Parity in Test Infrastructure

In modern CI/CD pipelines, ensuring that End-to-End (E2E) tests run reliably requires a fundamental shift in philosophy: your test environment should mirror your production environment, not your development environment. This guide explains why **"Dev Mode"** is the primary cause of CI flakiness and how to implement a **"Build-First"** strategy.

---

## 1. Why `dev` mode is the Enemy of CI

Local development servers (like Vite, Webpack Dev Server, or `tsx watch`) are optimized for **human developers**, prioritizing features like Hot Module Replacement (HMR). These features are counter-productive for automated runners.

### A. The Compilation Penalty
In `dev` mode, the server performs **lazy-loading** and **on-the-fly bundling**.
*   **Locally**: High-spec developer machines mask the latency of these operations.
*   **In CI**: GitHub Actions or GitLab runners are often resource-constrained (e.g., 2-core machines). When a test runner like Playwright requests a page, the dev server may trigger a massive CPU-bound compilation process, causing the request to hang and leading to **E2E Timeouts**.

### B. The Startup Race Condition
A dev server might open its port and return a `200 OK` status *before* it has actually finished preparing the Javascript bundle. The test runner starts interacting with a "blank" or "half-hydrated" page, leading to non-deterministic failures (flakiness).

---

## 2. The Solution: The "Production-Artifact" Strategy

Instead of running raw source code, switch the entire test pipeline to use **Compiled Artifacts**.

### Step 1: Pre-Build Everything
Run your project's build script (e.g., `npm run build`) **before** starting any tests.

**Benefits:**
1.  **Artifact Integrity**: Ensures that generated code (Prisma, GraphQL clients) is physically written to disk.
2.  **Zero Runtime Overhead**: Once built, the application is "static." Serving it requires minimal CPU, leaving maximum resources for the browser.

### Step 2: Use Production-Ready Preview Servers
Update your test configuration (e.g., `playwright.config.ts`) to serve the production build:

| Environment | Frontend Command | Backend Command | Rationale |
| :--- | :--- | :--- | :--- |
| **Local Dev** | `npm run dev` | `npm run dev` | Speed and HMR. |
| **CI / E2E** | `npm run preview` | `node dist/app.js` | Uses pre-compiled binaries; no runtime compilation. |

---

## 3. Dealing with Resource Contention

A typical E2E run in CI involves multiple heavy processes (Database, Cache, API, Frontend, Browser) fighting for the same 2 CPU cores.

### Strategy: Sequential Power
By building the code first, you eliminate the "Compilation" task from the execution phase. This ensures that when the browser starts, it isn't competing with a compiler for CPU cycles.

---

## 4. Checklist for E2E Stability

- [ ] **No `watch` mode**: Ensure no process in CI is watching for file changes.
- [ ] **Wait for Health**: Always use a dedicated health-check URL (e.g., `/api/health`) to signal that the server is ready.
- [ ] **Extended Timeouts**: Set longer timeouts (e.g., 60s-120s) in CI to account for slower virtualized hardware.
- [ ] **Deterministic Workers**: Use `workers: 1` in CI if your tests share a single stateful resource (like a database) to avoid race conditions.
- [ ] **Reporter Alignment**: Standardize on `--reporter=list` or `--reporter=github` for CI runs to print failure tracebacks directly in stdout.

---

## 5. CI Log Visibility & Reporter Selection

Running E2E test suites inside CI/CD virtual environments presents challenges with log visibility and failure diagnostic efficiency:

### A. The Hidden Failure Trap
By default, Playwright uses the `html` or `line` reporter.
* **In Local Development:** The HTML reporter opens a browser window showcasing step-by-step failures, screenshots, and trace logs.
* **In CI Run Logs:** These graphical pages are saved as local artifact folders on the runner disk. If a test fails, developers are forced to manually download a zip archive from the CI system's job page, unzip it, and open the HTML report just to see a basic selector failure, introducing massive debugging delays.

### B. Verbose vs. Swallowed Logs
* Progress reporters (like `dot` or `line`) compile output into a single line or print minimal dots. While clean, they swallow error context, stack traces, and console logs unless the process fails completely.
* High-verbosity progress outputs can flood the log buffer on large suites, making logs hard to search.

### C. Best Practice: Standardizing `--reporter=list`
To ensure immediate diagnostic feedback, explicitly supply `--reporter=list` (or `--reporter=github` for GHA annotation integrations) in:
1. **CI workflows (`ci.yml`)**: Under test execution runner steps.
2. **Project scripts (`package.json`)**: Within quality control commands like `test:e2e` or `ci:quality` to guarantee developers get consistent terminal tracing.

This prints the start of each test case and immediately dumps detailed stack traces, expected vs. received DOM mismatches, and console output to the terminal stdout on any failure.

## Summary
The secret to stable CI E2E tests is **Isolation, Pre-computation, and Visibility**. By validating your **real production code** rather than your development source, and ensuring that any failures print their traces directly to the job log, you minimize resource overhead and maximize developer velocity.
