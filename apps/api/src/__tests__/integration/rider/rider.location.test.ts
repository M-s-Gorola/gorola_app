import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { io as Client } from "socket.io-client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.stockMovement.deleteMany();
  await db.riderLocation.deleteMany();
  await db.riderStore.deleteMany();
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
  await db.admin.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
}

describe("Rider Geolocation Tracking Integration", () => {
  const db = getPrismaClient();
  let server: FastifyInstance;
  let keys: ReturnType<typeof resolveBuyerJwtKeyPair>;
  let port: number;
  let storeId1: string;
  let riderId1: string;
  let riderToken: string;
  let buyerId: string;
  let buyerToken: string;
  let orderId: string;

  beforeAll(async () => {
    server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    await server.ready();
    port = (server.server.address() as { port: number }).port;
    keys = resolveBuyerJwtKeyPair();
  });

  afterAll(async () => {
    await server.close();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);

    const store = await db.store.create({
      data: {
        name: "Mussoorie Mart",
        description: "Mart desc",
        phone: "+919999999911",
        address: "Mussoorie Mall Road"
      }
    });
    storeId1 = store.id;

    const rider = await db.deliveryRider.create({
      data: {
        name: "Fast Rider",
        phone: "+919000000011",
        email: "fastrider@gorola.in",
        passwordHash: "hash",
        isActive: true
      }
    });
    await db.riderStore.create({
      data: {
        riderId: rider.id,
        storeId: storeId1,
        isPrimary: true
      }
    });
    riderId1 = rider.id;

    riderToken = await new SignJWT({
      role: "RIDER",
      storeId: storeId1
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(riderId1)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);

    const buyer = await db.user.create({
      data: {
        name: "Jane Shopper",
        phone: "+919876543219"
      }
    });
    buyerId = buyer.id;

    buyerToken = await new SignJWT({
      role: "BUYER"
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject(buyerId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);

    const order = await db.order.create({
      data: {
        userId: buyerId,
        storeId: storeId1,
        status: "OUT_FOR_DELIVERY",
        subtotal: 150.00,
        deliveryFee: 30.00,
        total: 180.00,
        landmarkDescription: "Near Clock Tower"
      }
    });
    orderId = order.id;
  });

  it("should accept geolocation updates on PUT /api/v1/rider/location and upsert DB", async () => {
    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/rider/location",
      headers: {
        authorization: `Bearer ${riderToken}`
      },
      payload: {
        lat: 30.4593,
        lng: 78.0677,
        orderId
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const dbLoc = await db.riderLocation.findFirst({
      where: { riderId: riderId1 }
    });
    expect(dbLoc).not.toBeNull();
    expect(Number(dbLoc?.lat)).toBeCloseTo(30.4593, 4);
    expect(Number(dbLoc?.lng)).toBeCloseTo(78.0677, 4);
  });

  it("should reject invalid coordinates on PUT /api/v1/rider/location with HTTP 400", async () => {
    const res = await server.inject({
      method: "PUT",
      url: "/api/v1/rider/location",
      headers: {
        authorization: `Bearer ${riderToken}`
      },
      payload: {
        lat: 95.0, // Invalid: lat must be <= 90
        lng: 78.0677,
        orderId
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it("should reject connection to /rider socket namespace with invalid token", () => {
    return new Promise<void>((resolve, reject) => {
      const clientSocket = Client(`http://127.0.0.1:${port}/rider`, {
        auth: { token: "bad-token" },
        transports: ["websocket"]
      });

      clientSocket.on("connect", () => {
        clientSocket.disconnect();
        reject(new Error("Socket should have been rejected."));
      });

      clientSocket.on("connect_error", (err) => {
        try {
          expect(err.message).toMatch(/Authentication error|Invalid token/i);
          clientSocket.disconnect();
          resolve();
        } catch (e) {
          clientSocket.disconnect();
          reject(e);
        }
      });
    });
  });

  it("should accept connection to /rider namespace with valid RIDER JWT without disconnection", () => {
    return new Promise<void>((resolve, reject) => {
      const clientSocket = Client(`http://127.0.0.1:${port}/rider`, {
        auth: { token: riderToken },
        transports: ["websocket"]
      });

      clientSocket.on("connect", () => {
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          clientSocket.disconnect();
          resolve();
        }, 800);
      });

      clientSocket.on("connect_error", (err) => {
        clientSocket.disconnect();
        reject(err);
      });
    });
  });

  it("should broadcast coordinates to buyer socket room on HTTP location update", () => {
    return new Promise<void>((resolve, reject) => {
      // 1. Buyer connects to the default namespace and joins order room
      const buyerSocket = Client(`http://127.0.0.1:${port}`, {
        auth: { token: buyerToken },
        transports: ["websocket"]
      });

      buyerSocket.on("connect", () => {
        buyerSocket.emit("join_order", orderId);
      });

      buyerSocket.on("rider_location_update", (data: { lat: number; lng: number; updatedAt: string }) => {
        try {
          expect(data.lat).toBeCloseTo(30.4593, 4);
          expect(data.lng).toBeCloseTo(78.0677, 4);
          expect(data.updatedAt).toBeDefined();
          buyerSocket.disconnect();
          resolve();
        } catch (e) {
          buyerSocket.disconnect();
          reject(e);
        }
      });

      buyerSocket.on("connect_error", (err) => {
        buyerSocket.disconnect();
        reject(err);
      });

      // 2. Trigger the location update via PUT HTTP endpoint after connection
      setTimeout(async () => {
        try {
          const res = await server.inject({
            method: "PUT",
            url: "/api/v1/rider/location",
            headers: {
              authorization: `Bearer ${riderToken}`
            },
            payload: {
              lat: 30.4593,
              lng: 78.0677,
              orderId
            }
          });
          if (res.statusCode !== 200) {
            buyerSocket.disconnect();
            reject(new Error(`HTTP location update returned ${res.statusCode}`));
          }
        } catch (err) {
          buyerSocket.disconnect();
          reject(err);
        }
      }, 500);
    });
  });

  describe("GET /api/v1/orders/:orderId/rider-location", () => {
    it("should return the last known rider location for a valid buyer owning the order", async () => {
      // 1. Seed rider location in DB
      await db.riderLocation.create({
        data: {
          riderId: riderId1,
          lat: new Prisma.Decimal("30.4600000"),
          lng: new Prisma.Decimal("78.0680000")
        }
      });

      // 2. Add status history entry to link rider to the order as OUT_FOR_DELIVERY status changer
      await db.orderStatusHistory.create({
        data: {
          orderId,
          status: "OUT_FOR_DELIVERY",
          changedBy: riderId1
        }
      });

      const res = await server.inject({
        method: "GET",
        url: `/api/v1/orders/${orderId}/rider-location`,
        headers: {
          authorization: `Bearer ${buyerToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).not.toBeNull();
      expect(body.data.lat).toBe("30.46");
      expect(body.data.lng).toBe("78.068");
      expect(body.data.updatedAt).toBeDefined();
    });

    it("should return null if there is no rider location or no status history (preparing)", async () => {
      const res = await server.inject({
        method: "GET",
        url: `/api/v1/orders/${orderId}/rider-location`,
        headers: {
          authorization: `Bearer ${buyerToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it("should return 403 if requested by a different buyer", async () => {
      const differentBuyer = await db.user.create({
        data: {
          name: "Different Shopper",
          phone: "+919999999999"
        }
      });

      const differentBuyerToken = await new SignJWT({
        role: "BUYER"
      })
        .setProtectedHeader({ alg: "RS256" })
        .setSubject(differentBuyer.id)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(keys.privateKey);

      const res = await server.inject({
        method: "GET",
        url: `/api/v1/orders/${orderId}/rider-location`,
        headers: {
          authorization: `Bearer ${differentBuyerToken}`
        }
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().success).toBe(false);
    });

    it("should return 401 if requested without token", async () => {
      const res = await server.inject({
        method: "GET",
        url: `/api/v1/orders/${orderId}/rider-location`
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().success).toBe(false);
    });
  });
});

