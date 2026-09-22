import { z } from "zod";

export const consentPurposeEnum = z.enum([
  "OTP_AUTH",
  "ORDER_PROCESSING",
  "MARKETING_EMAIL",
  "ANALYTICS"
]);

export const recordConsentBodySchema = z.object({
  consentVersion: z.string().min(1).default("1.0").optional(),
  noticeText: z.string().min(1, "noticeText is required"),
  purpose: consentPurposeEnum
});

export const withdrawConsentParamsSchema = z.object({
  purpose: consentPurposeEnum
});

export type RecordConsentBody = z.infer<typeof recordConsentBodySchema>;
export type WithdrawConsentParams = z.infer<typeof withdrawConsentParamsSchema>;
