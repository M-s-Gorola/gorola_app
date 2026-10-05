import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerUserRoutes } from "../../../modules/user/user.controller.js";
import { createServer } from "../../../server.js";

type UserRepositoryMock = {
  update: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  acceptPolicyVersion: ReturnType<typeof vi.fn>;
  getMyData: ReturnType<typeof vi.fn>;
};

type TokenVerifierMock = {
  verifyAccessToken: ReturnType<typeof vi.fn>;
};

function createUserRepositoryMock(): UserRepositoryMock {
  return {
    update: vi.fn(),
    findById: vi.fn(),
    acceptPolicyVersion: vi.fn(),
    getMyData: vi.fn()
  };
}

function createTokenVerifierMock(): TokenVerifierMock {
  return {
    verifyAccessToken: vi.fn()
  };
}

describe("user policy routes - Edge & Special Cases", () => {
  const servers: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(async (server) => server.close()));
    servers.length = 0;
  });

  describe("POST /api/v1/user/accept-policy", () => {
    it("Happy path: should accept policy version 1.1 and return 200 with sanitized data", async () => {
      const userRepository = createUserRepositoryMock();
      const tokenVerifier = createTokenVerifierMock();

      const mockUser = { sub: "u123", role: "BUYER" };
      tokenVerifier.verifyAccessToken.mockResolvedValueOnce(mockUser);
      userRepository.acceptPolicyVersion.mockResolvedValueOnce({
        id: "u123",
        privacyPolicyVersionAccepted: "1.1"
      });

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        headers: {
          authorization: "Bearer valid-token"
        },
        payload: { version: "1.1" }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.accepted).toBe(true);
      expect(body.data.version).toBe("1.1");
      expect(userRepository.acceptPolicyVersion).toHaveBeenCalledWith("u123", "1.1");
    });

    it("Edge case: should reject invalid policy version string ('9.9') with 400", async () => {
      const userRepository = createUserRepositoryMock();
      const tokenVerifier = createTokenVerifierMock();

      tokenVerifier.verifyAccessToken.mockResolvedValueOnce({ sub: "u123", role: "BUYER" });

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        headers: {
          authorization: "Bearer valid-token"
        },
        payload: { version: "9.9" }
      });

      expect(response.statusCode).toBe(400);
    });

    it("Security case: should return 401 when unauthenticated", async () => {
      const userRepository = createUserRepositoryMock();
      const tokenVerifier = createTokenVerifierMock();

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        payload: { version: "1.0" }
      });

      expect(response.statusCode).toBe(401);
    });

    it("Security case: should return 403 when authenticated as non-BUYER role (e.g. STORE_OWNER)", async () => {
      const userRepository = createUserRepositoryMock();
      const tokenVerifier = createTokenVerifierMock();

      tokenVerifier.verifyAccessToken.mockResolvedValueOnce({ sub: "owner-1", role: "STORE_OWNER" });

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        headers: {
          authorization: "Bearer valid-store-token"
        },
        payload: { version: "2.0" }
      });

      expect(response.statusCode).toBe(403);
    });

    it("Edge case: should reject empty string version with 400", async () => {
      const userRepository = createUserRepositoryMock();
      const tokenVerifier = createTokenVerifierMock();

      tokenVerifier.verifyAccessToken.mockResolvedValueOnce({ sub: "u123", role: "BUYER" });

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        headers: {
          authorization: "Bearer valid-token"
        },
        payload: { version: "" }
      });

      expect(response.statusCode).toBe(400);
    });

    it("Edge case: should reject whitespace-only version with 400", async () => {
      const userRepository = createUserRepositoryMock();
      const tokenVerifier = createTokenVerifierMock();

      tokenVerifier.verifyAccessToken.mockResolvedValueOnce({ sub: "u123", role: "BUYER" });

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        headers: {
          authorization: "Bearer valid-token"
        },
        payload: { version: "    " }
      });

      expect(response.statusCode).toBe(400);
    });

    it("Edge case: should reject oversized version string (>20 chars) with 400", async () => {
      const userRepository = createUserRepositoryMock();
      const tokenVerifier = createTokenVerifierMock();

      tokenVerifier.verifyAccessToken.mockResolvedValueOnce({ sub: "u123", role: "BUYER" });

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        headers: {
          authorization: "Bearer valid-token"
        },
        payload: { version: "1.0.0.0.0.0.0.0.0.0.0.0.0" }
      });

      expect(response.statusCode).toBe(400);
    });

    it("Edge case: should reject missing or non-string version payload with 400", async () => {
      const userRepository = createUserRepositoryMock();
      const tokenVerifier = createTokenVerifierMock();

      tokenVerifier.verifyAccessToken.mockResolvedValue({ sub: "u123", role: "BUYER" });

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const res1 = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        headers: { authorization: "Bearer valid-token" },
        payload: {}
      });
      expect(res1.statusCode).toBe(400);

      const res2 = await server.inject({
        method: "POST",
        url: "/api/v1/user/accept-policy",
        headers: { authorization: "Bearer valid-token" },
        payload: { version: 12345 }
      });
      expect(res2.statusCode).toBe(400);
    });
  });
});
