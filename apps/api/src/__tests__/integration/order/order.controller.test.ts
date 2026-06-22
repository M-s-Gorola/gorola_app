import type { Category, PrismaClient, Product, ProductVariant, Store, User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CartRepository } from "../../../modules/cart/cart.repository.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { DiscountRepository } from "../../../modules/promotion/discount.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanOrderIntegrationGraph(db: PrismaClient): Promise<void> {
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.discount.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.storeOwner.deleteMany();
  await db.riderLocation.deleteMany();

  await db.deliveryRider.deleteMany();

  await db.store.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
  await db.systemSetting.deleteMany().catch(() => {});
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

describe("POST /api/v1/orders (buyer checkout)", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const variantRepo = new ProductVariantRepository(db);
  const cartRepo = new CartRepository(db);
  const discountRepo = new DiscountRepository(db);

  let userRow: User;
  let otherUserRow: User;
  let category: Category;
  let subCategory: { id: string };
  let store: Store;
  let product: Product;
  let variant: ProductVariant;

  beforeEach(async () => {
    await cleanOrderIntegrationGraph(db);
    userRow = await userRepo.ensureBuyerByPhone("+919988776099");
    otherUserRow = await userRepo.ensureBuyerByPhone("+919988776088");

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
    variant = await variantRepo.create({
      label: "500g",
      price: "100",
      productId: product.id,
      stockQty: 20,
      unit: "pc"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("places order with saved address and clears cart", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    await cartRepo.addItem(userRow.id, variant.id, 2);

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        addressId: addr.id,
        addressMode: "saved",
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(res.statusCode).toBe(200);
    const envelope = res.json() as {
      data: {
        items: unknown[];
        id: string;
        landmarkDescription: string;
        status: string;
        total: string;
      };
      success: boolean;
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.status).toBe("PLACED");
    expect(envelope.data.landmarkDescription).toBe(addr.landmarkDescription);
    expect(envelope.data.items).toHaveLength(1);

    const cartAfter = await cartRepo.findByUserId(userRow.id);
    expect(cartAfter?.items ?? []).toHaveLength(0);

    const stock = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(stock.stockQty).toBe(18);
  });

  it("places order with new address (min landmark) — optional saved address row", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    await cartRepo.addItem(userRow.id, variant.id, 1);

    const landmarkNew = "Near red gate landmark area descriptive text minimum ten chars";

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        addressMode: "new",
        landmarkDescription: landmarkNew,
        paymentMethod: "COD",
        saveAddress: true,
        addressLabel: "Work"
      },
      url: "/api/v1/orders"
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(res.statusCode).toBe(200);
    const envelope = res.json() as {
      data: { landmarkDescription: string };
      success: boolean;
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.landmarkDescription).toBe(landmarkNew);

    const saved = await db.address.findFirst({
      where: { userId: userRow.id, label: "Work" }
    });
    expect(saved?.landmarkDescription).toBe(landmarkNew);
  });

  it("returns 400 when new address landmark is too short", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");
    await cartRepo.addItem(userRow.id, variant.id, 1);

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        addressMode: "new",
        landmarkDescription: "short",
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps cart and order ownership on JWT subject when stale userId is sent to cart API", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    const cartAdd = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        userId: otherUserRow.id,
        productVariantId: variant.id,
        quantity: 1
      },
      url: "/api/v1/cart/items"
    });
    expect(cartAdd.statusCode).toBe(200);

    const orderRes = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        addressId: addr.id,
        addressMode: "saved",
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });

    expect(orderRes.statusCode).toBe(200);
    const orderPayload = orderRes.json() as {
      data: { id: string; userId: string };
      success: boolean;
    };
    expect(orderPayload.success).toBe(true);
    expect(orderPayload.data.userId).toBe(userRow.id);

    const persistedOrder = await db.order.findUniqueOrThrow({
      where: { id: orderPayload.data.id }
    });
    expect(persistedOrder.userId).toBe(userRow.id);

    const buyerCart = await cartRepo.findByUserId(userRow.id);
    const otherBuyerCart = await cartRepo.findByUserId(otherUserRow.id);
    expect(buyerCart?.items ?? []).toHaveLength(0);
    expect(otherBuyerCart?.items ?? []).toHaveLength(0);

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("applies valid discount code at checkout and persists reconciled totals", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    await discountRepo.create({
      code: "SAVE10",
      discountType: "FLAT",
      discountValue: 10,
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      startsAt: new Date(Date.now() - 60 * 1000),
      storeId: store.id
    });

    await cartRepo.addItem(userRow.id, variant.id, 2);

    const orderRes = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        addressId: addr.id,
        addressMode: "saved",
        discountCode: "SAVE10",
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });

    expect(orderRes.statusCode).toBe(200);
    const orderPayload = orderRes.json() as {
      data: {
        discount: {
          amount: string;
          code: string | null;
        };
        id: string;
        subtotal: string;
        total: string;
      };
      success: boolean;
    };
    expect(orderPayload.success).toBe(true);
    expect(orderPayload.data.discount).toMatchObject({
      amount: "10.00",
      code: "SAVE10"
    });
    expect(orderPayload.data.subtotal).toBe("200");
    expect(orderPayload.data.total).toBe("220");

    const persisted = await db.order.findUniqueOrThrow({
      where: { id: orderPayload.data.id }
    });
    expect(persisted.subtotal.toString()).toBe("200");
    expect(persisted.deliveryFee.toString()).toBe("30");
    expect(persisted.total.toString()).toBe("220");
    expect(
      Number(persisted.subtotal) + Number(persisted.deliveryFee) - Number(orderPayload.data.discount.amount)
    ).toBe(Number(persisted.total));

    const discountPersisted = await db.discount.findFirstOrThrow({
      where: { code: "SAVE10", storeId: store.id }
    });
    expect(discountPersisted.usedCount).toBe(1);

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("returns placed order by id via GET /api/v1/orders/:id for owning buyer", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });
    await cartRepo.addItem(userRow.id, variant.id, 1);

    const placeRes = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        addressId: addr.id,
        addressMode: "saved",
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });
    expect(placeRes.statusCode).toBe(200);
    const placedPayload = placeRes.json() as {
      data: { id: string };
      success: boolean;
    };
    const orderId = placedPayload.data.id;

    const getRes = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "GET",
      url: `/api/v1/orders/${orderId}`
    });
    expect(getRes.statusCode).toBe(200);
    const getPayload = getRes.json() as {
      data: { id: string; userId: string };
      success: boolean;
    };
    expect(getPayload.success).toBe(true);
    expect(getPayload.data.id).toBe(orderId);
    expect(getPayload.data.userId).toBe(userRow.id);
    expect(
      (getPayload as { data: { store?: { id: string; name: string; phone: string; storeType: string } } }).data.store
    ).toEqual({
      id: store.id,
      name: "OC Store",
      phone: "+911200000099",
      storeType: "QUICK_COMMERCE"
    });

    const persistedOrder = await db.order.findUniqueOrThrow({
      where: { id: orderId }
    });
    expect(persistedOrder.id).toBe(orderId);
    expect(persistedOrder.userId).toBe(userRow.id);

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("returns reconciled discount amount in GET /api/v1/orders/:id", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });
    await discountRepo.create({
      storeId: store.id,
      code: "SAVE10",
      discountType: "FLAT",
      discountValue: 10,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60_000),
      minOrderAmount: null,
      usageLimit: null
    });
    await cartRepo.addItem(userRow.id, variant.id, 1);

    const placeRes = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        addressId: addr.id,
        addressMode: "saved",
        discountCode: "SAVE10",
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });
    expect(placeRes.statusCode).toBe(200);
    const placed = placeRes.json() as { data: { id: string } };

    const getRes = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "GET",
      url: `/api/v1/orders/${placed.data.id}`
    });
    expect(getRes.statusCode).toBe(200);
    const getPayload = getRes.json() as {
      data: { deliveryFee: string; discount: { amount: string; code: string | null }; subtotal: string; total: string };
      success: boolean;
    };
    expect(getPayload.success).toBe(true);
    expect(getPayload.data.discount.amount).toBe("10.00");
    expect(getPayload.data.discount.code).toBe("SAVE10");
    expect(
      Number(getPayload.data.subtotal) + Number(getPayload.data.deliveryFee) - Number(getPayload.data.discount.amount)
    ).toBe(Number(getPayload.data.total));

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("returns 404 for GET /api/v1/orders/:id when buyer does not own order", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const ownerAuth = await getBuyerAccessToken(server, "+919988776099");
    const otherAuth = await getBuyerAccessToken(server, "+919988776088");

    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });
    await cartRepo.addItem(userRow.id, variant.id, 1);
    const placeRes = await server.inject({
      headers: {
        authorization: `Bearer ${ownerAuth.accessToken}`
      },
      method: "POST",
      payload: {
        addressId: addr.id,
        addressMode: "saved",
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });
    const orderId = (placeRes.json() as { data: { id: string } }).data.id;

    const getRes = await server.inject({
      headers: {
        authorization: `Bearer ${otherAuth.accessToken}`
      },
      method: "GET",
      url: `/api/v1/orders/${orderId}`
    });

    expect(getRes.statusCode).toBe(404);
    const body = getRes.json() as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("honours X-Idempotency-Key to prevent duplicate order placement (W-014 RED)", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    // We need real Redis for this or a mock that we can check. 
    // The plan says integration test should run — confirming RED.
    // Since createServer({ disableRedis: true }) is used in other tests, 
    // we'll see if the controller even looks at the header.
    const server = createServer({
      disableRedis: false, // Use real redis if available, or it will fallback to mock/fail if not configured
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    const idempotencyKey = `key-${Date.now()}`;
    const payload = {
      addressId: addr.id,
      addressMode: "saved",
      paymentMethod: "COD"
    };

    // First request
    await cartRepo.addItem(userRow.id, variant.id, 1);
    const res1 = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-idempotency-key": idempotencyKey
      },
      method: "POST",
      payload,
      url: "/api/v1/orders"
    });
    expect(res1.statusCode).toBe(200);
    const order1 = (res1.json() as { data: { id: string } }).data.id;

    // Second request (identical)
    // In the current buggy state, this will try to place another order. 
    // Since the cart is cleared by res1, res2 might fail with "Cart is empty" or create a second order if cart wasn't cleared.
    // Actually, res1 clears the cart. So res2 should fail with 400 Cart Empty.
    // IF idempotency worked, res2 would return the SAME order1.
    const res2 = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-idempotency-key": idempotencyKey
      },
      method: "POST",
      payload,
      url: "/api/v1/orders"
    });

    // In RED state, this will likely be 400 because cart is empty, or 200 with a NEW order if cart wasn't cleared (unlikely here).
    // The goal is that it SHOULD be 200 and return the SAME order id.
    expect(res2.statusCode).toBe(200);
    const order2 = (res2.json() as { data: { id: string } }).data.id;
    expect(order2).toBe(order1);

    const orderCount = await db.order.count({ where: { userId: userRow.id } });
    expect(orderCount).toBe(1);

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("verifies multi-offer and coupon stacking math and granular checkout response details", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    // 1. FLAT offer of ₹20, min order ₹150
    await db.offer.create({
      data: {
        storeId: store.id,
        title: "FLAT 20 OFF",
        description: "Flat 20 off",
        discountType: "FLAT",
        discountValue: "20",
        minOrderAmount: "150",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
        isActive: true
      }
    });

    // 2. PERCENTAGE offer of 10% with maxDiscount cap of ₹15
    await db.offer.create({
      data: {
        storeId: store.id,
        title: "10% OFF max 15",
        description: "10% off max 15",
        discountType: "PERCENTAGE",
        discountValue: "10",
        minOrderAmount: null,
        maxDiscount: "15",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
        isActive: true
      }
    });

    // 3. Coupon code SAVE10 (FLAT ₹10)
    await discountRepo.create({
      code: "SAVE10",
      discountType: "FLAT",
      discountValue: 10,
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      startsAt: new Date(Date.now() - 60 * 1000),
      storeId: store.id
    });

    await cartRepo.addItem(userRow.id, variant.id, 2);

    const orderRes = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        addressId: addr.id,
        addressMode: "saved",
        discountCode: "SAVE10",
        paymentMethod: "COD"
      },
      url: "/api/v1/orders"
    });

    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(orderRes.statusCode).toBe(200);
    const body = orderRes.json();
    expect(body.success).toBe(true);

    // Verify granular response details
    expect(body.data.discount).toMatchObject({
      amount: "45.00",
      code: "SAVE10",
      appliedDiscountAmount: "10.00",
      appliedOfferAmount: "35.00"
    });

    expect(body.data.subtotal).toBe("200");
    expect(body.data.deliveryFee).toBe("30");
    expect(body.data.total).toBe("185");
  });
});

