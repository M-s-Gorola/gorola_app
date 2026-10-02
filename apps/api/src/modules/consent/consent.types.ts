import type { ConsentLog } from "@prisma/client";

export type { ConsentLog };

export type ConsentPurpose =
  | "OTP_AUTH"
  | "ORDER_PROCESSING"
  | "MARKETING_COMMS"
  | "ANALYTICS";

export type RecordConsentInput = {
  userId: string;
  purpose: ConsentPurpose;
  consentVersion?: string | undefined;
  noticeText: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
};

export type ConsentDTO = {
  id: string;
  userId: string;
  purpose: ConsentPurpose;
  consentVersion: string;
  noticeText: string;
  isWithdrawn: boolean;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
};
