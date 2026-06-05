import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function generateAccessToken(userId: string, role: string, storeId?: string): Promise<string> {
  const keys = resolveBuyerJwtKeyPair();
  return new SignJWT({
    role,
    ...(storeId ? { storeId } : {})
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keys.privateKey);
}

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.bookingOrder.deleteMany();
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
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
  await db.admin.deleteMany();
  await db.featureFlag.deleteMany();
  await db.auditLog.deleteMany();
}

describe("Admin Advertisements Integration Tests", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let adminToken: string;
  let storeOwnerToken: string;
  let storeAId: string;
  let storeBId: string;

  beforeAll(async () => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    adminToken = await generateAccessToken("admin-123", "ADMIN");
    storeOwnerToken = await generateAccessToken("owner-123", "STORE_OWNER", "store-123");
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);

    // Seed 2 active stores
    const storeA = await db.store.create({
      data: {
        id: "store-a",
        name: "Hillside Groceries",
        description: "Fresh goods",
        phone: "+919999000001",
        address: "Mussoorie Center",
        isActive: true
      }
    });
    storeAId = storeA.id;

    const storeB = await db.store.create({
      data: {
        id: "store-b",
        name: "Mountain Meds",
        description: "Medicines",
        phone: "+919999000002",
        address: "Library Chowk",
        isActive: true
      }
    });
    storeBId = storeB.id;
  });

  describe("GET /api/v1/admin/advertisements", () => {
    it("should return 401 when token is missing", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/admin/advertisements"
      });
      expect(res.statusCode).toBe(401);
    });

    it("should return 403 when user is not admin", async () => {
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/admin/advertisements",
        headers: { authorization: `Bearer ${storeOwnerToken}` }
      });
      expect(res.statusCode).toBe(403);
    });

    it("should return all advertisements when status is omitted or ALL", async () => {
      // Create 1 pending, 1 approved
      await db.advertisement.create({
        data: {
          storeId: storeAId,
          title: "Winter Sale",
          imageUrl: "https://test.com/winter.png",
          linkUrl: "https://test.com/winter",
          startsAt: new Date("2026-12-01T00:00:00Z"),
          endsAt: new Date("2026-12-31T00:00:00Z"),
          isApproved: false,
          isActive: true
        }
      });

      await db.advertisement.create({
        data: {
          storeId: storeBId,
          title: "Monsoon Deals",
          imageUrl: "https://test.com/monsoon.png",
          linkUrl: "https://test.com/monsoon",
          startsAt: new Date("2026-06-01T00:00:00Z"),
          endsAt: new Date("2026-06-30T00:00:00Z"),
          isApproved: true,
          isActive: true
        }
      });

      const res = await server.inject({
        method: "GET",
        url: "/api/v1/admin/advertisements",
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0]).toHaveProperty("storeName");
      expect(body.data[0]).toHaveProperty("submittedAt");
    });

    it("should filter by PENDING status correctly", async () => {
      await db.advertisement.create({
        data: {
          storeId: storeAId,
          title: "Pending Ad",
          imageUrl: "https://test.com/pending.png",
          linkUrl: "https://test.com/pending",
          startsAt: new Date("2026-12-01T00:00:00Z"),
          endsAt: new Date("2026-12-31T00:00:00Z"),
          isApproved: false,
          isActive: true
        }
      });

      await db.advertisement.create({
        data: {
          storeId: storeBId,
          title: "Approved Ad",
          imageUrl: "https://test.com/approved.png",
          linkUrl: "https://test.com/approved",
          startsAt: new Date("2026-06-01T00:00:00Z"),
          endsAt: new Date("2026-06-30T00:00:00Z"),
          isApproved: true,
          isActive: true
        }
      });

      const res = await server.inject({
        method: "GET",
        url: "/api/v1/admin/advertisements?status=PENDING",
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].title).toBe("Pending Ad");
      expect(body.data[0].storeName).toBe("Hillside Groceries");
    });
  });

  describe("PUT /api/v1/admin/advertisements/:id/approve", () => {
    it("should approve the ad, mark isApproved/isActive as true, and write audit log", async () => {
      const ad = await db.advertisement.create({
        data: {
          storeId: storeAId,
          title: "Christmas Sale",
          imageUrl: "https://test.com/xmas.png",
          linkUrl: "https://test.com/xmas",
          startsAt: new Date("2026-12-01T00:00:00Z"),
          endsAt: new Date("2026-12-25T00:00:00Z"),
          isApproved: false,
          isActive: true
        }
      });

      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/advertisements/${ad.id}/approve`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const dbAd = await db.advertisement.findUnique({ where: { id: ad.id } });
      expect(dbAd?.isApproved).toBe(true);
      expect(dbAd?.isActive).toBe(true);

      const audit = await db.auditLog.findFirst({
        where: { action: "ADMIN_ADVERTISEMENT_APPROVE", entityId: ad.id }
      });
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe("admin-123");
      expect(audit?.oldValue).toEqual({ isApproved: false, isActive: true });
      expect(audit?.newValue).toEqual({ isApproved: true, isActive: true });
    });
  });

  describe("PUT /api/v1/admin/advertisements/:id/reject", () => {
    it("should reject the ad with reason, set isApproved/isActive as false, and log reason", async () => {
      const ad = await db.advertisement.create({
        data: {
          storeId: storeAId,
          title: "Spam Ad",
          imageUrl: "https://test.com/spam.png",
          linkUrl: "https://test.com/spam",
          startsAt: new Date("2026-12-01T00:00:00Z"),
          endsAt: new Date("2026-12-25T00:00:00Z"),
          isApproved: false,
          isActive: true
        }
      });

      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/advertisements/${ad.id}/reject`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: "Image contains inappropriate text" }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const dbAd = await db.advertisement.findUnique({ where: { id: ad.id } });
      expect(dbAd?.isApproved).toBe(false);
      expect(dbAd?.isActive).toBe(false);

      const audit = await db.auditLog.findFirst({
        where: { action: "ADMIN_ADVERTISEMENT_REJECT", entityId: ad.id }
      });
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe("admin-123");
      expect(audit?.oldValue).toEqual({ isApproved: false, isActive: true });
      expect(audit?.newValue).toEqual({ isApproved: false, isActive: false, reason: "Image contains inappropriate text" });
    });

    it("should return 400 when reason is missing or empty", async () => {
      const ad = await db.advertisement.create({
        data: {
          storeId: storeAId,
          title: "Bad Ad",
          imageUrl: "https://test.com/bad.png",
          linkUrl: "https://test.com/bad",
          startsAt: new Date("2026-12-01T00:00:00Z"),
          endsAt: new Date("2026-12-25T00:00:00Z"),
          isApproved: false,
          isActive: true
        }
      });

      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/advertisements/${ad.id}/reject`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: "" }
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
    });
  });

  describe("PUT /api/v1/admin/advertisements/:id/deactivate", () => {
    it("should deactivate an approved advertisement, setting isActive as false", async () => {
      const ad = await db.advertisement.create({
        data: {
          storeId: storeAId,
          title: "Valid Ad",
          imageUrl: "https://test.com/val.png",
          linkUrl: "https://test.com/val",
          startsAt: new Date("2026-12-01T00:00:00Z"),
          endsAt: new Date("2026-12-25T00:00:00Z"),
          isApproved: true,
          isActive: true
        }
      });

      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/admin/advertisements/${ad.id}/deactivate`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const dbAd = await db.advertisement.findUnique({ where: { id: ad.id } });
      expect(dbAd?.isApproved).toBe(true);
      expect(dbAd?.isActive).toBe(false);

      const audit = await db.auditLog.findFirst({
        where: { action: "ADMIN_ADVERTISEMENT_DEACTIVATE", entityId: ad.id }
      });
      expect(audit).toBeDefined();
      expect(audit?.actorId).toBe("admin-123");
      expect(audit?.oldValue).toEqual({ isApproved: true, isActive: true });
      expect(audit?.newValue).toEqual({ isApproved: true, isActive: false });
    });
  });
});
