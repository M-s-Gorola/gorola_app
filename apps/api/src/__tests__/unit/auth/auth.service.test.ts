import fs from "node:fs";
import path from "node:path";

import { RateLimitError, UnauthorizedError, ValidationError } from "@gorola/shared";
import { hash } from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgeGateService } from "../../../modules/age-gate/age-gate.service.js";
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

type MockAgeGateService = {
  isPhoneLocked: ReturnType<typeof vi.fn>;
  lockPhone: ReturnType<typeof vi.fn>;
  unlockPhone: ReturnType<typeof vi.fn>;
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
  const ageGateService: MockAgeGateService = {
    isPhoneLocked: vi.fn(),
    lockPhone: vi.fn(),
    unlockPhone: vi.fn()
  };
  const findBuyerByPhone = vi.fn();
  const findUserById = vi.fn();

  const service = new AuthService({
    findBuyerByPhone: findBuyerByPhone as unknown as (phone: string) => Promise<BuyerUserLookup | null>,
    findUserById: findUserById as unknown as (id: string) => Promise<BuyerUserLookup | null>,
    otpProvider: otpProvider as unknown as OtpProvider,
    otpTtlSeconds: 300,
    redis: redis as unknown as RedisLikeClient,
    tokenService: tokenService as unknown as TokenService,
    ageGateService: ageGateService as unknown as AgeGateService
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T08:00:00.000Z"));
    process.env.GOROLA_TEST_OTP = "123456";
    ageGateService.isPhoneLocked.mockResolvedValue(false);
    findBuyerByPhone.mockResolvedValue({
      id: "user_test_1",
      name: "",
      phone: "+919876543210",
      isActive: true,
      ageConfirmedAt: new Date("2026-01-01T00:00:00Z"),
      ageConfirmedPolicyVersion: "1.1"
    });
    findUserById.mockResolvedValue({
      id: "user_test_1",
      name: "Latest Name",
      phone: "+919876543210",
      isActive: true,
      ageConfirmedAt: new Date("2026-01-01T00:00:00Z"),
      ageConfirmedPolicyVersion: "1.1"
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

      expect(ageGateService.isPhoneLocked).toHaveBeenCalledWith("+919876543210");
      expect(otpProvider.sendOtp).toHaveBeenCalledWith("+919876543210", "123456");
      expect(redis.set).toHaveBeenCalledWith(
        "otp:+919876543210",
        expect.any(String),
        "EX",
        300
      );
    });

    it("should throw 403 AGE_GATE_LOCKED when phone is locked by age gate", async () => {
      ageGateService.isPhoneLocked.mockResolvedValueOnce(true);

      await expect(service.sendOtp({ phone: "+919876543210" })).rejects.toMatchObject({
        statusCode: 403,
        code: "AGE_GATE_LOCKED"
      });

      expect(otpProvider.sendOtp).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it("should throw RateLimitError after 5 attempts in 15 minutes", async () => {
      const payload: OtpStoreRecord = {
        attempts: 0,
        expiresAt: "2026-04-21T08:05:00.000Z",
        hashedOtp: "mock_hash",
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
    });
  });

  describe("verifyOtp", () => {
    it("should verify OTP, delete key, and complete login for existing adult user", async () => {
      const validOtpHash = await hash("123456", 8);
      const tokenPair: BuyerRefreshSuccess = {
        accessToken: "access-token-123",
        refreshToken: "refresh-token-123",
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

      expect(findBuyerByPhone).toHaveBeenCalledWith("+919876543210");
      expect(tokenService.issueTokens).toHaveBeenCalledWith({
        name: null,
        phone: "+919876543210",
        userId: "user_test_1"
      });
      expect(result).toEqual({
        ...tokenPair,
        name: null,
        phone: "+919876543210",
        userId: "user_test_1",
        isPendingDeletion: false,
        deletionScheduledFor: null
      });
      expect(redis.del).toHaveBeenCalledWith("otp:+919876543210");
    });

    it("should return ageGateRequired: true and ageTicket when user is null (new phone)", async () => {
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
      findBuyerByPhone.mockResolvedValueOnce(null);

      const result = await service.verifyOtp({
        otp: "123456",
        phone: "+919876543210"
      });

      expect(result).toEqual({
        ageGateRequired: true,
        ageTicket: expect.stringMatching(/^[a-f0-9]{64}$/)
      });
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith("otp:+919876543210");
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^age_ticket:[a-f0-9]{64}$/),
        expect.any(String),
        "EX",
        600
      );
    });

    it("should return isPendingDeletion: true and deletionScheduledFor when user is in 30-day grace period", async () => {
      const validOtpHash = await hash("123456", 8);
      const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      findBuyerByPhone.mockResolvedValueOnce({
        id: "user_pending_1",
        name: "Pending User",
        phone: "+919876543210",
        isActive: true,
        ageConfirmedAt: new Date(),
        deletedAt: new Date(),
        deletionScheduledFor: scheduledDate
      });
      const tokenPair: BuyerRefreshSuccess = {
        accessToken: "access-token-pending",
        refreshToken: "refresh-token-pending",
        name: "Pending User",
        phone: "+919876543210",
        userId: "user_pending_1"
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

      if ("isPendingDeletion" in result) {
        expect(result.isPendingDeletion).toBe(true);
        expect(result.deletionScheduledFor).toBe(scheduledDate.toISOString());
      }
    });

    it("should throw UnauthorizedError when OTP does not exist in Redis", async () => {
      redis.get.mockResolvedValueOnce(null);

      await expect(
        service.verifyOtp({
          otp: "123456",
          phone: "+919876543210"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("should throw RateLimitError when 3 attempts have already been made", async () => {
      const payload: OtpStoreRecord = {
        attempts: 3,
        expiresAt: "2026-04-21T08:05:00.000Z",
        hashedOtp: "mock_hash",
        sentCount: 1,
        sentWindowStartedAt: "2026-04-21T08:00:00.000Z"
      };
      redis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await expect(
        service.verifyOtp({
          otp: "123456",
          phone: "+919876543210"
        })
      ).rejects.toBeInstanceOf(RateLimitError);
    });

    it("should increment attempts and throw UnauthorizedError on wrong OTP", async () => {
      const validOtpHash = await hash("999999", 8);
      const payload: OtpStoreRecord = {
        attempts: 1,
        expiresAt: "2026-04-21T08:05:00.000Z",
        hashedOtp: validOtpHash,
        sentCount: 1,
        sentWindowStartedAt: "2026-04-21T08:00:00.000Z"
      };
      redis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await expect(
        service.verifyOtp({
          otp: "123456",
          phone: "+919876543210"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);

      expect(redis.set).toHaveBeenCalledWith(
        "otp:+919876543210",
        expect.stringContaining('"attempts":2'),
        "EX",
        300
      );
    });

    it("should throw RateLimitError on the 3rd failed attempt", async () => {
      const validOtpHash = await hash("999999", 8);
      const payload: OtpStoreRecord = {
        attempts: 2,
        expiresAt: "2026-04-21T08:05:00.000Z",
        hashedOtp: validOtpHash,
        sentCount: 1,
        sentWindowStartedAt: "2026-04-21T08:00:00.000Z"
      };
      redis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await expect(
        service.verifyOtp({
          otp: "123456",
          phone: "+919876543210"
        })
      ).rejects.toBeInstanceOf(RateLimitError);
    });
  });

  describe("Architectural Guard: No ensureBuyerUser in auth.service.ts", () => {
    it("auth.service.ts source code does not contain ensureBuyerUser or ensureBuyerByPhone", () => {
      const serviceFilePath = path.resolve(__dirname, "../../../modules/auth/auth.service.ts");
      const content = fs.readFileSync(serviceFilePath, "utf8");
      expect(content).not.toContain("ensureBuyerUser");
      expect(content).not.toContain("ensureBuyerByPhone");
    });
  });
});
