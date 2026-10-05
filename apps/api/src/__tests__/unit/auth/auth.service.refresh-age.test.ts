import { describe, expect, it, vi } from "vitest";

import {
  AuthService,
  type AuthServiceDependencies,
  type BuyerUserLookup
} from "../../../modules/auth/auth.service.js";
import type { RedisLikeClient, TokenService } from "../../../modules/auth/auth.types.js";

describe("AuthService Refresh Token Age Gate Unit (Phase 8.8.7)", () => {
  it("throws 403 AGE_CONFIRMATION_REQUIRED when user has not confirmed age (ageConfirmedAt is null)", async () => {
    const mockTokenService: TokenService = {
      issueTokens: vi.fn(),
      revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
      verifyRefreshToken: vi.fn().mockResolvedValue({
        userId: "legacy-user-1",
        phone: "+919876543210",
        name: "Legacy User"
      })
    };

    const mockRedis: RedisLikeClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1)
    };

    const unconfirmedUser: BuyerUserLookup = {
      id: "legacy-user-1",
      name: "Legacy User",
      phone: "+919876543210",
      isActive: true,
      ageConfirmedAt: null, // Legacy user without age confirmation
      privacyPolicyVersionAccepted: "1.0"
    };

    const deps: AuthServiceDependencies = {
      findBuyerByPhone: vi.fn(),
      findUserById: vi.fn().mockResolvedValue(unconfirmedUser),
      otpProvider: { sendOtp: vi.fn() },
      otpTtlSeconds: 300,
      redis: mockRedis,
      tokenService: mockTokenService
    };

    const service = new AuthService(deps);

    await expect(
      service.refreshToken({ refreshToken: "valid-legacy-rt" })
    ).rejects.toMatchObject({
      code: "AGE_CONFIRMATION_REQUIRED",
      statusCode: 403
    });
  });

  it("successfully rotates tokens when ageConfirmedAt is present", async () => {
    const mockTokenService: TokenService = {
      issueTokens: vi.fn().mockResolvedValue({
        accessToken: "new-access",
        refreshToken: "new-refresh",
        name: "Adult User",
        phone: "+919876543210",
        userId: "adult-user-1"
      }),
      revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
      verifyRefreshToken: vi.fn().mockResolvedValue({
        userId: "adult-user-1",
        phone: "+919876543210",
        name: "Adult User"
      })
    };

    const mockRedis: RedisLikeClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1)
    };

    const confirmedUser: BuyerUserLookup = {
      id: "adult-user-1",
      name: "Adult User",
      phone: "+919876543210",
      isActive: true,
      ageConfirmedAt: new Date("2026-10-05T00:00:00.000Z"),
      privacyPolicyVersionAccepted: "1.1"
    };

    const deps: AuthServiceDependencies = {
      findBuyerByPhone: vi.fn(),
      findUserById: vi.fn().mockResolvedValue(confirmedUser),
      otpProvider: { sendOtp: vi.fn() },
      otpTtlSeconds: 300,
      redis: mockRedis,
      tokenService: mockTokenService
    };

    const service = new AuthService(deps);

    const result = await service.refreshToken({ refreshToken: "valid-confirmed-rt" });
    expect(result.accessToken).toBe("new-access");
    expect(result.refreshToken).toBe("new-refresh");
  });
});
