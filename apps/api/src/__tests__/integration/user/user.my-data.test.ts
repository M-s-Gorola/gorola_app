import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerUserRoutes } from "../../../modules/user/user.controller.js";
import { createServer } from "../../../server.js";

describe("GET /api/v1/user/my-data (DPDP Right to Access & Data Portability)", () => {
  const servers: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(async (server) => server.close()));
    servers.length = 0;
  });

  it("should return complete sanitized user data export for authenticated buyer", async () => {
    const userRepository = {
      update: vi.fn(),
      findById: vi.fn(),
      getMyData: vi.fn().mockResolvedValueOnce({
        profile: {
          id: "usr_123",
          name: "Vikram Sharma",
          phone: "+919876543210",
          createdAt: "2026-05-10T10:00:00.000Z"
        },
        addresses: [
          {
            id: "addr_1",
            label: "Home",
            landmarkDescription: "Near Picture Palace, Mall Road",
            flatRoom: "Flat 4B",
            lat: 30.4598,
            lng: 78.0644,
            isDefault: true,
            createdAt: "2026-05-10T10:05:00.000Z"
          }
        ],
        orders: [
          {
            id: "ord_101",
            orderType: "QUICK",
            status: "DELIVERED",
            subtotal: 450,
            deliveryFee: 30,
            total: 480,
            paymentMethod: "UPI",
            paymentStatus: "CAPTURED",
            createdAt: "2026-05-11T12:00:00.000Z",
            items: [
              {
                productName: "Organic Mountain Apples",
                variantLabel: "1 kg",
                price: 150,
                quantity: 3
              }
            ]
          }
        ],
        consents: [
          {
            id: "c_1",
            purpose: "OTP_AUTH",
            consentVersion: "1.0",
            noticeText: "Authentication notice",
            isWithdrawn: false,
            createdAt: "2026-05-10T10:00:00.000Z",
            withdrawnAt: null
          },
          {
            id: "c_2",
            purpose: "ORDER_PROCESSING",
            consentVersion: "1.0",
            noticeText: "Order fulfillment notice",
            isWithdrawn: false,
            createdAt: "2026-05-10T10:05:00.000Z",
            withdrawnAt: null
          }
        ]
      })
    };

    const tokenVerifier = {
      verifyAccessToken: vi.fn().mockResolvedValue({ sub: "usr_123", role: "BUYER" })
    };

    const server = createServer({
      disableRedis: true,
      // @ts-expect-error - mock dependencies
      registerRoutes: (app) => registerUserRoutes(app, { userRepository, tokenVerifier })
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/user/my-data",
      headers: {
        authorization: "Bearer valid-buyer-token"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.profile.name).toBe("Vikram Sharma");
    expect(body.data.profile.phone).toBe("+919876543210");
    expect(body.data.addresses).toHaveLength(1);
    expect(body.data.orders).toHaveLength(1);
    expect(body.data.consents).toHaveLength(2);
    expect(userRepository.getMyData).toHaveBeenCalledWith("usr_123");
  });

  it("should return 401 when unauthenticated", async () => {
    const userRepository = {
      update: vi.fn(),
      findById: vi.fn(),
      getMyData: vi.fn()
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
      method: "GET",
      url: "/api/v1/user/my-data"
    });

    expect(response.statusCode).toBe(401);
  });
});
