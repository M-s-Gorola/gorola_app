import type { FastifyInstance } from "fastify";
import { afterAll,beforeAll, describe, expect, it } from "vitest";

import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

describe("Rider Interface Stubs (W-015)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer({
      registerRoutes: (instance) => registerAppRoutes(instance)
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/rider/auth/login should return 501", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/rider/auth/login",
      payload: { email: "rider@example.com", password: "password" }
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Rider interface deferred to Phase 5"
      },
      meta: { requestId: expect.any(String) }
    });
  });

  it("GET /api/v1/rider/orders/active should return 501", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/rider/orders/active"
    });

    expect(response.statusCode).toBe(501);
    expect(response.json().error.code).toBe("NOT_IMPLEMENTED");
  });

  it("PUT /api/v1/rider/orders/:id/status should return 501", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/rider/orders/123/status",
      payload: { status: "DELIVERED" }
    });

    expect(response.statusCode).toBe(501);
    expect(response.json().error.code).toBe("NOT_IMPLEMENTED");
  });

  it("PUT /api/v1/rider/location should return 501", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/rider/location",
      payload: { lat: 30.45, lng: 78.08 }
    });

    expect(response.statusCode).toBe(501);
    expect(response.json().error.code).toBe("NOT_IMPLEMENTED");
  });
});
