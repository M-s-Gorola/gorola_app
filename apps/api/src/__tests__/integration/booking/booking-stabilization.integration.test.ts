import { randomUUID } from "node:crypto";

import { type Category, Prisma, type PrismaClient, type Product, type ProductVariant, type Store, type StoreOwner, type User } from "@prisma/client";
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanBookingStabilizationGraph(db: PrismaClient): Promise<void> {
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

describe("Booking Stabilization (TDD Integration)", () => {
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
  let owner: StoreOwner;
  let ownerEmail = "owner-stab@gorola.in";

  beforeEach(async () => {
    await cleanBookingStabilizationGraph(db);
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

    const ownerHashed = await hash("Owner#123", 10);
    owner = await db.storeOwner.create({
      data: {
        email: ownerEmail,
        passwordHash: ownerHashed,
        storeId: store.id
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
        label: "CBC Test",
        price: new Prisma.Decimal("250"),
        stockQty: 0,
        unit: "visit",
        requiresFasting: false,
        allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00"],
        isActive: true
      }
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("should return fully serialized store relation in buyer details query", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const buyerToken = await signTestToken(buyerUser.id, "BUYER");
    const addr = await db.address.create({
      data: {
        userId: buyerUser.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const placeRes = await server.inject({
      headers: { authorization: `Bearer ${buyerToken}` },
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
    expect(placeRes.statusCode).toBe(201);
    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    const getRes = await server.inject({
      headers: { authorization: `Bearer ${buyerToken}` },
      method: "GET",
      url: `/api/v1/bookings/${orderId}`
    });

    await server.close();

    expect(getRes.statusCode).toBe(200);
    const envelope = getRes.json() as {
      success: boolean;
      data: {
        id: string;
        store: {
          id: string;
          name: string;
          phone: string;
          storeType: string;
        };
      };
    };

    expect(envelope.success).toBe(true);
    expect(envelope.data.store).toBeDefined();
    expect(envelope.data.store.id).toBe(store.id);
    expect(envelope.data.store.name).toBe("Apollo Diagnostics");
    expect(envelope.data.store.phone).toBe("+911200000099");
    expect(envelope.data.store.storeType).toBe("BOOKING_COMMERCE");
  });

  it("should return booking-specific KPI summary in dashboard when storeType is BOOKING_COMMERCE", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const buyerToken = await signTestToken(buyerUser.id, "BUYER");
    const ownerToken = await signTestToken(owner.id, "STORE_OWNER");
    const addr = await db.address.create({
      data: {
        userId: buyerUser.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create 1 booking request
    const placeRes = await server.inject({
      headers: { authorization: `Bearer ${buyerToken}` },
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
    expect(placeRes.statusCode).toBe(201);

    // Call store owner dashboard
    const dashboardRes = await server.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: "GET",
      url: "/api/v1/store/dashboard"
    });

    await server.close();

    expect(dashboardRes.statusCode).toBe(200);
    const envelope = dashboardRes.json() as {
      success: boolean;
      data: {
        todayOrderCount: number;
        todayRevenue: number;
        pendingOrdersCount: number;
      };
    };

    expect(envelope.success).toBe(true);
    // Since it's a booking store, the aggregate counts should correctly find the BookingOrder
    expect(envelope.data.todayOrderCount).toBe(1);
    expect(envelope.data.pendingOrdersCount).toBe(1);
    expect(envelope.data.todayRevenue).toBe(250);
  });
});
