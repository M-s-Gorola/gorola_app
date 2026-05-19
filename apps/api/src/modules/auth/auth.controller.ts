import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AdminAuthService } from "./admin-auth.service.js";
import {
  parseAdminLoginInput,
  parseLogoutInput,
  parseRefreshTokenInput,
  parseSendOtpInput,
  parseSetup2FAInput,
  parseStoreOwnerLoginInput,
  parseVerify2FAInput,
  parseVerifyOtpInput
} from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";
import type { StoreOwnerAuthService } from "./store-owner-auth.service.js";

type AuthControllerDeps = {
  authService: Pick<AuthService, "logout" | "refreshToken" | "sendOtp" | "verifyOtp">;
  storeOwnerAuthService: Pick<StoreOwnerAuthService, "login" | "setup2FA" | "verify2FA">;
  adminAuthService: Pick<AdminAuthService, "login" | "setup2FA" | "verify2FA">;
};

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: {
    requestId: string;
  };
};

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
  body: unknown
): { refreshToken: string } {
  const bodyToken =
    typeof body === "object" && body !== null && "refreshToken" in body
      ? (body as { refreshToken?: unknown }).refreshToken
      : undefined;
  if (typeof bodyToken === "string" && bodyToken.length > 0) {
    return { refreshToken: bodyToken };
  }

  const cookieToken = (request.cookies as Record<string, string | undefined> | undefined)
    ?.refreshToken;
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return { refreshToken: cookieToken };
  }
  return { refreshToken: "" };
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthControllerDeps): void {
  app.post("/api/v1/auth/buyer/send-otp", async (request, reply) => {
    const payload = parseSendOtpInput(request.body as { phone: string });
    await deps.authService.sendOtp(payload);
    return success(request, reply, { sent: true });
  });

  app.post("/api/v1/auth/buyer/verify-otp", async (request, reply) => {
    const payload = parseVerifyOtpInput(request.body as { otp: string; phone: string });
    const result = await deps.authService.verifyOtp(payload);
    reply.setCookie("refreshToken", result.refreshToken, refreshCookieOptions());
    return success(request, reply, {
      accessToken: result.accessToken,
      name: result.name,
      phone: result.phone,
      refreshToken: result.refreshToken,
      userId: result.userId
    });
  });

  app.post("/api/v1/auth/buyer/refresh", async (request, reply) => {
    const payload = parseRefreshTokenInput(resolveRefreshToken(request, request.body));
    const tokens = await deps.authService.refreshToken(payload);
    reply.setCookie("refreshToken", tokens.refreshToken, refreshCookieOptions());
    return success(request, reply, tokens);
  });

  app.post("/api/v1/auth/buyer/logout", async (request, reply) => {
    const payload = parseLogoutInput(resolveRefreshToken(request, request.body));
    await deps.authService.logout(payload);
    reply.clearCookie("refreshToken", refreshCookieClearOptions());
    return success(request, reply, { loggedOut: true });
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
    reply.setCookie("refreshToken", result.refreshToken, refreshCookieOptions());
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

  app.post("/api/v1/auth/admin/login", async (request, reply) => {
    const payload = parseAdminLoginInput(
      request.body as {
        email: string;
        password: string;
        totpCode: string;
      }
    );
    const tokens = await deps.adminAuthService.login(payload);
    reply.setCookie("refreshToken", tokens.refreshToken, refreshCookieOptions());
    return success(request, reply, tokens);
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
}
