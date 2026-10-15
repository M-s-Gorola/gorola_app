import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

async function generateAccessToken(userId: string, role: string): Promise<string> {
  const keys = resolveBuyerJwtKeyPair();
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(keys.privateKey);
}

async function cleanAdminData(db: PrismaClient): Promise<void> {
  await db.bookingOrder.deleteMany().catch(() => {});
  await db.stockMovement.deleteMany().catch(() => {});
  await db.riderLocation.deleteMany().catch(() => {});
  await db.deliveryRider.deleteMany().catch(() => {});
  await db.orderStatusHistory.deleteMany().catch(() => {});
  await db.orderItem.deleteMany().catch(() => {});
  await db.order.deleteMany().catch(() => {});
  await db.address.deleteMany().catch(() => {});
  await db.user.deleteMany().catch(() => {});
  await db.advertisement.deleteMany().catch(() => {});
  await db.storeOwner.deleteMany().catch(() => {});
  await db.store.deleteMany().catch(() => {});
}

describe("Admin Pagination Engine (20 records/page)", () => {
  const db = getPrismaClient();
  let server: ReturnType<typeof createServer>;
  let adminToken: string;

  beforeEach(async () => {
    await cleanAdminData(db);
    server = createServer({ disableRedis: true, registerRoutes: registerAppRoutes });
    adminToken = await generateAccessToken("admin-user-id", "ADMIN");
  });

  afterAll(async () => {
    await server?.close();
    await disconnectPrisma();
  });

  it("paginates GET /api/v1/admin/users (20 per page)", async () => {
    const initialUsers = await db.user.count();
    // Seed 22 users
    for (let i = 0; i < 22; i++) {
      await db.user.create({
        data: {
          name: `User ${i}`,
          phone: `+9198765432${i < 10 ? "0" + i : i}`,
          isVerified: true
        }
      });
    }

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/admin/users?page=1&limit=20",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(20);
    expect(body.data.total).toBe(initialUsers + 22);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(20);
    expect(body.data.totalPages).toBe(Math.ceil((initialUsers + 22) / 20));

    // Page 2
    const res2 = await server.inject({
      method: "GET",
      url: "/api/v1/admin/users?page=2&limit=20",
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(res2.statusCode).toBe(200);
    const body2 = res2.json();
    expect(body2.data.items).toHaveLength(initialUsers + 22 - 20);
    expect(body2.data.page).toBe(2);
  });

  it("paginates GET /api/v1/admin/stores (20 per page)", async () => {
    const initialStores = await db.store.count();
    // Seed 21 stores
    for (let i = 0; i < 21; i++) {
      await db.store.create({
        data: {
          name: `Store ${i}`,
          description: `Desc ${i}`,
          phone: `+9190000000${i < 10 ? "0" + i : i}`,
          address: `Mall Road ${i}`,
          storeType: "QUICK_COMMERCE"
        }
      });
    }

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/admin/stores?page=1&limit=20",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(20);
    expect(body.data.total).toBe(initialStores + 21);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(20);
    expect(body.data.totalPages).toBe(Math.ceil((initialStores + 21) / 20));
  });

  it("paginates GET /api/v1/admin/riders (20 per page)", async () => {
    const initialRiders = await db.deliveryRider.count();
    // Seed 21 riders
    for (let i = 0; i < 21; i++) {
      await db.deliveryRider.create({
        data: {
          name: `Rider ${i}`,
          phone: `+9180000000${i < 10 ? "0" + i : i}`,
          email: `rider${i}@gorola.in`,
          passwordHash: "hash",
          riderType: "DELIVERY"
        }
      });
    }

    const res = await server.inject({
      method: "GET",
      url: "/api/v1/admin/riders?page=1&limit=20",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(20);
    expect(body.data.total).toBe(initialRiders + 21);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(20);
    expect(body.data.totalPages).toBe(Math.ceil((initialRiders + 21) / 20));
  });

  it("defaults limit to 20 for GET /api/v1/admin/orders", async () => {
    const store = await db.store.create({
      data: {
        name: "Order Store",
        description: "Desc",
        phone: "+919999900000",
        address: "Address",
        storeType: "QUICK_COMMERCE"
      }
    });

    const user = await db.user.create({
      data: {
        name: "Order Buyer",
        phone: "+919999911111",
        isVerified: true
      }
    });

    // Seed 25 orders
    for (let i = 0; i < 25; i++) {
      await db.order.create({
        data: {
          userId: user.id,
          storeId: store.id,
          subtotal: 100,
          deliveryFee: 10,
          total: 110,
          paymentMethod: "COD",
          landmarkDescription: "Mussoorie Road"
        }
      });
    }

    // Call without limit param
    const res = await server.inject({
      method: "GET",
      url: "/api/v1/admin/orders",
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    // Should return at most 20 orders by default
    expect(body.data.items.length).toBeLessThanOrEqual(20);
    expect(body.data.items.length).toBe(20);
  });
});
