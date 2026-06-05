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

type OmitUndefined<T> = {
  [K in keyof T]: Exclude<T[K], undefined>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanUndefined<T extends Record<string, any>>(obj: T): OmitUndefined<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = {} as any;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // eslint-disable-next-line security/detect-object-injection
      const val = obj[key];
      if (val !== undefined) {
        // eslint-disable-next-line security/detect-object-injection
        result[key] = val;
      }
    }
  }
  return result;
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

  const createStoreBodySchema = z.object({
    storeName: z.string().min(1, "Store name is required"),
    description: z.string().default(""),
    phone: z.string().min(1, "Phone is required"),
    landmarkAddress: z.string().min(1, "Address is required"),
    storeType: z.enum(["QUICK_COMMERCE", "BOOKING_COMMERCE"]),
    ownerEmail: z.string().email("Invalid owner email"),
    ownerTempPassword: z.string().min(8, "Temp password must be at least 8 characters")
  });

  const updateStoreStatusBodySchema = z.object({
    isActive: z.boolean()
  });

  app.post("/api/v1/admin/stores", { preHandler }, async (request, reply) => {
    const parsed = createStoreBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid store creation data", parsed.error.flatten());
    }
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.createStore(parsed.data, adminId, ip, userAgent);
    reply.status(201);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/admin/stores", { preHandler }, async (request, reply) => {
    const result = await adminService.getStores();
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/admin/stores/:id", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await adminService.getStoreDetail(id);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/stores/:id/status", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateStoreStatusBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid store status data", parsed.error.flatten());
    }
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.updateStoreStatus(id, parsed.data.isActive, adminId, ip, userAgent);
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

  // Zod schemas for category routes
  const createCategorySchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    slug: z.string().trim().min(1, "Slug is required"),
    imageUrl: z.string().trim().nullable().optional(),
    displayOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
    commerceType: z.enum(["QUICK_COMMERCE", "BOOKING_COMMERCE"])
  });

  const updateCategorySchema = z.object({
    name: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().nullable().optional(),
    displayOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
    commerceType: z.enum(["QUICK_COMMERCE", "BOOKING_COMMERCE"]).optional()
  });

  const reorderSchema = z.array(
    z.object({
      id: z.string().min(1),
      displayOrder: z.coerce.number().int()
    })
  );

  const createSubCategorySchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    slug: z.string().trim().min(1, "Slug is required"),
    imageUrl: z.string().trim().nullable().optional(),
    displayOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true)
  });

  const updateSubCategorySchema = z.object({
    name: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().nullable().optional(),
    displayOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional()
  });

  // Endpoints
  app.get("/api/v1/admin/categories", { preHandler }, async (request, reply) => {
    const result = await adminService.getCategories();
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.post("/api/v1/admin/categories", { preHandler }, async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid category creation data", parsed.error.flatten());
    }

    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.createCategory(cleanUndefined(parsed.data), adminId, ip, userAgent);
    reply.status(201);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/categories/:id", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid category update data", parsed.error.flatten());
    }

    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.updateCategory(id, cleanUndefined(parsed.data), adminId, ip, userAgent);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.delete("/api/v1/admin/categories/:id", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    await adminService.deleteCategory(id, adminId, ip, userAgent);
    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/categories/reorder", { preHandler }, async (request, reply) => {
    const parsed = reorderSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid reorder data", parsed.error.flatten());
    }

    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    await adminService.reorderCategories(parsed.data, adminId, ip, userAgent);
    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.post("/api/v1/admin/categories/:slug/sub-categories", { preHandler }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parsed = createSubCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid subcategory creation data", parsed.error.flatten());
    }

    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.createSubCategory(slug, cleanUndefined(parsed.data), adminId, ip, userAgent);
    reply.status(201);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/sub-categories/:id", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSubCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid subcategory update data", parsed.error.flatten());
    }

    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.updateSubCategory(id, cleanUndefined(parsed.data), adminId, ip, userAgent);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/sub-categories/reorder", { preHandler }, async (request, reply) => {
    const parsed = reorderSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid reorder data", parsed.error.flatten());
    }

    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    await adminService.reorderSubCategories(parsed.data, adminId, ip, userAgent);
    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/admin/feature-flags", { preHandler }, async (request, reply) => {
    const result = await adminService.getFlags();
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  const updateFlagBodySchema = z.object({
    value: z.boolean()
  });

  app.put("/api/v1/admin/feature-flags/:key", { preHandler }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const parsed = updateFlagBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid flag value", parsed.error.flatten());
    }

    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.updateFlag(
      key,
      parsed.data.value,
      adminId,
      ip,
      userAgent
    );

    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/admin/advertisements", { preHandler }, async (request, reply) => {
    const statusSchema = z.object({
      status: z.enum(["PENDING", "APPROVED", "ALL"]).optional()
    });
    const parsed = statusSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid status filter", parsed.error.flatten());
    }

    const result = await adminService.getAds(parsed.data.status);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/advertisements/:id/approve", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.approveAd(id, adminId, ip, userAgent);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  const rejectAdBodySchema = z.object({
    reason: z.string().min(1, "Reason is required")
  });

  app.put("/api/v1/admin/advertisements/:id/reject", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = rejectAdBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid rejection request", parsed.error.flatten());
    }

    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.rejectAd(id, parsed.data.reason, adminId, ip, userAgent);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/admin/advertisements/:id/deactivate", { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adminId = request.user?.sub;
    if (!adminId) {
      throw new ValidationError("Admin ID missing from auth context");
    }

    const ip = request.ip;
    const userAgent = (request.headers["user-agent"] ?? "") as string;

    const result = await adminService.deactivateAd(id, adminId, ip, userAgent);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  const getAuditLogsQuerySchema = z.object({
    role: z.enum(["ADMIN", "STORE_OWNER", "BUYER", "SYSTEM"]).optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    format: z.string().optional()
  });

  const exportAuditLogsQuerySchema = z.object({
    role: z.enum(["ADMIN", "STORE_OWNER", "BUYER", "SYSTEM"]).optional(),
    action: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional()
  });

  const methodNotAllowedHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(405).send({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method Not Allowed"
      }
    });
  };

  app.get("/api/v1/admin/audit-logs", { preHandler }, async (request, reply) => {
    const parsed = getAuditLogsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters", parsed.error.flatten());
    }

    const { format, role, ...rest } = parsed.data;
    const filters = {
      ...(role ? { actorRole: role } : {}),
      ...rest
    };

    if (format === "csv") {
      const csv = await adminService.exportAuditLogsCsv(filters);
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", 'attachment; filename="audit-logs-export.csv"')
        .send(csv);
    }

    const result = await adminService.getAuditLogs(filters);
    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/admin/audit-logs/export", { preHandler }, async (request, reply) => {
    const parsed = exportAuditLogsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters", parsed.error.flatten());
    }

    const { role, ...rest } = parsed.data;
    const filters = {
      ...(role ? { actorRole: role } : {}),
      ...rest
    };

    const csv = await adminService.exportAuditLogsCsv(filters);
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="audit-logs-export.csv"')
      .send(csv);
  });

  // Read-only method restrictions (returning 405 Method Not Allowed)
  app.put("/api/v1/admin/audit-logs", { preHandler }, methodNotAllowedHandler);
  app.post("/api/v1/admin/audit-logs", { preHandler }, methodNotAllowedHandler);
  app.delete("/api/v1/admin/audit-logs", { preHandler }, methodNotAllowedHandler);

  app.put("/api/v1/admin/audit-logs/:id", { preHandler }, methodNotAllowedHandler);
  app.post("/api/v1/admin/audit-logs/:id", { preHandler }, methodNotAllowedHandler);
  app.delete("/api/v1/admin/audit-logs/:id", { preHandler }, methodNotAllowedHandler);
}
