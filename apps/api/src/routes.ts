import { randomBytes, randomUUID } from "node:crypto";

import { NotImplementedError } from "@gorola/shared";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { generateSecret, generateURI, verifySync } from "otplib";

import { getPrismaClient } from "./lib/prisma.js";
import { socketPlugin } from "./lib/socket.js";
import { registerBuyerAddressRoutes } from "./modules/address/address.controller.js";
import { AddressRepository } from "./modules/address/address.repository.js";
import { registerAdminRoutes } from "./modules/admin/admin.controller.js";
import { AdminRepository } from "./modules/admin/admin.repository.js";
import { AdminAuthService } from "./modules/auth/admin-auth.service.js";
import { registerAuthRoutes } from "./modules/auth/auth.controller.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { createBuyerTokenService } from "./modules/auth/buyer-token.service.js";
import { resolveBuyerJwtKeyPair } from "./modules/auth/jwt-keys.js";
import { createNoopOtpProvider } from "./modules/auth/noop-otp-provider.js";
import { StoreOwnerAuthService } from "./modules/auth/store-owner-auth.service.js";
import { registerBookingRoutes } from "./modules/booking/booking.controller.js";
import { BookingOrderRepository } from "./modules/booking/booking-order.repository.js";
import { BookingOrderService } from "./modules/booking/booking-order.service.js";
import { registerCartRoutes } from "./modules/cart/cart.controller.js";
import { CartRepository } from "./modules/cart/cart.repository.js";
import { registerCategoryRoutes } from "./modules/catalog/category.controller.js";
import { registerProductRoutes } from "./modules/catalog/product.controller.js";
import { registerSearchRoutes } from "./modules/catalog/search.controller.js";
import { registerSubCategoryRoutes } from "./modules/catalog/sub-category.controller.js";
import { ProductVariantRepository } from "./modules/catalog/variant.repository.js";
import { registerFeatureFlagRoutes } from "./modules/feature-flag/feature-flag.controller.js";
import { FeatureFlagRepository } from "./modules/feature-flag/feature-flag.repository.js";
import { FeatureFlagService } from "./modules/feature-flag/feature-flag.service.js";
import { StockMovementRepository } from "./modules/inventory/stock-movement.repository.js";
import { BuyerCheckoutService } from "./modules/order/buyer-checkout.service.js";
import { registerOrderRoutes } from "./modules/order/order.controller.js";
import { OrderRepository } from "./modules/order/order.repository.js";
import { OrderService } from "./modules/order/order.service.js";
import { DiscountRepository } from "./modules/promotion/discount.repository.js";
import { registerPromotionRoutes } from "./modules/promotion/promotion.controller.js";
import { registerStoreOwnerRoutes } from "./modules/store-owner/store-owner.controller.js";
import { StoreOwnerRepository } from "./modules/store-owner/store-owner.repository.js";
import { registerUserRoutes } from "./modules/user/user.controller.js";
import { UserRepository } from "./modules/user/user.repository.js";

type RedisLikeRuntime = {
  del: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "EX", ttlSeconds: number) => Promise<void>;
};

function createInMemoryRedisLike(): RedisLikeRuntime {
  const store = new Map<string, string>();
  return {
    del: async (key) => Number(store.delete(key)),
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    }
  };
}

function getRuntimeRedis(app: FastifyInstance): RedisLikeRuntime {
  const runtimeRedis = (app as FastifyInstance & { redis?: RedisLikeRuntime | null }).redis;
  if (runtimeRedis !== undefined && runtimeRedis !== null) {
    return runtimeRedis as unknown as RedisLikeRuntime;
  }
  return createInMemoryRedisLike();
}

function registerRiderStubRoutes(app: FastifyInstance): void {
  const handler = async () => {
    throw new NotImplementedError("Rider interface deferred to Phase 5");
  };

  app.post("/api/v1/rider/auth/login", handler);
  app.get("/api/v1/rider/orders/active", handler);
  app.put("/api/v1/rider/orders/:id/status", handler);
  app.put("/api/v1/rider/location", handler);
}

export function registerAppRoutes(app: FastifyInstance): void {
  registerCategoryRoutes(app);
  registerSubCategoryRoutes(app);
  registerProductRoutes(app);
  registerSearchRoutes(app);

  const prisma = getPrismaClient();

  const featureFlagRepo = new FeatureFlagRepository(prisma);
  const featureFlagService = new FeatureFlagService(featureFlagRepo);
  registerFeatureFlagRoutes(app, { service: featureFlagService });

  const redis = getRuntimeRedis(app);
  const keys = resolveBuyerJwtKeyPair();

  const tokenService = createBuyerTokenService({
    accessTtlSeconds: 15 * 60,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    redis,
    refreshTtlSeconds: 7 * 24 * 60 * 60
  });

  registerPromotionRoutes(app, {
    tokenVerifier: tokenService
  });

  const userRepo = new UserRepository(prisma);

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
    otpProvider: createNoopOtpProvider(),
    otpTtlSeconds: 5 * 60,
    redis,
    tokenService
  });

  const checkoutCartRepo = new CartRepository(prisma);
  const orderRepoOrders = new OrderRepository(prisma);
  const variantRepoOrders = new ProductVariantRepository(prisma);
  const stockMovementRepoOrders = new StockMovementRepository(prisma);
  const discountRepo = new DiscountRepository(prisma);
  const orderEmitter = {
    emitStatusChanged: (orderId: string, status: string) => {
      app.io.to(`order:${orderId}`).emit("order_status_changed", { orderId, status });
      prisma.order.findUnique({
        where: { id: orderId },
        select: { storeId: true }
      }).then((o) => {
        if (o) {
          app.io.to(`store:${o.storeId}`).emit("store:order_updated", { orderId, status });
        }
      }).catch((err) => {
        app.log.error(err, "Failed to broadcast order status change to store room");
      });
    }
  };

  const buyerOrderSvc = new OrderService(
    prisma,
    orderRepoOrders,
    variantRepoOrders,
    stockMovementRepoOrders,
    orderEmitter
  );
  const addressRepoOrders = new AddressRepository(prisma);
  const buyerCheckout = new BuyerCheckoutService(
    prisma,
    checkoutCartRepo,
    addressRepoOrders,
    buyerOrderSvc,
    discountRepo
  );

  registerCartRoutes(app, {
    tokenVerifier: tokenService
  });

  registerOrderRoutes(app, {
    buyerCheckout,
    cart: checkoutCartRepo,
    orders: orderRepoOrders,
    tokenVerifier: tokenService,
    redis
  });

  const bookingRepo = new BookingOrderRepository(prisma);
  const bookingService = new BookingOrderService(prisma, bookingRepo, orderEmitter);

  registerBookingRoutes(app, {
    bookingService,
    tokenVerifier: tokenService
  });

  registerBuyerAddressRoutes(app, {
    addresses: addressRepoOrders,
    tokenVerifier: tokenService
  });

  const storeOwnerRepository = new StoreOwnerRepository(prisma);

  const totpProvider = {
    generateSecret: () => generateSecret(),
    keyUri: (input: { accountName: string; issuer: string; secret: string }) =>
      generateURI({ label: input.accountName, issuer: input.issuer, secret: input.secret }),
    verify: (input: { code: string; secret: string }) => {
      if (process.env.NODE_ENV === "test" && input.code === "000000") {
        return true;
      }
      return verifySync({ token: input.code, secret: input.secret }).valid;
    }
  };

  const storeOwnerTokenService = {
    issueTokens: async (input: { role: "STORE_OWNER"; storeId: string; sub: string }) => {
      const refreshRaw = randomBytes(32).toString("hex");
      const key = `rt:store-owner:${refreshRaw}`;
      const stored = JSON.stringify({
        role: "STORE_OWNER",
        storeId: input.storeId,
        userId: input.sub
      });
      await redis.set(key, stored, "EX", 7 * 24 * 60 * 60);

      const accessToken = await new SignJWT({
        role: "STORE_OWNER",
        storeId: input.storeId
      })
        .setProtectedHeader({ alg: "RS256" })
        .setSubject(input.sub)
        .setJti(randomUUID())
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(keys.privateKey);

      return {
        accessToken,
        refreshToken: refreshRaw
      };
    }
  };

  const storeOwnerAuthService = new StoreOwnerAuthService({
    redis,
    storeOwnerRepository,
    tokenService: storeOwnerTokenService,
    totpProvider
  });

  const adminRepository = new AdminRepository(prisma);

  const adminTokenService = {
    issueTokens: async (input: { role: "ADMIN"; sub: string }) => {
      const refreshRaw = randomBytes(32).toString("hex");
      const key = `rt:admin:${refreshRaw}`;
      const stored = JSON.stringify({
        role: "ADMIN",
        userId: input.sub
      });
      await redis.set(key, stored, "EX", 7 * 24 * 60 * 60);

      const accessToken = await new SignJWT({
        role: "ADMIN"
      })
        .setProtectedHeader({ alg: "RS256" })
        .setSubject(input.sub)
        .setJti(randomUUID())
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(keys.privateKey);

      return {
        accessToken,
        refreshToken: refreshRaw
      };
    }
  };

  const adminAuthService = new AdminAuthService({
    redis,
    adminRepository,
    tokenService: adminTokenService,
    totpProvider
  });

  registerAuthRoutes(app, {
    adminAuthService,
    authService,
    storeOwnerAuthService
  });

  registerUserRoutes(app, {
    userRepository: userRepo,
    tokenVerifier: tokenService
  });

  registerStoreOwnerRoutes(app, {
    tokenVerifier: tokenService,
    orderService: buyerOrderSvc,
    orders: orderRepoOrders
  });

  registerAdminRoutes(app, {
    tokenVerifier: tokenService,
    orderService: buyerOrderSvc,
    orders: orderRepoOrders
  });

  app.get("/api/v1/stores/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = await prisma.store.findUnique({
      where: { id }
    });
    if (!store) {
      return reply.code(404).send({ success: false, error: "Store not found" });
    }
    return { success: true, data: store };
  });

  registerRiderStubRoutes(app);

  void app.register(socketPlugin, {
    tokenVerifier: tokenService,
    orderRepository: orderRepoOrders
  });
}
