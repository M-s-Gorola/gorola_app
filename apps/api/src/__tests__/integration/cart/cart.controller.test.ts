import type { Category, PrismaClient, Product, ProductVariant, Store, User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanCartIntegrationGraph(db: PrismaClient): Promise<void> {
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

describe("Cart controller", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const variantRepo = new ProductVariantRepository(db);

  let user: User;
  let otherUser: User;
  let store: Store;
  let category: Category;
  let subCategory: { id: string };
  let product: Product;
  let variantA: ProductVariant;
  let variantB: ProductVariant;

  beforeEach(async () => {
    await cleanCartIntegrationGraph(db);
    user = await userRepo.create({ phone: "+919700000001", name: "Cart Controller User" });
    otherUser = await userRepo.create({ phone: "+919700000002", name: "Other Cart User" });
    store = await storeRepo.create({
      name: "Cart Controller Store",
      description: "d",
      phone: "+911111111199",
      address: "Road"
    });
    category = await categoryRepo.create({ slug: "cart-controller-cat", name: "Cart Cat", imageUrl: "https://example.com/cat.jpg" });
    subCategory = await db.subCategory.create({
      data: { slug: "cart-sub", name: "Cart Sub", categoryId: category.id }
    });
    product = await productRepo.create({
      storeId: store.id,
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: "Cart Product",
      description: "d",
      imageUrl: "https://example.com/p.jpg"
    });
    variantA = await variantRepo.create({
      productId: product.id,
      label: "500g",
      price: "55",
      stockQty: 100,
      unit: "pack"
    });
    variantB = await variantRepo.create({
      productId: product.id,
      label: "1kg",
      price: "100",
      stockQty: 50,
      unit: "pack"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("supports cart read/mutate lifecycle through runtime routes", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, user.phone);

    const add = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      url: "/api/v1/cart/items",
      payload: {
        productVariantId: variantA.id,
        quantity: 2
      }
    });
    expect(add.statusCode).toBe(200);

    const get = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "GET",
      url: "/api/v1/cart"
    });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual({
      success: true,
      data: expect.objectContaining({
        userId: user.id,
        items: expect.arrayContaining([
          expect.objectContaining({
            productName: "Cart Product",
            productVariantId: variantA.id,
            quantity: 2
          })
        ])
      }),
      meta: {
        requestId: expect.any(String)
      }
    });

    const update = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "PUT",
      url: `/api/v1/cart/items/${variantA.id}`,
      payload: {
        quantity: 5
      }
    });
    expect(update.statusCode).toBe(200);

    const addSecond = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      url: "/api/v1/cart/items",
      payload: {
        productVariantId: variantB.id,
        quantity: 1
      }
    });
    expect(addSecond.statusCode).toBe(200);

    const remove = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "DELETE",
      url: `/api/v1/cart/items/${variantB.id}`
    });
    expect(remove.statusCode).toBe(200);

    const clear = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "DELETE",
      url: "/api/v1/cart"
    });
    expect(clear.statusCode).toBe(200);
    expect(clear.json()).toEqual({
      success: true,
      data: expect.objectContaining({
        userId: user.id,
        items: []
      }),
      meta: {
        requestId: expect.any(String)
      }
    });

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("uses JWT subject as single cart identity even when stale userId is sent", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, user.phone);

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        userId: otherUser.id,
        productVariantId: variantA.id,
        quantity: 1
      },
      url: "/api/v1/cart/items"
    });

    expect(response.statusCode).toBe(200);
    const ownCart = await db.cart.findFirst({
      where: { userId: user.id },
      include: { items: true }
    });
    const otherCart = await db.cart.findFirst({
      where: { userId: otherUser.id },
      include: { items: true }
    });
    expect(ownCart?.items).toHaveLength(1);
    expect(otherCart?.items ?? []).toHaveLength(0);

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("returns validation error for malformed cart payload", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, user.phone);

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      url: "/api/v1/cart/items",
      payload: {
        productVariantId: variantA.id,
        quantity: 0
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: expect.any(String),
        details: expect.any(Object)
      },
      meta: {
        requestId: expect.any(String)
      }
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("verifies activeOffers is returned in cart response when store has active offers", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, user.phone);

    // Create an active flat offer for this store
    const now = new Date();
    const seededOffer = await db.offer.create({
      data: {
        storeId: store.id,
        title: "Test Active Offer",
        description: "Test Offer Desc",
        discountType: "FLAT",
        discountValue: "20.00",
        minOrderAmount: "100.00",
        maxDiscount: null,
        startsAt: new Date(now.getTime() - 60000),
        endsAt: new Date(now.getTime() + 60000),
        isActive: true
      }
    });

    // Add item to cart first so active offers can be fetched (scoped by store)
    await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { productVariantId: variantA.id, quantity: 2 }
    });

    const getRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: "/api/v1/cart"
    });

    expect(getRes.statusCode).toBe(200);
    const body = getRes.json() as {
      success: boolean;
      data: {
        activeOffers: Array<{
          id: string;
          title: string;
          discountType: string;
          discountValue: number;
          minOrderAmount: number | null;
          maxDiscount: number | null;
        }>;
      };
    };
    expect(body.data.activeOffers).toBeDefined();
    expect(body.data.activeOffers).toHaveLength(1);
    expect(body.data.activeOffers[0]).toEqual({
      id: seededOffer.id,
      title: "Test Active Offer",
      discountType: "FLAT",
      discountValue: 20,
      minOrderAmount: 100,
      maxDiscount: null
    });

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

  it("verifies activeOffers is empty when store has no active offers", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    const { accessToken } = await getBuyerAccessToken(server, user.phone);

    // Add item to cart (store has no offers)
    await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      url: "/api/v1/cart/items",
      payload: { productVariantId: variantA.id, quantity: 2 }
    });

    const getRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: "/api/v1/cart"
    });

    expect(getRes.statusCode).toBe(200);
    const body = getRes.json() as {
      success: boolean;
      data: {
        activeOffers: unknown[];
      };
    };
    expect(body.data.activeOffers).toEqual([]);

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });
});
