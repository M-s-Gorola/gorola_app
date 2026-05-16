import { getPrismaClient } from "./prisma.js";
import { getRedisClient } from "./redis.js";

/**
 * Resolves lazily-connected clients **before** the HTTP server accepts traffic so the
 * first buyer request does not block on Postgres/Redis handshakes (observed ~7s+ then 500).
 */
export async function warmupExternalConnections(): Promise<void> {
  await getPrismaClient().$connect();

  const redis = getRedisClient();
  if (redis !== null && process.env.NODE_ENV !== "test") {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    await redis.ping();
  }
}
