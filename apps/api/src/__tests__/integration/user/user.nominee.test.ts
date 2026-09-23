import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerUserRoutes } from "../../../modules/user/user.controller.js";
import { createServer } from "../../../server.js";

describe("DPDP Act Section 14 (Right to Nominate) Routes", () => {
  const servers: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(async (server) => server.close()));
    servers.length = 0;
  });

  describe("PUT /api/v1/user/nominee", () => {
    it("should update nominee details and return 200 for valid payload", async () => {
      const userRepository = {
        update: vi.fn(),
        findById: vi.fn(),
        getMyData: vi.fn(),
        updateNominee: vi.fn().mockResolvedValueOnce({
          nomineeName: "Aarav Sharma",
          nomineeContact: "+919876543211",
          nomineeRelationship: "Sibling"
        })
      };

      const tokenVerifier = {
        verifyAccessToken: vi.fn().mockResolvedValue({ sub: "u_nominee_1", role: "BUYER" })
      };

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/user/nominee",
        headers: {
          authorization: "Bearer valid-token"
        },
        payload: {
          nomineeName: "Aarav Sharma",
          nomineeContact: "+919876543211",
          nomineeRelationship: "Sibling"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.nomineeName).toBe("Aarav Sharma");
      expect(body.data.nomineeContact).toBe("+919876543211");
      expect(body.data.nomineeRelationship).toBe("Sibling");
      expect(userRepository.updateNominee).toHaveBeenCalledWith("u_nominee_1", {
        nomineeName: "Aarav Sharma",
        nomineeContact: "+919876543211",
        nomineeRelationship: "Sibling"
      });
    });

    it("should allow clearing nominee details with null values", async () => {
      const userRepository = {
        update: vi.fn(),
        findById: vi.fn(),
        getMyData: vi.fn(),
        updateNominee: vi.fn().mockResolvedValueOnce({
          nomineeName: null,
          nomineeContact: null,
          nomineeRelationship: null
        })
      };

      const tokenVerifier = {
        verifyAccessToken: vi.fn().mockResolvedValue({ sub: "u_nominee_1", role: "BUYER" })
      };

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/user/nominee",
        headers: {
          authorization: "Bearer valid-token"
        },
        payload: {
          nomineeName: null,
          nomineeContact: null,
          nomineeRelationship: null
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.nomineeName).toBeNull();
    });
  });

  describe("GET /api/v1/user/nominee", () => {
    it("should return nominee details for authenticated buyer", async () => {
      const userRepository = {
        update: vi.fn(),
        findById: vi.fn(),
        getMyData: vi.fn(),
        getNominee: vi.fn().mockResolvedValueOnce({
          nomineeName: "Aarav Sharma",
          nomineeContact: "+919876543211",
          nomineeRelationship: "Sibling"
        })
      };

      const tokenVerifier = {
        verifyAccessToken: vi.fn().mockResolvedValue({ sub: "u_nominee_1", role: "BUYER" })
      };

      const server = createServer({
        disableRedis: true,
        // @ts-expect-error - mock dependencies
        registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
      });
      servers.push(server);

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/user/nominee",
        headers: {
          authorization: "Bearer valid-token"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.nomineeName).toBe("Aarav Sharma");
      expect(userRepository.getNominee).toHaveBeenCalledWith("u_nominee_1");
    });
  });
});
