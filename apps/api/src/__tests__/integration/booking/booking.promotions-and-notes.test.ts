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

describe("Booking Promotions and Notes Integration Tests (Phase 6.19.1)", () => {
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
      name: "Diagnostic Services",
      imageUrl: "https://example.com/cat.jpg"
    });
    subCategory = await db.subCategory.create({
      data: { slug: "lab-sub", name: "Blood Diagnostics", categoryId: category.id }
    });

    store = await db.store.create({
      data: {
        address: "Healthcare Blvd",
        description: "Diagnostic Lab",
        name: "Metropolis Diagnostics",
        phone: "+911200000099",
        storeType: "BOOKING_COMMERCE",
        isAcceptingBookings: true,
        bookingLeadDays: 1
      }
    });

    product = await productRepo.create({
      categoryId: category.id,
      subCategoryId: subCategory.id,
      description: "Full body lab profile",
      imageUrl: "https://example.com/test.jpg",
      name: "Complete Blood Profile",
      storeId: store.id
    });

    variantStandard = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Profile Standard",
        price: new Prisma.Decimal("1000.00"), // Subtotal: 1000
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
        landmarkDescription: "Near Central Park Main Gate",
        flatRoom: "Flat 402"
      }
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("POST /api/v1/bookings with stacked coupon, store offer, and delivery note persists and serializes all fields accurately", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const now = new Date();
    // 1. Create Coupon WELCOME50 (Flat 50 off)
    await db.discount.create({
      data: {
        code: "WELCOME50",
        discountType: "FLAT",
        discountValue: new Prisma.Decimal("50.00"),
        startsAt: new Date(now.getTime() - 3600000),
        endsAt: new Date(now.getTime() + 86400000),
        isActive: true,
        storeId: store.id
      }
    });

    // 2. Create Store-Wide Offer 10% OFF
    await db.offer.create({
      data: {
        title: "10% OFF",
        description: "10% festive store discount",
        discountType: "PERCENTAGE",
        discountValue: new Prisma.Decimal("10.00"),
        startsAt: new Date(now.getTime() - 3600000),
        endsAt: new Date(now.getTime() + 86400000),
        isActive: true,
        storeId: store.id
      }
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deliveryNoteText = "Please bring 22-gauge needle and ring bell twice";

    // 3. Place booking
    const placeRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [{ productId: product.id, variantId: variantStandard.id }],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        discountCode: "WELCOME50",
        deliveryNote: deliveryNoteText
      },
      url: "/api/v1/bookings"
    });

    expect(placeRes.statusCode).toBe(201);
    const placeEnvelope = placeRes.json() as { success: boolean; data: { orderId: string } };
    expect(placeEnvelope.success).toBe(true);
    const orderId = placeEnvelope.data.orderId;

    // 4. Retrieve booking via GET /api/v1/bookings/:orderId
    const getRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: `/api/v1/bookings/${orderId}`
    });

    await server.close();

    expect(getRes.statusCode).toBe(200);
    const getEnvelope = getRes.json() as { success: boolean; data: Record<string, unknown> };
    expect(getEnvelope.success).toBe(true);

    const booking = getEnvelope.data;
    // Assert promotional snapshot columns
    expect(booking.appliedDiscountCode).toBe("WELCOME50");
    expect(booking.appliedOfferTitle).toBe("10% OFF");
    expect(booking.discountSavingAmount).toBe(50);
    expect(booking.offerSavingAmount).toBe(100); // 10% of 1000 subtotal = 100
    expect(booking.deliveryNote).toBe(deliveryNoteText);

    // Verify DB row
    const dbOrder = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(dbOrder.appliedDiscountCode).toBe("WELCOME50");
    expect(dbOrder.appliedOfferTitle).toBe("10% OFF");
    expect(Number(dbOrder.discountSavingAmount)).toBe(50);
    expect(Number(dbOrder.offerSavingAmount)).toBe(100);
    expect(dbOrder.deliveryNote).toBe(deliveryNoteText);
  });

  it("POST /api/v1/bookings with coupon only returns offerSavingAmount = 0 and appliedOfferTitle = null", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const now = new Date();
    await db.discount.create({
      data: {
        code: "COUPONONLY",
        discountType: "FLAT",
        discountValue: new Prisma.Decimal("100.00"),
        startsAt: new Date(now.getTime() - 3600000),
        endsAt: new Date(now.getTime() + 86400000),
        isActive: true,
        storeId: store.id
      }
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placeRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [{ productId: product.id, variantId: variantStandard.id }],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        discountCode: "COUPONONLY"
      },
      url: "/api/v1/bookings"
    });

    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    const getRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: `/api/v1/bookings/${orderId}`
    });

    await server.close();

    expect(getRes.statusCode).toBe(200);
    const booking = (getRes.json() as { data: Record<string, unknown> }).data;

    expect(booking.appliedDiscountCode).toBe("COUPONONLY");
    expect(booking.appliedOfferTitle).toBeNull();
    expect(booking.discountSavingAmount).toBe(100);
    expect(booking.offerSavingAmount).toBe(0);
    expect(booking.deliveryNote).toBeNull();
  });

  it("POST /api/v1/bookings with store offer only returns discountSavingAmount = 0 and appliedDiscountCode = null", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const now = new Date();
    await db.offer.create({
      data: {
        title: "20% Promo",
        description: "20% off all tests",
        discountType: "PERCENTAGE",
        discountValue: new Prisma.Decimal("20.00"),
        startsAt: new Date(now.getTime() - 3600000),
        endsAt: new Date(now.getTime() + 86400000),
        isActive: true,
        storeId: store.id
      }
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placeRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [{ productId: product.id, variantId: variantStandard.id }],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id
      },
      url: "/api/v1/bookings"
    });

    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    const getRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: `/api/v1/bookings/${orderId}`
    });

    await server.close();

    expect(getRes.statusCode).toBe(200);
    const booking = (getRes.json() as { data: Record<string, unknown> }).data;

    expect(booking.appliedDiscountCode).toBeNull();
    expect(booking.appliedOfferTitle).toBe("20% Promo");
    expect(booking.discountSavingAmount).toBe(0);
    expect(booking.offerSavingAmount).toBe(200); // 20% of 1000 = 200
  });

  it("POST /api/v1/bookings at full retail returns 0 savings and null promo titles", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placeRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [{ productId: product.id, variantId: variantStandard.id }],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id
      },
      url: "/api/v1/bookings"
    });

    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    const getRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
      url: `/api/v1/bookings/${orderId}`
    });

    await server.close();

    expect(getRes.statusCode).toBe(200);
    const booking = (getRes.json() as { data: Record<string, unknown> }).data;

    expect(booking.appliedDiscountCode).toBeNull();
    expect(booking.appliedOfferTitle).toBeNull();
    expect(booking.discountSavingAmount).toBe(0);
    expect(booking.offerSavingAmount).toBe(0);
  });

  it("POST /api/v1/bookings with deliveryNote boundary checks (500 chars succeeds, 501 fails)", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 500 characters
    const valid500Note = "A".repeat(500);

    const successRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [{ productId: product.id, variantId: variantStandard.id }],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        deliveryNote: valid500Note
      },
      url: "/api/v1/bookings"
    });

    expect(successRes.statusCode).toBe(201);
    const orderId = (successRes.json() as { data: { orderId: string } }).data.orderId;
    const dbOrder = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(dbOrder.deliveryNote).toBe(valid500Note);

    // 501 characters -> must fail with 400
    const invalid501Note = "A".repeat(501);
    const failRes = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [{ productId: product.id, variantId: variantStandard.id }],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        deliveryNote: invalid501Note
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(failRes.statusCode).toBe(400);
  });

  it("POST /api/v1/bookings normalizes empty or whitespace deliveryNote to null", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await server.inject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [{ productId: product.id, variantId: variantStandard.id }],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id,
        deliveryNote: "     "
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(res.statusCode).toBe(201);
    const orderId = (res.json() as { data: { orderId: string } }).data.orderId;
    const dbOrder = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(dbOrder.deliveryNote).toBeNull();
  });
});
