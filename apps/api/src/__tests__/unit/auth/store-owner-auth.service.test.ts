import { RateLimitError, UnauthorizedError } from "@gorola/shared";
import { hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StoreOwnerAuthService } from "../../../modules/auth/store-owner-auth.service.js";

type StoreOwner = {
  email: string;
  id: string;
  passwordHash: string;
  storeId: string;
  totpEnabled: boolean;
  totpSecret: string | null;
};

describe("StoreOwnerAuthService", () => {
  const redis = {
    get: vi.fn(),
    set: vi.fn()
  };
  const tokenService = {
    issueTokens: vi.fn()
  };
  const storeOwnerRepository = {
    findByEmail: vi.fn(),
    update: vi.fn()
  };
  const totpProvider = {
    generateSecret: vi.fn(),
    keyUri: vi.fn(),
    verify: vi.fn()
  };

  const service = new StoreOwnerAuthService({
    redis,
    storeOwnerRepository,
    tokenService,
    totpProvider
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T08:00:00.000Z"));
  });

  describe("login", () => {
    it("should login with correct email and password when 2FA disabled", async () => {
      const passwordHash = await hash("Password#123", 8);
      const owner: StoreOwner = {
        email: "owner@gorola.in",
        id: "owner-1",
        passwordHash,
        storeId: "store-1",
        totpEnabled: false,
        totpSecret: null
      };
      storeOwnerRepository.findByEmail.mockResolvedValueOnce(owner);
      tokenService.issueTokens.mockResolvedValueOnce({
        accessToken: "access",
        refreshToken: "refresh"
      });
      redis.get.mockResolvedValueOnce(null);

      const result = await service.login({
        email: "owner@gorola.in",
        password: "Password#123"
      });

      expect(result).toEqual({
        accessToken: "access",
        refreshToken: "refresh"
      });
    });

    it("should throw same UnauthorizedError for wrong password or unknown email", async () => {
      const passwordHash = await hash("Password#123", 8);
      const owner: StoreOwner = {
        email: "owner@gorola.in",
        id: "owner-1",
        passwordHash,
        storeId: "store-1",
        totpEnabled: false,
        totpSecret: null
      };
      storeOwnerRepository.findByEmail.mockResolvedValueOnce(owner);
      redis.get.mockResolvedValueOnce(null);

      await expect(
        service.login({
          email: "owner@gorola.in",
          password: "wrong-pass"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);

      storeOwnerRepository.findByEmail.mockResolvedValueOnce(null);
      redis.get.mockResolvedValueOnce(null);

      await expect(
        service.login({
          email: "missing@gorola.in",
          password: "whatever"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("should throw RateLimitError after 10 failed attempts in 15min", async () => {
      redis.get.mockResolvedValueOnce(
        JSON.stringify({
          count: 10,
          windowStartedAt: "2026-04-22T07:50:00.000Z"
        })
      );

      await expect(
        service.login({
          email: "owner@gorola.in",
          password: "Password#123"
        })
      ).rejects.toBeInstanceOf(RateLimitError);
    });

    it("should return requiresTwoFactor: true when 2FA is enabled and no totpCode is provided", async () => {
      const passwordHash = await hash("Password#123", 8);
      const owner: StoreOwner = {
        email: "owner@gorola.in",
        id: "owner-1",
        passwordHash,
        storeId: "store-1",
        totpEnabled: true,
        totpSecret: "secret"
      };
      storeOwnerRepository.findByEmail.mockResolvedValueOnce(owner);
      redis.get.mockResolvedValueOnce(null);

      const result = await service.login({
        email: "owner@gorola.in",
        password: "Password#123"
      });
      expect(result).toEqual({ requiresTwoFactor: true });
    });

    it("should throw UnauthorizedError for wrong totp code", async () => {
      const passwordHash = await hash("Password#123", 8);
      const owner: StoreOwner = {
        email: "owner@gorola.in",
        id: "owner-1",
        passwordHash,
        storeId: "store-1",
        totpEnabled: true,
        totpSecret: "secret"
      };
      storeOwnerRepository.findByEmail.mockResolvedValueOnce(owner);
      redis.get.mockResolvedValueOnce(null);
      totpProvider.verify.mockReturnValueOnce(false);

      await expect(
        service.login({
          email: "owner@gorola.in",
          password: "Password#123",
          totpCode: "123456"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe("setup2FA", () => {
    it("should generate totp secret and qr uri", async () => {
      storeOwnerRepository.findByEmail.mockResolvedValueOnce({
        email: "owner@gorola.in",
        id: "owner-1",
        passwordHash: "hash",
        storeId: "store-1",
        totpEnabled: false,
        totpSecret: null
      });
      totpProvider.generateSecret.mockReturnValueOnce("new-secret");
      totpProvider.keyUri.mockReturnValueOnce("otpauth://totp/GoRola:owner@gorola.in");

      const result = await service.setup2FA({
        email: "owner@gorola.in"
      });

      expect(result).toEqual({
        qrCodeUri: "otpauth://totp/GoRola:owner@gorola.in",
        secret: "new-secret"
      });
      expect(storeOwnerRepository.update).toHaveBeenCalled();
    });
  });

  describe("verify2FA", () => {
    it("should enable 2FA with correct totp code", async () => {
      storeOwnerRepository.findByEmail.mockResolvedValueOnce({
        email: "owner@gorola.in",
        id: "owner-1",
        passwordHash: "hash",
        storeId: "store-1",
        totpEnabled: false,
        totpSecret: "new-secret"
      });
      totpProvider.verify.mockReturnValueOnce(true);
      storeOwnerRepository.update.mockResolvedValueOnce(undefined);

      await service.verify2FA({
        code: "123456",
        email: "owner@gorola.in"
      });

      expect(storeOwnerRepository.update).toHaveBeenCalledWith("owner-1", {
        totpEnabled: true
      });
    });
  });
});
