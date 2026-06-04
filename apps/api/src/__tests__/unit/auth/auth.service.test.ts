import { RateLimitError, UnauthorizedError, ValidationError } from "@gorola/shared";
import { hash } from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BuyerUserLookup } from "../../../modules/auth/auth.service.js";
import { AuthService } from "../../../modules/auth/auth.service.js";
import type {
  BuyerRefreshSuccess,
  OtpProvider,
  OtpStoreRecord,
  RedisLikeClient,
  TokenService
} from "../../../modules/auth/auth.types.js";

type MockRedisClient = {
  del: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

type MockOtpProvider = {
  sendOtp: ReturnType<typeof vi.fn>;
};

type MockTokenService = {
  issueTokens: ReturnType<typeof vi.fn>;
  verifyRefreshToken: ReturnType<typeof vi.fn>;
  revokeRefreshToken: ReturnType<typeof vi.fn>;
};

describe("AuthService", () => {
  const redis: MockRedisClient = {
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn()
  };
  const otpProvider: MockOtpProvider = {
    sendOtp: vi.fn()
  };
  const tokenService: MockTokenService = {
    issueTokens: vi.fn(),
    verifyRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn()
  };
  const ensureBuyerUser = vi.fn();
  const findUserById = vi.fn();

  const service = new AuthService({
    ensureBuyerUser: ensureBuyerUser as unknown as (phone: string) => Promise<BuyerUserLookup>,
    findUserById: findUserById as unknown as (id: string) => Promise<BuyerUserLookup | null>,
    otpProvider: otpProvider as unknown as OtpProvider,
    otpTtlSeconds: 300,
    redis: redis as unknown as RedisLikeClient,
    tokenService: tokenService as unknown as TokenService
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T08:00:00.000Z"));
    process.env.GOROLA_TEST_OTP = "123456";
    ensureBuyerUser.mockResolvedValue({
      id: "user_test_1",
      name: "",
      phone: "+919876543210",
      isActive: true
    });
    findUserById.mockResolvedValue({
      id: "user_test_1",
      name: "Latest Name",
      phone: "+919876543210",
      isActive: true
    });
  });

  afterEach(() => {
    delete process.env.GOROLA_TEST_OTP;
    vi.useRealTimers();
  });

  describe("sendOtp", () => {
    it("should send OTP, hash it, and store in Redis with TTL", async () => {
      redis.get.mockResolvedValueOnce(null);
      otpProvider.sendOtp.mockResolvedValueOnce(undefined);

      await service.sendOtp({ phone: "+919876543210" });

      expect(otpProvider.sendOtp).toHaveBeenCalledWith("+919876543210", "123456");
      expect(redis.set).toHaveBeenCalledWith(
        "otp:+919876543210",
        expect.any(String),
        "EX",
        300
      );
    });

    it("should throw RateLimitError after 5 attempts in 15 minutes", async () => {
      const payload: OtpStoreRecord = {
        attempts: 0,
        expiresAt: "2026-04-21T08:05:00.000Z",
        hashedOtp: "hashed",
        sentCount: 5,
        sentWindowStartedAt: "2026-04-21T07:50:00.000Z"
      };
      redis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await expect(service.sendOtp({ phone: "+919876543210" })).rejects.toBeInstanceOf(
        RateLimitError
      );
      expect(otpProvider.sendOtp).not.toHaveBeenCalled();
    });

    it("should throw ValidationError for invalid phone format", async () => {
      await expect(service.sendOtp({ phone: "9876543210" })).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(otpProvider.sendOtp).not.toHaveBeenCalled();
    });
  });

  describe("verifyOtp", () => {
    it("should return tokens and user when OTP is valid", async () => {
      const validOtpHash = await hash("123456", 8);
      const tokenPair: BuyerRefreshSuccess = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        name: null,
        phone: "+919876543210",
        userId: "user_test_1"
      };
      redis.get.mockResolvedValueOnce(
        JSON.stringify({
          attempts: 0,
          expiresAt: "2026-04-21T08:05:00.000Z",
          hashedOtp: validOtpHash,
          sentCount: 1,
          sentWindowStartedAt: "2026-04-21T08:00:00.000Z"
        } satisfies OtpStoreRecord)
      );
      tokenService.issueTokens.mockResolvedValueOnce(tokenPair);

      const result = await service.verifyOtp({
        otp: "123456",
        phone: "+919876543210"
      });

      expect(ensureBuyerUser).toHaveBeenCalledWith("+919876543210");
      expect(tokenService.issueTokens).toHaveBeenCalledWith({
        name: null,
        phone: "+919876543210",
        userId: "user_test_1"
      });
      expect(result).toEqual({
        ...tokenPair,
        name: null,
        phone: "+919876543210",
        userId: "user_test_1"
      });
      expect(redis.del).toHaveBeenCalledWith("otp:+919876543210");
    });

    it("should throw UnauthorizedError and increment attempts when OTP is wrong", async () => {
      const validOtpHash = await hash("123456", 8);
      redis.get.mockResolvedValueOnce(
        JSON.stringify({
          attempts: 0,
          expiresAt: "2026-04-21T08:05:00.000Z",
          hashedOtp: validOtpHash,
          sentCount: 1,
          sentWindowStartedAt: "2026-04-21T08:00:00.000Z"
        } satisfies OtpStoreRecord)
      );

      try {
        await service.verifyOtp({
          otp: "000000",
          phone: "+919876543210"
        });
        expect.fail("expected rejection");
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedError);
        expect((e as UnauthorizedError).details).toEqual({
          attemptsRemaining: 2
        });
      }
      expect(redis.set).toHaveBeenCalled();
    });

    it("should throw RateLimitError after 3 failed verify attempts", async () => {
      const validOtpHash = await hash("123456", 8);
      redis.get.mockResolvedValueOnce(
        JSON.stringify({
          attempts: 3,
          expiresAt: "2026-04-21T08:05:00.000Z",
          hashedOtp: validOtpHash,
          sentCount: 1,
          sentWindowStartedAt: "2026-04-21T08:00:00.000Z"
        } satisfies OtpStoreRecord)
      );

      await expect(
        service.verifyOtp({
          otp: "000000",
          phone: "+919876543210"
        })
      ).rejects.toBeInstanceOf(RateLimitError);
    });

    it("should throw UnauthorizedError on expired OTP", async () => {
      redis.get.mockResolvedValueOnce(
        JSON.stringify({
          attempts: 0,
          expiresAt: "2026-04-21T07:59:00.000Z",
          hashedOtp: "hashed",
          sentCount: 1,
          sentWindowStartedAt: "2026-04-21T08:00:00.000Z"
        } satisfies OtpStoreRecord)
      );

      await expect(
        service.verifyOtp({
          otp: "123456",
          phone: "+919876543210"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe("refreshToken", () => {
    it("should issue new tokens and return latest user profile from DB", async () => {
      tokenService.verifyRefreshToken.mockResolvedValueOnce({
        name: "Old Name",
        phone: "+919999999999",
        userId: "user_1"
      });
      findUserById.mockResolvedValueOnce({
        id: "user_1",
        name: "Fresh Name From DB",
        phone: "+919999999999",
        isActive: true
      });
      tokenService.issueTokens.mockResolvedValueOnce({
        accessToken: "new-access",
        name: "Fresh Name From DB",
        phone: "+919999999999",
        refreshToken: "new-refresh",
        userId: "user_1"
      } satisfies BuyerRefreshSuccess);

      const result = await service.refreshToken({ refreshToken: "old-refresh" });

      expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith("old-refresh");
      expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith("old-refresh");
      expect(findUserById).toHaveBeenCalledWith("user_1");
      expect(result).toEqual({
        accessToken: "new-access",
        name: "Fresh Name From DB",
        phone: "+919999999999",
        refreshToken: "new-refresh",
        userId: "user_1"
      });
    });

    it("should throw UnauthorizedError for revoked refresh token", async () => {
      tokenService.verifyRefreshToken.mockRejectedValueOnce(
        new UnauthorizedError("Refresh token is invalid.")
      );

      await expect(service.refreshToken({ refreshToken: "invalid" })).rejects.toBeInstanceOf(
        UnauthorizedError
      );
    });
  });

  describe("logout", () => {
    it("should revoke refresh token in Redis", async () => {
      tokenService.revokeRefreshToken.mockResolvedValueOnce(undefined);

      await service.logout({ refreshToken: "refresh" });

      expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith("refresh");
    });
  });
});
