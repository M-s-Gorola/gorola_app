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
  deps: { tokenVerifier: AccessTokenVerifier }
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
}
