export type AccountDerivedStatus = "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";

export function deriveAccountStatus(user: {
  isActive: boolean;
  isDeleted: boolean;
  deletionScheduledFor?: Date | null;
}): AccountDerivedStatus {
  if (user.deletionScheduledFor && new Date(user.deletionScheduledFor).getTime() > Date.now()) {
    return "PENDING_DELETION";
  }
  if (!user.isActive) {
    return "SUSPENDED";
  }
  return "ACTIVE";
}

export function calculateDaysRemaining(lockedUntil: Date, now: Date = new Date()): number {
  const diffMs = lockedUntil.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function maskPhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length < 4) return trimmed;
  const last4 = trimmed.slice(-4);
  return `+91 ******${last4}`;
}

export function buildLookupAuditPayload(foundLockout: boolean, foundAccount: boolean): {
  foundLockout: boolean;
  foundAccount: boolean;
} {
  return {
    foundLockout,
    foundAccount
  };
}
