import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanBuyerOnly(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.$executeRawUnsafe('DELETE FROM "ConsentLog";');
  await db.ageGateLockout.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("buyer OTP end-to-end (Phase 2.10.1 / Phase 8.8 Age Gate)", () => {
  const prisma = getPrismaClient();

  beforeAll(() => {
    process.env.GOROLA_TEST_OTP = "111222";
  });

  afterAll(async () => {
    delete process.env.GOROLA_TEST_OTP;
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanBuyerOnly(prisma);
  });

  it("new phone returns ageGateRequired: true; existing adult user logs in, refreshes and logouts", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919988776601";

    // 1. New phone sends OTP and verifies -> returns ageGateRequired: true
    const sendRes = await server.inject({
      method: "POST",
      payload: { phone },
      url: "/api/v1/auth/buyer/send-otp"
    });
    expect(sendRes.statusCode).toBe(200);

    const verify1Res = await server.inject({
      method: "POST",
      payload: { otp: "111222", phone },
      url: "/api/v1/auth/buyer/verify-otp"
    });
    expect(verify1Res.statusCode).toBe(200);
    const body1 = verify1Res.json() as {
      data: {
        ageGateRequired?: boolean;
        ageTicket?: string;
      };
      success: boolean;
    };
    expect(body1.success).toBe(true);
    expect(body1.data.ageGateRequired).toBe(true);
    expect(body1.data.ageTicket).toBeDefined();

    // 2. Seed adult user with ageConfirmedAt
    const adultUser = await prisma.user.create({
      data: {
        name: "Adult Buyer",
        phone,
        phoneHash: hashPII(phone),
        isVerified: true,
        ageConfirmedAt: new Date(),
        ageConfirmedPolicyVersion: "1.1"
      }
    });

    // 3. Existing adult user logs in with OTP -> returns tokens directly
    const send2Res = await server.inject({
      method: "POST",
      payload: { phone },
      url: "/api/v1/auth/buyer/send-otp"
    });
    expect(send2Res.statusCode).toBe(200);

    const verify2Res = await server.inject({
      method: "POST",
      payload: { otp: "111222", phone },
      url: "/api/v1/auth/buyer/verify-otp"
    });
    expect(verify2Res.statusCode).toBe(200);
    const body2 = verify2Res.json() as {
      data: {
        accessToken: string;
        refreshToken: string;
        userId: string;
      };
    };
    expect(body2.data.userId).toBe(adultUser.id);
    expect(body2.data.accessToken).toBeDefined();
    expect(body2.data.refreshToken).toBeDefined();

    // 4. Session Refresh
    const refreshRes = await server.inject({
      method: "POST",
      payload: { refreshToken: body2.data.refreshToken },
      url: "/api/v1/auth/buyer/refresh"
    });
    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json() as { data: { refreshToken: string } };

    // 5. Session Logout
    const logoutRes = await server.inject({
      method: "POST",
      payload: { refreshToken: refreshBody.data.refreshToken },
      url: "/api/v1/auth/buyer/logout"
    });
    expect(logoutRes.statusCode).toBe(200);

    await server.close();
  });
});
