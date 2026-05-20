# Issue Guide: E2E Resource Management and Shutdown Stability

## The Problem: "Worker process did not exit within 300000ms"

A common stability bottleneck in E2E suites is the "Teardown Hang." This occurs when the test runner (Playwright) completes its work, but the underlying worker process remains active for the full duration of the OS timeout (typically 5 minutes). This is almost always caused by background handles (sockets, timers, or telemetry flushes) that prevent the Node.js event loop from reaching a clean exit state.

---

## Principle 1: Fail-Fast Telemetry Flushes

In production, OpenTelemetry (OTEL) is designed to be "graceful," meaning it will attempt to flush all pending spans to a collector before the process exits.

**The Conflict:**
In a local E2E environment, a collector is rarely running on the default OTLP port (4318). When the process receives a shutdown signal, the OTEL SDK attempts to connect, fails, and hangs while waiting for network timeouts.

**The Solution:**
Explicitly disable the Telemetry SDK in the E2E test environment. This ensures the `sdk.shutdown()` call is a no-op and doesn't block the worker.

```typescript
// apps/web/playwright.config.ts
env: {
  OTEL_ENABLED: 'false' // Disables SDK warmup and shutdown logic
}
```

---

## Principle 2: Forceful Socket Closure (Disconnect vs. Quit)

Most database and cache clients (Prisma, ioredis) offer two shutdown methods: `quit()` (graceful) and `disconnect()` (forceful).

**The Conflict:**
`quit()` waits for all pending commands to finish and the server to acknowledge the closure. If the client is in a retry loop (e.g., Redis is down) or if a test failure left a command hanging, `quit()` will wait indefinitely.

**The Solution:**
In E2E teardown, always favor `disconnect()`. It closes the TCP socket immediately, which is acceptable in a test environment where data persistence for the current process is no longer required.

```typescript
// apps/api/src/lib/redis.ts
export async function disconnectRedis(): Promise<void> {
  if (redisSingleton) {
    redisSingleton.disconnect(); // Immediate socket closure
    redisSingleton = null;
  }
}
```

---

## Principle 3: The Shutdown "Guillotine"

Even with Principles 1 and 2, a complex application may still have "leaky" handles (e.g., a third-party library's internal timer).

**The Solution:**
Implement a failsafe "guillotine" timeout in the main application shutdown handler. If the application has not cleanly exited within a reasonable window (e.g., 10 seconds), the process should be forced to terminate with `process.exit(0)`.

**Implementation Pattern:**
```typescript
const closeWithTelemetry = async (): Promise<void> => {
  // Failsafe: if we don't exit in 10s, force it
  const failsafe = setTimeout(() => {
    process.exit(0);
  }, 10000);
  failsafe.unref(); // Don't let the failsafe timer itself keep the process alive

  try {
    await app.close();
  } finally {
    await cleanupConnections();
    clearTimeout(failsafe);
    process.exit(0);
  }
};
```

---

## Principle 4: E2E Server Reuse Locally (`reuseExistingServer`)

To prevent the Windows process teardown hang when running the E2E suite sequentially or inside automated quality runners (`pnpm ci:quality`) locally, the backend `webServer` block in `playwright.config.ts` must use `reuseExistingServer: !process.env.CI`.

### The Conflict: The "Orphaned Port 3002" Paradox
If `reuseExistingServer: false` is configured for the backend, Playwright is forced to spawn a new server process (`pnpm --filter @gorola/api dev`) on every local E2E run.
* **On Windows**: Terminating the parent process group does not kill the child processes (`tsx watch` -> `node`). The actual API server is left orphaned and alive in the background holding Port `3002` open.
* **Stream Pipe Leak**: Because the orphaned child processes are still alive, they hold open the standard output/error stream pipes (`stdout`/`stderr`). The parent terminal hangs **indefinitely** at the very end of the run waiting for these pipes to close.
* **The Paradox**: If you run `pnpm test:e2e` standalone first, the server remains running on port `3002`. During a subsequent `pnpm ci:quality` run, the newly spawned duplicate server crashes immediately with `EADDRINUSE`. Since the duplicate server crashes on boot, there are no active stream pipes from a newly spawned child process tree during teardown. Playwright checks the health endpoint of the existing stale server, receives `200 OK`, runs the E2E tests, and exits **instantly without hanging**! However, if port `3002` is free, a fresh server starts successfully, leading to the orphaned process tree and the stream leak.

### The Solution:
Setting `reuseExistingServer: !process.env.CI` instructs Playwright to reuse the active E2E server on Port `3002` locally, completely avoiding the duplicate process spawning and the Windows stream hang.
* **Why it is 100% Safe**: The backend is stateless, and the `gorola_test` database is reset and seeded during the E2E `globalSetup` phase anyway. Furthermore, since the backend runs via `tsx watch`, any source code changes you make will automatically hot-reload in the background.

---

## Summary for Developers

1. **Isolation**: Tests should not rely on graceful shutdowns; the environment is ephemeral.
2. **Timeouts**: Every background connection (Redis, DB) must have a `connectTimeout` and `maxRetries` configured for test mode.
3. **Deadlocks**: If a worker hangs, use `node --trace-exit` or `why-is-node-running` to identify the specific handle keeping the event loop alive.
4. **Local Reuse**: Set `reuseExistingServer: !process.env.CI` for both frontend and backend to avoid duplicate process stream leaks on Windows.

