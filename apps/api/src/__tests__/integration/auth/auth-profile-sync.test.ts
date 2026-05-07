import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

describe("Regression: Profile Persistence (Session Sync)", () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  beforeAll(async () => {
    app = createServer({
      disableRedis: true, // Uses in-memory fallback defined in routes.ts
      registerRoutes: (server) => registerAppRoutes(server)
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should reflect name updates after a session refresh", async () => {
    const phone = "+919999988888";
    
    // 1. Seed a user
    const user = await prisma.user.upsert({
      where: { phone },
      update: { name: "Original Name", isVerified: true, isDeleted: false },
      create: { phone, name: "Original Name", isVerified: true }
    });

    // 2. Obtain a session (Login/Verify OTP flow)
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/send-otp",
      payload: { phone }
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/verify-otp",
      payload: { phone, otp: "123456" }
    });
    
    expect(loginRes.statusCode).toBe(200);
    const { accessToken, refreshToken, name: initialName } = loginRes.json().data;
    expect(initialName).toBe("Original Name");

    // 3. Update the profile name
    const updateRes = await app.inject({
      method: "PUT",
      url: "/api/v1/account/profile",
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      payload: { name: "Updated Name" }
    });
    
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().data.name).toBe("Updated Name");

    // 4. Trigger a session refresh
    // This is where the bug lived: it would use the 'Original Name' snapshot from Redis
    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/buyer/refresh",
      payload: { refreshToken }
    });

    expect(refreshRes.statusCode).toBe(200);
    const { name: refreshedName } = refreshRes.json().data;

    // ASSERTION: The refreshed session must have the NEW name from the database
    expect(refreshedName).toBe("Updated Name");
    
    // Cleanup
    await prisma.user.delete({ where: { id: user.id } });
  });
});
