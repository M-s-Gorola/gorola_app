import { ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import { StoreOwnerRepository } from "./store-owner.repository.js";
import { StoreOwnerService } from "./store-owner.service.js";

function getRequestId(request: FastifyRequest, reply: FastifyReply): string {
  return reply.getHeader("x-request-id")?.toString() ?? request.id;
}

export function registerStoreOwnerRoutes(
  app: FastifyInstance,
  deps: {
    tokenVerifier: AccessTokenVerifier;
    orderService?: any;
    orders?: any;
  }
): void {
  const prisma = getPrismaClient();
  const storeOwnerService = new StoreOwnerService(prisma);
  const storeOwnerRepository = new StoreOwnerRepository(prisma);
  const preHandler = [requireAuth(deps.tokenVerifier), requireRole(["STORE_OWNER"])];

  app.get("/api/v1/store/dashboard", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const storeId = owner.storeId;
    const data = await storeOwnerService.getDashboard(storeId);

    return {
      success: true,
      data,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/store/orders", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const storeId = owner.storeId;
    const query = request.query as any;

    const page = query.page ? parseInt(query.page as string, 10) : 1;
    const limit = query.limit ? parseInt(query.limit as string, 10) : 10;
    const status = query.status as any;

    const data = await storeOwnerService.getOrders(storeId, { status, page, limit });

    return {
      success: true,
      data: data.data,
      meta: {
        total: data.meta.total,
        page: data.meta.page,
        limit: data.meta.limit,
        hasMore: data.meta.hasMore,
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/store/orders/:orderId/status", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const storeId = owner.storeId;
    const params = request.params as any;
    const orderId = params.orderId;
    const body = request.body as any;
    const newStatus = body.status;

    if (!newStatus) {
      throw new ValidationError("Status is required");
    }

    const order = await storeOwnerService.updateOrderStatus(
      storeId,
      orderId,
      newStatus,
      deps.orderService
    );

    return {
      success: true,
      data: order,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });
}

