import { CURRENT_PRIVACY_POLICY_VERSION, ValidationError } from "@gorola/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgeGateRepository } from "../../../modules/age-gate/age-gate.repository.js";
import type { AgeGateService } from "../../../modules/age-gate/age-gate.service.js";
import { AuthService, type BuyerUserLookup } from "../../../modules/auth/auth.service.js";
import type {
  AgeTicketRecord,
  BuyerRefreshSuccess,
  OtpProvider,
  RedisLikeClient,
  TokenService
} from "../../../modules/auth/auth.types.js";

type MockRedisClient = {
  del: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

describe("AuthService.confirmAge Unit (Phase 8.8.5)", () => {
  const redis: MockRedisClient = {
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn()
  };
  const tokenService = {
    issueTokens: vi.fn(),
    verifyRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn()
  };
  const ageGateService = {
    isPhoneLocked: vi.fn(),
    lockPhone: vi.fn(),
    unlockPhone: vi.fn()
  };
  const ageGateRepository = {
    createAdultBuyerWithConsents: vi.fn(),
    upsertLock: vi.fn(),
    findActiveByPhoneHash: vi.fn(),
    deleteByPhoneHash: vi.fn(),
    deleteExpired: vi.fn()
  };
  const findBuyerByPhone = vi.fn();
  const findUserById = vi.fn();

  const service = new AuthService({
    findBuyerByPhone: findBuyerByPhone as unknown as (phone: string) => Promise<BuyerUserLookup | null>,
    findUserById: findUserById as unknown as (id: string) => Promise<BuyerUserLookup | null>,
    otpProvider: {} as OtpProvider,
    otpTtlSeconds: 300,
    redis: redis as unknown as RedisLikeClient,
    tokenService: tokenService as unknown as TokenService,
    ageGateService: ageGateService as unknown as AgeGateService,
    ageGateRepository: ageGateRepository as unknown as AgeGateRepository
  });

  const rawTicket = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
  const validTicketRecord: AgeTicketRecord = {
    phone: "+919876543210",
    existingUserId: null,
    ip: "127.0.0.1",
    createdAt: new Date().toISOString()
  };

  const createdUser: BuyerUserLookup = {
    id: "created_user_1",
    name: "",
    phone: "+919876543210",
    isActive: true,
    ageConfirmedAt: new Date(),
    ageConfirmedPolicyVersion: "1.1",
    privacyPolicyVersionAccepted: "1.1"
  };

  const tokenPair: BuyerRefreshSuccess = {
    accessToken: "access-token-abc",
    refreshToken: "refresh-token-xyz",
    name: null,
    phone: "+919876543210",
    userId: "created_user_1"
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adult DOB -> createAdultBuyerWithConsents called once with canonical policy version; lockPhone zero times; tokens issued", async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(validTicketRecord));
    redis.del.mockResolvedValueOnce(1); // atomic consume success
    ageGateRepository.createAdultBuyerWithConsents.mockResolvedValueOnce(createdUser);
    tokenService.issueTokens.mockResolvedValueOnce(tokenPair);

    const result = await service.confirmAge({
      ageTicket: rawTicket,
      dateOfBirth: "1995-06-15",
      acknowledgedNotice: true,
      consentVersion: "1.1"
    }, { ipAddress: "127.0.0.1", userAgent: "Vitest" });

    expect(result).toBeDefined();
    expect(result.userId).toBe("created_user_1");
    expect(result.accessToken).toBe("access-token-abc");

    expect(ageGateRepository.createAdultBuyerWithConsents).toHaveBeenCalledTimes(1);
    expect(ageGateRepository.createAdultBuyerWithConsents).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+919876543210",
        consentVersion: CURRENT_PRIVACY_POLICY_VERSION,
        ipAddress: "127.0.0.1",
        userAgent: "Vitest"
      })
    );
    expect(ageGateService.lockPhone).not.toHaveBeenCalled();
    expect(tokenService.issueTokens).toHaveBeenCalledTimes(1);
  });

  it("missing ticket in Redis -> throws 401 AGE_TICKET_INVALID, repo and delete never called", async () => {
    redis.get.mockResolvedValueOnce(null);

    await expect(
      service.confirmAge({
        ageTicket: rawTicket,
        dateOfBirth: "1995-06-15",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "AGE_TICKET_INVALID"
    });

    expect(redis.del).not.toHaveBeenCalled();
    expect(ageGateRepository.createAdultBuyerWithConsents).not.toHaveBeenCalled();
  });

  it("invalid DOB -> throws ValidationError, ticket is NOT consumed, repo never called", async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(validTicketRecord));

    await expect(
      service.confirmAge({
        ageTicket: rawTicket,
        dateOfBirth: "2010-02-30", // Invalid calendar date
        acknowledgedNotice: true,
        consentVersion: "1.1"
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(redis.del).not.toHaveBeenCalled();
    expect(ageGateRepository.createAdultBuyerWithConsents).not.toHaveBeenCalled();
  });

  it("atomic redis.del returns 0 (ticket already consumed by concurrent request) -> throws 401 AGE_TICKET_INVALID", async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(validTicketRecord));
    redis.del.mockResolvedValueOnce(0); // lost race

    await expect(
      service.confirmAge({
        ageTicket: rawTicket,
        dateOfBirth: "1995-06-15",
        acknowledgedNotice: true,
        consentVersion: "1.1"
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "AGE_TICKET_INVALID"
    });

    expect(ageGateRepository.createAdultBuyerWithConsents).not.toHaveBeenCalled();
  });
});
