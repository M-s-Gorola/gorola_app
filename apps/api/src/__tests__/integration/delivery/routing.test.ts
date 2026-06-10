import type { Category, PrismaClient, Product, ProductVariant, Store, User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CartRepository } from "../../../modules/cart/cart.repository.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanRoutingIntegrationGraph(db: PrismaClient): Promise<void> {
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

describe("Modular Routing & Geolocation Fix Integration", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const variantRepo = new ProductVariantRepository(db);
  const cartRepo = new CartRepository(db);

  let userRow: User;
  let category: Category;
  let subCategory: { id: string };
  let store: Store;
  let product: Product;
  let variant: ProductVariant;

  beforeEach(async () => {
    await cleanRoutingIntegrationGraph(db);
    userRow = await userRepo.ensureBuyerByPhone("+919988776099");

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

  it("persists coordinate snapshots on Order during checkout", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const { accessToken } = await getBuyerAccessToken(server, "+919988776099");

    // Create address with coordinates outside Mussoorie
    const addr = await db.address.create({
      data: {
        userId: userRow.id,
        label: "Dehradun Office",
        landmarkDescription: "Near Clock Tower Dehradun",
        lat: 30.3165,
        lng: 78.0322
      }
    });

    await cartRepo.addItem(userRow.id, variant.id, 1);

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

    expect(res.statusCode).toBe(200);
    const envelope = res.json() as {
      data: { id: string };
      success: boolean;
    };
    expect(envelope.success).toBe(true);

    // Assert database state contains coordinates
    const order = await db.order.findUniqueOrThrow({
      where: { id: envelope.data.id }
    });

    expect(order.deliveryLat).toBeDefined();
    expect(order.deliveryLng).toBeDefined();
    expect(Number(order.deliveryLat)).toBeCloseTo(30.3165);
    expect(Number(order.deliveryLng)).toBeCloseTo(78.0322);

    await server.close();
    delete process.env.GOROLA_TEST_OTP;
  });

});
