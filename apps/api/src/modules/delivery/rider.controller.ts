import { ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import type { RiderAuthService } from "../auth/rider-auth.service.js";
import type { RiderLocationService } from "./rider-location.service.js";
import type { RiderOrderService } from "./rider-order.service.js";

function maskPhone(phone: string): string {
  if (!phone) return "";
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

function getRequestId(request: FastifyRequest, reply: FastifyReply): string {
  return reply.getHeader("x-request-id")?.toString() ?? request.id;
}

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required")
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});

const updateStatusSchema = z.object({
  status: z.enum([
    "PLACED",
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "PENDING_APPROVAL",
    "APPROVED"
  ])
});

const updateStatusParamsSchema = z.object({
  id: z.string().min(1, "Order ID is required")
});

const updateLocationSchema = z.object({
  lat: z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
  lng: z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  orderId: z.string().min(1, "Order ID is required")
});

function refreshCookieOptions(): {
  path: string;
  sameSite: "lax" | "none";
  secure?: boolean;
  partitioned?: boolean;
} {
  if (process.env.NODE_ENV === "production") {
    return {
      path: "/",
      partitioned: true,
      sameSite: "none",
      secure: true
    };
  }
  return {
    path: "/",
    sameSite: "lax"
  };
}

function refreshCookieClearOptions(): {
  path: string;
  sameSite?: "lax" | "none";
  secure?: boolean;
  partitioned?: boolean;
} {
  const options = refreshCookieOptions();
  const clearOptions: {
    path: string;
    sameSite?: "lax" | "none";
    secure?: boolean;
    partitioned?: boolean;
  } = {
    path: options.path,
    sameSite: options.sameSite
  };
  if (options.secure !== undefined) {
    clearOptions.secure = options.secure;
  }
  if (options.partitioned !== undefined) {
    clearOptions.partitioned = options.partitioned;
  }
  return clearOptions;
}

function resolveRiderRefreshToken(request: FastifyRequest): { refreshToken: string } {
  const body = request.body as Record<string, unknown> | null;
  const bodyToken = body && typeof body.refreshToken === "string" ? body.refreshToken : undefined;
  if (bodyToken && bodyToken.length > 0) {
    return { refreshToken: bodyToken };
  }
  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  return { refreshToken: cookies?.["riderRefreshToken"] ?? "" };
}

export function registerRiderRoutes(
  app: FastifyInstance,
  deps: {
    tokenVerifier: AccessTokenVerifier;
    riderAuthService: RiderAuthService;
    riderOrderService: RiderOrderService;
    riderLocationService: RiderLocationService;
  }
): void {
  const preHandler = [requireAuth(deps.tokenVerifier), requireRole(["RIDER"])];

  // POST /api/v1/rider/auth/login
  app.post("/api/v1/rider/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid login payload", parsed.error.flatten());
    }

    const result = await deps.riderAuthService.login(parsed.data);
    reply.setCookie("riderRefreshToken", result.refreshToken, refreshCookieOptions());

    return {
      success: true,
      data: result,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // POST /api/v1/rider/auth/refresh
  app.post("/api/v1/rider/auth/refresh", async (request, reply) => {
    const resolved = resolveRiderRefreshToken(request);
    const parsed = refreshSchema.safeParse(resolved);
    if (!parsed.success) {
      throw new ValidationError("Invalid refresh token payload", parsed.error.flatten());
    }

    const tokens = await deps.riderAuthService.refreshToken(parsed.data);
    reply.setCookie("riderRefreshToken", tokens.refreshToken, refreshCookieOptions());

    return {
      success: true,
      data: tokens,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // POST /api/v1/rider/auth/logout
  app.post("/api/v1/rider/auth/logout", async (request, reply) => {
    const resolved = resolveRiderRefreshToken(request);
    const parsed = logoutSchema.safeParse(resolved);
    if (!parsed.success) {
      throw new ValidationError("Invalid logout payload", parsed.error.flatten());
    }

    await deps.riderAuthService.logout(parsed.data);
    reply.clearCookie("riderRefreshToken", refreshCookieClearOptions());

    return {
      success: true,
      data: { loggedOut: true },
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // GET /api/v1/rider/orders/active
  app.get("/api/v1/rider/orders/active", { preHandler }, async (request, reply) => {
    const storeId = request.user?.storeId;
    if (!storeId) {
      return reply.code(400).send({ success: false, error: "Store context missing from session" });
    }

    const orders = await deps.riderOrderService.getActiveOrders(storeId);
    
    const mapped = orders.map((o) => {
      return {
        id: o.id,
        status: o.status,
        items: o.items.map((i) => ({
          productName: i.productName,
          variantLabel: i.variantLabel,
          quantity: i.quantity
        })),
        deliveryAddress: {
          landmark: o.landmarkDescription,
          lat: o.deliveryLat ? Number(o.deliveryLat) : null,
          lng: o.deliveryLng ? Number(o.deliveryLng) : null
        },
        buyerMaskedPhone: maskPhone(o.user?.phone ?? ""),
        createdAt: o.createdAt
      };
    });

    return {
      success: true,
      data: mapped,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // PUT /api/v1/rider/orders/:id/status
  app.put("/api/v1/rider/orders/:id/status", { preHandler }, async (request, reply) => {
    const paramsParsed = updateStatusParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError("Invalid parameters", paramsParsed.error.flatten());
    }

    const bodyParsed = updateStatusSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError("Invalid status transition payload", bodyParsed.error.flatten());
    }

    const storeId = request.user?.storeId;
    const changedBy = request.user?.sub;
    if (!storeId || !changedBy) {
      return reply.code(400).send({ success: false, error: "Authentication context missing" });
    }

    const order = await deps.riderOrderService.updateOrderStatus(
      storeId,
      paramsParsed.data.id,
      bodyParsed.data.status,
      changedBy
    );

    return {
      success: true,
      data: {
        id: order.id,
        status: order.status
      },
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // PUT /api/v1/rider/location
  app.put("/api/v1/rider/location", { preHandler }, async (request, reply) => {
    const parsed = updateLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid location payload", parsed.error.flatten());
    }

    const riderId = request.user?.sub;
    if (!riderId) {
      return reply.code(400).send({ success: false, error: "Authentication context missing" });
    }

    const location = await deps.riderLocationService.updateLocation(riderId, parsed.data);

    return {
      success: true,
      data: {
        id: location.id,
        lat: Number(location.lat),
        lng: Number(location.lng),
        updatedAt: location.updatedAt
      },
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

}

