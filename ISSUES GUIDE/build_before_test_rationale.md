# The "Build-First" Verification Pattern

In modern software engineering, particularly within monorepo architectures, the sequence of operations in a CI/CD pipeline is a primary determinant of both speed and system integrity. This guide establishes the rationale for placing the **Build** step before **Unit, Integration, and E2E tests**.

---

## 1. Artifact and Dependency Generation
Many modern frameworks and ORMs (like Prisma, GraphQL, or ProtoBuf) rely on code generation to provide type-safety.
*   **The Issue**: Tests often import these generated clients. If the build (generation) hasn't happened, the test suite will fail with "Module not found" or "Schema mismatch" errors.
*   **The Pattern**: Always execute generation/build scripts before starting any test runner. This ensures the tests are validating the current schema, not a stale artifact from a previous branch.

**GoRola Case Study:**
We run `prisma generate` as part of the build. Without this, the API integration tests would import a Prisma client that doesn't reflect the latest database migrations.

---

## 2. Shared Library Integrity
In monorepos, applications frequently depend on internal shared packages (e.g., `packages/shared`).
*   **The Issue**: Changes in a shared package might appear correct in the IDE (source), but the **compiled output** used by other applications may be out of sync.
*   **The Pattern**: A full workspace build compiles and links all internal dependencies. This prevents "Ghost Bugs"—where tests fail because an application is running against a stale version of a shared library.

---

## 3. The "Fail-Fast" Architecture
CI pipelines are expensive in terms of both time and computing resources.
*   **The Issue**: Running a 15-minute E2E suite on code that has a syntax error or a broken production import is a waste of resources.
*   **The Pattern**: The build step acts as the ultimate "Quality Gate." If the code is "un-buildable," the pipeline should terminate immediately. This provides the developer with the fastest possible feedback loop.

---

## 4. Deterministic E2E Environments
E2E runners (like Playwright or Cypress) are sensitive to resource contention and timing.
*   **The Issue**: Running tests against "live-compiling" dev servers (e.g., Vite in dev mode) causes CPU spikes during the first navigation, leading to timeouts in resource-constrained CI environments.
*   **The Pattern**: Execute E2E tests against **Production-Ready Artifacts** (the `dist/` or `build/` folder). A production server merely serves static assets or pre-compiled binaries, freeing 100% of the CPU for the browser and the test runner.

---

## Summary: The Universal Workflow
A robust pipeline follows this logical sequence of increasing complexity:

1.  **Static Analysis** (Lint/Typecheck): Is the code grammatically and logically consistent?
2.  **Synthesis** (Build): Can the code be transformed into a shippable product?
3.  **Verification** (Test): Does the product behave as expected in isolation and as a whole?

By enforcing the **Build-First** pattern, you ensure that every test run is grounded in a valid, shippable version of the application.
