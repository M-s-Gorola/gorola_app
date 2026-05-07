import { RateLimitError, UnauthorizedError, ValidationError } from "@gorola/shared";
import { compare, hash } from "bcryptjs";

import type {
  BuyerRefreshSuccess,
  BuyerVerifySuccess,
  LogoutInput,
  OtpProvider,
  OtpStoreRecord,
  RedisLikeClient,
  RefreshTokenInput,
  SendOtpInput,
  TokenService,
  VerifyOtpInput
} from "./auth.types.js";
import { generateBuyerOtp } from "./generate-buyer-otp.js";

export type BuyerUserLookup = {
  id: string;
  name: string;
  phone: string;
};

export type AuthServiceDependencies = {
  ensureBuyerUser: (phone: string) => Promise<BuyerUserLookup>;
  findUserById: (id: string) => Promise<BuyerUserLookup | null>;
  otpProvider: OtpProvider;
  otpTtlSeconds: number;
  redis: RedisLikeClient;
  tokenService: TokenService;
};

export class AuthService {
  public constructor(private readonly deps: AuthServiceDependencies) {}

  public async sendOtp(input: SendOtpInput): Promise<void> {
    const phone = input.phone.trim();
    if (!/^\+91\d{10}$/.test(phone)) {
      throw new ValidationError("Invalid phone format");
    }

    const key = `otp:${phone}`;
    const now = Date.now();
    const existing = await this.deps.redis.get(key);
    const existingRecord = existing !== null ? (JSON.parse(existing) as OtpStoreRecord) : null;

    if (existingRecord !== null) {
      const windowStarted = new Date(existingRecord.sentWindowStartedAt).getTime();
      const withinWindow = now - windowStarted < 15 * 60 * 1000;
      if (withinWindow && existingRecord.sentCount >= 5) {
        throw new RateLimitError("Too many attempts — try in 15 minutes");
      }
    }

    const otpPlain = generateBuyerOtp();
    const hashedOtp = await hash(otpPlain, 8);
    const sentWindowStartedAt =
      existingRecord !== null &&
      now - new Date(existingRecord.sentWindowStartedAt).getTime() < 15 * 60 * 1000
        ? existingRecord.sentWindowStartedAt
        : new Date(now).toISOString();
    const sentCount =
      existingRecord !== null && sentWindowStartedAt === existingRecord.sentWindowStartedAt
        ? existingRecord.sentCount + 1
        : 1;

    const record: OtpStoreRecord = {
      attempts: 0,
      expiresAt: new Date(now + this.deps.otpTtlSeconds * 1000).toISOString(),
      hashedOtp,
      sentCount,
      sentWindowStartedAt
    };

    await this.deps.redis.set(key, JSON.stringify(record), "EX", this.deps.otpTtlSeconds);
    await this.deps.otpProvider.sendOtp(phone, otpPlain);
  }

  /** Verifies OTP, persists/fetches buyer {@link BuyerUserLookup}, issues RS256-backed tokens. */
  public async verifyOtp(input: VerifyOtpInput): Promise<BuyerVerifySuccess> {
    const key = `otp:${input.phone}`;
    const payload = await this.deps.redis.get(key);
    if (payload === null) {
      throw new UnauthorizedError("OTP not found");
    }

    const record = JSON.parse(payload) as OtpStoreRecord;
    if (record.attempts >= 3) {
      throw new RateLimitError(
        "Too many incorrect OTP attempts. Try requesting a new code."
      );
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedError("OTP expired");
    }

    const valid = await compare(input.otp, record.hashedOtp);
    if (!valid) {
      const nextAttempts = record.attempts + 1;
      const attemptsRemainingAfterThisFailure = Math.max(0, 3 - nextAttempts);
      const nextRecord: OtpStoreRecord = {
        ...record,
        attempts: nextAttempts
      };
      await this.deps.redis.set(key, JSON.stringify(nextRecord), "EX", this.deps.otpTtlSeconds);

      if (nextAttempts >= 3) {
        throw new RateLimitError(
          "Too many incorrect OTP attempts. Try requesting a new code."
        );
      }
      throw new UnauthorizedError("Invalid OTP", {
        attemptsRemaining: attemptsRemainingAfterThisFailure
      });
    }

    const user = await this.deps.ensureBuyerUser(input.phone);
    const tokens = await this.deps.tokenService.issueTokens({
      name: user.name.trim().length === 0 ? null : user.name,
      phone: user.phone,
      userId: user.id
    });
    await this.deps.redis.del(key);

    return {
      ...tokens,
      name: user.name.trim().length === 0 ? null : user.name,
      phone: user.phone,
      userId: user.id
    };
  }

  public async refreshToken(input: RefreshTokenInput): Promise<BuyerRefreshSuccess> {
    const payload = await this.deps.tokenService.verifyRefreshToken(input.refreshToken);
    await this.deps.tokenService.revokeRefreshToken(input.refreshToken);

    const user = await this.deps.findUserById(payload.userId);
    if (user === null) {
      throw new UnauthorizedError("User session no longer valid.");
    }

    return this.deps.tokenService.issueTokens({
      name: user.name.trim().length === 0 ? null : user.name,
      phone: user.phone,
      userId: user.id
    });
  }

  public async logout(input: LogoutInput): Promise<void> {
    await this.deps.tokenService.revokeRefreshToken(input.refreshToken);
  }
}
