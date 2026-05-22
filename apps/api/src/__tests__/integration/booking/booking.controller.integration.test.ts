import { randomUUID } from "node:crypto";

import { type Category, Prisma, type PrismaClient, type Product, type ProductVariant, type Store, type StoreOwner,type User } from "@prisma/client";
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

async function cleanBookingControllerGraph(db: PrismaClient): Promise<void> {
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

describe("Booking HTTP Endpoints (Integration)", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);

  let buyerUser: User;
  let store: Store;
  let otherStore: Store;
  let category: Category;
  let subCategory: { id: string };
  let product: Product;
  let variantStandard: ProductVariant;
  let variantFasting: ProductVariant;
  let owner: StoreOwner;
  let otherOwner: StoreOwner;
  let ownerEmail = "owner@gorola.in";
  let otherOwnerEmail = "owner2@gorola.in";

  beforeEach(async () => {
    await cleanBookingControllerGraph(db);
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

    otherStore = await db.store.create({
      data: {
        address: "Booking Avenue 2",
        description: "d",
        name: "Max Lab",
        phone: "+911200000088",
        storeType: "BOOKING_COMMERCE",
        isAcceptingBookings: true,
        bookingLeadDays: 1
      }
    });

    // Hash store owner passwords
    const ownerHashed = await hash("Owner#123", 10);
    owner = await db.storeOwner.create({
      data: {
        email: ownerEmail,
        passwordHash: ownerHashed,
        storeId: store.id
      }
    });

    otherOwner = await db.storeOwner.create({
      data: {
        email: otherOwnerEmail,
        passwordHash: ownerHashed,
        storeId: otherStore.id
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

    variantFasting = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "Fasting Blood Sugar Test",
        price: new Prisma.Decimal("150"),
        stockQty: 0,
        unit: "visit",
        requiresFasting: true,
        allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00"],
        isActive: true
      }
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("should place a booking request successfully as buyer (HTTP 201)", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");

    const addr = await db.address.create({
      data: {
        userId: buyerUser.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

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
        scheduledDate: tomorrow.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(res.statusCode).toBe(201);
    const envelope = res.json() as {
      success: boolean;
      data: {
        orderId: string;
        status: string;
        bookingOrder: {
          timeslot: string;
          requiresFasting: boolean;
        };
      };
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.orderId).toBeDefined();
    expect(envelope.data.status).toBe("PENDING_APPROVAL");
    expect(envelope.data.bookingOrder.timeslot).toBe("09:00-12:00");
    expect(envelope.data.bookingOrder.requiresFasting).toBe(false);

    // Verify in database
    const dbOrder = await db.order.findUniqueOrThrow({
      where: { id: envelope.data.orderId },
      include: { bookingOrder: true }
    });
    expect(dbOrder.orderType).toBe("BOOKING");
    expect(dbOrder.deliveryFee.toString()).toBe("0"); // delivery fee zero by default
  });

  it("should fail validation if lead days scheduling is violated (HTTP 400)", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");

    const addr = await db.address.create({
      data: {
        userId: buyerUser.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    // Lead days is 1, so today is too early
    const today = new Date();

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
        scheduledDate: today.toISOString(),
        timeslot: "09:00-12:00",
        addressId: addr.id
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_BOOKING_DATE");
  });

  it("should fail validation if fasting timeslot starts at 10 AM or later (HTTP 400)", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const accessToken = await signTestToken(buyerUser.id, "BUYER");

    const addr = await db.address.create({
      data: {
        userId: buyerUser.id,
        label: "Home",
        landmarkDescription: "Near Clock Tower landmark area min ten"
      }
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 12:00-15:00 requires fasting but starts after 10 AM
    const res = await server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      method: "POST",
      payload: {
        storeId: store.id,
        items: [
          { productId: product.id, variantId: variantFasting.id }
        ],
        scheduledDate: tomorrow.toISOString(),
        timeslot: "12:00-15:00",
        addressId: addr.id
      },
      url: "/api/v1/bookings"
    });

    await server.close();

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_TIMESLOT_FOR_FASTING");
  });

  it("should return a list of bookings for the store owner dashboard (HTTP 200)", async () => {
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

    // Create a booking request
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

    // Retrieve store bookings list as store owner
    const listRes = await server.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: "GET",
      url: "/api/v1/store/bookings?status=PENDING_APPROVAL"
    });

    await server.close();

    expect(listRes.statusCode).toBe(200);
    const envelope = listRes.json() as {
      success: boolean;
      data: {
        bookings: Array<{ id: string; status: string; bookingOrder: { timeslot: string } }>;
      };
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.bookings).toHaveLength(1);
    const firstBooking = envelope.data.bookings[0]!;
    expect(firstBooking.id).toBe(orderId);
    expect(firstBooking.status).toBe("PENDING_APPROVAL");
  });

  it("should allow a store owner to approve a pending booking (HTTP 200)", async () => {
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

    // Create a booking request
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
    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    // Approve booking
    const approveRes = await server.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: "PUT",
      url: `/api/v1/store/bookings/${orderId}/approve`
    });

    await server.close();

    expect(approveRes.statusCode).toBe(200);
    const envelope = approveRes.json() as {
      success: boolean;
      data: { status: string; bookingOrder: { approvalStatus: string } };
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.status).toBe("APPROVED");
    expect(envelope.data.bookingOrder.approvalStatus).toBe("APPROVED");

    // Double check in DB
    const finalOrder = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { bookingOrder: true }
    });
    expect(finalOrder.status).toBe("APPROVED");
    expect(finalOrder.bookingOrder?.approvalStatus).toBe("APPROVED");
  });

  it("should fail approval if wrong store owner attempts to approve (HTTP 403)", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const buyerToken = await signTestToken(buyerUser.id, "BUYER");
    const wrongOwnerToken = await signTestToken(otherOwner.id, "STORE_OWNER");

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
    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    const approveRes = await server.inject({
      headers: { authorization: `Bearer ${wrongOwnerToken}` },
      method: "PUT",
      url: `/api/v1/store/bookings/${orderId}/approve`
    });

    await server.close();

    expect(approveRes.statusCode).toBe(403);
  });

  it("should allow owner to reject with a reason (HTTP 200), and block empty reasons (HTTP 400)", async () => {
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
    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    // Test rejection with empty reason
    const failRes = await server.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: "PUT",
      payload: { reason: "" },
      url: `/api/v1/store/bookings/${orderId}/reject`
    });
    expect(failRes.statusCode).toBe(400);

    // Test rejection with valid reason
    const okRes = await server.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: "PUT",
      payload: { reason: "Fully booked slot" },
      url: `/api/v1/store/bookings/${orderId}/reject`
    });

    await server.close();

    expect(okRes.statusCode).toBe(200);
    const envelope = okRes.json() as {
      success: boolean;
      data: { status: string; bookingOrder: { approvalStatus: string; rejectionReason: string } };
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.status).toBe("REJECTED");
    expect(envelope.data.bookingOrder.approvalStatus).toBe("REJECTED");
    expect(envelope.data.bookingOrder.rejectionReason).toBe("Fully booked slot");
  });

  it("should allow buyer to cancel their own pending booking (HTTP 200)", async () => {
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
    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    // Cancel pending request
    const cancelRes = await server.inject({
      headers: { authorization: `Bearer ${buyerToken}` },
      method: "DELETE",
      url: `/api/v1/bookings/${orderId}`
    });

    await server.close();

    expect(cancelRes.statusCode).toBe(200);
    const envelope = cancelRes.json() as {
      success: boolean;
      data: { status: string; bookingOrder: { approvalStatus: string } };
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.status).toBe("CANCELLED");
    expect(envelope.data.bookingOrder.approvalStatus).toBe("CANCELLED");
  });

  it("should block cancellation of already approved bookings (HTTP 422)", async () => {
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
    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    // Approve the booking first
    const approveRes = await server.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: "PUT",
      url: `/api/v1/store/bookings/${orderId}/approve`
    });
    expect(approveRes.statusCode).toBe(200);

    // Attempt cancellation
    const cancelRes = await server.inject({
      headers: { authorization: `Bearer ${buyerToken}` },
      method: "DELETE",
      url: `/api/v1/bookings/${orderId}`
    });

    await server.close();

    expect(cancelRes.statusCode).toBe(400);
    const body = cancelRes.json() as { error: { code: string } };
    expect(body.error.code).toBe("CANNOT_CANCEL_APPROVED_BOOKING");
  });

  it("should allow a buyer to retrieve their own booking order details (HTTP 200)", async () => {
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
        storeId: string;
        userId: string;
        status: string;
        bookingOrder: {
          scheduledDate: string;
          timeslot: string;
        };
      };
    };
    expect(envelope.success).toBe(true);
    expect(envelope.data.id).toBe(orderId);
    expect(envelope.data.userId).toBe(buyerUser.id);
    expect(envelope.data.bookingOrder.timeslot).toBe("09:00-12:00");
  });

  it("should block a buyer from retrieving another buyer's booking order details (HTTP 404)", async () => {
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const buyerToken = await signTestToken(buyerUser.id, "BUYER");
    const otherBuyer = await userRepo.ensureBuyerByPhone("+919988776011");
    const otherBuyerToken = await signTestToken(otherBuyer.id, "BUYER");

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
    const orderId = (placeRes.json() as { data: { orderId: string } }).data.orderId;

    const getRes = await server.inject({
      headers: { authorization: `Bearer ${otherBuyerToken}` },
      method: "GET",
      url: `/api/v1/bookings/${orderId}`
    });

    await server.close();

    expect(getRes.statusCode).toBe(404);
  });
});
