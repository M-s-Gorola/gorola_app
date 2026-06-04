import { ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import { OrderRepository } from "../order/order.repository.js";
import { OrderService } from "../order/order.service.js";
import { AdminService } from "./admin.service.js";

function getRequestId(request: FastifyRequest, reply: FastifyReply): string {
  return reply.getHeader("x-request-id")?.toString() ?? request.id;
}

export function registerAdminRoutes(
  app: FastifyInstance,
  deps: {
    tokenVerifier: AccessTokenVerifier;
    orderService?: OrderService;
    orders?: OrderRepository;
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

  const getOrdersQuerySchema = z.object({
    storeId: z.string().optional(),
    status: z.enum(["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "PENDING_APPROVAL", "APPROVED"]).optional(),
    paymentMethod: z.enum(["COD", "UPI", "CARD"]).optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  });

  app.get("/api/v1/admin/orders", { preHandler }, async (request, reply) => {
    const parsed = getOrdersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters", parsed.error.flatten());
    }
    const result = await adminService.getOrders(parsed.data);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/admin/orders/:id", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await adminService.getOrderDetail(id);
    return {
      success: true,
      data: order,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  const forceUpdateStatusBodySchema = z.object({
    status: z.enum(["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "PENDING_APPROVAL", "APPROVED"]),
    auditNote: z.string().min(1, "Audit note is required")
  });

  app.put("/api/v1/admin/orders/:id/status", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = forceUpdateStatusBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid status update data", parsed.error.flatten());
    }
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const order = await adminService.forceUpdateOrderStatus(
      id,
      parsed.data.status,
      parsed.data.auditNote,
      adminId,
      ip,
      userAgent,
      {
        orderService: deps.orderService!,
        ordersRepo: deps.orders!
      }
    );

    return {
      success: true,
      data: order,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  const exportQuerySchema = z.object({
    storeId: z.string().optional(),
    status: z.enum(["PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "PENDING_APPROVAL", "APPROVED"]).optional(),
    paymentMethod: z.enum(["COD", "UPI", "CARD"]).optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional()
  });

  app.get("/api/v1/admin/orders/export", { preHandler }, async (request, reply) => {
    const parsed = exportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters", parsed.error.flatten());
    }
    const csv = await adminService.exportOrdersCsv(parsed.data);

    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="orders-export.csv"')
      .send(csv);
  });

  const getUsersQuerySchema = z.object({
    phone: z.string().optional()
  });

  app.get("/api/v1/admin/users", { preHandler }, async (request, reply) => {
    const parsed = getUsersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters", parsed.error.flatten());
    }

    const result = await adminService.getUsers(parsed.data);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/admin/users/:id", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await adminService.getUserDetail(id);
    return {
      success: true,
      data: user,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/users/:id/suspend", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.suspendUser(id, adminId, ip, userAgent);
    return {
      success: true,
      data: {
        id: result.id,
        isActive: result.isActive
      },
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/users/:id/unsuspend", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.unsuspendUser(id, adminId, ip, userAgent);
    return {
      success: true,
      data: {
        id: result.id,
        isActive: result.isActive
      },
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });
}
