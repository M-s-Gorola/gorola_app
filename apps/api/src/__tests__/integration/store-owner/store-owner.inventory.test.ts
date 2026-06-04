import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { StoreOwnerRepository } from "../../../modules/store-owner/store-owner.repository.js";
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
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.store.deleteMany();
}

describe("StoreOwner Inventory (Stock Movements) Integration Tests", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const ownerRepo = new StoreOwnerRepository(db);
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

  it("should return 401 when authorization token is missing for inventory routes", async () => {
    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/store/products/p1/variants/v1/stock",
      payload: { addQty: 10 }
    });
    expect(res.statusCode).toBe(401);
  });

  describe("Quick Commerce - Successful Operations", () => {
    it("should successfully restock a variant and record a REFILL movement", async () => {
      // 1. Setup Quick Commerce Store
      const store = await storeRepo.create({
        name: "Quick Groceries",
        description: "Fresh delivery",
        phone: "+911111111111",
        address: "Dehradun Central"
      });
      await db.store.update({
        where: { id: store.id },
        data: { storeType: "QUICK_COMMERCE" }
      });

      const owner = await ownerRepo.create({
        email: "owner@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });

      // 2. Setup Category & Product & Variant
      const category = await db.category.create({
        data: { name: "Fruits", slug: "fruits", icon: "apple" }
      });
      const subCategory = await db.subCategory.create({
        data: { name: "Organic", slug: "organic", categoryId: category.id }
      });
      const product = await db.product.create({
        data: {
          name: "Apple",
          description: "Fresh red apples",
          storeId: store.id,
          categoryId: category.id,
          subCategoryId: subCategory.id,
          imageUrl: "http://example.com/apple.png"
        }
      });
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          label: "Single Unit",
          price: 50.0,
          stockQty: 10,
          lowStockThreshold: 5,
          unit: "piece"
        }
      });

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      // 3. Make Restock Request
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/store/products/${product.id}/variants/${variant.id}/stock`,
        headers: { authorization: `Bearer ${token}` },
        payload: { addQty: 20, note: "Weekly Restock" }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.stockQty).toBe(30);
      expect(body.data.isLowStock).toBe(false);
      expect(body.data.isInStock).toBe(true);

      // 4. Verify StockMovement Created
      const movements = await db.stockMovement.findMany({
        where: { productVariantId: variant.id }
      });
      expect(movements.length).toBe(1);
      const movement = movements[0]!;
      expect(movement.type).toBe("REFILL");
      expect(movement.quantity).toBe(20);
      expect(movement.stockQtyBefore).toBe(10);
      expect(movement.stockQtyAfter).toBe(30);
      expect(movement.note).toBe("Weekly Restock");
    });

    it("should successfully adjust variant stock physically and record an ADJUSTMENT movement", async () => {
      const store = await storeRepo.create({
        name: "Quick Groceries",
        description: "Fresh delivery",
        phone: "+911111111111",
        address: "Dehradun Central"
      });
      const owner = await ownerRepo.create({
        email: "owner@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });
      const category = await db.category.create({
        data: { name: "Fruits", slug: "fruits", icon: "apple" }
      });
      const subCategory = await db.subCategory.create({
        data: { name: "Organic", slug: "organic", categoryId: category.id }
      });
      const product = await db.product.create({
        data: {
          name: "Apple",
          description: "Fresh red apples",
          storeId: store.id,
          categoryId: category.id,
          subCategoryId: subCategory.id,
          imageUrl: "http://example.com/apple.png"
        }
      });
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          label: "Single Unit",
          price: 50.0,
          stockQty: 10,
          lowStockThreshold: 5,
          unit: "piece"
        }
      });

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      // Adjust stock down to 3 (which is below lowStockThreshold = 5)
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/store/products/${product.id}/variants/${variant.id}/stock/adjust`,
        headers: { authorization: `Bearer ${token}` },
        payload: { setQty: 3, reason: "Physical damage check" }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.stockQty).toBe(3);
      expect(body.data.isLowStock).toBe(true);
      expect(body.data.isInStock).toBe(true);

      const movements = await db.stockMovement.findMany({
        where: { productVariantId: variant.id }
      });
      expect(movements.length).toBe(1);
      const movement = movements[0]!;
      expect(movement.type).toBe("ADJUSTMENT");
      expect(movement.quantity).toBe(7); // Delta of 10 -> 3 is 7
      expect(movement.stockQtyBefore).toBe(10);
      expect(movement.stockQtyAfter).toBe(3);
      expect(movement.reason).toBe("Physical damage check");
    });

    it("should reject adjustment when reason is missing", async () => {
      const store = await storeRepo.create({
        name: "Quick Groceries",
        description: "Fresh delivery",
        phone: "+911111111111",
        address: "Dehradun"
      });
      const owner = await ownerRepo.create({
        email: "owner@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });
      const category = await db.category.create({
        data: { name: "Fruits", slug: "fruits", icon: "apple" }
      });
      const subCategory = await db.subCategory.create({
        data: { name: "Organic", slug: "organic", categoryId: category.id }
      });
      const product = await db.product.create({
        data: {
          name: "Apple",
          description: "Fresh red apples",
          storeId: store.id,
          categoryId: category.id,
          subCategoryId: subCategory.id,
          imageUrl: "http://example.com/apple.png"
        }
      });
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          label: "Single Unit",
          price: 50.0,
          stockQty: 10,
          lowStockThreshold: 5,
          unit: "piece"
        }
      });

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/store/products/${product.id}/variants/${variant.id}/stock/adjust`,
        headers: { authorization: `Bearer ${token}` },
        payload: { setQty: 5 } // missing reason
      });

      expect(res.statusCode).toBe(400);
    });

    it("should successfully configure low-stock threshold", async () => {
      const store = await storeRepo.create({
        name: "Quick Groceries",
        description: "Fresh delivery",
        phone: "+911111111111",
        address: "Dehradun Central"
      });
      const owner = await ownerRepo.create({
        email: "owner@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });
      const category = await db.category.create({
        data: { name: "Fruits", slug: "fruits", icon: "apple" }
      });
      const subCategory = await db.subCategory.create({
        data: { name: "Organic", slug: "organic", categoryId: category.id }
      });
      const product = await db.product.create({
        data: {
          name: "Apple",
          description: "Fresh red apples",
          storeId: store.id,
          categoryId: category.id,
          subCategoryId: subCategory.id,
          imageUrl: "http://example.com/apple.png"
        }
      });
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          label: "Single Unit",
          price: 50.0,
          stockQty: 10,
          lowStockThreshold: 5,
          unit: "piece"
        }
      });

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/store/products/${product.id}/variants/${variant.id}/threshold`,
        headers: { authorization: `Bearer ${token}` },
        payload: { threshold: 15 } // stockQty is 10, so lowStockThreshold = 15 makes it low stock!
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.lowStockThreshold).toBe(15);
      expect(body.data.isLowStock).toBe(true);
    });

    it("should return stock movement history for a product", async () => {
      const store = await storeRepo.create({
        name: "Quick Groceries",
        description: "Fresh delivery",
        phone: "+911111111111",
        address: "Dehradun"
      });
      const owner = await ownerRepo.create({
        email: "owner@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });
      const category = await db.category.create({
        data: { name: "Fruits", slug: "fruits", icon: "apple" }
      });
      const subCategory = await db.subCategory.create({
        data: { name: "Organic", slug: "organic", categoryId: category.id }
      });
      const product = await db.product.create({
        data: {
          name: "Apple",
          description: "Fresh red apples",
          storeId: store.id,
          categoryId: category.id,
          subCategoryId: subCategory.id,
          imageUrl: "http://example.com/apple.png"
        }
      });
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          label: "Single Unit",
          price: 50.0,
          stockQty: 10,
          lowStockThreshold: 5,
          unit: "piece"
        }
      });

      // Insert mock movements
      await db.stockMovement.create({
        data: {
          productVariantId: variant.id,
          type: "INITIAL",
          quantity: 10,
          stockQtyBefore: 0,
          stockQtyAfter: 10,
          createdAt: new Date(Date.now() - 10000)
        }
      });
      await db.stockMovement.create({
        data: {
          productVariantId: variant.id,
          type: "REFILL",
          quantity: 5,
          stockQtyBefore: 10,
          stockQtyAfter: 15,
          note: "Midweek refill",
          createdAt: new Date()
        }
      });

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      const res = await server.inject({
        method: "GET",
        url: `/api/v1/store/products/${product.id}/stock-history`,
        headers: { authorization: `Bearer ${token}` }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0].type).toBe("REFILL"); // sorted descending
      expect(body.data[0].note).toBe("Midweek refill");
      expect(body.data[1].type).toBe("INITIAL");
    });
  });

  describe("Booking Commerce - Guardrail Rejections (No Booking Inventory)", () => {
    let bookingProductId: string;
    let bookingVariantId: string;
    let token: string;

    beforeEach(async () => {
      // 1. Create Booking Commerce Store
      const store = await storeRepo.create({
        name: "Doctor Consultation Services",
        description: "Medical booking",
        phone: "+912222222222",
        address: "Dehradun Central"
      });
      await db.store.update({
        where: { id: store.id },
        data: { storeType: "BOOKING_COMMERCE" }
      });

      const owner = await ownerRepo.create({
        email: "doc@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });

      // 2. Create Services
      const category = await db.category.create({
        data: { name: "Health", slug: "health", icon: "heart" }
      });
      const subCategory = await db.subCategory.create({
        data: { name: "Consult", slug: "consult", categoryId: category.id }
      });
      const product = await db.product.create({
        data: {
          name: "General Physician",
          description: "Consultation service",
          storeId: store.id,
          categoryId: category.id,
          subCategoryId: subCategory.id,
          imageUrl: "http://example.com/clinic.png"
        }
      });
      bookingProductId = product.id;

      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          label: "30 Mins Slot",
          price: 500.0,
          stockQty: 0, // immaterial for bookings
          lowStockThreshold: 0,
          unit: "consultation"
        }
      });
      bookingVariantId = variant.id;

      token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);
    });

    it("should reject restocking booking services with 400 ValidationError", async () => {
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/store/products/${bookingProductId}/variants/${bookingVariantId}/stock`,
        headers: { authorization: `Bearer ${token}` },
        payload: { addQty: 10 }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
      expect(res.json().error.code).toBe("INVALID_STORE_TYPE");
    });

    it("should reject stock adjustments on booking services with 400 ValidationError", async () => {
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/store/products/${bookingProductId}/variants/${bookingVariantId}/stock/adjust`,
        headers: { authorization: `Bearer ${token}` },
        payload: { setQty: 5, reason: "Reset" }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
      expect(res.json().error.code).toBe("INVALID_STORE_TYPE");
    });

    it("should reject threshold updates on booking services with 400 ValidationError", async () => {
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/store/products/${bookingProductId}/variants/${bookingVariantId}/threshold`,
        headers: { authorization: `Bearer ${token}` },
        payload: { threshold: 5 }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
      expect(res.json().error.code).toBe("INVALID_STORE_TYPE");
    });

    it("should reject stock history queries on booking services with 400 ValidationError", async () => {
      const res = await server.inject({
        method: "GET",
        url: `/api/v1/store/products/${bookingProductId}/stock-history`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
      expect(res.json().error.code).toBe("INVALID_STORE_TYPE");
    });
  });

  describe("Booking Order Status Updates - Stock Bypass Guardrail", () => {
    it("should bypass stock increments and logging when a BOOKING order is cancelled", async () => {
      // 1. Setup Booking Store & Variant
      const store = await storeRepo.create({
        name: "Doctor Booking",
        description: "Clinical consults",
        phone: "+911111111122",
        address: "Dehradun Center"
      });
      await db.store.update({
        where: { id: store.id },
        data: { storeType: "BOOKING_COMMERCE" }
      });

      const owner = await ownerRepo.create({
        email: "doc-owner@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });

      const category = await db.category.create({
        data: { name: "Health", slug: "health", icon: "heart" }
      });
      const subCategory = await db.subCategory.create({
        data: { name: "Clinics", slug: "clinics", categoryId: category.id }
      });
      const product = await db.product.create({
        data: {
          name: "Doc Consult",
          description: "Consult service",
          storeId: store.id,
          categoryId: category.id,
          subCategoryId: subCategory.id,
          imageUrl: "http://example.com/clinic.png"
        }
      });
      const variant = await db.productVariant.create({
        data: {
          productId: product.id,
          label: "Consultation Slot",
          price: 300.0,
          stockQty: 5, // initial stock 5
          lowStockThreshold: 1,
          unit: "consult"
        }
      });

      // 2. Create a User and place a PENDING_APPROVAL BOOKING order
      const user = await db.user.create({
        data: { phone: "+919999999999", name: "Patient Doe" }
      });

      const order = await db.order.create({
        data: {
          userId: user.id,
          storeId: store.id,
          status: "PENDING_APPROVAL",
          orderType: "BOOKING",
          subtotal: 300.0,
          deliveryFee: 0.0,
          total: 300.0,
          landmarkDescription: "Chowk",
          items: {
            create: {
              productVariantId: variant.id,
              productName: "Doc Consult",
              variantLabel: "Consultation Slot",
              price: 300.0,
              quantity: 1
            }
          }
        }
      });

      await db.bookingOrder.create({
        data: {
          orderId: order.id,
          scheduledDate: new Date(),
          timeslot: "09:00 AM - 09:30 AM",
          approvalStatus: "PENDING_APPROVAL"
        }
      });

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      // 3. Store owner cancels the booking order
      // (This will trigger the order.service.ts cancelOrderWithStockRestore method!)
      const res = await server.inject({
        method: "PUT",
        url: `/api/v1/store/orders/${order.id}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "CANCELLED" }
      });

      expect(res.statusCode).toBe(200);

      // 4. Assert booking status updated to CANCELLED in DB
      const dbOrder = await db.order.findUnique({
        where: { id: order.id }
      });
      expect(dbOrder?.status).toBe("CANCELLED");

      // 5. Assert stock remains completely unchanged (still 5, NOT incremented to 6)
      const dbVariant = await db.productVariant.findUnique({
        where: { id: variant.id }
      });
      expect(dbVariant?.stockQty).toBe(5);

      // 6. Assert zero StockMovements created
      const movements = await db.stockMovement.findMany({
        where: { productVariantId: variant.id }
      });
      expect(movements.length).toBe(0);
    });
  });
});
