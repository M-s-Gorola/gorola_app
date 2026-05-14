# The Principle of Parallel Environment Isolation

This guide establishes the architecture for running End-to-End (E2E) tests in parallel with active local development without port collisions or environment contamination.

---

## 1. The Problem: The "Port in Use" Conflict

Most web applications bind to "well-known" default ports:
- **Frontend (Vite/React)**: `5173` or `3000`
- **Backend (Node/Go/Python)**: `3001` or `8000`

**In the GoRola environment**, we use a custom standard:
- **Frontend**: `5180`
- **Backend**: `3001`

When a developer is actively working on a feature, their dev server is already holding these ports. If they (or a CI runner on the same machine) attempt to start an E2E suite that tries to bind to the same API port (`3001`), the suite will crash with `EADDRINUSE`.

## 2. The Solution: Shifted Test-Specific Ports

To achieve 100% isolation, the test environment should be assigned a "Reserved Range" of ports that do not overlap with development defaults.

**Universal Pattern:**
- **Development (Frontend)**: `5180` (Standard for GoRola)
- **Development (Backend)**: `3001`
- **Testing (Backend)**: `3002` (Isolated for E2E)

By shifting the API port specifically, you create a "Shadow Backend" where the E2E suite can run against a test database while the developer continues to use the development database on the default port.

### GoRola Case Study:
In our `playwright.config.ts`, we explicitly shift the API port to 3002 while retaining 5180 for the frontend:
```typescript
webServer: [
  {
    // Frontend stays on 5180 (standard)
    command: 'pnpm dev --port 5180',
    url: 'http://127.0.0.1:5180',
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:3002' }
  },
  {
    // Backend shifted to 3002 to avoid 3001 conflict
    command: 'PORT=3002 pnpm dev',
    url: 'http://127.0.0.1:3002/api/health',
    env: { PORT: '3002' }
  }
]
```

---

## 3. Principle of Explicit Routing

Never rely on `localhost` or environmental "guesses" in E2E tests.

### A. The 127.0.0.1 Standard
As documented in the *Deterministic Networking* guide, always use the IPv4 loopback `127.0.0.1`. This avoids the dual-stack resolution lag (IPv4 vs IPv6) which can cause subtle "Connection Refused" errors in CI environments.

### B. Hard-Linked URLs
In your test configuration, explicitly link the frontend to the backend's test port via environment variables (e.g., `VITE_API_BASE_URL`). Do not assume the frontend will find the backend on the "default" dev port.

---

## 4. Environment Safety (The "Test Mode" Flag)

To prevent tests from accidentally writing to a developer's local database or a production cache, use a strict `NODE_ENV=test` or `APP_ENV=test` flag.

**Best Practices:**
1. **Dynamic Config**: If `APP_ENV === 'test'`, use `DATABASE_URL_TEST`.
2. **Fail-Fast**: If the test-specific database string is missing, the application should crash immediately rather than falling back to the development database.

---

## 5. CI Compatibility: Dynamic Proxying

While shifting ports works in `dev` mode (where environment variables are injected at runtime), it can fail in CI when using `preview` mode with a static production build. This is because a static build has the API URL "baked in" at build-time.

### **The Solution: Dynamic Proxy Targets**
To solve this, we make the **Vite Proxy** dynamic. Instead of hardcoding `3001` in `vite.config.ts`, we use an environment variable. This allows the `vite preview` server to route requests correctly even if the frontend code was built with a different default.

**GoRola Implementation:**

1. **Vite Config:**
```typescript
// apps/web/vite.config.ts
proxy: {
  "/api": {
    target: `http://127.0.0.1:${process.env.PORT_API || "3001"}`,
    changeOrigin: true
  }
}
```

2. **Playwright Config:**
```typescript
// apps/web/playwright.config.ts
webServer: [
  {
    command: 'pnpm preview',
    env: { 
      PORT_API: '3002' // Forces the proxy to the test backend
    }
  }
]
```

This ensures that the CI pipeline remains stable, even when running against a production bundle.

---

## 6. Local Hardening: Preventing "Proxy Leaks"

While dynamic proxying (Step 5) is great for CI, it can create a "Footgun" for local development. If a developer runs `pnpm dev` in a terminal that has a stale `PORT_API` variable (e.g., from a crashed test run), the **Dev Frontend** might accidentally talk to a **Test Backend**.

### **The Solution: Explicit E2E Proxy Flag**
We protect against this by requiring an explicit "Opt-In" flag for port shifting.

**GoRola Hardened Implementation:**

1. **Vite Config:**
```typescript
// apps/web/vite.config.ts
target: process.env.VITE_E2E_PROXY === "true"
  ? `http://127.0.0.1:${process.env.PORT_API || "3002"}`
  : "http://127.0.0.1:3001"
```

2. **Playwright Config:**
```typescript
// apps/web/playwright.config.ts
env: { 
  VITE_E2E_PROXY: 'true',
  PORT_API: '3002' 
}
```

**Result:**
- **Local Dev**: Always defaults to `3001` (Safe).
- **E2E Tests**: Explicitly switches to `3002` (Isolated).

---

## 7. Summary for Future Projects
1. **Assign** a unique, non-colliding port range for your E2E suite (e.g., `+10` or `+100` from defaults).
2. **Inject** these ports into your application via environment variables during the test boot sequence.
3. **Bind** explicitly to `127.0.0.1` to ensure cross-platform consistency.
4. **Enforce** environment isolation to protect development and production data.
