import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { AdminRepository } from "../../../modules/admin/admin.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.stockMovement.deleteMany();
  await db.riderLocation.deleteMany();
  await db.deliveryRider.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.store.deleteMany();
  await db.admin.deleteMany();
}

describe("AdminAuth Route Integration", () => {
  const db = getPrismaClient();
  const adminRepo = new AdminRepository(db);
  let server: FastifyInstance;

  beforeAll(() => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);
  });

  it("POST /api/v1/auth/admin/login handles validation, requiresTwoFactor and tokens", async () => {
    const passwordHash = await hash("Admin#123", 8);

    // 1. Create admin with TOTP secret set
    await adminRepo.create({
      email: "admin.2fa@gorola.in",
      passwordHash,
      totpSecret: "base32secret"
    });

    // Login without TOTP code -> returns requiresTwoFactor: true
    const requires2FARes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/admin/login",
      payload: {
        email: "admin.2fa@gorola.in",
        password: "Admin#123"
      }
    });
    expect(requires2FARes.statusCode).toBe(200);
    const body2FA = requires2FARes.json();
    expect(body2FA.success).toBe(true);
    expect(body2FA.data.requiresTwoFactor).toBe(true);

    // Login with invalid password
    const wrongPassRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/admin/login",
      payload: {
        email: "admin.2fa@gorola.in",
        password: "wrongpassword"
      }
    });
    expect(wrongPassRes.statusCode).toBe(401);

    // Login with TOTP code (000000 is always valid in test environment)
    const successRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/admin/login",
      payload: {
        email: "admin.2fa@gorola.in",
        password: "Admin#123",
        totpCode: "000000"
      }
    });
    expect(successRes.statusCode).toBe(200);
    const bodySuccess = successRes.json();
    expect(bodySuccess.success).toBe(true);
    expect(bodySuccess.data.accessToken).toBeDefined();
    expect(bodySuccess.data.refreshToken).toBeDefined();

    // Login when 2FA is not configured (should throw 401 Admin 2FA is not configured)
    await adminRepo.create({
      email: "admin.no2fa@gorola.in",
      passwordHash
    });
    const no2FARes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/admin/login",
      payload: {
        email: "admin.no2fa@gorola.in",
        password: "Admin#123",
        totpCode: "000000"
      }
    });
    expect(no2FARes.statusCode).toBe(401);
    expect(no2FARes.json().error.message).toContain("2FA is not configured");
  });

  it("POST /api/v1/auth/admin/setup-2fa and verify-2fa onboarding flow works", async () => {
    const passwordHash = await hash("Admin#123", 8);
    await adminRepo.create({
      email: "onboard@gorola.in",
      passwordHash
    });

    const setupRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/admin/setup-2fa",
      payload: {
        email: "onboard@gorola.in"
      }
    });
    expect(setupRes.statusCode).toBe(200);
    const bodySetup = setupRes.json();
    expect(bodySetup.success).toBe(true);
    expect(bodySetup.data.secret).toBeDefined();
    expect(bodySetup.data.qrCodeUri).toBeDefined();

    const verifyRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/admin/verify-2fa",
      payload: {
        email: "onboard@gorola.in",
        code: "000000"
      }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().success).toBe(true);
  });
});
