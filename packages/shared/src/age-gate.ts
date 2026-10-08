export const MINIMUM_AGE_YEARS = 18;
export const CURRENT_PRIVACY_POLICY_VERSION = "1.1";
export const GRIEVANCE_EMAIL = "privacy@gorola.in";
export const SUPPORT_EMAIL = "support@gorola.in";

export type AdminAgeGateLockoutDto = {
  id: string;
  createdAt: string;
  lockedUntil: string;
  strikeCount: number;
  isActive: boolean;
  daysRemaining: number;
};

export type AdminAgeGateAccountDto = {
  id: string;
  name: string | null;
  maskedPhone: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";
  createdAt: string;
  ageConfirmedAt: string | null;
  ordersCount: number;
};

export type AgeGateLookupResult = {
  lockout: AdminAgeGateLockoutDto | null;
  account: AdminAgeGateAccountDto | null;
};

export type AgeGateLockoutListItem = {
  id: string;
  createdAt: string;
  lockedUntil: string;
  strikeCount: number;
  isActive: boolean;
};

export type AgeGateLockoutSummary = {
  activeCount: number;
  createdLast7Days: number;
};

export type AgeGateLockoutList = {
  items: AgeGateLockoutListItem[];
  summary: AgeGateLockoutSummary;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
