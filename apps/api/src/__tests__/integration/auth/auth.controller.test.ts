import { ValidationError } from "@gorola/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerAuthRoutes } from "../../../modules/auth/auth.controller.js";
import { createServer } from "../../../server.js";

type AuthServiceMock = {
  logout: ReturnType<typeof vi.fn>;
  refreshToken: ReturnType<typeof vi.fn>;
  sendOtp: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
};

type StoreOwnerAuthServiceMock = {
  login: ReturnType<typeof vi.fn>;
  setup2FA: ReturnType<typeof vi.fn>;
  verify2FA: ReturnType<typeof vi.fn>;
};

type AdminAuthServiceMock = {
  login: ReturnType<typeof vi.fn>;
  setup2FA: ReturnType<typeof vi.fn>;
  verify2FA: ReturnType<typeof vi.fn>;
};

function createAuthServiceMock(): AuthServiceMock {
  return {
    logout: vi.fn(),
    refreshToken: vi.fn(),
    sendOtp: vi.fn(),
    verifyOtp: vi.fn()
  };
}

function createStoreOwnerAuthServiceMock(): StoreOwnerAuthServiceMock {
  return {
    login: vi.fn(),
    setup2FA: vi.fn(),
    verify2FA: vi.fn()
  };
}

function createAdminAuthServiceMock(): AdminAuthServiceMock {
  return {
    login: vi.fn(),
    setup2FA: vi.fn(),
    verify2FA: vi.fn()
  };
}

describe("auth controller routes", () => {
  const servers: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(async (server) => server.close()));
    servers.length = 0;
  });

  it("POST /api/v1/auth/buyer/send-otp should return success envelope", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    authService.sendOtp.mockResolvedValueOnce(undefined);

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: { phone: "+919876543210" },
      url: "/api/v1/auth/buyer/send-otp"
    });

    expect(response.statusCode).toBe(200);
    expect(authService.sendOtp).toHaveBeenCalledWith({ phone: "+919876543210" });
    expect(response.json()).toEqual({
      success: true,
      data: { sent: true },
      meta: { requestId: expect.any(String) }
    });
  });

  it("POST /api/v1/auth/buyer/send-otp should return validation envelope for bad payload", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: { phone: "9876543210" },
      url: "/api/v1/auth/buyer/send-otp"
    });

    expect(response.statusCode).toBe(400);
    expect(authService.sendOtp).not.toHaveBeenCalled();
  });

  it("POST /api/v1/auth/buyer/verify-otp should return token pair and set refresh cookie", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    authService.verifyOtp.mockResolvedValueOnce({
      accessToken: "access",
      name: null,
      phone: "+919876543210",
      refreshToken: "refresh",
      userId: "user_cuid_abc"
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: {
        otp: "123456",
        phone: "+919876543210"
      },
      url: "/api/v1/auth/buyer/verify-otp"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      accessToken: "access",
      name: null,
      phone: "+919876543210",
      refreshToken: "refresh",
      userId: "user_cuid_abc"
    });
    expect(response.headers["set-cookie"]).toEqual(expect.any(String));
  });

  it("POST /api/v1/auth/buyer/refresh should rotate tokens", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    authService.refreshToken.mockResolvedValueOnce({
      accessToken: "next-access",
      refreshToken: "next-refresh"
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: { refreshToken: "old-refresh" },
      url: "/api/v1/auth/buyer/refresh"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toBe("next-access");
    expect(authService.refreshToken).toHaveBeenCalledWith({
      refreshToken: "old-refresh"
    });
  });

  it("POST /api/v1/auth/buyer/logout should revoke token", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    authService.logout.mockResolvedValueOnce(undefined);

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: { refreshToken: "refresh" },
      url: "/api/v1/auth/buyer/logout"
    });

    expect(response.statusCode).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith({ refreshToken: "refresh" });
    expect(response.json()).toEqual({
      success: true,
      data: { loggedOut: true },
      meta: { requestId: expect.any(String) }
    });
  });

  it("should pass through service typed errors", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    authService.sendOtp.mockRejectedValueOnce(new ValidationError("payload invalid"));

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: { phone: "+919876543210" },
      url: "/api/v1/auth/buyer/send-otp"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/auth/store-owner/login should return tokens", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    storeOwnerAuthService.login.mockResolvedValueOnce({
      accessToken: "store-access",
      refreshToken: "store-refresh"
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: {
        email: "owner@gorola.in",
        password: "Owner#123"
      },
      url: "/api/v1/auth/store-owner/login"
    });

    expect(response.statusCode).toBe(200);
    expect(storeOwnerAuthService.login).toHaveBeenCalledWith({
      email: "owner@gorola.in",
      password: "Owner#123",
      totpCode: undefined
    });
  });

  it("POST /api/v1/auth/store-owner/setup-2fa should return qr code details", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    storeOwnerAuthService.setup2FA.mockResolvedValueOnce({
      qrCodeUri: "otpauth://store-owner",
      secret: "store-secret"
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: { email: "owner@gorola.in" },
      url: "/api/v1/auth/store-owner/setup-2fa"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.secret).toBe("store-secret");
  });

  it("POST /api/v1/auth/admin/login should require and use totp code", async () => {
    const authService = createAuthServiceMock();
    const storeOwnerAuthService = createStoreOwnerAuthServiceMock();
    const adminAuthService = createAdminAuthServiceMock();
    adminAuthService.login.mockResolvedValueOnce({
      accessToken: "admin-access",
      refreshToken: "admin-refresh"
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: (app) =>
        registerAuthRoutes(app, { adminAuthService, authService, storeOwnerAuthService })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      payload: {
        email: "admin@gorola.in",
        password: "Admin#123",
        totpCode: "123456"
      },
      url: "/api/v1/auth/admin/login"
    });

    expect(response.statusCode).toBe(200);
    expect(adminAuthService.login).toHaveBeenCalledWith({
      email: "admin@gorola.in",
      password: "Admin#123",
      totpCode: "123456"
    });
  });
});
