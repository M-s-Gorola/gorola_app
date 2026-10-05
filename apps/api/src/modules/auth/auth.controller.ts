import { AppError, UnauthorizedError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { signDeviceCookie } from "../age-gate/age-gate-cookie.js";
import type { AdminAuthService } from "./admin-auth.service.js";
import {
  parseAdminLoginInput,
  parseConfirmAgeInput,
  parseLogoutInput,
  parseRefreshTokenInput,
  parseSendOtpInput,
  parseSetup2FAInput,
  parseStoreOwnerLoginInput,
  parseVerify2FAInput,
  parseVerifyOtpInput
} from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";
import type { AccessTokenVerifier, ConfirmAgeInput } from "./auth.types.js";
import type { StoreOwnerAuthService } from "./store-owner-auth.service.js";

type AuthControllerDeps = {
  authService: Pick<
    AuthService,
    "logout" | "refreshToken" | "sendOtp" | "verifyOtp" | "confirmAge" | "getActiveSessions" | "terminateAllSessions"
  >;
  storeOwnerAuthService: Pick<StoreOwnerAuthService, "login" | "setup2FA" | "verify2FA" | "refreshToken" | "logout">;
  adminAuthService: Pick<AdminAuthService, "login" | "setup2FA" | "verify2FA" | "refreshToken" | "logout">;
  tokenVerifier?: AccessTokenVerifier;
};

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

function getClientContext(request: FastifyRequest): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = request.headers["x-forwarded-for"];
  const ipAddress =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim() || request.ip || null
      : request.ip || null;
  const userAgent = typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null;
  return { ipAddress, userAgent };
}

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

function getRequestId(request: FastifyRequest, reply: FastifyReply): string {
  return reply.getHeader("x-request-id")?.toString() ?? request.id;
}

function success<T>(request: FastifyRequest, reply: FastifyReply, data: T): SuccessEnvelope<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: getRequestId(request, reply)
    }
  };
}

function resolveRefreshToken(
  request: FastifyRequest,
  body: unknown,
  cookieName = "refreshToken"
): { refreshToken: string } {
  const bodyToken =
    typeof body === "object" && body !== null && "refreshToken" in body
      ? (body as { refreshToken?: unknown }).refreshToken
      : undefined;
  if (typeof bodyToken === "string" && bodyToken.length > 0) {
    return { refreshToken: bodyToken };
  }

  const cookies = request.cookies as Record<string, string | undefined> | undefined;
  const cookieToken =
    cookies && cookieName === "storeOwnerRefreshToken"
      ? cookies["storeOwnerRefreshToken"]
      : cookies && cookieName === "adminRefreshToken"
        ? cookies["adminRefreshToken"]
        : cookies
          ? cookies["refreshToken"]
          : undefined;
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return { refreshToken: cookieToken };
  }
  return { refreshToken: "" };
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthControllerDeps): void {
  const requireBuyerAuth = async (request: FastifyRequest): Promise<{ userId: string }> => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid authorization header");
    }
    const token = authHeader.substring(7);
    if (!deps.tokenVerifier) {
      throw new UnauthorizedError("Token verifier unavailable");
    }
    const payload = await deps.tokenVerifier.verifyAccessToken(token);
    if (payload.role !== "BUYER") {
      throw new UnauthorizedError("Unauthorized role");
    }
    return { userId: payload.sub };
  };

  app.post("/api/v1/auth/buyer/send-otp", async (request, reply) => {
    const payload = parseSendOtpInput(request.body as { phone: string });
    await deps.authService.sendOtp(payload);
    return success(request, reply, { sent: true });
  });

  app.post("/api/v1/auth/buyer/verify-otp", async (request, reply) => {
    const payload = parseVerifyOtpInput(request.body as { otp: string; phone: string });
    const context = getClientContext(request);
    const result = await deps.authService.verifyOtp(payload, context);
    if ("ageGateRequired" in result && result.ageGateRequired) {
      return success(request, reply, {
        ageGateRequired: true,
        ageTicket: result.ageTicket
      });
    }
    reply.setCookie("refreshToken", result.refreshToken, refreshCookieOptions());
    return success(request, reply, {
      accessToken: result.accessToken,
      name: result.name,
      phone: result.phone,
      refreshToken: result.refreshToken,
      userId: result.userId,
      privacyPolicyVersionAccepted: result.privacyPolicyVersionAccepted ?? "1.0",
      isPendingDeletion: result.isPendingDeletion ?? false,
      deletionScheduledFor: result.deletionScheduledFor ?? null
    });
  });

  app.post("/api/v1/auth/buyer/confirm-age", async (request, reply) => {
    const payload = parseConfirmAgeInput(request.body as ConfirmAgeInput);
    const context = getClientContext(request);
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const deviceCookie = cookies?.["gorola_ag"] ?? null;
    try {
      const result = await deps.authService.confirmAge(payload, context, deviceCookie);

      reply.setCookie("refreshToken", result.refreshToken, refreshCookieOptions());
      return success(request, reply, {
        accessToken: result.accessToken,
        name: result.name,
        phone: result.phone,
        refreshToken: result.refreshToken,
        userId: result.userId,
        privacyPolicyVersionAccepted: result.privacyPolicyVersionAccepted ?? "1.1",
        ageGateRequired: false,
        isPendingDeletion: result.isPendingDeletion ?? false,
        deletionScheduledFor: result.deletionScheduledFor ?? null
      });
    } catch (err: unknown) {
      if (err instanceof AppError && err.code === "AGE_REQUIREMENT_NOT_MET") {
        const agCookie = signDeviceCookie(new Date(), 24);
        reply.setCookie("gorola_ag", agCookie, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          path: "/",
          maxAge: 86400
        });
      }
      throw err;
    }
  });

  app.post("/api/v1/auth/buyer/refresh", async (request, reply) => {
    const payload = parseRefreshTokenInput(resolveRefreshToken(request, request.body));
    const context = getClientContext(request);
    const tokens = await deps.authService.refreshToken(payload, context);
    reply.setCookie("refreshToken", tokens.refreshToken, refreshCookieOptions());
    return success(request, reply, {
      ...tokens,
      privacyPolicyVersionAccepted: tokens.privacyPolicyVersionAccepted ?? "1.0"
    });
  });

  app.post("/api/v1/auth/buyer/logout", async (request, reply) => {
    const payload = parseLogoutInput(resolveRefreshToken(request, request.body));
    await deps.authService.logout(payload);
    reply.clearCookie("refreshToken", refreshCookieClearOptions());
    return success(request, reply, { loggedOut: true });
  });

  app.get("/api/v1/auth/sessions", async (request, reply) => {
    const { userId } = await requireBuyerAuth(request);
    const { refreshToken } = resolveRefreshToken(request, request.body);
    const sessions = await deps.authService.getActiveSessions(userId, refreshToken);
    return success(request, reply, { sessions });
  });

  app.delete("/api/v1/auth/sessions", async (request, reply) => {
    const { userId } = await requireBuyerAuth(request);
    const result = await deps.authService.terminateAllSessions(userId);
    reply.clearCookie("refreshToken", refreshCookieClearOptions());
    return success(request, reply, result);
  });

  app.post("/api/v1/auth/store-owner/login", async (request, reply) => {
    const payload = parseStoreOwnerLoginInput(
      request.body as {
        email: string;
        password: string;
        totpCode?: string;
      }
    );

    const result = await deps.storeOwnerAuthService.login(payload);
    if ("requiresTwoFactor" in result) {
      return success(request, reply, result);
    }
    reply.setCookie("storeOwnerRefreshToken", result.refreshToken, refreshCookieOptions());
    return success(request, reply, result);
  });

  app.post("/api/v1/auth/store-owner/setup-2fa", async (request, reply) => {
    const payload = parseSetup2FAInput(request.body as { email: string });
    const result = await deps.storeOwnerAuthService.setup2FA(payload);
    return success(request, reply, result);
  });

  app.post("/api/v1/auth/store-owner/verify-2fa", async (request, reply) => {
    const payload = parseVerify2FAInput(request.body as { email: string; code: string });
    await deps.storeOwnerAuthService.verify2FA(payload);
    return success(request, reply, { verified: true });
  });

  app.post("/api/v1/auth/store-owner/refresh", async (request, reply) => {
    const payload = parseRefreshTokenInput(resolveRefreshToken(request, request.body, "storeOwnerRefreshToken"));
    const tokens = await deps.storeOwnerAuthService.refreshToken(payload);
    reply.setCookie("storeOwnerRefreshToken", tokens.refreshToken, refreshCookieOptions());
    return success(request, reply, tokens);
  });

  app.post("/api/v1/auth/store-owner/logout", async (request, reply) => {
    const payload = parseLogoutInput(resolveRefreshToken(request, request.body, "storeOwnerRefreshToken"));
    await deps.storeOwnerAuthService.logout(payload);
    reply.clearCookie("storeOwnerRefreshToken", refreshCookieClearOptions());
    return success(request, reply, { loggedOut: true });
  });

  app.post("/api/v1/auth/admin/login", async (request, reply) => {
    const payload = parseAdminLoginInput(
      request.body as {
        email: string;
        password: string;
        totpCode?: string;
      }
    );
    const result = await deps.adminAuthService.login(payload);
    if ("requiresTwoFactor" in result) {
      return success(request, reply, result);
    }
    reply.setCookie("adminRefreshToken", result.refreshToken, refreshCookieOptions());
    return success(request, reply, result);
  });

  app.post("/api/v1/auth/admin/setup-2fa", async (request, reply) => {
    const payload = parseSetup2FAInput(request.body as { email: string });
    const result = await deps.adminAuthService.setup2FA(payload);
    return success(request, reply, result);
  });

  app.post("/api/v1/auth/admin/verify-2fa", async (request, reply) => {
    const payload = parseVerify2FAInput(request.body as { email: string; code: string });
    await deps.adminAuthService.verify2FA(payload);
    return success(request, reply, { verified: true });
  });

  app.post("/api/v1/auth/admin/refresh", async (request, reply) => {
    const payload = parseRefreshTokenInput(resolveRefreshToken(request, request.body, "adminRefreshToken"));
    const tokens = await deps.adminAuthService.refreshToken(payload);
    reply.setCookie("adminRefreshToken", tokens.refreshToken, refreshCookieOptions());
    return success(request, reply, tokens);
  });

  app.post("/api/v1/auth/admin/logout", async (request, reply) => {
    const payload = parseLogoutInput(resolveRefreshToken(request, request.body, "adminRefreshToken"));
    await deps.adminAuthService.logout(payload);
    reply.clearCookie("adminRefreshToken", refreshCookieClearOptions());
    return success(request, reply, { loggedOut: true });
  });
}
