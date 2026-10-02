import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerUserRoutes } from "../../../modules/user/user.controller.js";
import { createServer } from "../../../server.js";

describe("DELETE /api/v1/user/account (DPDP Act Section 12 - Right to Erasure)", () => {
  const servers: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(async (server) => server.close()));
    servers.length = 0;
  });

  it("should mark account pending deletion with 30-day grace period and invalidate sessions", async () => {
    const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const userRepository = {
      update: vi.fn(),
      findById: vi.fn(),
      getMyData: vi.fn(),
      updateNominee: vi.fn(),
      getNominee: vi.fn(),
      markPendingDeletion: vi.fn().mockResolvedValueOnce({
        id: "usr_del_1",
        deletedAt: new Date().toISOString(),
        deletionScheduledFor: scheduledDate
      })
    };

    const tokenVerifier = {
      verifyAccessToken: vi.fn().mockResolvedValue({ sub: "usr_del_1", role: "BUYER" }),
      revokeAllUserTokens: vi.fn().mockResolvedValue(undefined)
    };

    const server = createServer({
      disableRedis: true,
      // @ts-expect-error - mock dependencies
      registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
    });
    servers.push(server);

    const response = await server.inject({
      method: "DELETE",
      url: "/api/v1/user/account",
      headers: {
        authorization: "Bearer valid-token"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.isPendingDeletion).toBe(true);
    expect(body.data.deletionScheduledFor).toBeDefined();
    expect(userRepository.markPendingDeletion).toHaveBeenCalledWith("usr_del_1");
  });

  it("should return 401 when unauthenticated", async () => {
    const userRepository = {
      update: vi.fn(),
      findById: vi.fn(),
      getMyData: vi.fn(),
      updateNominee: vi.fn(),
      getNominee: vi.fn(),
      markPendingDeletion: vi.fn()
    };
    const tokenVerifier = {
      verifyAccessToken: vi.fn().mockRejectedValue(new Error("Unauthorized"))
    };

    const server = createServer({
      disableRedis: true,
      // @ts-expect-error - mock dependencies
      registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
    });
    servers.push(server);

    const response = await server.inject({
      method: "DELETE",
      url: "/api/v1/user/account"
    });

    expect(response.statusCode).toBe(401);
  });
});
