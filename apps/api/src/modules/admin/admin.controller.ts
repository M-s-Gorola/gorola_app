import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import { AdminService } from "./admin.service.js";

function getRequestId(request: FastifyRequest, reply: FastifyReply): string {
  return reply.getHeader("x-request-id")?.toString() ?? request.id;
}

export function registerAdminRoutes(
  app: FastifyInstance,
  deps: {
    tokenVerifier: AccessTokenVerifier;
  }
): void {
  const prisma = getPrismaClient();
  const adminService = new AdminService(prisma);
  const preHandler = [requireAuth(deps.tokenVerifier), requireRole(["ADMIN"])];

  app.get("/api/v1/admin/dashboard", { preHandler }, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const range = query["range"] ?? "WEEK";
    const groupBy = query["groupBy"] ?? "DAILY";
    const data = await adminService.getDashboard(range, groupBy);

    return {
      success: true,
      data,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });
}
