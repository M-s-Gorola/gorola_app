import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerUserRoutes } from "../../../modules/user/user.controller.js";
import { createServer } from "../../../server.js";

describe("POST /api/v1/user/reactivate-account (Account Recovery in 30-Day Grace Period)", () => {
  const servers: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(async (server) => server.close()));
    servers.length = 0;
  });

  it("should reactivate account and clear soft-deletion status", async () => {
    const userRepository = {
      update: vi.fn(),
      findById: vi.fn(),
      getMyData: vi.fn(),
      updateNominee: vi.fn(),
      getNominee: vi.fn(),
      markPendingDeletion: vi.fn(),
      reactivateAccount: vi.fn().mockResolvedValueOnce({
        id: "usr_reactivate_1",
        name: "Vikram Sharma",
        phone: "+919876543210",
        isDeleted: false,
        deletedAt: null,
        deletionScheduledFor: null
      })
    };

    const tokenVerifier = {
      verifyAccessToken: vi.fn().mockResolvedValue({ sub: "usr_reactivate_1", role: "BUYER" })
    };

    const server = createServer({
      disableRedis: true,
      // @ts-expect-error - mock dependencies
      registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/user/reactivate-account",
      headers: {
        authorization: "Bearer valid-token"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.reactivated).toBe(true);
    expect(body.data.user.name).toBe("Vikram Sharma");
    expect(userRepository.reactivateAccount).toHaveBeenCalledWith("usr_reactivate_1");
  });
});
