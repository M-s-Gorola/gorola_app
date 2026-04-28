import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanBuyerOnly(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("buyer OTP end-to-end (Phase 2.10.1)", () => {
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

  it("send-otp + verify persists User; second verify yields same userId; refresh/logout wired", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919988776601";

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
        accessToken: string;
        refreshToken: string;
        userId: string;
      };
      success: boolean;
    };
    expect(body1.success).toBe(true);

    const row = await prisma.user.findUnique({ where: { phone } });
    expect(row?.id).toBe(body1.data.userId);
    expect(row?.isVerified).toBe(true);

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
    expect((verify2Res.json() as { data: { userId: string } }).data.userId).toBe(body1.data.userId);

    expect(await prisma.user.count({ where: { phone } })).toBe(1);

    const refreshRes = await server.inject({
      method: "POST",
      payload: { refreshToken: body1.data.refreshToken },
      url: "/api/v1/auth/buyer/refresh"
    });
    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json() as { data: { refreshToken: string } };

    const logoutRes = await server.inject({
      method: "POST",
      payload: { refreshToken: refreshBody.data.refreshToken },
      url: "/api/v1/auth/buyer/logout"
    });
    expect(logoutRes.statusCode).toBe(200);

    await server.close();
  });
});
