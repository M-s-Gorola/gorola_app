import type { FastifyInstance } from "fastify";
import { io as Client } from "socket.io-client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { StockMovementRepository } from "../../../modules/inventory/stock-movement.repository.js";
import { OrderRepository } from "../../../modules/order/order.repository.js";
import { OrderService } from "../../../modules/order/order.service.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { registerAppRoutes } from "../../../routes.js";
import { createServer } from "../../../server.js";

describe("Socket.IO Order Status Integration", () => {
  const db = getPrismaClient();
  let app: FastifyInstance;
  let port: number;
  let accessToken: string;
  let userId: string;
  let orderId: string;

  beforeAll(async () => {
    process.env.GOROLA_TEST_OTP = "111222";
    app = createServer({
      disableRedis: true,
      registerRoutes: registerAppRoutes
    });
    await app.listen({ host: "127.0.0.1", port: 0 });
    await app.ready();
    port = (app.server.address() as { port: number }).port;

    // Get access token
    const phone = "+919900000001";
    await app.inject({
      method: "POST",
      payload: { phone },
      url: "/api/v1/auth/buyer/send-otp"
    });
    const verifyRes = await app.inject({
      method: "POST",
      payload: { otp: "111222", phone },
      url: "/api/v1/auth/buyer/verify-otp"
    });
    const body = verifyRes.json() as { data: { accessToken: string; userId: string } };
    accessToken = body.data.accessToken;
    userId = body.data.userId;
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
    delete process.env.GOROLA_TEST_OTP;
  });

  beforeEach(async () => {
    // Setup minimal data for an order
    const storeRepo = new StoreRepository(db);
    const categoryRepo = new CategoryRepository(db);
    const productRepo = new ProductRepository(db);
    const variantRepo = new ProductVariantRepository(db);
    const orderRepo = new OrderRepository(db);

    const store = await storeRepo.create({
      name: "Socket Store",
      address: "Address",
      description: "Desc",
      phone: "+911234567890"
    });
    const category = await categoryRepo.create({ name: "Cat", slug: `cat-${Date.now()}` });
    const product = await productRepo.create({
      name: "Prod",
      categoryId: category.id,
      storeId: store.id,
      description: "D",
      imageUrl: "http://img.png"
    });
    const variant = await variantRepo.create({
      label: "V",
      price: "100",
      productId: product.id,
      stockQty: 10,
      unit: "pc"
    });

    const order = await orderRepo.create({
      userId,
      storeId: store.id,
      subtotal: "100",
      deliveryFee: "30",
      total: "130",
      paymentMethod: "COD",
      landmarkDescription: "Landmark test 10 chars",
      changedBy: userId,
      items: [{
        productVariantId: variant.id,
        productName: product.name,
        variantLabel: variant.label,
        price: variant.price.toString(),
        quantity: 1
      }]
    });
    orderId = order.id;
  });

  it("should receive order_status_changed event when status is updated via OrderService", () => {
    return new Promise<void>((resolve, reject) => {
      const clientSocket = Client(`http://127.0.0.1:${port}`, {
        auth: { token: accessToken }
      });

      clientSocket.on("connect", () => {
        clientSocket.emit("join_order", orderId);
      });

      clientSocket.on("order_status_changed", (data: { orderId: string; status: string }) => {
        try {
          expect(data.orderId).toBe(orderId);
          expect(data.status).toBe("PREPARING");
          clientSocket.disconnect();
          resolve();
        } catch (err) {
          clientSocket.disconnect();
          reject(err);
        }
      });

      clientSocket.on("connect_error", (err) => {
        clientSocket.disconnect();
        reject(err);
      });

      // Debug check
      if (!(app as FastifyInstance & { io: import("socket.io").Server }).io) {
        clientSocket.disconnect();
        reject(new Error("app.io is undefined after app.ready()"));
        return;
      }

      // Trigger update
      setTimeout(async () => {
        try {
          const orderRepo = new OrderRepository(db);
          const variantRepo = new ProductVariantRepository(db);
          const stockMovementRepo = new StockMovementRepository(db);
          
          // We need an emitter that uses the app.io
          const emitter = {
            emitStatusChanged: (oid: string, status: string) => {
              app.io.to(`order:${oid}`).emit("order_status_changed", { orderId: oid, status });
            }
          };

          const orderService = new OrderService(db, orderRepo, variantRepo, stockMovementRepo, emitter);
          await orderService.updateStatus(orderId, "PREPARING", "SYSTEM");
        } catch (err) {
          reject(err);
        }
      }, 500);
    });
  });

  it("should reject connection with invalid token", () => {
    return new Promise<void>((resolve, reject) => {
      const clientSocket = Client(`http://127.0.0.1:${port}`, {
        auth: { token: "invalid-token" }
      });

      clientSocket.on("connect", () => {
        clientSocket.disconnect();
        reject(new Error("Should not connect"));
      });

      clientSocket.on("connect_error", (err) => {
        try {
          expect(err.message).toContain("Authentication error");
          clientSocket.disconnect();
          resolve();
        } catch (e) {
          clientSocket.disconnect();
          reject(e);
        }
      });
    });
  });
});
