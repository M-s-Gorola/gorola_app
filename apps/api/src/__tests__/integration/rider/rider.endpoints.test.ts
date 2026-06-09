import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

describe("Rider Interface Endpoints", () => {
  let app: FastifyInstance;
  let riderToken: string;

  beforeAll(async () => {
    app = await createServer({
      registerRoutes: (instance) => registerAppRoutes(instance)
    });
    await app.ready();

    const keys = resolveBuyerJwtKeyPair();
    riderToken = await new SignJWT({
      role: "RIDER",
      storeId: "test-store-id"
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("test-rider-id")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);
  });

  afterAll(async () => {
    await app.close();
  });


  it("PUT /api/v1/rider/location should return 501", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/rider/location",
      payload: { lat: 30.45, lng: 78.08 },
      headers: {
        authorization: `Bearer ${riderToken}`
      }
    });

    expect(response.statusCode).toBe(501);
    expect(response.json().error.code).toBe("NOT_IMPLEMENTED");
  });
});
