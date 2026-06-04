import { ValidationError } from "@gorola/shared";
import { z } from "zod";

import type {
  LogoutInput,
  RefreshTokenInput,
  SendOtpInput,
  VerifyOtpInput
} from "./auth.types.js";

const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+91\d{10}$/, "Invalid phone format")
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+91\d{10}$/, "Invalid phone format"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});

const ownerLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().regex(/^\d{6}$/, "TOTP must be 6 digits").optional()
});

const adminLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().regex(/^\d{6}$/, "TOTP must be 6 digits").optional()
});

const setup2FASchema = z.object({
  email: z.string().email("Invalid email")
});

const verify2FASchema = z.object({
  email: z.string().email("Invalid email"),
  code: z.string().regex(/^\d{6}$/, "TOTP must be 6 digits")
});

export function parseSendOtpInput(input: SendOtpInput): SendOtpInput {
  const parsed = sendOtpSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid send OTP payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseVerifyOtpInput(input: VerifyOtpInput): VerifyOtpInput {
  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid verify OTP payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseRefreshTokenInput(input: RefreshTokenInput): RefreshTokenInput {
  const parsed = refreshTokenSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid refresh token payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseLogoutInput(input: LogoutInput): LogoutInput {
  const parsed = logoutSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid logout payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseStoreOwnerLoginInput(input: {
  email: string;
  password: string;
  totpCode?: string;
}): { email: string; password: string; totpCode?: string | undefined } {
  const parsed = ownerLoginSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid store owner login payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseAdminLoginInput(input: {
  email: string;
  password: string;
  totpCode?: string;
}): { email: string; password: string; totpCode?: string | undefined } {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid admin login payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseSetup2FAInput(input: { email: string }): { email: string } {
  const parsed = setup2FASchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid 2FA setup payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseVerify2FAInput(input: { email: string; code: string }): {
  email: string;
  code: string;
} {
  const parsed = verify2FASchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid 2FA verify payload", parsed.error.flatten());
  }
  return parsed.data;
}
