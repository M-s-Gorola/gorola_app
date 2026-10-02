import { randomUUID } from "node:crypto";

import { hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { AuthService } from "../../../modules/auth/auth.service.js";
import { resolveBuyerJwtKeyPair } from "../../../modules/auth/jwt-keys.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
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
  await db.auditLog.deleteMany();
}

describe("Admin Users Integration Tests", () => {
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

  it("should fail validation/auth checks when no token is provided", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/users"
    });
    expect(response.statusCode).toBe(401);
  });

  it("should fail when user is not an ADMIN", async () => {
    const token = await generateAccessToken("buyer-123", "BUYER");
    const response = await server.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(response.statusCode).toBe(403);
  });

  it("should list all users, filter by phone (partial search), show masked numbers, and load details with address/order lists", async () => {
    // 1. Create buyers
    const buyer1 = await db.user.create({
      data: {
        name: "Abhishek Sharma",
        phone: "+919876543210",
        isVerified: true
      }
    });

    const buyer2 = await db.user.create({
      data: {
        name: "Rohit Verma",
        phone: "+919999999002",
        isVerified: true
      }
    });

    // Create a store & order for buyer 1
    const store = await db.store.create({
      data: {
        name: "Test Store",
        description: "Desc",
        phone: "+910000000000",
        address: "Store Address",
        storeType: "QUICK_COMMERCE"
      }
    });

    await db.order.create({
      data: {
        userId: buyer1.id,
        storeId: store.id,
        status: "PLACED",
        subtotal: 100.0,
        deliveryFee: 10.0,
        total: 110.0,
        paymentMethod: "COD",
        landmarkDescription: "Gate 1"
      }
    });

    await db.address.create({
      data: {
        userId: buyer1.id,
        flatRoom: "Flat 401",
        landmarkDescription: "Near Park",
        label: "Home",
        lat: 12.9715987,
        lng: 77.5945627
      }
    });

    const token = await generateAccessToken("admin-123", "ADMIN");

    // Test: GET all users
    const resAll = await server.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resAll.statusCode).toBe(200);
    const bodyAll = resAll.json();
    expect(bodyAll.success).toBe(true);
    expect(bodyAll.data.length).toBe(2);

    const match1 = (bodyAll.data as Array<{ id: string; name: string; maskedPhone: string; orderCount: number; totalSpent: number; isActive: boolean }>).find((u) => u.id === buyer1.id);
    expect(match1).toBeDefined();
    expect(match1?.name).toBe("Abhishek Sharma");
    expect(match1?.maskedPhone).toBe("*********3210");
    expect(match1?.orderCount).toBe(1);
    expect(match1?.totalSpent).toBe(110);
    expect(match1?.isActive).toBe(true);

    // Test: GET with phone filter (partial)
    const resFiltered = await server.inject({
      method: "GET",
      url: "/api/v1/admin/users?phone=9999",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resFiltered.statusCode).toBe(200);
    const bodyFiltered = resFiltered.json();
    expect(bodyFiltered.data.length).toBe(1);
    expect(bodyFiltered.data[0].id).toBe(buyer2.id);

    // Test: GET single user details
    const resDetail = await server.inject({
      method: "GET",
      url: `/api/v1/admin/users/${buyer1.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resDetail.statusCode).toBe(200);
    const bodyDetail = resDetail.json();
    expect(bodyDetail.success).toBe(true);
    expect(bodyDetail.data.name).toBe("Abhishek Sharma");
    expect(bodyDetail.data.maskedPhone).toBe("*********3210");
    expect(bodyDetail.data.orders.length).toBe(1);
    expect(bodyDetail.data.orders[0].total).toBe(110);
    expect(bodyDetail.data.orders[0].storeName).toBe("Test Store");
    expect(bodyDetail.data.addresses.length).toBe(1);
    expect(bodyDetail.data.addresses[0].flatRoom).toBe("Flat 401");
  });

  it("should suspend a user, log audit trial, block verifyOtp, and unsuspend to restore login", async () => {
    const buyer = await db.user.create({
      data: {
        name: "Suspicious User",
        phone: "+919876543211",
        isVerified: true
      }
    });

    const token = await generateAccessToken("admin-123", "ADMIN");

    // 1. Suspend User
    const resSuspend = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/users/${buyer.id}/suspend`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resSuspend.statusCode).toBe(200);
    expect(resSuspend.json().data.isActive).toBe(false);

    // Verify DB
    const dbUser = await db.user.findUnique({ where: { id: buyer.id } });
    expect(dbUser?.isActive).toBe(false);

    // Verify AuditLog
    const logs = await db.auditLog.findMany({ where: { entityId: buyer.id } });
    expect(logs.length).toBe(1);
    const firstLog = logs[0];
    expect(firstLog).toBeDefined();
    expect(firstLog?.action).toBe("ADMIN_USER_SUSPEND");
    expect(firstLog?.actorId).toBe("admin-123");

    // 2. Try verifying OTP for this suspended user
    const hashedOtp = await hash("123456", 8);
    const userRepo = new UserRepository(db);
    const authService = new AuthService({
      ensureBuyerUser: async (phone) => {
        const row = await userRepo.ensureBuyerByPhone(phone);
        return {
          id: row.id,
          name: row.name,
          phone: row.phone,
          isActive: row.isActive
        };
      },
      findUserById: async (id) => {
        const row = await userRepo.findById(id);
        if (row === null) return null;
        return {
          id: row.id,
          name: row.name,
          phone: row.phone,
          isActive: row.isActive
        };
      },
      otpProvider: { sendOtp: async () => {} },
      otpTtlSeconds: 300,
      redis: {
        get: async () => JSON.stringify({
          hashedOtp,
          attempts: 0,
          expiresAt: new Date(Date.now() + 100000).toISOString(),
          sentCount: 1,
          sentWindowStartedAt: new Date().toISOString()
        }),
        set: async () => {},
        del: async () => {}
      },
      tokenService: {
        issueTokens: async () => ({ accessToken: "mock-access-token", refreshToken: "mock-refresh-token", userId: buyer.id, phone: buyer.phone, name: buyer.name }),
        revokeRefreshToken: async () => {},
        verifyRefreshToken: async () => ({ userId: buyer.id, phone: buyer.phone, name: buyer.name })
      }
    });

    await expect(authService.verifyOtp({ phone: buyer.phone, otp: "123456" })).rejects.toThrow(/Account suspended/);

    // Verify token refresh is also blocked for suspended sessions
    await expect(authService.refreshToken({ refreshToken: "mock-refresh-token" })).rejects.toThrow(/User session no longer valid/);

    // 3. Unsuspend User
    const resUnsuspend = await server.inject({
      method: "PUT",
      url: `/api/v1/admin/users/${buyer.id}/unsuspend`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(resUnsuspend.statusCode).toBe(200);
    expect(resUnsuspend.json().data.isActive).toBe(true);

    // Verify DB
    const dbUserAfter = await db.user.findUnique({ where: { id: buyer.id } });
    expect(dbUserAfter?.isActive).toBe(true);

    // Verify OTP verification passes now
    const verifySuccess = await authService.verifyOtp({ phone: buyer.phone, otp: "123456" });
    expect(verifySuccess.userId).toBe(buyer.id);

    // Verify token refresh passes now
    const refreshSuccess = await authService.refreshToken({ refreshToken: "mock-refresh-token" });
    expect(refreshSuccess.accessToken).toBeDefined();
  });

  describe("GET /api/v1/admin/users/:id/consents (DPDP 8.3.4.3)", () => {
    it("returns consent summary and paginated logs for a user with admin JWT", async () => {
      const user = await db.user.create({
        data: {
          name: "Consent Audit User",
          phone: "+919876501111",
          isVerified: true
        }
      });

      // Create 2 consent log rows: 1 active OTP_AUTH, 1 withdrawn MARKETING_COMMS
      await db.consentLog.create({
        data: {
          userId: user.id,
          purpose: "OTP_AUTH",
          consentVersion: "1.0",
          noticeText: "Authentication notice",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          isWithdrawn: false
        }
      });

      await db.consentLog.create({
        data: {
          userId: user.id,
          purpose: "MARKETING_COMMS",
          consentVersion: "1.0",
          noticeText: "Promotions notice",
          ipAddress: "192.168.1.2",
          userAgent: "Mozilla/5.0",
          isWithdrawn: true,
          withdrawnAt: new Date()
        }
      });

      const adminToken = await generateAccessToken("admin-123", "ADMIN");

      const res = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${user.id}/consents`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json() as {
        success: boolean;
        data: {
          summary: Array<{
            purpose: string;
            displayName: string;
            isEssential: boolean;
            isActive: boolean;
            givenAt: string | null;
            withdrawnAt: string | null;
            version: string | null;
          }>;
          logs: Array<{
            id: string;
            purpose: string;
            isWithdrawn: boolean;
            consentVersion: string;
            noticeText: string;
            ipAddress: string | null;
            userAgent: string | null;
            createdAt: string;
            withdrawnAt: string | null;
          }>;
          total: number;
          page: number;
          totalPages: number;
          limit: number;
        };
      };

      expect(json.success).toBe(true);
      expect(json.data.total).toBe(2);
      expect(json.data.page).toBe(1);
      expect(json.data.limit).toBe(20);
      expect(json.data.totalPages).toBe(1);
      expect(json.data.logs).toHaveLength(2);

      // Check summary
      const otpSummary = json.data.summary.find((s) => s.purpose === "OTP_AUTH");
      expect(otpSummary).toBeDefined();
      expect(otpSummary?.isActive).toBe(true);
      expect(otpSummary?.isEssential).toBe(true);
      expect(otpSummary?.displayName).toBe("Authentication & Account Security");

      const mktSummary = json.data.summary.find((s) => s.purpose === "MARKETING_COMMS");
      expect(mktSummary).toBeDefined();
      expect(mktSummary?.isActive).toBe(false);
      expect(mktSummary?.withdrawnAt).not.toBeNull();
    });

    it("paginates consent logs with page and limit query params", async () => {
      const user = await db.user.create({
        data: {
          name: "Pagination User",
          phone: "+919876502222",
          isVerified: true
        }
      });

      await db.consentLog.create({
        data: {
          userId: user.id,
          purpose: "OTP_AUTH",
          consentVersion: "1.0",
          noticeText: "First log",
          createdAt: new Date("2026-01-01T00:00:00Z")
        }
      });

      await db.consentLog.create({
        data: {
          userId: user.id,
          purpose: "ORDER_PROCESSING",
          consentVersion: "1.0",
          noticeText: "Second log",
          createdAt: new Date("2026-01-02T00:00:00Z")
        }
      });

      const adminToken = await generateAccessToken("admin-123", "ADMIN");

      // Page 1, limit 1
      const resPage1 = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${user.id}/consents?page=1&limit=1`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(resPage1.statusCode).toBe(200);
      const json1 = resPage1.json() as { data: { logs: unknown[]; total: number; totalPages: number; page: number } };
      expect(json1.data.logs).toHaveLength(1);
      expect(json1.data.total).toBe(2);
      expect(json1.data.totalPages).toBe(2);
      expect(json1.data.page).toBe(1);

      // Page 2, limit 1
      const resPage2 = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${user.id}/consents?page=2&limit=1`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(resPage2.statusCode).toBe(200);
      const json2 = resPage2.json() as { data: { logs: unknown[]; total: number; totalPages: number; page: number } };
      expect(json2.data.logs).toHaveLength(1);
      expect(json2.data.page).toBe(2);
    });

    it("returns 403 when called with buyer JWT", async () => {
      const buyerToken = await generateAccessToken("buyer-123", "BUYER");
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users/any-id/consents",
        headers: { authorization: `Bearer ${buyerToken}` }
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 404 with NOT_FOUND error code when user does not exist", async () => {
      const adminToken = await generateAccessToken("admin-123", "ADMIN");
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users/nonexistent-user-id/consents",
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res.statusCode).toBe(404);
      const json = res.json() as { error: { code: string } };
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /api/v1/admin/users/:id/orders (Phase 6.17.2)", () => {
    it("returns 200 with paginated orders and total count for the user", async () => {
      const user = await db.user.create({
        data: {
          name: "Alice Walker",
          phone: "+919876543201",
          isVerified: true
        }
      });

      const store = await db.store.create({
        data: {
          name: "Fresh Groceries",
          description: "Fresh goods",
          phone: "+919876543202",
          address: "Mall Road",
          storeType: "QUICK_COMMERCE"
        }
      });

      // Create 3 orders for user
      await db.order.createMany({
        data: [
          {
            userId: user.id,
            storeId: store.id,
            status: "DELIVERED",
            subtotal: 100,
            deliveryFee: 20,
            total: 120,
            paymentMethod: "COD",
            landmarkDescription: "House 1"
          },
          {
            userId: user.id,
            storeId: store.id,
            status: "PLACED",
            subtotal: 200,
            deliveryFee: 20,
            total: 220,
            paymentMethod: "UPI",
            landmarkDescription: "House 2"
          },
          {
            userId: user.id,
            storeId: store.id,
            status: "DELIVERED",
            subtotal: 300,
            deliveryFee: 20,
            total: 320,
            paymentMethod: "CARD",
            landmarkDescription: "House 3"
          }
        ]
      });

      const adminToken = await generateAccessToken("admin-123", "ADMIN");

      // Test page 1 with limit 2
      const res = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${user.id}/orders?page=1&limit=2`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json() as {
        success: boolean;
        data: {
          items: Array<{ id: string; storeName: string; total: number; status: string; createdAt: string }>;
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      };
      expect(json.success).toBe(true);
      expect(json.data.total).toBe(3);
      expect(json.data.totalPages).toBe(2);
      expect(json.data.page).toBe(1);
      expect(json.data.limit).toBe(2);
      expect(json.data.items).toHaveLength(2);
      expect(json.data.items[0]?.storeName).toBe("Fresh Groceries");

      // Test status filter
      const filterRes = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${user.id}/orders?status=DELIVERED`,
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(filterRes.statusCode).toBe(200);
      const filterJson = filterRes.json() as {
        data: { items: Array<{ status: string }>; total: number };
      };
      expect(filterJson.data.total).toBe(2);
      expect(filterJson.data.items.every((o) => o.status === "DELIVERED")).toBe(true);
    });

    it("returns 404 when user does not exist", async () => {
      const adminToken = await generateAccessToken("admin-123", "ADMIN");
      const res = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users/non-existent-id/orders",
        headers: { authorization: `Bearer ${adminToken}` }
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/admin/users/:id (DPDP 8.3.5.3 Nominee Integration & PII Minimization)", () => {
    it("returns nomineeName only and excludes nomineeContact and nomineeRelationship for user with nominee", async () => {
      const user = await db.user.create({
        data: {
          phone: "+919876543299",
          name: "Test User With Nominee",
          nomineeName: "Aarav Sharma",
          nomineeContact: "+919999999999",
          nomineeRelationship: "Sibling",
          isActive: true
        }
      });

      const adminToken = await generateAccessToken("admin-123", "ADMIN");
      const res = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${user.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.nomineeName).toBe("Aarav Sharma");
      expect(json.data).not.toHaveProperty("nomineeContact");
      expect(json.data).not.toHaveProperty("nomineeRelationship");
    });

    it("returns nomineeName: null when user has no nominee configured", async () => {
      const user = await db.user.create({
        data: {
          phone: "+919876543298",
          name: "Test User Without Nominee",
          isActive: true
        }
      });

      const adminToken = await generateAccessToken("admin-123", "ADMIN");
      const res = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${user.id}`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.nomineeName).toBeNull();
    });
  });
});

