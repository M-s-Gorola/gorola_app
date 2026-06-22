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
  await db.systemSetting.deleteMany();
  await db.auditLog.deleteMany();
}

describe("Admin Settings Integration Tests", () => {
  const db = getPrismaClient();
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
    // Seed default settings for testing
    await db.systemSetting.createMany({
      data: [
        { key: "DELIVERY_CHARGE", value: "30", updatedBy: "system" },
        { key: "SERVICE_CHARGE", value: "0", updatedBy: "system" }
      ]
    });
  });

  describe("GET /api/v1/admin/settings", () => {
    it("should return 401 when no token is provided", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/settings"
      });
      expect(response.statusCode).toBe(401);
    });

    it("should return 403 when user is not an ADMIN", async () => {
      const token = await generateAccessToken("buyer-123", "BUYER");
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/settings",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(response.statusCode).toBe(403);
    });

    it("should return 200 and list system settings containing keys DELIVERY_CHARGE and SERVICE_CHARGE", async () => {
      const token = await generateAccessToken("admin-123", "ADMIN");
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/settings",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      
      const keys = body.data.map((s: { key: string }) => s.key);
      expect(keys).toContain("DELIVERY_CHARGE");
      expect(keys).toContain("SERVICE_CHARGE");

      const delivery = body.data.find((s: { key: string }) => s.key === "DELIVERY_CHARGE");
      expect(delivery.value).toBe("30");
    });
  });

  describe("PUT /api/v1/admin/settings", () => {
    it("should update settings, create audit log and return 200", async () => {
      const token = await generateAccessToken("admin-123", "ADMIN");
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/admin/settings",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          deliveryCharge: "45.00",
          serviceCharge: "25.00"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);

      const keys = body.data.map((s: { key: string }) => s.key);
      expect(keys).toContain("DELIVERY_CHARGE");
      expect(keys).toContain("SERVICE_CHARGE");

      const delivery = body.data.find((s: { key: string }) => s.key === "DELIVERY_CHARGE");
      expect(delivery.value).toBe("45.00");
      expect(delivery.updatedBy).toBe("admin-123");

      const service = body.data.find((s: { key: string }) => s.key === "SERVICE_CHARGE");
      expect(service.value).toBe("25.00");
      expect(service.updatedBy).toBe("admin-123");

      // Verify DB change
      const dbDelivery = await db.systemSetting.findUnique({ where: { key: "DELIVERY_CHARGE" } });
      expect(dbDelivery?.value).toBe("45.00");

      // Verify Audit Log
      const auditLog = await db.auditLog.findFirst({
        where: {
          action: "ADMIN_SETTINGS_UPDATE",
          entityType: "SystemSetting"
        }
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe("admin-123");
      expect((auditLog?.newValue as Record<string, unknown>)?.DELIVERY_CHARGE).toBe("45.00");
      expect((auditLog?.newValue as Record<string, unknown>)?.SERVICE_CHARGE).toBe("25.00");
    });
  });

  describe("GET /api/v1/settings (public)", () => {
    it("should return settings map without auth header", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/settings"
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.DELIVERY_CHARGE).toBe("30");
      expect(body.data.SERVICE_CHARGE).toBe("0");
    });
  });

  describe("Order placement with dynamic settings", () => {
    let buyerToken: string;
    let buyerId: string;
    let storeBookingId: string;
    let variantBookingId: string;

    beforeEach(async () => {
      const buyer = await db.user.create({
        data: { name: "Test Buyer", phone: "+919876543200", isVerified: true }
      });
      buyerId = buyer.id;
      buyerToken = await generateAccessToken(buyer.id, "BUYER");

      const category = await db.category.create({
        data: { slug: "cat", name: "Cat", isActive: true }
      });
      const subCategory = await db.subCategory.create({
        data: { slug: "subcat", name: "Subcat", categoryId: category.id }
      });

      // Quick commerce store
      const storeQ = await db.store.create({
        data: {
          name: "Quick Store",
          description: "Desc",
          phone: "9999999991",
          address: "Address Q",
          storeType: "QUICK_COMMERCE"
        }
      });

      const productQ = await db.product.create({
        data: {
          name: "Product Q",
          description: "Desc Q",
          imageUrl: "http://example.com/q.png",
          storeId: storeQ.id,
          categoryId: category.id,
          subCategoryId: subCategory.id
        }
      });

      const variantQ = await db.productVariant.create({
        data: {
          productId: productQ.id,
          label: "Standard",
          price: 100.0,
          stockQty: 10,
          unit: "pcs"
        }
      });

      // Booking commerce store
      const storeB = await db.store.create({
        data: {
          name: "Booking Store",
          description: "Desc",
          phone: "9999999992",
          address: "Address B",
          storeType: "BOOKING_COMMERCE",
          bookingLeadDays: 0
        }
      });
      storeBookingId = storeB.id;

      const productB = await db.product.create({
        data: {
          name: "Service B",
          description: "Desc B",
          imageUrl: "http://example.com/b.png",
          storeId: storeB.id,
          categoryId: category.id,
          subCategoryId: subCategory.id
        }
      });

      const variantB = await db.productVariant.create({
        data: {
          productId: productB.id,
          label: "Session",
          price: 500.0,
          stockQty: 1,
          unit: "hour",
          allowedTimeslots: ["08:00 - 09:00", "09:00 - 10:00"]
        }
      });
      variantBookingId = variantB.id;

      // Create address
      await db.address.create({
        data: {
          userId: buyer.id,
          label: "Home",
          landmarkDescription: "Near Mall",
          isDefault: true
        }
      });

      // Seed cart for Quick commerce
      await db.cart.create({
        data: {
          userId: buyer.id,
          items: {
            create: { productVariantId: variantQ.id, quantity: 1 }
          }
        }
      });
    });

    it("should apply updated DELIVERY_CHARGE on placing Quick order", async () => {
      // Set delivery charge to 45.00
      const adminToken = await generateAccessToken("admin-123", "ADMIN");
      await server.inject({
        method: "PUT",
        url: "/api/v1/admin/settings",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { deliveryCharge: "45.00", serviceCharge: "0.00" }
      });

      // Place Quick order
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: {
          addressMode: "saved",
          addressId: (await db.address.findFirst({ where: { userId: buyerId } }))?.id,
          paymentMethod: "COD"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);

      const orderId = body.data.id;
      const order = await db.order.findUnique({ where: { id: orderId } });
      expect(Number(order?.deliveryFee)).toBe(45.00);
      expect(Number(order?.total)).toBe(145.00); // 100 (subtotal) + 45 (deliveryFee)
    });

    it("should apply updated SERVICE_CHARGE on placing Booking order", async () => {
      // Set service charge to 25.00
      const adminToken = await generateAccessToken("admin-123", "ADMIN");
      await server.inject({
        method: "PUT",
        url: "/api/v1/admin/settings",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { deliveryCharge: "0.00", serviceCharge: "25.00" }
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Place Booking order
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { authorization: `Bearer ${buyerToken}` },
        payload: {
          storeId: storeBookingId,
          items: [{ productId: (await db.product.findFirst({ where: { storeId: storeBookingId } }))?.id, variantId: variantBookingId, quantity: 1 }],
          scheduledDate: tomorrow.toISOString(),
          timeslot: "08:00 - 09:00",
          addressId: (await db.address.findFirst({ where: { userId: buyerId } }))?.id
        }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);

      const orderId = body.data.orderId;
      const order = await db.order.findUnique({ where: { id: orderId } });
      expect(Number(order?.deliveryFee)).toBe(25.00); // Platform service charge gets mapped to deliveryFee
      expect(Number(order?.total)).toBe(525.00); // 500 (subtotal) + 25 (service charge)
    });
  });
});
