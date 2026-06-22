import { randomUUID } from "node:crypto";

import { type Category, Prisma, type PrismaClient, type Product, type ProductVariant, type Store, type User } from "@prisma/client";
import { SignJWT } from "jose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanDatabase(db: PrismaClient): Promise<void> {
  await db.stockMovement.deleteMany().catch(() => {});
  await db.orderStatusHistory.deleteMany().catch(() => {});
  await db.orderItem.deleteMany().catch(() => {});
  await db.bookingOrder.deleteMany().catch(() => {});
  await db.order.deleteMany().catch(() => {});
  await db.discount.deleteMany().catch(() => {});
  await db.cartItem.deleteMany().catch(() => {});
  await db.cart.deleteMany().catch(() => {});
  await db.address.deleteMany().catch(() => {});
  await db.riderLocation.deleteMany().catch(() => {});
  await db.deliveryRider.deleteMany().catch(() => {});
  await db.advertisement.deleteMany().catch(() => {});
  await db.offer.deleteMany().catch(() => {});
  await db.user.deleteMany().catch(() => {});
  await db.productVariant.deleteMany().catch(() => {});
  await db.product.deleteMany().catch(() => {});
  await db.storeOwner.deleteMany().catch(() => {});
  await db.store.deleteMany().catch(() => {});
  await db.subCategory.deleteMany().catch(() => {});
  await db.category.deleteMany().catch(() => {});
  await db.systemSetting.deleteMany().catch(() => {});
}

async function signTestToken(
  sub: string,
  role: "BUYER" | "STORE_OWNER" | "ADMIN",
  extraClaims: Record<string, unknown> = {}
): Promise<string> {
  const { privateKey } = resolveBuyerJwtKeyPair();
  return new SignJWT({
    role,
    ...extraClaims
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

describe("Booking Discount Integration Tests", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);

  let buyerUser: User;
  let store: Store;
  let category: Category;
  let subCategory: { id: string };
  let product: Product;
  let variantStandard: ProductVariant;
  let addr: { id: string };

  beforeEach(async () => {
    await cleanDatabase(db);
    buyerUser = await userRepo.ensureBuyerByPhone("+919988776099");

    category = await categoryRepo.create({
      slug: `cat-${Date.now().toString(36)}`,
      name: "Booking Services",
      imageUrl: "https://example.com/cat.jpg"
    });
    subCategory = await db.subCategory.create({
      data: { slug: "booking-sub", name: "Sub Services", categoryId: category.id }
    });

    store = await db.store.create({
      data: {
        address: "Booking Avenue",
        description: "d",
        name: "Apollo Diagnostics",
        phone: "+911200000099",
        storeType: "BOOKING_COMMERCE",
        isAcceptingBookings: true,
        bookingLeadDays: 1
      }
    });

    product = await productRepo.create({
      categoryId: category.id,
      subCategoryId: subCategory.id,
      description: "d",
      imageUrl: "https://x.jpg",
      name: "Blood Tests Package",
      storeId: store.id
    });

    variantStandard = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Blood Test Paket",
        price: new Prisma.Decimal("1000"), // Rs 1000.00 Subtotal
        stockQty: 0,
        unit: "visit",
        requiresFasting: false,
        allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00"],
        isActive: true
      }
    });

    addr = await db.address.create({
      data: {
        userId: buyerUser.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("POST /api/v1/bookings with a valid, active discount code SAVE20 successfully applies the discount, sets total to Rs 800.00, and increments usedCount", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    // Create a discount code SAVE20 (20% off)
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.discount.create({
      data: {
        code: "SAVE20",
        discountType: "PERCENTAGE",
        discountValue: new Prisma.Decimal("20"),
        startsAt: new Date(now.getTime() - 3600000), // 1 hour ago
        endsAt: new Date(now.getTime() + 86400000), // 1 day from now
        isActive: true,
        storeId: store.id
      }
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [
          { productId: product.id, variantId: variantStandard.id }
        ],
        scheduledDate: scheduledDate.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        discountCode: "SAVE20"
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(res.statusCode).toBe(201);
    const envelope = res.json();
    expect(envelope.success).toBe(true);

    const dbOrder = await db.order.findUniqueOrThrow({
      where: { id: envelope.data.orderId }
    });

    expect(Number(dbOrder.subtotal)).toBe(1000);
    expect(Number(dbOrder.total)).toBe(800);
    expect(dbOrder.appliedDiscountCode).toBe("SAVE20");

    const dbDiscount = await db.discount.findUniqueOrThrow({
      where: { storeId_code: { storeId: store.id, code: "SAVE20" } }
    });
    expect(dbDiscount.usedCount).toBe(1);
  });

  it("POST /api/v1/bookings with active store-wide offers automatically applies the offer, stacking with the valid discount code greedily", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const now = new Date();
    
    // Create store-wide offer: 10% off for store orders (min order Rs 500)
    await db.offer.create({
      data: {
        storeId: store.id,
        title: "Store Wide Offer 10%",
        description: "10% off on diagnostics",
        discountType: "PERCENTAGE",
        discountValue: new Prisma.Decimal("10"),
        minOrderAmount: new Prisma.Decimal("500"),
        startsAt: new Date(now.getTime() - 3600000),
        endsAt: new Date(now.getTime() + 86400000),
        isActive: true
      }
    });

    // Create discount code SAVE20 (20% off)
    await db.discount.create({
      data: {
        code: "SAVE20",
        discountType: "PERCENTAGE",
        discountValue: new Prisma.Decimal("20"),
        startsAt: new Date(now.getTime() - 3600000),
        endsAt: new Date(now.getTime() + 86400000),
        isActive: true,
        storeId: store.id
      }
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [
          { productId: product.id, variantId: variantStandard.id }
        ],
        scheduledDate: scheduledDate.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        discountCode: "SAVE20"
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(res.statusCode).toBe(201);
    const envelope = res.json();
    expect(envelope.success).toBe(true);

    const dbOrder = await db.order.findUniqueOrThrow({
      where: { id: envelope.data.orderId }
    });

    // Subtotal: 1000
    // Discount code SAVE20 (20%): -200
    // Store wide offer (10%): -100
    // Total should be 1000 - 200 - 100 = 700
    expect(Number(dbOrder.subtotal)).toBe(1000);
    expect(Number(dbOrder.total)).toBe(700);
    expect(dbOrder.appliedDiscountCode).toBe("SAVE20");
  });

  it("POST /api/v1/bookings with an invalid or expired discount code returns a 400 Bad Request", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [
          { productId: product.id, variantId: variantStandard.id }
        ],
        scheduledDate: scheduledDate.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        discountCode: "INVALIDCODE"
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.message).toMatch(/Invalid or expired discount code/i);
  });

  it("POST /api/v1/bookings with a valid coupon code but where order subtotal is below min threshold returns 400 Bad Request", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const now = new Date();

    // Create discount code BIGSAVE with minOrderAmount = 2000
    await db.discount.create({
      data: {
        code: "BIGSAVE",
        discountType: "PERCENTAGE",
        discountValue: new Prisma.Decimal("30"),
        minOrderAmount: new Prisma.Decimal("2000"),
        startsAt: new Date(now.getTime() - 3600000),
        endsAt: new Date(now.getTime() + 86400000),
        isActive: true,
        storeId: store.id
      }
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);

    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [
          { productId: product.id, variantId: variantStandard.id }
        ],
        scheduledDate: scheduledDate.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        discountCode: "BIGSAVE"
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.message).toMatch(/Discount minimum subtotal not met/i);
  });
});
