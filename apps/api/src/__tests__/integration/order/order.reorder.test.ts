import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function getBuyerAccessToken(
  server: ReturnType<typeof createServer>,
  phone: string
): Promise<string> {
  await server.inject({ method: "POST", payload: { phone }, url: "/api/v1/auth/buyer/send-otp" });
  const verifyRes = await server.inject({
    method: "POST",
    payload: { otp: "111222", phone },
    url: "/api/v1/auth/buyer/verify-otp"
  });
  return (verifyRes.json() as { data: { accessToken: string } }).data.accessToken;
}

async function cleanReorderGraph(db: PrismaClient): Promise<void> {
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.riderLocation.deleteMany();
  await db.deliveryRider.deleteMany();
  await db.store.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("POST /api/v1/orders/:id/reorder", () => {
  const db = getPrismaClient();
  let server: ReturnType<typeof createServer>;
  let token: string;
  let user: { id: string };
  let store: { id: string };
  let subCategory: { id: string };
  let variant1: { id: string };
  let variant2: { id: string };

  beforeEach(async () => {
    await cleanReorderGraph(db);
    process.env.GOROLA_TEST_OTP = "111222";
    server = createServer({ disableRedis: true, registerRoutes: registerAppRoutes });
    const phone = "+919988776656";
    token = await getBuyerAccessToken(server, phone);
    user = await db.user.findUniqueOrThrow({ where: { phone } });
    
    store = await db.store.create({
      data: { address: "Test Addr", description: "Test Desc", name: "Test Store", phone: "123" }
    });

    const category = await db.category.create({ data: { name: "Cat", slug: "cat", imageUrl: "https://example.com/cat.jpg" } });
    subCategory = await db.subCategory.create({
      data: { name: "Sub", slug: "sub", categoryId: category.id }
    });
    const product = await db.product.create({
      data: { categoryId: category.id, subCategoryId: subCategory.id, description: "Desc", imageUrl: "img", name: "Prod", storeId: store.id }
    });

    variant1 = await db.productVariant.create({
      data: { label: "V1", price: 10, productId: product.id, stockQty: 100, unit: "kg" }
    });
    variant2 = await db.productVariant.create({
      data: { label: "V2", price: 20, productId: product.id, stockQty: 100, unit: "kg" }
    });
  });

  afterAll(async () => {
    await server?.close();
    delete process.env.GOROLA_TEST_OTP;
    await disconnectPrisma();
  });

  it("appends past order items to cart", async () => {
    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: user.id,
        items: {
          create: [
            { price: 10, productName: "Prod", quantity: 1, variantLabel: "V1", productVariantId: variant1.id },
            { price: 20, productName: "Prod", quantity: 2, variantLabel: "V2", productVariantId: variant2.id }
          ]
        }
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      url: `/api/v1/orders/${order.id}/reorder`
    });

    expect(res.statusCode).toBe(200);

    const cart = await db.cart.findUnique({
      where: { userId: user.id },
      include: { items: true }
    });

    expect(cart).not.toBeNull();
    expect(cart?.items).toHaveLength(2);
    
    const v1Item = cart?.items.find(i => i.productVariantId === variant1.id);
    const v2Item = cart?.items.find(i => i.productVariantId === variant2.id);
    
    expect(v1Item?.quantity).toBe(1);
    expect(v2Item?.quantity).toBe(2);
  });

  it("skips deleted or inactive variants and warns", async () => {
    // Delete variant2
    await db.productVariant.update({ where: { id: variant2.id }, data: { isActive: false } });

    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: user.id,
        items: {
          create: [
            { price: 10, productName: "Prod", quantity: 1, variantLabel: "V1", productVariantId: variant1.id },
            { price: 20, productName: "Prod", quantity: 2, variantLabel: "V2", productVariantId: variant2.id }
          ]
        }
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      url: `/api/v1/orders/${order.id}/reorder`
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { warnings: string[] } };
    expect(body.data.warnings).toContain("Some items were no longer available and were skipped.");

    const cart = await db.cart.findUnique({
      where: { userId: user.id },
      include: { items: true }
    });

    expect(cart?.items).toHaveLength(1);
    expect(cart?.items[0]?.productVariantId).toBe(variant1.id);
  });

  it("returns 404 if order does not belong to user", async () => {
    const otherUser = await db.user.create({ data: { name: "Other", phone: "other-reorder" } });
    const order = await db.order.create({
      data: {
        deliveryFee: 10,
        landmarkDescription: "lm",
        storeId: store.id,
        subtotal: 50,
        total: 60,
        userId: otherUser.id
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      url: `/api/v1/orders/${order.id}/reorder`
    });

    expect(res.statusCode).toBe(404);
  });
});
