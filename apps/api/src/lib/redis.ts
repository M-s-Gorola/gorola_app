import { Redis } from "ioredis";

let redisSingleton: Redis | null = null;

export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (!redisSingleton) {
    redisSingleton = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      enableOfflineQueue: false // Fail fast if not connected
    });
  }

  return redisSingleton;
}

export async function disconnectRedis(): Promise<void> {
  if (redisSingleton) {
    // Use disconnect() for immediate closure during teardown
    redisSingleton.disconnect();
    redisSingleton = null;
  }
}
