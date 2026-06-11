import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { StoreOwnerRepository } from "../../../modules/store-owner/store-owner.repository.js";
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
}

describe("StoreOwner Dashboard Integration Tests", () => {
  const db = getPrismaClient();
  const storeRepo = new StoreRepository(db);
  const ownerRepo = new StoreOwnerRepository(db);
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
      url: "/api/v1/store/dashboard"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().success).toBe(false);
  });

  it("should return 403 Forbidden when user is a BUYER rather than STORE_OWNER", async () => {
    const buyerToken = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/store/dashboard",
      headers: {
        authorization: `Bearer ${buyerToken}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().success).toBe(false);
  });

  it("should return 200 and correct KPI metrics with isolation between stores", async () => {
    // 1. Setup Store A & Store B
    const storeA = await storeRepo.create({
      name: "Store A",
      description: "Organic Groceries",
      phone: "+919999999901",
      address: "Store A Street"
    });

    const storeB = await storeRepo.create({
      name: "Store B",
      description: "Fast Foods",
      phone: "+919999999902",
      address: "Store B Street"
    });

    // 2. Setup Store Owners
    const ownerA = await ownerRepo.create({
      email: "owner.a@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeA.id
    });

    const ownerB = await ownerRepo.create({
      email: "owner.b@gorola.in",
      passwordHash: "dummy-hash",
      storeId: storeB.id
    });

    // 3. Setup common Buyer User
    const buyer = await db.user.create({
      data: {
        name: "Test Buyer",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // 4. Setup catalog for Store A
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

    // Low stock variant (stockQty <= lowStockThreshold)
    const variantA1 = await db.productVariant.create({
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

    // Normal stock variant
    const variantA2 = await db.productVariant.create({
      data: {
        productId: productA.id,
        label: "5kg Box",
        price: 700.0,
        stockQty: 20,
        lowStockThreshold: 5,
        isLowStock: false,
        isInStock: true,
        unit: "box",
        isActive: true
      }
    });

    // 5. Seed active ads and offers for Store A
    await db.advertisement.create({
      data: {
        storeId: storeA.id,
        title: "Store A Promo Banner",
        imageUrl: "http://example.com/banner.png",
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        isActive: true,
        isApproved: true
      }
    });

    await db.offer.create({
      data: {
        storeId: storeA.id,
        title: "10% Off Organic Items",
        description: "Save on fresh items",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startsAt: new Date(Date.now() - 3600000),
        endsAt: new Date(Date.now() + 3600000),
        isActive: true
      }
    });

    // 6. Create Orders today for Store A
    // Order 1: DELIVERED, placed today (revenue = 150)
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
        createdAt: new Date(),
        items: {
          create: [
            {
              productVariantId: variantA1.id,
              productName: productA.name,
              variantLabel: variantA1.label,
              price: variantA1.price,
              quantity: 1
            }
          ]
        }
      }
    });

    // Order 2: PLACED, placed today (revenue = 700)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "PLACED",
        subtotal: 700.0,
        deliveryFee: 30.0,
        total: 730.0,
        paymentMethod: "UPI",
        landmarkDescription: "Near school",
        createdAt: new Date(),
        items: {
          create: [
            {
              productVariantId: variantA2.id,
              productName: productA.name,
              variantLabel: variantA2.label,
              price: variantA2.price,
              quantity: 1
            }
          ]
        }
      }
    });

    // Order 3: CANCELLED, placed today (excluded from revenue count)
    await db.order.create({
      data: {
        userId: buyer.id,
        storeId: storeA.id,
        status: "CANCELLED",
        subtotal: 150.0,
        deliveryFee: 20.0,
        total: 170.0,
        paymentMethod: "COD",
        landmarkDescription: "Near park",
        createdAt: new Date()
      }
    });

    // 7. Request dashboard for Store Owner A
    const tokenA = await generateAccessToken(ownerA.id, "STORE_OWNER", storeA.id);
    const resA = await server.inject({
      method: "GET",
      url: "/api/v1/store/dashboard",
      headers: {
        authorization: `Bearer ${tokenA}`
      }
    });

    expect(resA.statusCode).toBe(200);
    const bodyA = resA.json();
    expect(bodyA.success).toBe(true);
    
    const dataA = bodyA.data;
    // Total order count placed today is 3 (DELIVERED, PLACED, CANCELLED)
    expect(dataA.todayOrderCount).toBe(3);
    // Revenue for DELIVERED (170) + PLACED (730) = 900
    expect(dataA.todayRevenue).toBe(900);
    // Pending orders count (status: PLACED) is 1
    expect(dataA.pendingOrdersCount).toBe(1);

    // Weekly revenue check
    expect(dataA.weeklyRevenue).toBeInstanceOf(Array);
    expect(dataA.weeklyRevenue.length).toBe(7);
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    const d = String(new Date().getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    const todayTrend = dataA.weeklyRevenue.find((item: { date: string }) => item.date === todayStr);
    expect(todayTrend).toBeDefined();
    expect(todayTrend.revenue).toBe(900);

    // Top selling products check (Apples sold 2 units across Placed/Delivered)
    expect(dataA.topProducts).toBeInstanceOf(Array);
    expect(dataA.topProducts[0]).toEqual({
      name: "Apples",
      soldCount: 2
    });

    // Low stock alert check
    expect(dataA.lowStockItems).toBeInstanceOf(Array);
    expect(dataA.lowStockItems.length).toBe(1);
    expect(dataA.lowStockItems[0]).toEqual({
      productName: "Apples",
      variantLabel: "1kg",
      stockQty: 2
    });

    expect(dataA.activeAdvertisementsCount).toBe(1);
    expect(dataA.activeOffersCount).toBe(1);

    // 8. Request dashboard for Store Owner B (strict isolation verify)
    const tokenB = await generateAccessToken(ownerB.id, "STORE_OWNER", storeB.id);
    const resB = await server.inject({
      method: "GET",
      url: "/api/v1/store/dashboard",
      headers: {
        authorization: `Bearer ${tokenB}`
      }
    });

    expect(resB.statusCode).toBe(200);
    const dataB = resB.json().data;
    expect(dataB.todayOrderCount).toBe(0);
    expect(dataB.todayRevenue).toBe(0);
    expect(dataB.pendingOrdersCount).toBe(0);
    expect(dataB.activeAdvertisementsCount).toBe(0);
    expect(dataB.activeOffersCount).toBe(0);
    expect(dataB.topProducts.length).toBe(0);
    expect(dataB.lowStockItems.length).toBe(0);
  });

  describe("Multi-Dimensional Analytics Granularity", () => {
    it("should aggregate revenue dynamically based on range and groupBy parameters", async () => {
      // 1. Setup Store, Owner, and common Buyer
      const store = await storeRepo.create({
        name: "Analytics Store",
        description: "Analytics test shop",
        phone: "+919999999905",
        address: "Analytics Street"
      });

      const owner = await ownerRepo.create({
        email: "owner.analytics@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });

      const buyer = await db.user.create({
        data: {
          name: "Analytics Buyer",
          phone: "+919876543205",
          isVerified: true
        }
      });

      // Helper to seed orders at specific dates and times
      const createOrder = async (date: Date, total: number) => {
        await db.order.create({
          data: {
            userId: buyer.id,
            storeId: store.id,
            status: "DELIVERED",
            subtotal: total - 20,
            deliveryFee: 20,
            total,
            paymentMethod: "COD",
            landmarkDescription: "Test landmark",
            createdAt: date
          }
        });
      };

      const now = new Date();

      // Today at 10:15 AM (Revenue = 100)
      const dateToday10AM = new Date(now);
      dateToday10AM.setHours(10, 15, 0, 0);
      await createOrder(dateToday10AM, 100.0);

      // Yesterday at 15:30 PM (Revenue = 200)
      const dateYesterday3PM = new Date(now);
      dateYesterday3PM.setDate(now.getDate() - 1);
      dateYesterday3PM.setHours(15, 30, 0, 0);
      await createOrder(dateYesterday3PM, 200.0);

      // 10 days ago at 10:45 AM (Revenue = 300) - falls in MONTH / YEAR
      const date10DaysAgo10AM = new Date(now);
      date10DaysAgo10AM.setDate(now.getDate() - 10);
      date10DaysAgo10AM.setHours(10, 45, 0, 0);
      await createOrder(date10DaysAgo10AM, 300.0);

      // 40 days ago at 15:00 PM (Revenue = 400) - falls in YEAR only
      const date40DaysAgo3PM = new Date(now);
      date40DaysAgo3PM.setDate(now.getDate() - 40);
      date40DaysAgo3PM.setHours(15, 0, 0, 0);
      await createOrder(date40DaysAgo3PM, 400.0);

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      // Scenario 1: range=WEEK, groupBy=HOURLY (Hour-of-day pattern across the week)
      // Expect 24 buckets.
      // Hourly bucket 10:00 should sum Today's 10 AM (100). (Yesterday was 15:00, 10 days ago is out of week).
      // Hourly bucket 15:00 should sum Yesterday's 15:00 (200).
      const res1 = await server.inject({
        method: "GET",
        url: "/api/v1/store/dashboard?range=WEEK&groupBy=HOURLY",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(res1.statusCode).toBe(200);
      const weeklyTrend = res1.json().data.weeklyRevenue;
      expect(weeklyTrend.length).toBe(24);
      
      const hour10Item = weeklyTrend.find((item: { date: string }) => item.date === "10:00");
      const hour15Item = weeklyTrend.find((item: { date: string }) => item.date === "15:00");
      expect(hour10Item).toBeDefined();
      expect(hour10Item.revenue).toBe(100.0);
      expect(hour15Item).toBeDefined();
      expect(hour15Item.revenue).toBe(200.0);

      // Scenario 2: range=MONTH, groupBy=DAILY (Sequential daily timeline for last 30 days)
      // Expect 30 buckets.
      // Today should have 100, Yesterday 200, 10 days ago 300. 40 days ago is out of month.
      const res2 = await server.inject({
        method: "GET",
        url: "/api/v1/store/dashboard?range=MONTH&groupBy=DAILY",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(res2.statusCode).toBe(200);
      const monthlyTrend = res2.json().data.weeklyRevenue;
      expect(monthlyTrend.length).toBe(30);

      const formatDate = (d: Date) => {
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      };
      
      const todayLabel = formatDate(now);
      const yesterdayLabel = formatDate(dateYesterday3PM);
      const tenDaysAgoLabel = formatDate(date10DaysAgo10AM);

      const todayItem = monthlyTrend.find((item: { date: string }) => item.date === todayLabel);
      const yesterdayItem = monthlyTrend.find((item: { date: string }) => item.date === yesterdayLabel);
      const tenDaysAgoItem = monthlyTrend.find((item: { date: string }) => item.date === tenDaysAgoLabel);

      expect(todayItem?.revenue).toBe(100.0);
      expect(yesterdayItem?.revenue).toBe(200.0);
      expect(tenDaysAgoItem?.revenue).toBe(300.0);

      // Scenario 3: range=YEAR, groupBy=DAILY (Day-of-week distribution across the current year)
      // Expect 7 buckets (Mon, Tue, Wed, Thu, Fri, Sat, Sun) representing aggregate pattern of the year.
      const res3 = await server.inject({
        method: "GET",
        url: "/api/v1/store/dashboard?range=YEAR&groupBy=DAILY",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(res3.statusCode).toBe(200);
      const yearlyDayTrend = res3.json().data.weeklyRevenue;
      expect(yearlyDayTrend.length).toBe(7);
    });
  });

  describe("Booking Commerce Dashboard metrics", () => {
    it("should return correct metrics (todayOrderCount as scheduled approved bookings today, activeDiscountsCount and activeOffersCount separated)", async () => {
      // 1. Setup Store, Owner, and Buyer
      const store = await storeRepo.create({
        name: "Booking Store",
        description: "Booking commerce shop",
        phone: "+919999999906",
        address: "Booking Street",
        storeType: "BOOKING_COMMERCE"
      });

      const owner = await ownerRepo.create({
        email: "owner.booking@gorola.in",
        passwordHash: "dummy-hash",
        storeId: store.id
      });

      const buyer = await db.user.create({
        data: {
          name: "Booking Buyer",
          phone: "+919876543206",
          isVerified: true
        }
      });

      // Helper to create booking orders
      const createBookingOrder = async (scheduledDate: Date, approvalStatus: "APPROVED" | "PENDING_APPROVAL", createdAt: Date = new Date()) => {
        const order = await db.order.create({
          data: {
            userId: buyer.id,
            storeId: store.id,
            status: "PLACED",
            orderType: "BOOKING",
            subtotal: 500.0,
            deliveryFee: 50.0,
            total: 550.0,
            paymentMethod: "COD",
            landmarkDescription: "Test landmark",
            createdAt
          }
        });

        await db.bookingOrder.create({
          data: {
            orderId: order.id,
            scheduledDate,
            timeslot: "09:00-11:00",
            approvalStatus
          }
        });
      };

      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      // Seed 2 BookingOrders with scheduledDate = today, approvalStatus = APPROVED
      await createBookingOrder(today, "APPROVED");
      await createBookingOrder(today, "APPROVED");

      // Seed 1 BookingOrder with scheduledDate = tomorrow, approvalStatus = APPROVED
      await createBookingOrder(tomorrow, "APPROVED");

      // Seed 1 BookingOrder scheduled today, but approvalStatus = PENDING_APPROVAL (should not be in todayOrderCount)
      await createBookingOrder(today, "PENDING_APPROVAL");

      // Seed 2 active Discount rows
      await db.discount.create({
        data: {
          storeId: store.id,
          code: "DEAL1",
          discountType: "FLAT",
          discountValue: 10.0,
          startsAt: new Date(Date.now() - 3600000),
          endsAt: new Date(Date.now() + 3600000),
          isActive: true
        }
      });
      await db.discount.create({
        data: {
          storeId: store.id,
          code: "DEAL2",
          discountType: "PERCENTAGE",
          discountValue: 15.0,
          startsAt: new Date(Date.now() - 3600000),
          endsAt: new Date(Date.now() + 3600000),
          isActive: true
        }
      });

      // Seed 1 active Offer row
      await db.offer.create({
        data: {
          storeId: store.id,
          title: "Offer 1",
          description: "Details 1",
          discountType: "PERCENTAGE",
          discountValue: 10,
          startsAt: new Date(Date.now() - 3600000),
          endsAt: new Date(Date.now() + 3600000),
          isActive: true
        }
      });

      const token = await generateAccessToken(owner.id, "STORE_OWNER", store.id);

      const res = await server.inject({
        method: "GET",
        url: "/api/v1/store/dashboard",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      // Count of approved bookings scheduled for today = 2
      expect(data.todayOrderCount).toBe(2);
      expect(data.activeOffersCount).toBe(1);
      expect(data.activeDiscountsCount).toBe(2);
    });
  });
});

