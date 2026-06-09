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

async function cleanOrderGraph(db: PrismaClient): Promise<void> {
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

describe("Order Address Snapshoting", () => {
  const db = getPrismaClient();
  let server: ReturnType<typeof createServer>;
  let token: string;
  let user: { id: string };
  let store: { id: string };
  let variant: { id: string };

  beforeEach(async () => {
    await cleanOrderGraph(db);
    process.env.GOROLA_TEST_OTP = "111222";
    server = createServer({ disableRedis: true, registerRoutes: registerAppRoutes });
    const phone = "+919988776656";
    token = await getBuyerAccessToken(server, phone);
    user = await db.user.findUniqueOrThrow({ where: { phone } });
    
    store = await db.store.create({
      data: { address: "Test Addr", description: "Test Desc", name: "Test Store", phone: "123" }
    });

    const category = await db.category.create({ data: { name: "Cat", slug: "cat", imageUrl: "https://example.com/cat.jpg" } });
    const subCategory = await db.subCategory.create({
      data: { name: "Sub", slug: "sub", categoryId: category.id }
    });
    const product = await db.product.create({
      data: { categoryId: category.id, subCategoryId: subCategory.id, description: "Desc", imageUrl: "img", name: "Prod", storeId: store.id }
    });

    variant = await db.productVariant.create({
      data: { label: "V1", price: 10, productId: product.id, stockQty: 100, unit: "kg" }
    });

    // Add item to cart
    await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      payload: { productVariantId: variant.id, quantity: 1 },
      url: "/api/v1/cart/items"
    });
  });

  afterAll(async () => {
    await server?.close();
    delete process.env.GOROLA_TEST_OTP;
    await disconnectPrisma();
  });

  it("snapshots addressLabel and flatRoom from a saved address", async () => {
    const address = await db.address.create({
      data: {
        label: "Home",
        flatRoom: "A-402",
        landmarkDescription: "Near the big tree",
        userId: user.id
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      payload: {
        addressMode: "saved",
        addressId: address.id,
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const orderId = body.data.id;

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.addressLabel).toBe("Home");
    expect(order.flatRoom).toBe("A-402");
    expect(order.landmarkDescription).toBe("Near the big tree");

    // Even if we delete the address, the order remains intact
    await db.address.delete({ where: { id: address.id } });
    const orderAfterDelete = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderAfterDelete.addressLabel).toBe("Home");
  });

  it("snapshots fields from a new address body", async () => {
    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      payload: {
        addressMode: "new",
        addressLabel: "Work",
        flatRoom: "Desk 12",
        landmarkDescription: "Main Mussoorie Library Entrance",
        paymentMethod: "COD",
        saveAddress: false
      },
      url: "/api/v1/orders"
    });

    if (res.statusCode !== 200) {
      console.log("FAILED BODY:", res.payload);
    }
    expect(res.statusCode).toBe(200);
    const orderId = res.json().data.id;

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.addressLabel).toBe("Work");
    expect(order.flatRoom).toBe("Desk 12");
    expect(order.landmarkDescription).toBe("Main Mussoorie Library Entrance");
  });
});
