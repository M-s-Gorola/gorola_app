import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

async function cleanAuditLogs(db: ReturnType<typeof getPrismaClient>): Promise<void> {
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
  await db.auditLog.deleteMany();
}

describe("Admin Audit Logs Integration Tests", () => {
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
    await cleanAuditLogs(db);
  });

  it("should fail authentication check when no token is provided", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs"
    });
    expect(response.statusCode).toBe(401);
  });

  it("should fail when user is not an ADMIN", async () => {
    const token = await generateAccessToken("buyer-1", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(response.statusCode).toBe(403);
  });

  it("should list all audit logs, mask details properly, support filtering, and export to CSV", async () => {
    // 1. Create entities to link logs to
    const adminUser = await db.admin.create({
      data: {
        email: "admin-test@gorola.in",
        passwordHash: "dummy"
      }
    });

    const storeOwner = await db.storeOwner.create({
      data: {
        email: "merchant-test@gorola.in",
        passwordHash: "dummy",
        store: {
          create: {
            name: "Audit Store",
            description: "Desc",
            phone: "+911234567890",
            address: "Address"
          }
        }
      }
    });

    const buyerUser = await db.user.create({
      data: {
        name: "Buyer Test",
        phone: "+919876543210",
        isVerified: true
      }
    });

    // 2. Create Audit Logs in the database
    // Log 1: Admin Suspend User
    const log1 = await db.auditLog.create({
      data: {
        actorId: adminUser.id,
        actorRole: "ADMIN",
        action: "ADMIN_USER_SUSPEND",
        entityType: "User",
        entityId: buyerUser.id,
        oldValue: { isActive: true },
        newValue: { isActive: false },
        ip: "192.168.1.100",
        userAgent: "Chrome"
      }
    });

    // Log 2: Store Owner Update Store Status
    const log2 = await db.auditLog.create({
      data: {
        actorId: storeOwner.id,
        actorRole: "STORE_OWNER",
        action: "STORE_STATUS_UPDATE",
        entityType: "Store",
        entityId: storeOwner.storeId,
        oldValue: { isAcceptingOrders: true },
        newValue: { isAcceptingOrders: false },
        ip: "10.0.0.50",
        userAgent: "Safari"
      }
    });

    const token = await generateAccessToken(adminUser.id, "ADMIN");

    // Test: GET /api/v1/admin/audit-logs
    const resAll = await server.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resAll.statusCode).toBe(200);

    const bodyAll = resAll.json();
    expect(bodyAll.success).toBe(true);
    expect(bodyAll.data.items.length).toBe(2);

    type LogItem = { id: string; actorMasked: string; ipMasked: string; oldValue: unknown; newValue: unknown };
    // Verify masking of Admin actor
    const adminLogItem = (bodyAll.data.items as LogItem[]).find((item) => item.id === log1.id);
    expect(adminLogItem).toBeDefined();
    expect(adminLogItem?.actorMasked).toBe("a********t@gorola.in");
    expect(adminLogItem?.ipMasked).toBe("192.168.***.***");
    expect(adminLogItem?.oldValue).toEqual({ isActive: true });
    expect(adminLogItem?.newValue).toEqual({ isActive: false });

    // Verify masking of Store Owner actor
    const storeLogItem = (bodyAll.data.items as LogItem[]).find((item) => item.id === log2.id);
    expect(storeLogItem).toBeDefined();
    expect(storeLogItem?.actorMasked).toBe("m***********t@gorola.in");
    expect(storeLogItem?.ipMasked).toBe("10.0.***.***");

    // Test filtering by action: GET /api/v1/admin/audit-logs?action=ADMIN_USER_SUSPEND
    const resActionFilter = await server.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs?action=ADMIN_USER_SUSPEND",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resActionFilter.statusCode).toBe(200);
    const bodyActionFilter = resActionFilter.json();
    expect(bodyActionFilter.data.items.length).toBe(1);
    expect(bodyActionFilter.data.items[0].id).toBe(log1.id);

    // Test filtering by role and date range
    const fromIso = new Date(Date.now() - 3600000).toISOString();
    const toIso = new Date(Date.now() + 3600000).toISOString();
    const resRoleFilter = await server.inject({
      method: "GET",
      url: `/api/v1/admin/audit-logs?role=STORE_OWNER&from=${fromIso}&to=${toIso}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resRoleFilter.statusCode).toBe(200);
    const bodyRoleFilter = resRoleFilter.json();
    expect(bodyRoleFilter.data.items.length).toBe(1);
    expect(bodyRoleFilter.data.items[0].id).toBe(log2.id);

    // Test format=csv: GET /api/v1/admin/audit-logs?format=csv
    const resCsvFormat = await server.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs?format=csv",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resCsvFormat.statusCode).toBe(200);
    expect(resCsvFormat.headers["content-type"]).toContain("text/csv");
    expect(resCsvFormat.body).toContain("Timestamp");
    expect(resCsvFormat.body).toContain("a********t@gorola.in");
    expect(resCsvFormat.body).toContain("ADMIN_USER_SUSPEND");
    expect(resCsvFormat.body).toContain(`"{""isActive"":true}"`); // Stringified and escaped oldValue
    expect(resCsvFormat.body).toContain(`"{""isActive"":false}"`); // Stringified and escaped newValue

    // Test /export route: GET /api/v1/admin/audit-logs/export
    const resCsvRoute = await server.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs/export",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resCsvRoute.statusCode).toBe(200);
    expect(resCsvRoute.headers["content-type"]).toContain("text/csv");
    expect(resCsvRoute.body).toContain("ADMIN_USER_SUSPEND");
  });

  it("should reject PUT or DELETE operations with 405 Method Not Allowed", async () => {
    const token = await generateAccessToken("admin-123", "ADMIN");

    const resPut = await server.inject({
      method: "PUT",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: `Bearer ${token}` },
      payload: { some: "data" }
    });
    expect(resPut.statusCode).toBe(405);

    const resDelete = await server.inject({
      method: "DELETE",
      url: "/api/v1/admin/audit-logs/some-id",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resDelete.statusCode).toBe(405);
  });
});
