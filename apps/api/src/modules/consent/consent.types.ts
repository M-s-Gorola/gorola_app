import type { ConsentLog, ConsentPurpose } from "@prisma/client";

export type { ConsentLog, ConsentPurpose };

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
