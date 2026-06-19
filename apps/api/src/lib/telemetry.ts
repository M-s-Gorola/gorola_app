import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

let sdk: NodeSDK | null = null;

/**
 * Selects trace exporter: OTLP HTTP to {@link process.env.OTEL_EXPORTER_ENDPOINT} when set, otherwise
 * console (useful in local dev without a collector).
 */
export function createTraceExporterFromEnv(): SpanExporter {
  const endpoint = process.env.OTEL_EXPORTER_ENDPOINT?.trim();
  if (endpoint) {
    return new OTLPTraceExporter({ url: endpoint });
  }
  return new ConsoleSpanExporter();
}

/**
 * @internal
 */
export function isTelemetryEnabledForTests(): boolean {
  return sdk !== null;
}

/**
 * @internal
 */
export async function resetTelemetryForTests(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

/**
 * Stops the SDK and flushes pending spans (e.g. on SIGTERM).
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }
  await sdk.shutdown();
  sdk = null;
}

/**
 * Idempotent. Skipped under Vitest and when `OTEL_ENABLED=false`.
 * Call from {@link startApp} before `import('./server.js')` so Prisma and Fastify are instrumented on first load.
 */
export async function startTelemetry(): Promise<void> {
  if (process.env.VITEST === "true" || process.env.OTEL_ENABLED === "false") {
    return;
  }
  if (sdk) {
    return;
  }
  const traceExporter = createTraceExporterFromEnv();
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "gorola-api"
    }),
    traceExporter,
    instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation(), new PrismaInstrumentation()]
  });
  sdk.start();
}
