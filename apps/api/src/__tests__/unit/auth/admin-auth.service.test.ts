import { RateLimitError, UnauthorizedError } from "@gorola/shared";
import { hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAuthService } from "../../../modules/auth/admin-auth.service.js";

type Admin = {
  email: string;
  id: string;
  passwordHash: string;
  totpSecret: string | null;
};

describe("AdminAuthService", () => {
  const redis = {
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn()
  };
  const tokenService = {
    issueTokens: vi.fn()
  };
  const adminRepository = {
    findByEmail: vi.fn(),
    updateTotpSecret: vi.fn()
  };
  const totpProvider = {
    generateSecret: vi.fn(),
    keyUri: vi.fn(),
    verify: vi.fn()
  };

  const service = new AdminAuthService({
    adminRepository,
    redis,
    tokenService,
    totpProvider
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T09:00:00.000Z"));
  });

  describe("login", () => {
    it("should login with correct email/password and valid totp code", async () => {
      const passwordHash = await hash("Admin#123", 8);
      const admin: Admin = {
        email: "admin@gorola.in",
        id: "admin-1",
        passwordHash,
        totpSecret: "base32secret"
      };
      adminRepository.findByEmail.mockResolvedValueOnce(admin);
      redis.get.mockResolvedValueOnce(null);
      totpProvider.verify.mockReturnValueOnce(true);
      tokenService.issueTokens.mockResolvedValueOnce({
        accessToken: "admin-access",
        refreshToken: "admin-refresh"
      });

      const result = await service.login({
        email: "admin@gorola.in",
        password: "Admin#123",
        totpCode: "123456"
      });

      expect(result).toEqual({
        accessToken: "admin-access",
        refreshToken: "admin-refresh"
      });
    });

    it("should throw same UnauthorizedError for wrong password and unknown email", async () => {
      const passwordHash = await hash("Admin#123", 8);
      adminRepository.findByEmail.mockResolvedValueOnce({
        email: "admin@gorola.in",
        id: "admin-1",
        passwordHash,
        totpSecret: "base32secret"
      } satisfies Admin);
      redis.get.mockResolvedValueOnce(null);

      await expect(
        service.login({
          email: "admin@gorola.in",
          password: "wrong-pass",
          totpCode: "123456"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);

      adminRepository.findByEmail.mockResolvedValueOnce(null);
      redis.get.mockResolvedValueOnce(null);
      await expect(
        service.login({
          email: "missing@gorola.in",
          password: "anything",
          totpCode: "123456"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("should throw RateLimitError after 10 failed attempts in 15 minutes", async () => {
      redis.get.mockResolvedValueOnce(
        JSON.stringify({
          count: 10,
          windowStartedAt: "2026-04-22T08:50:00.000Z"
        })
      );

      await expect(
        service.login({
          email: "admin@gorola.in",
          password: "Admin#123",
          totpCode: "123456"
        })
      ).rejects.toBeInstanceOf(RateLimitError);
    });

    it("should require totp code always by returning requiresTwoFactor", async () => {
      const passwordHash = await hash("Admin#123", 8);
      adminRepository.findByEmail.mockResolvedValueOnce({
        email: "admin@gorola.in",
        id: "admin-1",
        passwordHash,
        totpSecret: "base32secret"
      } satisfies Admin);
      redis.get.mockResolvedValueOnce(null);

      const result = await service.login({
        email: "admin@gorola.in",
        password: "Admin#123"
      });
      expect(result).toEqual({ requiresTwoFactor: true });
    });

    it("should throw UnauthorizedError for wrong totp code", async () => {
      const passwordHash = await hash("Admin#123", 8);
      adminRepository.findByEmail.mockResolvedValueOnce({
        email: "admin@gorola.in",
        id: "admin-1",
        passwordHash,
        totpSecret: "base32secret"
      } satisfies Admin);
      redis.get.mockResolvedValueOnce(null);
      totpProvider.verify.mockReturnValueOnce(false);

      await expect(
        service.login({
          email: "admin@gorola.in",
          password: "Admin#123",
          totpCode: "000000"
        })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe("setup2FA", () => {
    it("should generate totp secret and qr code uri", async () => {
      adminRepository.findByEmail.mockResolvedValueOnce({
        email: "admin@gorola.in",
        id: "admin-1",
        passwordHash: "hash",
        totpSecret: null
      } satisfies Admin);
      totpProvider.generateSecret.mockReturnValueOnce("admin-secret");
      totpProvider.keyUri.mockReturnValueOnce("otpauth://totp/GoRola:admin@gorola.in");

      const result = await service.setup2FA({
        email: "admin@gorola.in"
      });

      expect(result).toEqual({
        qrCodeUri: "otpauth://totp/GoRola:admin@gorola.in",
        secret: "admin-secret"
      });
      expect(adminRepository.updateTotpSecret).toHaveBeenCalledWith("admin-1", "admin-secret");
    });
  });

  describe("verify2FA", () => {
    it("should succeed with valid totp code for existing secret", async () => {
      adminRepository.findByEmail.mockResolvedValueOnce({
        email: "admin@gorola.in",
        id: "admin-1",
        passwordHash: "hash",
        totpSecret: "admin-secret"
      } satisfies Admin);
      totpProvider.verify.mockReturnValueOnce(true);

      await service.verify2FA({
        code: "123456",
        email: "admin@gorola.in"
      });

      expect(totpProvider.verify).toHaveBeenCalledWith({
        code: "123456",
        secret: "admin-secret"
      });
    });
  });

  describe("refreshToken", () => {
    it("should issue new tokens and delete old refresh token if valid", async () => {
      redis.get.mockResolvedValueOnce(
        JSON.stringify({ role: "ADMIN", userId: "admin-1" })
      );
      tokenService.issueTokens.mockResolvedValueOnce({
        accessToken: "new-access",
        refreshToken: "new-refresh"
      });

      const result = await service.refreshToken({ refreshToken: "old-refresh" });

      expect(redis.get).toHaveBeenCalledWith("rt:admin:old-refresh");
      expect(redis.del).toHaveBeenCalledWith("rt:admin:old-refresh");
      expect(tokenService.issueTokens).toHaveBeenCalledWith({
        role: "ADMIN",
        sub: "admin-1"
      });
      expect(result).toEqual({
        accessToken: "new-access",
        refreshToken: "new-refresh"
      });
    });

    it("should throw UnauthorizedError if refresh token not found in redis", async () => {
      redis.get.mockResolvedValueOnce(null);

      await expect(
        service.refreshToken({ refreshToken: "missing-refresh" })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("logout", () => {
    it("should delete refresh token from redis", async () => {
      await service.logout({ refreshToken: "token-to-revoke" });
      expect(redis.del).toHaveBeenCalledWith("rt:admin:token-to-revoke");
    });
  });
});
