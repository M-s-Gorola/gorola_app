import type { Writable } from "node:stream";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { AppError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastify from "fastify";
import fp from "fastify-plugin";
import { v4 as uuidV4 } from "uuid";

import { API_VERSION } from "./lib/api-version.js";
import {
  buildHealthData,
  getHealthState,
  type HealthCheckResult,
  runHealthProbes
} from "./lib/health.js";
import { createAppLoggerToStream, getLogger } from "./lib/logger.js";
import { getPrismaClient } from "./lib/prisma.js";
import { getRedisClient } from "./lib/redis.js";

const requestIdPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  app.addHook("onRequest", async (request, reply) => {
    const requestId = request.headers["x-request-id"]?.toString() ?? uuidV4();
    request.headers["x-request-id"] = requestId;
    reply.header("x-request-id", requestId);
  });
});

type RouteRegistrar = (app: FastifyInstance) => void | Promise<void>;

export type CreateServerOptions = {
  registerRoutes?: RouteRegistrar;
  disableRedis?: boolean;
  /** When set, Fastify uses this pino instance target so tests can assert JSON log lines. */
  pinoTestStream?: Writable;
  /**
   * Override health probes (e.g. integration tests for 200 / 200 degraded / 503 down).
   * When omitted, uses Prisma `SELECT 1` and Redis `PING` against the live clients.
   */
  healthProbes?: {
    checkDatabase: () => Promise<HealthCheckResult>;
    checkRedis: () => Promise<HealthCheckResult>;
  };
  /** Fixed clock for health `timestamp` in tests. */
  nowIso?: () => string;
};

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    requestId: string;
  };
};

function getRequestId(request: FastifyRequest, reply: FastifyReply): string {
  return reply.getHeader("x-request-id")?.toString() ?? request.id;
}

function coerceToAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : "Internal server error";
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string"
      ? ((error as Record<string, unknown>).code as string)
      : "INTERNAL_SERVER_ERROR";
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as Record<string, unknown>).statusCode === "number"
      ? ((error as Record<string, unknown>).statusCode as number)
      : 500;
  return new AppError(message, { code, statusCode });
}

export function success<T>(request: FastifyRequest, reply: FastifyReply, data: T): SuccessEnvelope<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: getRequestId(request, reply)
    }
  };
}

export function createServer(options: CreateServerOptions = {}): FastifyInstance {
  const appLogger = options.pinoTestStream
    ? createAppLoggerToStream(options.pinoTestStream)
    : getLogger();

  const app = fastify({
    loggerInstance: appLogger,
    disableRequestLogging: true
  });

  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  void app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"]
      }
    }
  });
  void app.register(cors, {
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    origin: corsOrigins.length === 0 ? true : corsOrigins,
    credentials: true,
    strictPreflight: true
  });

  const redisClient =
    process.env.NODE_ENV === "test" || options.disableRedis ? null : getRedisClient();
  void app.register(rateLimit, {
    global: true,
    max: process.env.NODE_ENV === "production" ? 100 : 1000,
    timeWindow: "1 minute",
    ...(redisClient
      ? {
          redis: redisClient
        }
      : {})
  });
  void app.register(cookie);
  app.addHook("preHandler", async (_request, reply) => {
    const originalSetCookie = reply.setCookie.bind(reply);
    reply.setCookie = ((name, value, options = {}) =>
      originalSetCookie(name, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        ...options
      })) as typeof reply.setCookie;
  });
  void app.register(requestIdPlugin);

  app.addHook("onResponse", (request, reply, done) => {
    const requestId = reply.getHeader("x-request-id")?.toString() ?? request.id;
    request.log.info(
      {
        event: "request",
        requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime
      },
      "request completed"
    );
    done();
  });

  app.decorate("prisma", getPrismaClient());
  app.decorate("redis", redisClient);

  app.setErrorHandler((error, request, reply) => {
    if (!(error instanceof AppError)) {
      request.log.error({ err: error }, "unhandled_route_error");
    }
    const appError = coerceToAppError(error);
    const payload: ErrorEnvelope = {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { details: appError.details as Record<string, unknown> } : {})
      },
      meta: {
        requestId: getRequestId(request, reply)
      }
    };

    void reply.status(appError.statusCode).send(payload);
  });

  app.get("/api/health", async (request, reply) => {
    const checks = options.healthProbes
      ? {
          database: await options.healthProbes.checkDatabase(),
          redis: await options.healthProbes.checkRedis()
        }
      : await runHealthProbes(getPrismaClient(), redisClient);
    const state = getHealthState(checks);
    const getNow = options.nowIso ?? (() => new Date().toISOString());
    const data = buildHealthData(state, checks, API_VERSION, getNow);
    return reply.status(state.statusCode).send(success(request, reply, data));
  });

  if (options.registerRoutes) {
    void app.register(fp(async (registeredApp) => options.registerRoutes?.(registeredApp)));
  }

  return app as unknown as FastifyInstance;
}
