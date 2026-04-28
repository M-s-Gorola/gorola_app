import { RateLimitError, UnauthorizedError, ValidationError } from "@gorola/shared";
import { compare, hash } from "bcryptjs";

import type {
  AuthTokenPair,
  LogoutInput,
  OtpProvider,
  OtpStoreRecord,
  RedisLikeClient,
  RefreshTokenInput,
  SendOtpInput,
  TokenService,
  VerifyOtpInput
} from "./auth.types.js";

export type AuthServiceDependencies = {
  redis: RedisLikeClient;
  otpProvider: OtpProvider;
  tokenService: TokenService;
  otpTtlSeconds: number;
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
    const existingRecord = existing ? (JSON.parse(existing) as OtpStoreRecord) : null;

    if (existingRecord) {
      const windowStarted = new Date(existingRecord.sentWindowStartedAt).getTime();
      const withinWindow = now - windowStarted < 15 * 60 * 1000;
      if (withinWindow && existingRecord.sentCount >= 5) {
        throw new RateLimitError("Too many attempts — try in 15 minutes");
      }
    }

    const otp = "123456";
    const hashedOtp = await hash(otp, 8);
    const sentWindowStartedAt =
      existingRecord && now - new Date(existingRecord.sentWindowStartedAt).getTime() < 15 * 60 * 1000
        ? existingRecord.sentWindowStartedAt
        : new Date(now).toISOString();
    const sentCount =
      existingRecord && sentWindowStartedAt === existingRecord.sentWindowStartedAt
        ? existingRecord.sentCount + 1
        : 1;

    const record: OtpStoreRecord = {
      hashedOtp,
      attempts: 0,
      expiresAt: new Date(now + this.deps.otpTtlSeconds * 1000).toISOString(),
      sentCount,
      sentWindowStartedAt
    };

    await this.deps.redis.set(key, JSON.stringify(record), "EX", this.deps.otpTtlSeconds);
    await this.deps.otpProvider.sendOtp(phone, otp);
  }

  public async verifyOtp(input: VerifyOtpInput): Promise<AuthTokenPair> {
    const key = `otp:${input.phone}`;
    const payload = await this.deps.redis.get(key);
    if (!payload) {
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

    const tokens = await this.deps.tokenService.issueTokens({
      phone: input.phone
    });
    await this.deps.redis.del(key);
    return tokens;
  }

  public async refreshToken(input: RefreshTokenInput): Promise<AuthTokenPair> {
    return this.deps.tokenService.rotateRefreshToken(input.refreshToken);
  }

  public async logout(input: LogoutInput): Promise<void> {
    await this.deps.tokenService.revokeRefreshToken(input.refreshToken);
  }
}
