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

## Summary for Developers

1. **Isolation**: Tests should not rely on graceful shutdowns; the environment is ephemeral.
2. **Timeouts**: Every background connection (Redis, DB) must have a `connectTimeout` and `maxRetries` configured for test mode.
3. **Deadlocks**: If a worker hangs, use `node --trace-exit` or `why-is-node-running` to identify the specific handle keeping the event loop alive.
