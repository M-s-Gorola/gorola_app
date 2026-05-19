import { Redis } from "ioredis";

let redisSingleton: Redis | null = null;

export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  const useMock =
    !redisUrl ||
    process.env.USE_MOCK_REDIS === "true" ||
    process.env.NODE_ENV === "development";

  if (useMock) {
    if (!redisSingleton) {
      const store = new Map<string, string>();
      redisSingleton = {
        status: "ready",
        get: async (key: string) => store.get(key) ?? null,
        set: async (key: string, value: string) => {
          store.set(key, value);
          return "OK";
        },
        del: async (key: string) => {
          store.delete(key);
          return 1;
        },
        ping: async () => "PONG",
        connect: async () => {},
        disconnect: () => {}
      } as unknown as Redis;
    }
    return redisSingleton;
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
