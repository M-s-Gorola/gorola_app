import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { registerAuthRoutes } from "../../../modules/auth/auth.controller.js";
import { AuthService } from "../../../modules/auth/auth.service.js";
import { createBuyerTokenService } from "../../../modules/auth/buyer-token.service.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { createNoopOtpProvider } from "../../../modules/auth/noop-otp-provider.js";
import { createServer } from "../../../server.js";

type RedisStore = Map<string, string>;

function createMockRedis(): {
  del: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<void>;
  _store: RedisStore;
} {
  const store = new Map<string, string>();
  return {
    _store: store,
    del: async (key: string) => Number(store.delete(key)),
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
    }
  };
}

describe("Phase 8.4.1 — Active Sessions & Remote Revoke", () => {
  const servers: FastifyInstance[] = [];
  let redis: ReturnType<typeof createMockRedis>;
  let authService: AuthService;
  let tokenService: ReturnType<typeof createBuyerTokenService>;

  const testUser = {
    id: "user-buyer-session-123",
    name: "Mussoorie Buyer",
    phone: "+919876543210",
    isActive: true,
    deletedAt: null,
    deletionScheduledFor: null
  };

  beforeAll(() => {
    process.env.GOROLA_TEST_OTP = "111222";
  });

  afterAll(() => {
    delete process.env.GOROLA_TEST_OTP;
  });

  beforeEach(() => {
    redis = createMockRedis();
    const keys = resolveBuyerJwtKeyPair();

    tokenService = createBuyerTokenService({
      accessTtlSeconds: 15 * 60,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      redis,
      refreshTtlSeconds: 7 * 24 * 60 * 60
    });

    authService = new AuthService({
      ensureBuyerUser: async () => testUser,
      findUserById: async (id) => (id === testUser.id ? testUser : null),
      otpProvider: createNoopOtpProvider(),
      otpTtlSeconds: 5 * 60,
      redis,
      tokenService
    });
  });

  afterEach(async () => {
    await Promise.all(servers.map(async (server) => server.close()));
    servers.length = 0;
  });

  function buildTestServer(): FastifyInstance {
    const dummyAdminAuthService = {
      login: async () => ({ accessToken: "", refreshToken: "" }),
      setup2FA: async () => ({ qrCodeUri: "", secret: "" }),
      verify2FA: async () => undefined,
      refreshToken: async () => ({ accessToken: "", refreshToken: "" }),
      logout: async () => undefined
    };
    const dummyStoreOwnerAuthService = {
      login: async () => ({ accessToken: "", refreshToken: "" }),
      setup2FA: async () => ({ qrCodeUri: "", secret: "" }),
      verify2FA: async () => undefined,
      refreshToken: async () => ({ accessToken: "", refreshToken: "" }),
      logout: async () => undefined
    };


    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, {
          adminAuthService: dummyAdminAuthService,
          authService,
          storeOwnerAuthService: dummyStoreOwnerAuthService,
          tokenVerifier: tokenService
        })
    });
    servers.push(server);
    return server;
  }

  it("GET /api/v1/auth/sessions returns 401 when unauthenticated", async () => {
    const server = buildTestServer();
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/auth/sessions"
    });

    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/auth/sessions lists active sessions and marks isCurrent", async () => {
    const server = buildTestServer();

    // 1. Send OTP & verify to establish Session 1
    await authService.sendOtp({ phone: testUser.phone });
    await authService.verifyOtp({
      phone: testUser.phone,
      otp: "111222"
    }, {
      ipAddress: "103.21.244.2",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"
    });


    // 2. Establish Session 2 (e.g. from Laptop)
    await authService.sendOtp({ phone: testUser.phone });
    const session2 = await authService.verifyOtp({
      phone: testUser.phone,
      otp: "111222"
    }, {
      ipAddress: "14.139.240.10",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    });

    // 3. Request sessions using Session 2's access token and refresh cookie
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/auth/sessions",
      headers: {
        authorization: `Bearer ${session2.accessToken}`,
        cookie: `refreshToken=${session2.refreshToken}`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.sessions)).toBe(true);
    expect(body.data.sessions).toHaveLength(2);

    const currentSession = body.data.sessions.find((s: { isCurrent: boolean }) => s.isCurrent === true);
    expect(currentSession).toBeDefined();
    expect(currentSession?.ipAddress).toBe("14.139.240.10");

    const otherSession = body.data.sessions.find((s: { isCurrent: boolean }) => s.isCurrent === false);
    expect(otherSession).toBeDefined();
    expect(otherSession?.ipAddress).toBe("103.21.244.2");
  });

  it("DELETE /api/v1/auth/sessions terminates all sessions and revokes refresh tokens in Redis", async () => {
    const server = buildTestServer();

    // Create 2 sessions
    await authService.sendOtp({ phone: testUser.phone });
    const session1 = await authService.verifyOtp({ phone: testUser.phone, otp: "111222" });

    await authService.sendOtp({ phone: testUser.phone });
    const session2 = await authService.verifyOtp({ phone: testUser.phone, otp: "111222" });

    // Assert both refresh tokens exist in Redis
    expect(await redis.get(`rt:${session1.refreshToken}`)).not.toBeNull();
    expect(await redis.get(`rt:${session2.refreshToken}`)).not.toBeNull();

    // Call DELETE /api/v1/auth/sessions
    const res = await server.inject({
      method: "DELETE",
      url: "/api/v1/auth/sessions",
      headers: {
        authorization: `Bearer ${session1.accessToken}`
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.terminatedCount).toBe(2);

    // Assert both refresh tokens are deleted in Redis
    expect(await redis.get(`rt:${session1.refreshToken}`)).toBeNull();
    expect(await redis.get(`rt:${session2.refreshToken}`)).toBeNull();

    // Querying active sessions should now return empty array
    const sessionsAfter = await authService.getActiveSessions(testUser.id);
    expect(sessionsAfter).toEqual([]);
  });
});
