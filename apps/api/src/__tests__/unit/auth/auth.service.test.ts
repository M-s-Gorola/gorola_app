import { RateLimitError, UnauthorizedError, ValidationError } from "@gorola/shared";
import { hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "../../../modules/auth/auth.service.js";
import type { AuthTokenPair, OtpStoreRecord } from "../../../modules/auth/auth.types.js";

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
  rotateRefreshToken: ReturnType<typeof vi.fn>;
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
    rotateRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn()
  };

  const service = new AuthService({
    otpProvider,
    otpTtlSeconds: 300,
    redis,
    tokenService
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T08:00:00.000Z"));
  });

  describe("sendOtp", () => {
    it("should send OTP, hash it, and store in Redis with TTL", async () => {
      redis.get.mockResolvedValueOnce(null);
      otpProvider.sendOtp.mockResolvedValueOnce(undefined);

      await service.sendOtp({ phone: "+919876543210" });

      expect(otpProvider.sendOtp).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        "otp:+919876543210",
        expect.any(String),
        "EX",
        300
      );
    });

    it("should throw RateLimitError after 5 attempts in 15 minutes", async () => {
      const payload: OtpStoreRecord = {
        attempts: 5,
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
    it("should return tokens when OTP is valid", async () => {
      const validOtpHash = await hash("123456", 8);
      const tokenPair: AuthTokenPair = {
        accessToken: "access-token",
        refreshToken: "refresh-token"
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

      expect(result).toEqual(tokenPair);
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
    it("should issue new access and rotated refresh tokens", async () => {
      tokenService.rotateRefreshToken.mockResolvedValueOnce({
        accessToken: "new-access",
        refreshToken: "new-refresh"
      } satisfies AuthTokenPair);

      const result = await service.refreshToken({ refreshToken: "old-refresh" });

      expect(result).toEqual({
        accessToken: "new-access",
        refreshToken: "new-refresh"
      });
    });

    it("should throw UnauthorizedError for revoked refresh token", async () => {
      tokenService.rotateRefreshToken.mockRejectedValueOnce(
        new UnauthorizedError("Refresh token is revoked.")
      );

      await expect(service.refreshToken({ refreshToken: "revoked" })).rejects.toBeInstanceOf(
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
