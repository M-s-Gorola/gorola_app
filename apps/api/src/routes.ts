import { NotImplementedError } from "@gorola/shared";
import type { FastifyInstance } from "fastify";

import { getPrismaClient } from "./lib/prisma.js";
import { registerAuthRoutes } from "./modules/auth/auth.controller.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { createBuyerTokenService } from "./modules/auth/buyer-token.service.js";
import { resolveBuyerJwtKeyPair } from "./modules/auth/jwt-keys.js";
import { createNoopOtpProvider } from "./modules/auth/noop-otp-provider.js";
import { registerCartRoutes } from "./modules/cart/cart.controller.js";
import { registerCategoryRoutes } from "./modules/catalog/category.controller.js";
import { registerProductRoutes } from "./modules/catalog/product.controller.js";
import { UserRepository } from "./modules/user/user.repository.js";

type RedisLikeRuntime = {
  del: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<void>;
};

function createInMemoryRedisLike(): RedisLikeRuntime {
  const store = new Map<string, string>();
  return {
    del: async (key) => Number(store.delete(key)),
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    }
  };
}

function getRuntimeRedis(app: FastifyInstance): RedisLikeRuntime {
  const runtimeRedis = (app as FastifyInstance & { redis?: RedisLikeRuntime | null }).redis;
  if (runtimeRedis !== undefined && runtimeRedis !== null) {
    return runtimeRedis as unknown as RedisLikeRuntime;
  }
  return createInMemoryRedisLike();
}

export function registerAppRoutes(app: FastifyInstance): void {
  registerCategoryRoutes(app);
  registerProductRoutes(app);
  registerCartRoutes(app);

  const redis = getRuntimeRedis(app);
  const keys = resolveBuyerJwtKeyPair();

  const tokenService = createBuyerTokenService({
    accessTtlSeconds: 15 * 60,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    redis,
    refreshTtlSeconds: 7 * 24 * 60 * 60
  });

  const userRepo = new UserRepository(getPrismaClient());

  const authService = new AuthService({
    ensureBuyerUser: async (phone) => {
      const row = await userRepo.ensureBuyerByPhone(phone);
      return {
        id: row.id,
        name: row.name,
        phone: row.phone
      };
    },
    otpProvider: createNoopOtpProvider(),
    otpTtlSeconds: 5 * 60,
    redis,
    tokenService
  });

  registerAuthRoutes(app, {
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
    },
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
    }
  });
}
