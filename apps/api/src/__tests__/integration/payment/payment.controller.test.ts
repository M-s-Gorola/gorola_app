import type { Category, Order, PrismaClient, Product, Store, User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanPaymentIntegrationGraph(db: PrismaClient): Promise<void> {
  await db.riderLocation.deleteMany();
  await db.riderStore.deleteMany();
  await db.deliveryRider.deleteMany();
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.bookingOrder.deleteMany();
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

async function getBuyerAccessToken(
  server: ReturnType<typeof createServer>,
  phone: string
): Promise<{ accessToken: string; userId: string }> {
  const sendRes = await server.inject({
    method: "POST",
    payload: { phone },
    url: "/api/v1/auth/buyer/send-otp"
  });
  expect(sendRes.statusCode).toBe(200);

  const verifyRes = await server.inject({
    method: "POST",
    payload: { otp: "111222", phone },
    url: "/api/v1/auth/buyer/verify-otp"
  });
  expect(verifyRes.statusCode).toBe(200);
  const body = verifyRes.json() as {
    data: { accessToken: string; userId: string };
  };
  return { accessToken: body.data.accessToken, userId: body.data.userId };
}

describe("Payment Controller Integration Tests", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const variantRepo = new ProductVariantRepository(db);

  let buyer1: User;
  let category: Category;
  let subCategory: { id: string };
  let store: Store;
  let product: Product;
  let orderUPI: Order;
  let orderCOD: Order;

  beforeEach(async () => {
    await cleanPaymentIntegrationGraph(db);
    buyer1 = await userRepo.ensureBuyerByPhone("+919988776099");
    await userRepo.ensureBuyerByPhone("+919988776088");

    category = await categoryRepo.create({
      slug: `oc-${Date.now().toString(36)}`,
      name: "OC Cat",
      imageUrl: "https://example.com/cat.jpg"
    });
    subCategory = await db.subCategory.create({
      data: { slug: "oc-sub", name: "OC Sub", categoryId: category.id }
    });
    store = await storeRepo.create({
      address: "Mall Road",
      description: "d",
      name: "OC Store",
      phone: "+911200000099"
    });
    product = await productRepo.create({
      categoryId: category.id,
      subCategoryId: subCategory.id,
      description: "d",
      imageUrl: "https://x.jpg",
      name: "OC Product",
      storeId: store.id
    });
    await variantRepo.create({
      label: "500g",
      price: "150.50",
      productId: product.id,
      stockQty: 20,
      unit: "pc"
    });

    await db.address.create({
      data: {
        userId: buyer1.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    // Create a UPI order belonging to buyer 1
    orderUPI = await db.order.create({
      data: {
        userId: buyer1.id,
        storeId: store.id,
        landmarkDescription: "Test landmark description minimum characters",
        paymentMethod: "UPI",
        paymentStatus: "PENDING",
        status: "PLACED",
        subtotal: "150.50",
        deliveryFee: "10.00",
        total: "160.50"
      }
    });

    // Create a COD order belonging to buyer 1
    orderCOD = await db.order.create({
      data: {
        userId: buyer1.id,
        storeId: store.id,
        landmarkDescription: "Test landmark description minimum characters",
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        status: "PLACED",
        subtotal: "150.50",
        deliveryFee: "10.00",
        total: "160.50"
      }
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("POST /api/v1/payments/initiate returns 200 and initiates payment for valid UPI order", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        orderId: orderUPI.id,
        paymentMethod: "UPI"
      },
      url: "/api/v1/payments/initiate"
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(res.statusCode).toBe(200);
    const envelope = res.json() as {
      success: boolean;
      data: {
        razorpayOrderId: string;
        amount: number;
        currency: string;
      };
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.razorpayOrderId).toBe(`rp_order_mock_${orderUPI.id}`);
    expect(envelope.data.amount).toBe(16050); // 160.50 * 100
    expect(envelope.data.currency).toBe("INR");

    const inDb = await db.order.findUnique({ where: { id: orderUPI.id } });
    expect(inDb?.razorpayOrderId).toBe(`rp_order_mock_${orderUPI.id}`);
  });

  it("POST /api/v1/payments/initiate returns 400 for COD order", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        orderId: orderCOD.id,
        paymentMethod: "COD"
      },
      url: "/api/v1/payments/initiate"
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(res.statusCode).toBe(400);
  });

  it("POST /api/v1/payments/initiate returns 403 if order belongs to a different buyer", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const { accessToken } = await getBuyerAccessToken(server, "+919988776088"); // buyer 2

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        orderId: orderUPI.id,
        paymentMethod: "UPI"
      },
      url: "/api/v1/payments/initiate"
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(res.statusCode).toBe(403);
  });

  it("POST /api/v1/payments/verify captures payment on success", async () => {
    // Prep order in DB to have razorpayOrderId
    await db.order.update({
      where: { id: orderUPI.id },
      data: { razorpayOrderId: `rp_order_mock_${orderUPI.id}` }
    });

    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        orderId: orderUPI.id,
        razorpayPaymentId: "pay_mock_123",
        razorpaySignature: "mock_sig_ok"
      },
      url: "/api/v1/payments/verify"
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(res.statusCode).toBe(200);
    const inDb = await db.order.findUnique({ where: { id: orderUPI.id } });
    expect(inDb?.paymentStatus).toBe("CAPTURED");
    expect(inDb?.razorpayPaymentId).toBe("pay_mock_123");
  });
});
