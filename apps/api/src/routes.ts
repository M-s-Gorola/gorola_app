import { randomUUID } from "node:crypto";

import { NotImplementedError } from "@gorola/shared";
import type { FastifyInstance } from "fastify";

import { registerAuthRoutes } from "./modules/auth/auth.controller.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { registerCategoryRoutes } from "./modules/catalog/category.controller.js";

type RedisLikeRuntime = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<void>;
  del: (key: string) => Promise<number>;
};

function createInMemoryRedisLike(): RedisLikeRuntime {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    },
    del: async (key) => Number(store.delete(key))
  };
}

function getRuntimeRedis(app: FastifyInstance): RedisLikeRuntime {
  const runtimeRedis = (app as FastifyInstance & { redis?: RedisLikeRuntime | null }).redis;
  if (runtimeRedis) {
    return runtimeRedis;
  }
  return createInMemoryRedisLike();
}

export function registerAppRoutes(app: FastifyInstance): void {
  registerCategoryRoutes(app);
  // TEMP STUB (Phase 2.61): buyer auth route reachability uses mock OTP sender and mock token issue/rotate.
  // Replace with real provider + token-service runtime wiring before production auth rollout.
  const authService = new AuthService({
    redis: getRuntimeRedis(app),
    otpProvider: {
      sendOtp: async () => {
        return;
      }
    },
    tokenService: {
      issueTokens: async () => ({
        accessToken: `buyer-access-${randomUUID()}`,
        refreshToken: `buyer-refresh-${randomUUID()}`
      }),
      rotateRefreshToken: async () => ({
        accessToken: `buyer-access-${randomUUID()}`,
        refreshToken: `buyer-refresh-${randomUUID()}`
      }),
      revokeRefreshToken: async () => {
        return;
      }
    },
    otpTtlSeconds: 5 * 60
  });
  // TEMP STUB (Phase 2.61): store-owner/admin runtime auth services are intentionally not wired yet.
  // Explicit NotImplemented placeholders prevent accidental false-success behavior.
  registerAuthRoutes(app, {
    authService,
    storeOwnerAuthService: {
      login: async () => {
        throw new NotImplementedError("Store owner auth runtime wiring pending");
      },
      setup2FA: async () => {
        throw new NotImplementedError("Store owner auth runtime wiring pending");
      },
      verify2FA: async () => {
        throw new NotImplementedError("Store owner auth runtime wiring pending");
      }
    },
    adminAuthService: {
      login: async () => {
        throw new NotImplementedError("Admin auth runtime wiring pending");
      },
      setup2FA: async () => {
        throw new NotImplementedError("Admin auth runtime wiring pending");
      },
      verify2FA: async () => {
        throw new NotImplementedError("Admin auth runtime wiring pending");
      }
    }
  });
}
