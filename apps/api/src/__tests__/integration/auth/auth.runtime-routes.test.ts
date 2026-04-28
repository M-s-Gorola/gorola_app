import { describe, expect, it } from "vitest";

import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

describe("Auth runtime route registration", () => {
  it("POST /api/v1/auth/buyer/send-otp is reachable via registerAppRoutes", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/send-otp",
      payload: {
        phone: "+919876543210"
      }
    });

    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: {
        sent: true
      },
      meta: {
        requestId: expect.any(String)
      }
    });
  });
});
