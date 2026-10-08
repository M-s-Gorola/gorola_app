import type { Writable } from "node:stream";

import pino, { type Logger, type LoggerOptions } from "pino";

const REDACT_PATHS = [
  "password",
  "*.password",
  "headers.authorization",
  "req.headers.authorization",
  "req.headers.cookie",
  "authorization",
  "phone",
  "*.phone",
  "body.phone",
  "req.body.phone",
  "dateOfBirth",
  "*.dateOfBirth",
  "body.dateOfBirth",
  "req.body.dateOfBirth",
  "ageTicket",
  "*.ageTicket",
  "body.ageTicket",
  "req.body.ageTicket"
];

export type LoggerResetTestOptions = {
  stream?: Writable;
  /** Force JSON (no pino-pretty) — used with a capture stream in tests. */
  forceJson?: boolean;
};

let appLoggerSingleton: Logger | undefined;
let testReset: LoggerResetTestOptions | undefined;

function basePinoOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: REDACT_PATHS,
      censor: "[Redacted]"
    }
  };
}

function useJsonToStdout(): boolean {
  if (testReset?.stream) {
    return true;
  }
  if (testReset?.forceJson) {
    return true;
  }
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    return true;
  }
  return false;
}

/**
 * Pino app logger. JSON in production and in tests; pino-pretty in local dev (NODE_ENV=development or unset, non-test).
 */
export function getLogger(): Logger {
  if (appLoggerSingleton) {
    return appLoggerSingleton;
  }

  if (testReset?.stream) {
    appLoggerSingleton = pino(basePinoOptions(), testReset.stream);
    return appLoggerSingleton;
  }

  if (useJsonToStdout()) {
    appLoggerSingleton = pino(basePinoOptions(), pino.destination(1));
    return appLoggerSingleton;
  }

  appLoggerSingleton = pino(
    {
      ...basePinoOptions(),
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname"
        }
      }
    } as LoggerOptions
  );
  return appLoggerSingleton;
}

/**
 * One-off pino (not the singleton) — use with {@link import("../server.js").CreateServerOptions.pinoTestStream} so
 * integration tests can assert request logs without using the process singleton.
 */
export function createAppLoggerToStream(stream: Writable): Logger {
  return pino(basePinoOptions(), stream);
}

/**
 * @internal For Vitest: clears the singleton and applies optional per-test stream / JSON mode.
 */
export function resetLoggerForTests(options?: LoggerResetTestOptions): void {
  appLoggerSingleton = undefined;
  testReset = options;
}

export type SecurityAlertPayload = {
  alertType: "FAILED_AUTH_BURST" | "RATE_LIMIT_BURST" | "SUSPICIOUS_ACCESS" | "ANOMALOUS_REVOCATION" | "AGE_GATE_ABUSE";
  ipAddress?: string | null | undefined;
  userId?: string | null | undefined;
  path?: string | null | undefined;
  message: string;
  details?: Record<string, unknown> | undefined;
};


/**
 * Logs a structured SECURITY_ALERT JSON event for DPDP Sec 8(5) and security monitoring.
 */
export function logSecurityAlert(logger: Logger, alert: SecurityAlertPayload): void {
  logger.warn(
    {
      event: "SECURITY_ALERT",
      alertType: alert.alertType,
      ipAddress: alert.ipAddress ?? null,
      userId: alert.userId ?? null,
      path: alert.path ?? null,
      details: alert.details ?? {},
      timestamp: new Date().toISOString()
    },
    `[SECURITY_ALERT] ${alert.message}`
  );
}

