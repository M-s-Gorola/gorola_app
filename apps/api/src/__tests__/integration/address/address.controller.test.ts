import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";
import { loginBuyer } from "../../helpers/auth.helper.js";

async function getBuyerAccessToken(
  server: ReturnType<typeof createServer>,
  phone: string
): Promise<string> {
  const auth = await loginBuyer(server, phone);
  return auth.accessToken;
}

async function cleanBuyerAddressControllerGraph(db: PrismaClient): Promise<void> {
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("GET /api/v1/addresses (buyer)", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanBuyerAddressControllerGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("returns saved addresses for authenticated buyer", async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    const server = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });

    const phone = "+919977665501";
    const token = await getBuyerAccessToken(server, phone);
    const user = await db.user.findUniqueOrThrow({ where: { phone } });

    await db.address.create({
      data: {
        label: "Hill home",
        landmarkDescription: "Near library landmark text area full ten",
        userId: user.id
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "GET",
      url: "/api/v1/addresses"
    });
    await server.close();
    delete process.env.GOROLA_TEST_OTP;

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: { addresses: Array<{ id: string; label: string; landmarkDescription: string }> };
      success: boolean;
    };
    expect(body.success).toBe(true);
    expect(body.data.addresses).toHaveLength(1);
    expect(body.data.addresses[0]?.label).toBe("Hill home");
  });
});

describe("Address CRUD operations (buyer)", () => {
  const db = getPrismaClient();
  let server: ReturnType<typeof createServer>;
  let token: string;
  let user: { id: string };

  beforeEach(async () => {
    await cleanBuyerAddressControllerGraph(db);
    process.env.GOROLA_TEST_OTP = "111222";
    server = createServer({ disableRedis: true, registerRoutes: registerAppRoutes });
    const phone = "+919977665502";
    token = await getBuyerAccessToken(server, phone);
    user = await db.user.findUniqueOrThrow({ where: { phone } });
  });

  afterAll(async () => {
    await server?.close();
    delete process.env.GOROLA_TEST_OTP;
    await disconnectPrisma();
  });

  it("POST /api/v1/addresses creates a new address", async () => {
    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      url: "/api/v1/addresses",
      payload: {
        label: "Office",
        landmarkDescription: "Near the big clock tower in downtown",
        flatRoom: "402",
        isDefault: true
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { id: string; label: string; isDefault: boolean; userId: string } };
    expect(body.data.label).toBe("Office");
    expect(body.data.isDefault).toBe(true);
    expect(body.data.userId).toBe(user.id);

    const dbRecord = await db.address.findUnique({ where: { id: body.data.id } });
    expect(dbRecord).not.toBeNull();
  });

  it("PUT /api/v1/addresses/:id updates an address", async () => {
    const address = await db.address.create({
      data: {
        label: "Old Label",
        landmarkDescription: "Old landmark ten chars",
        userId: user.id
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PUT",
      url: `/api/v1/addresses/${address.id}`,
      payload: { label: "New Label" }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { label: string } };
    expect(body.data.label).toBe("New Label");

    const dbRecord = await db.address.findUnique({ where: { id: address.id } });
    expect(dbRecord?.label).toBe("New Label");
  });

  it("DELETE /api/v1/addresses/:id soft deletes an address", async () => {
    const address = await db.address.create({
      data: {
        label: "To Delete",
        landmarkDescription: "Delete landmark ten",
        userId: user.id
      }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "DELETE",
      url: `/api/v1/addresses/${address.id}`
    });

    expect(res.statusCode).toBe(200);

    const dbRecord = await db.address.findUnique({ where: { id: address.id } });
    expect(dbRecord?.isDeleted).toBe(true);
  });

  it("PUT /api/v1/addresses/:id/default sets the address as default", async () => {
    const address1 = await db.address.create({
      data: { label: "A1", landmarkDescription: "Landmark one ten", userId: user.id, isDefault: true }
    });
    const address2 = await db.address.create({
      data: { label: "A2", landmarkDescription: "Landmark two ten", userId: user.id, isDefault: false }
    });

    const res = await server.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "PUT",
      url: `/api/v1/addresses/${address2.id}/default`
    });

    expect(res.statusCode).toBe(200);
    
    const dbA1 = await db.address.findUnique({ where: { id: address1.id } });
    const dbA2 = await db.address.findUnique({ where: { id: address2.id } });
    
    expect(dbA1?.isDefault).toBe(false);
    expect(dbA2?.isDefault).toBe(true);
  });
});
