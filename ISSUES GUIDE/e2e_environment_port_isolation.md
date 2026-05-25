# Universal Architectural Pattern: Dynamic E2E Port Isolation & Dynamic WebSocket Proxying

This guide establishes a reusable, project-agnostic architectural blueprint for running End-to-End (E2E) test suites in parallel with active local development. Implementing this pattern guarantees zero port collisions (`EADDRINUSE`), prevents local/CI environment contamination, and ensures flawless real-time WebSocket communication in both dev and production-bundle preview environments.

---

## 1. The Core Problem: Port Contention & Environment Contamination

Most modern web applications bind to standard, "well-known" default ports:
* **Frontend SPA (Vite, Webpack, etc.)**: `3000`, `5173`, or `5180`
* **Backend API (Express, Fastify, Go, etc.)**: `3001` or `8000`

When a developer is actively working on a feature:
1. Their local development server already holds these default ports.
2. If they (or a local script) trigger an automated E2E test suite, the suite will attempt to spin up its own isolated API and frontend instances.
3. This triggers an immediate port collision (`EADDRINUSE` crash).
4. Even if port sharing is somehow bypassed, the tests run against the developer's *active development database*, leading to test flakiness and database state pollution.

---

## 2. The Solution: Shifted Test-Specific Port Range

To achieve **100% parallel isolation**, you must define a dedicated, isolated port range reserved strictly for automated testing (e.g., shifting backend API ports by `+1` or `+100` from the dev standard).

### **The Port Architecture Map:**
* **Manual Development (Frontend)**: `5180` (Standard Dev Port)
* **Manual Development (Backend API)**: `3001` (Dev Port)
* **Automated E2E Testing (Backend API)**: `3002` (Isolated Shadow Port)

By shifting the E2E API port to a "Shadow Port" (`3002`), you can run the full E2E test suite against a clean test database completely in parallel while the developer continues working on the main dev database on port `3001`.

### **GoRola Implementation Example:**
In the testing harness (`playwright.config.ts`), the backend test webserver is launched explicitly on the shadow port `3002` while the frontend is instructed to target the test backend:
```typescript
// apps/web/playwright.config.ts
webServer: [
  {
    // Frontend stays on standard port
    command: 'pnpm dev --port 5180',
    url: 'http://127.0.0.1:5180',
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:3002' }
  },
  {
    // Backend API shifted to isolated shadow port
    command: 'PORT=3002 pnpm dev',
    url: 'http://127.0.0.1:3002/api/health',
    env: { PORT: '3002' }
  }
]
```

---

## 3. The Compile-Time Trap: Why Simple Port Shifting Fails in CI

While simple port shifting works beautifully in dev mode (where environment variables are dynamically evaluated at runtime), it introduces a major **silent failure vector in Continuous Integration (CI)**:

1. **The Static Bundle Trap**: In a robust CI pipeline, the application is built into production-ready static assets (e.g., via `vite build`) *before* the E2E runner starts. This means compile-time defaults (such as a fallback `import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"`) are **hardcoded/baked directly into the minified client JS**.
2. **The Proxy Bypass**: If the client code establishes WebSocket connections (like `socket.io` or standard WebSockets) by reading absolute compiled variables, the browser running the E2E test in CI will bypass the local web server and attempt to connect directly to the dev port (`3001`).
3. **The Failure**: Since only the isolated shadow API (`3002`) is running in CI, the WebSocket connection silently fails, and any test asserting real-time UI updates (like status changes or notifications) will hit a timeout and fail.

---

## 4. The Blueprint: Unified Dynamic Proxying & Relative Routing

To decouple your client code from environment ports entirely, you must apply the **Dynamic Proxying & Relative Routing** pattern. This consists of three decoupled pillars:

### **Pillar A: Relative Origin Fallbacks (Client Code)**
Never hardcode absolute URLs or fallback ports in your client-side UI code. Instead, default to a relative origin (`""`). This instructs the browser to communicate directly with the local server that served the page.

* **Incorrect (Tight Coupling)**:
  ```typescript
  const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  const socket = io(baseURL);
  ```
* **Correct (Decoupled Relative Routing)**:
  ```typescript
  const baseURL = import.meta.env.VITE_API_BASE_URL || "";
  const socket = io(baseURL); // Connects relatively to current domain, e.g. /socket.io
  ```

### **Pillar B: WebSocket-Capable Dynamic Upstream Proxies (Bundler)**
Configure your bundler (Vite, Webpack, etc.) to dynamically proxy both standard HTTP `/api` calls and WebSockets `/socket.io` requests to the correct active backend port. 

Ensure this proxy configuration is shared between **both** the development server and the static production preview server so it functions identically in both local development and CI.

* **Vite Implementation Example (`vite.config.ts`)**:
  ```typescript
  // Dynamically resolve target backend port based on the active test state
  const proxyTarget = process.env.VITE_E2E_PROXY === "true"
    ? `http://127.0.0.1:${process.env.PORT_API || "3002"}`
    : "http://127.0.0.1:3001";

  const proxyConfig = {
    "/api": {
      target: proxyTarget,
      changeOrigin: true
    },
    "/socket.io": {
      target: proxyTarget,
      ws: true, // IMPORTANT: Enable WebSocket proxying
      changeOrigin: true
    }
  };

  export default defineConfig({
    server: { port: 5180, proxy: proxyConfig },
    preview: { port: 5180, proxy: proxyConfig } // Shares proxy rules with production preview server in CI!
  });
  ```

### **Pillar C: Test Harness Environment Injection (Harness)**
Inject the isolated ports and the E2E proxy activator variable inside the test runner config. This acts as the runtime toggle to dynamically shift Vite's upstream targets.

* **Playwright Implementation Example (`playwright.config.ts`)**:
  ```typescript
  webServer: [
    {
      command: process.env.CI 
        ? 'pnpm preview' // CI serves static production build
        : 'pnpm dev',     // Local uses active dev mode
      env: {
        VITE_E2E_PROXY: 'true', // Activates the shadow port proxy target
        PORT_API: '3002'        // Routes both API and WebSockets to 3002
      }
    }
  ]
  ```

---

## 5. Local Hardening: Preventing "Proxy Leaks"

While dynamic proxying is essential for CI stability, a developer running a local development frontend might accidentally connect to a lingering E2E test database if environment variables leak.

### **The Hardening Rule**:
Always guard the port-shifting logic behind an explicit E2E flag (e.g., `VITE_E2E_PROXY === 'true'`).
* **Manual Development**: Always defaults to port `3001` (Safe, manual verification).
* **Automated E2E Tests**: The test runner explicitly injects the `VITE_E2E_PROXY: 'true'` flag, automatically routing all requests and WebSockets to the shadow backend (`3002`).

---

## 6. Project-Agnostic Setup Checklist

To implement this pattern in any new project, complete these 4 steps in under 5 minutes:

1. **Client Setup**: Ensure your API clients and WebSocket wrappers use relative paths (`""` or `/`) as their default baseline fallback.
2. **Bundler Setup**: Update your `vite.config.ts` or bundler proxy block to catch standard WebSocket endpoints (like `/socket.io`) with `ws: true`.
3. **Test Runner Setup**: In your test configuration, inject the dynamic proxy activator and the target port under the frontend server's `env` options.
4. **Safety Verification**: Verify that booting the test suite dynamically directs network calls to the shadow port, while launching the standard dev command continues to target the dev port.
