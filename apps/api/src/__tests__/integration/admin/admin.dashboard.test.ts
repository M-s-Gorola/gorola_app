import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function generateAccessToken(userId: string, role: string, storeId?: string): Promise<string> {
  const keys = resolveBuyerJwtKeyPair();
  return new SignJWT({
    role,
    ...(storeId ? { storeId } : {})
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keys.privateKey);
}

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.bookingOrder.deleteMany();
  await db.stockMovement.deleteMany();
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
  await db.admin.deleteMany();
  await db.featureFlag.deleteMany();
}

describe("Admin Dashboard Integration Tests", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;

  beforeAll(() => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);
  });

  it("should return 401 Unauthorized when authorization token is missing", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER", async () => {
    const token = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a STORE_OWNER", async () => {
    const token = await generateAccessToken("owner-123", "STORE_OWNER", "store-123");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should return 200 and correct aggregate KPI metrics across all stores for ADMIN", async () => {
    // 1. Setup Store A & Store B
    const storeA = await db.store.create({
      data: {
        name: "Store A",
        description: "Organic Groceries",
        phone: "+919999999901",
        address: "Store A Street",
        storeType: "QUICK_COMMERCE"
      }
    });

    const storeB = await db.store.create({
      data: {
        name: "Store B",
        description: "Fast Foods",
        phone: "+919999999902",
        address: "Store B Street",
        storeType: "QUICK_COMMERCE"
      }
    });

    // 2. Setup verified Buyer User
    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // 3. Setup catalog for Store A & B
    const category = await db.category.create({
      data: {
        slug: "groceries",
        name: "Groceries",
        imageUrl: "http://example.com/groceries.png",
        displayOrder: 1,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.create({
      data: {
        slug: "fruits",
        name: "Fruits",
        imageUrl: "http://example.com/fruits.png",
        displayOrder: 1,
        isActive: true,
        categoryId: category.id
      }
    });

    const productA = await db.product.create({
      data: {
        name: "Apples",
        description: "Fresh red apples",
        storeId: storeA.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/apples.png",
        isActive: true
      }
    });

    // Low stock variant (isLowStock = true)
    await db.productVariant.create({
      data: {
        productId: productA.id,
        label: "1kg",
        price: 150.0,
        stockQty: 2,
        lowStockThreshold: 5,
        isLowStock: true,
        isInStock: true,
        unit: "kg",
        isActive: true
      }
    });

    const productB = await db.product.create({
      data: {
        name: "Burgers",
        description: "Cheesy burgers",
        storeId: storeB.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
        imageUrl: "http://example.com/burgers.png",
        isActive: true
      }
    });

    // Normal variant
    await db.productVariant.create({
      data: {
        productId: productB.id,
        label: "Double Cheese",
        price: 250.0,
        stockQty: 10,
        lowStockThreshold: 3,
        isLowStock: false,
        isInStock: true,
        unit: "piece",
        isActive: true
      }
    });

    // 4. Seed active pending ads
    await db.advertisement.create({
      data: {
        storeId: storeA.id,
        title: "Store A Promo Banner",
        imageUrl: "http://example.com/banner.png",
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        isActive: true,
        isApproved: false
      }
    });

    // 5. Seed feature flags
    await db.featureFlag.create({
      data: {
        key: "WEATHER_MODE_ACTIVE",
        value: false,
        updatedBy: "system",
        description: "Controls weather overlay"
      }
    });

    // 6. Create Orders today for both stores
    // Order 1: DELIVERED today for Store A (revenue = 150)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "DELIVERED",
        subtotal: 150.0,
        deliveryFee: 20.0,
        total: 170.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park",
        createdAt: new Date()
      }
    });

    // Order 2: PLACED today for Store B (revenue = 250)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeB.id,
        status: "PLACED",
        subtotal: 250.0,
        deliveryFee: 30.0,
        total: 280.0,
        paymentMethod: "UPI",
        landmarkDescription: "Near school",
        createdAt: new Date()
      }
    });

    // Order 3: CANCELLED today for Store A (excluded from revenue count)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "CANCELLED",
        subtotal: 100.0,
        deliveryFee: 20.0,
        total: 120.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park",
        createdAt: new Date()
      }
    });

    // 7. Request dashboard for ADMIN
    const token = await generateAccessToken("admin-123", "ADMIN");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);

    const data = body.data;
    // Total orders placed today is 3
    expect(data.totalOrdersToday).toBe(3);
    // Total revenue is 170 (Store A) + 280 (Store B) = 450
    expect(data.totalRevenueToday).toBe(450);

    // Platform counts
    expect(data.lowStockAlertCount).toBe(1);
    expect(data.totalActiveBuyers).toBe(1);
    expect(data.totalProducts).toBe(2);
    expect(data.pendingAdApprovalsCount).toBe(1);

    // Per-store breakdown validation
    expect(data.perStoreBreakdown).toBeInstanceOf(Array);
    expect(data.perStoreBreakdown.length).toBe(2);

    const storeABreakdown = data.perStoreBreakdown.find((s: { storeId: string }) => s.storeId === storeA.id);
    const storeBBreakdown = data.perStoreBreakdown.find((s: { storeId: string }) => s.storeId === storeB.id);

    expect(storeABreakdown).toBeDefined();
    // Store A orders placed today: 2 (DELIVERED, CANCELLED)
    expect(storeABreakdown.ordersToday).toBe(2);
    // Store A revenue: 170
    expect(storeABreakdown.revenueToday).toBe(170);
    // Store A pending orders count (status PLACED): 0
    expect(storeABreakdown.pendingOrdersCount).toBe(0);

    expect(storeBBreakdown).toBeDefined();
    // Store B orders placed today: 1 (PLACED)
    expect(storeBBreakdown.ordersToday).toBe(1);
    // Store B revenue: 280
    expect(storeBBreakdown.revenueToday).toBe(280);
    // Store B pending orders count: 1
    expect(storeBBreakdown.pendingOrdersCount).toBe(1);

    // Feature flags check
    expect(data.featureFlags).toBeInstanceOf(Array);
    const weatherFlag = data.featureFlags.find((f: { key: string }) => f.key === "WEATHER_MODE_ACTIVE");
    expect(weatherFlag).toBeDefined();
    expect(weatherFlag.value).toBe(false);

    // Weekly revenue check
    expect(data.weeklyRevenue).toBeInstanceOf(Array);
    expect(data.weeklyRevenue.length).toBe(7);
  });

  it("should return 200 and correct orders trend filtered by storeIds", async () => {
    const storeA = await db.store.create({
      data: {
        name: "Store A",
        description: "Organic Groceries",
        phone: "+919999999911",
        address: "Store A Street",
        storeType: "QUICK_COMMERCE"
      }
    });
    const storeB = await db.store.create({
      data: {
        name: "Store B",
        description: "Fast Foods",
        phone: "+919999999912",
        address: "Store B Street",
        storeType: "QUICK_COMMERCE"
      }
    });
    const storeC = await db.store.create({
      data: {
        name: "Store C",
        description: "Other Shop",
        phone: "+919999999913",
        address: "Store C Street",
        storeType: "QUICK_COMMERCE"
      }
    });

    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543211",
        isVerified: true
      }
    });

    // Create Quick commerce orders for Store A, Store B, Store C
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "DELIVERED",
        subtotal: 100.0,
        deliveryFee: 20.0,
        total: 120.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park"
      }
    });
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeB.id,
        status: "PLACED",
        subtotal: 200.0,
        deliveryFee: 20.0,
        total: 220.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park"
      }
    });
    // Order for Store C (should be filtered out when querying for storeA, storeB)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeC.id,
        status: "DELIVERED",
        subtotal: 300.0,
        deliveryFee: 20.0,
        total: 320.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park"
      }
    });

    const token = await generateAccessToken("admin-123", "ADMIN");
    const response = await server.inject({
      method: "GET",
      url: `/api/v1/admin/dashboard/orders-trend?range=WEEK&groupBy=DAILY&storeIds=${storeA.id},${storeB.id}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    
    // Sum counts to verify only Store A and Store B orders are aggregated
    const totalCount = body.data.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
    expect(totalCount).toBe(2);
  });

  it("should return 200 and correct bookings trend filtered by storeIds", async () => {
    const storeC = await db.store.create({
      data: {
        name: "Store C",
        description: "Services Store",
        phone: "+919999999914",
        address: "Store C Street",
        storeType: "BOOKING_COMMERCE"
      }
    });
    const storeD = await db.store.create({
      data: {
        name: "Store D",
        description: "Other Services",
        phone: "+919999999915",
        address: "Store D Street",
        storeType: "BOOKING_COMMERCE"
      }
    });

    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543212",
        isVerified: true
      }
    });

    // Create booking orders
    const createBooking = async (storeId: string, status: "APPROVED" | "PENDING_APPROVAL") => {
      const order = await db.order.create({
        data: {
          userId: buyer.id,
          storeId,
          status: "PLACED",
          orderType: "BOOKING",
          subtotal: 500.0,
          deliveryFee: 50.0,
          total: 550.0,
          paymentMethod: "COD",
          landmarkDescription: "Near park"
        }
      });
      await db.bookingOrder.create({
        data: {
          orderId: order.id,
          scheduledDate: new Date(),
          timeslot: "09:00-11:00",
          approvalStatus: status
        }
      });
    };

    await createBooking(storeC.id, "APPROVED");
    await createBooking(storeC.id, "PENDING_APPROVAL");
    // Booking for Store D (filtered out)
    await createBooking(storeD.id, "APPROVED");

    const token = await generateAccessToken("admin-123", "ADMIN");
    const response = await server.inject({
      method: "GET",
      url: `/api/v1/admin/dashboard/bookings-trend?range=WEEK&groupBy=DAILY&storeIds=${storeC.id}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    
    // Sum counts to verify only Store C bookings (APPROVED/PENDING_APPROVAL) are aggregated
    const totalCount = body.data.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
    expect(totalCount).toBe(2);
  });

  it("should return 200 and correct dashboard metrics filtered by storeType and storeIds", async () => {
    const storeA = await db.store.create({
      data: {
        name: "Quick Store A",
        description: "Organic Groceries",
        phone: "+919999999905",
        address: "Store A Street",
        storeType: "QUICK_COMMERCE"
      }
    });

    const storeB = await db.store.create({
      data: {
        name: "Booking Store B",
        description: "Services Store",
        phone: "+919999999906",
        address: "Store B Street",
        storeType: "BOOKING_COMMERCE"
      }
    });

    const buyer = await db.user.create({
      data: {
        name: "Test Buyer X",
        phone: "+919876543209",
        isVerified: true
      }
    });

    // Order for Store A (Quick)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "DELIVERED",
        subtotal: 150.0,
        deliveryFee: 20.0,
        total: 170.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park"
      }
    });

    // Booking for Store B (Booking)
    const bookingOrder = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeB.id,
        status: "PLACED",
        orderType: "BOOKING",
        subtotal: 500.0,
        deliveryFee: 50.0,
        total: 550.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park"
      }
    });
    await db.bookingOrder.create({
      data: {
        orderId: bookingOrder.id,
        scheduledDate: new Date(),
        timeslot: "09:00-11:00",
        approvalStatus: "APPROVED"
      }
    });

    const token = await generateAccessToken("admin-123", "ADMIN");

    // 1. Request with storeType = QUICK_COMMERCE
    const resQuick = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard?storeType=QUICK_COMMERCE",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(resQuick.statusCode).toBe(200);
    const bodyQuick = resQuick.json().data;
    expect(bodyQuick.totalOrdersToday).toBe(1);
    expect(bodyQuick.totalRevenueToday).toBe(170.0);
    expect(bodyQuick.perStoreBreakdown).toHaveLength(1);
    expect(bodyQuick.perStoreBreakdown[0].storeId).toBe(storeA.id);

    // 2. Request with storeIds = storeB.id
    const resStoreB = await server.inject({
      method: "GET",
      url: `/api/v1/admin/dashboard?storeIds=${storeB.id}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(resStoreB.statusCode).toBe(200);
    const bodyStoreB = resStoreB.json().data;
    expect(bodyStoreB.totalOrdersToday).toBe(1);
    expect(bodyStoreB.totalRevenueToday).toBe(550.0);
    expect(bodyStoreB.perStoreBreakdown).toHaveLength(1);
    expect(bodyStoreB.perStoreBreakdown[0].storeId).toBe(storeB.id);
  });

  it("should support storeType filter in orders-trend and bookings-trend endpoints", async () => {
    const storeA = await db.store.create({
      data: {
        name: "Quick Store A",
        description: "Organic Groceries",
        phone: "+919999999907",
        address: "Store A Street",
        storeType: "QUICK_COMMERCE"
      }
    });

    const storeB = await db.store.create({
      data: {
        name: "Booking Store B",
        description: "Services Store",
        phone: "+919999999908",
        address: "Store B Street",
        storeType: "BOOKING_COMMERCE"
      }
    });

    const buyer = await db.user.create({
      data: {
        name: "Test Buyer Y",
        phone: "+919876543208",
        isVerified: true
      }
    });

    // Create a Quick Order for Store A
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "DELIVERED",
        subtotal: 100.0,
        deliveryFee: 20.0,
        total: 120.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park"
      }
    });

    // Create a Booking Order for Store B
    const bookingOrder = await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeB.id,
        status: "PLACED",
        orderType: "BOOKING",
        subtotal: 300.0,
        deliveryFee: 30.0,
        total: 330.0,
        paymentMethod: "COD",
        landmarkDescription: "Near school"
      }
    });
    await db.bookingOrder.create({
      data: {
        orderId: bookingOrder.id,
        scheduledDate: new Date(),
        timeslot: "09:00-11:00",
        approvalStatus: "APPROVED"
      }
    });

    const token = await generateAccessToken("admin-123", "ADMIN");

    // 1. orders-trend with storeType=BOOKING_COMMERCE (should return 0 orders because bookings aren't QUICK orders)
    const resOrdersBookingType = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard/orders-trend?storeType=BOOKING_COMMERCE",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resOrdersBookingType.statusCode).toBe(200);
    const dataOrdersBookingType = resOrdersBookingType.json().data;
    const totalCountOrdersBooking = dataOrdersBookingType.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
    expect(totalCountOrdersBooking).toBe(0);

    // 2. orders-trend with storeType=QUICK_COMMERCE (should return 1 order)
    const resOrdersQuickType = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard/orders-trend?storeType=QUICK_COMMERCE",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resOrdersQuickType.statusCode).toBe(200);
    const dataOrdersQuickType = resOrdersQuickType.json().data;
    const totalCountOrdersQuick = dataOrdersQuickType.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
    expect(totalCountOrdersQuick).toBe(1);

    // 3. bookings-trend with storeType=QUICK_COMMERCE (should return 0 bookings)
    const resBookingsQuickType = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard/bookings-trend?storeType=QUICK_COMMERCE",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resBookingsQuickType.statusCode).toBe(200);
    const dataBookingsQuickType = resBookingsQuickType.json().data;
    const totalCountBookingsQuick = dataBookingsQuickType.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
    expect(totalCountBookingsQuick).toBe(0);

    // 4. bookings-trend with storeType=BOOKING_COMMERCE (should return 1 booking)
    const resBookingsBookingType = await server.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard/bookings-trend?storeType=BOOKING_COMMERCE",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resBookingsBookingType.statusCode).toBe(200);
    const dataBookingsBookingType = resBookingsBookingType.json().data;
    const totalCountBookingsBooking = dataBookingsBookingType.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
    expect(totalCountBookingsBooking).toBe(1);
  });
});
