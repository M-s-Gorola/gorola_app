import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { StoreOwnerRepository } from "../../../modules/store-owner/store-owner.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.riderLocation.deleteMany();
  await db.deliveryRider.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.stockMovement.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.store.deleteMany();
}

describe("StoreOwnerAuth Route Integration", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const ownerRepo = new StoreOwnerRepository(db);
  let server: FastifyInstance;

  beforeAll(() => {
    server = createServer({
      disableRedis: true, // We disable real Redis connection so we don't depend on external Redis in routing test
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

  it("POST /api/v1/auth/store-owner/login handles password validation and 2FA required states", async () => {
    // Seed store and owner
    const store = await storeRepo.create({
      name: "Test Store",
      description: "For testing",
      phone: "+911234567890",
      address: "Test Road"
    });

    const passwordHash = await hash("Secret#123", 8);
    
    // 1. Test owner login with 2FA disabled (should return tokens directly)
    await ownerRepo.create({
      email: "owner.no2fa@gorola.in",
      passwordHash,
      storeId: store.id,
      totpEnabled: false
    });

    const successRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/store-owner/login",
      payload: {
        email: "owner.no2fa@gorola.in",
        password: "Secret#123"
      }
    });

    // Currently this will fail and return 501 (NOT_IMPLEMENTED) because it's a stub.
    // Once wired, this should return 200 and return tokens.
    expect(successRes.statusCode).toBe(200);
    const successBody = successRes.json();
    expect(successBody.success).toBe(true);
    expect(successBody.data.accessToken).toBeDefined();

    // 2. Test owner login with wrong password
    const wrongPassRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/store-owner/login",
      payload: {
        email: "owner.no2fa@gorola.in",
        password: "wrongpassword"
      }
    });
    expect(wrongPassRes.statusCode).toBe(401);
    expect(wrongPassRes.json().success).toBe(false);
    expect(wrongPassRes.json().error.code).toBe("UNAUTHORIZED");

    // 3. Test owner login with 2FA enabled but no totpCode (should return requiresTwoFactor)
    await ownerRepo.create({
      email: "owner.2fa@gorola.in",
      passwordHash,
      storeId: store.id,
      totpEnabled: true,
      totpSecret: "MYSECRETKEY"
    });

    const requires2FARes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/store-owner/login",
      payload: {
        email: "owner.2fa@gorola.in",
        password: "Secret#123"
      }
    });
    expect(requires2FARes.statusCode).toBe(200);
    expect(requires2FARes.json().success).toBe(true);
    expect(requires2FARes.json().data.requiresTwoFactor).toBe(true);
  });

  it("POST /api/v1/auth/store-owner/setup-2fa generates secrets for authenticated owners", async () => {
    const store = await storeRepo.create({
      name: "Test Store",
      description: "For testing",
      phone: "+911234567890",
      address: "Test Road"
    });

    const passwordHash = await hash("Secret#123", 8);
    await ownerRepo.create({
      email: "setup2fa@gorola.in",
      passwordHash,
      storeId: store.id,
      totpEnabled: false
    });

    const setupRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/store-owner/setup-2fa",
      payload: {
        email: "setup2fa@gorola.in"
      }
    });

    // Should return secret and qrCodeUri once implemented
    expect(setupRes.statusCode).toBe(200);
    const body = setupRes.json();
    expect(body.success).toBe(true);
    expect(body.data.secret).toBeDefined();
    expect(body.data.qrCodeUri).toBeDefined();
  });

  it("POST /api/v1/auth/store-owner/verify-2fa enables 2FA when valid code provided", async () => {
    const store = await storeRepo.create({
      name: "Test Store",
      description: "For testing",
      phone: "+911234567890",
      address: "Test Road"
    });

    const passwordHash = await hash("Secret#123", 8);
    await ownerRepo.create({
      email: "verify2fa@gorola.in",
      passwordHash,
      storeId: store.id,
      totpEnabled: false,
      totpSecret: "MYSECRETKEY"
    });

    // We can verify this via route once the service is wired
    const verifyRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/store-owner/verify-2fa",
      payload: {
        email: "verify2fa@gorola.in",
        code: "000000" // We'll have to stub/mock the TOTP verification in service or test with dummy
      }
    });

    // This is expected to be RED/fail on first run
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().success).toBe(true);
  });
});
