import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanPromotionIntegrationGraph(db: PrismaClient): Promise<void> {
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
}

describe("Discount controller", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanPromotionIntegrationGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("POST /api/v1/promotions/discounts/validate returns amountSaved for active discount", async () => {
    const store = await db.store.create({
      data: {
        name: "Validate Store",
        description: "d",
        phone: "+911111111155",
        address: "Address"
      }
    });

    await db.discount.create({
      data: {
        storeId: store.id,
        code: "SAVE20",
        discountType: "PERCENTAGE",
        discountValue: "20",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2027-01-01T00:00:00.000Z"),
        isActive: true
      }
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/promotions/discounts/validate",
      payload: {
        code: "save20",
        subtotal: 500,
        storeId: store.id
      }
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      success: boolean;
      data: { amountSaved: number; code: string; valid: boolean };
    };
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      amountSaved: 100,
      code: "SAVE20",
      valid: true
    });
  });

  it("POST /api/v1/promotions/discounts/validate returns invalid when code not active", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/promotions/discounts/validate",
      payload: {
        code: "UNKNOWN",
        subtotal: 500,
        storeId: "00000000-0000-0000-0000-000000000000"
      }
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as { success: boolean; data: { valid: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(false);
  });

  it("POST /api/v1/promotions/discounts/validate enforces store tenant isolation and rejects coupon from a different store", async () => {
    const storeA = await db.store.create({
      data: {
        name: "Store A",
        description: "d",
        phone: "+911111111101",
        address: "Address A"
      }
    });

    const storeB = await db.store.create({
      data: {
        name: "Store B",
        description: "d",
        phone: "+911111111102",
        address: "Address B"
      }
    });

    await db.discount.create({
      data: {
        storeId: storeA.id,
        code: "STOREA20",
        discountType: "PERCENTAGE",
        discountValue: "20",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2027-01-01T00:00:00.000Z"),
        isActive: true
      }
    });

    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    // Validate STOREA20 for Store B -> should be invalid!
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/promotions/discounts/validate",
      payload: {
        code: "STOREA20",
        subtotal: 500,
        storeId: storeB.id
      }
    });
    await server.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as { success: boolean; data: { valid: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(false);
  });
});
