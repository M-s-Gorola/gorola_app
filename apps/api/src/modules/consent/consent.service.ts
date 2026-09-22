import { AppError } from "@gorola/shared";

import type { AuditRepository } from "../audit/audit.repository.js";
import type { ConsentRepository } from "./consent.repository.js";
import type { ConsentDTO, ConsentLog, ConsentPurpose, RecordConsentInput } from "./consent.types.js";

const ESSENTIAL_PURPOSES: ReadonlySet<ConsentPurpose> = new Set([
  "OTP_AUTH",
  "ORDER_PROCESSING"
]);

export function formatConsentDTO(c: ConsentLog): ConsentDTO {
  return {
    consentVersion: c.consentVersion,
    createdAt: c.createdAt.toISOString(),
    id: c.id,
    isWithdrawn: c.isWithdrawn,
    noticeText: c.noticeText,
    purpose: c.purpose,
    updatedAt: c.updatedAt.toISOString(),
    userId: c.userId,
    withdrawnAt: c.withdrawnAt?.toISOString() ?? null
  };
}

export class ConsentService {
  public constructor(
    private readonly consentRepo: ConsentRepository,
    private readonly auditRepo?: AuditRepository
  ) {}

  public async recordConsent(input: RecordConsentInput): Promise<ConsentDTO> {
    const record = await this.consentRepo.create(input);

    if (this.auditRepo) {
      try {
        await this.auditRepo.create({
          action: "CONSENT_GIVEN",
          actorId: input.userId,
          actorRole: "BUYER",
          entityId: record.id,
          entityType: "ConsentLog",
          ip: input.ipAddress ?? "unknown",
          newValue: {
            consentVersion: record.consentVersion,
            purpose: record.purpose
          },
          userAgent: input.userAgent ?? "unknown"
        });
      } catch {
        // Audit log failures should not block critical consent recording
      }
    }

    return formatConsentDTO(record);
  }

  public async getUserConsents(userId: string): Promise<ConsentDTO[]> {
    const records = await this.consentRepo.findAllByUserId(userId);
    return records.map(formatConsentDTO);
  }

  public async withdrawConsent(params: {
    userId: string;
    purpose: ConsentPurpose;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ConsentDTO | null> {
    if (ESSENTIAL_PURPOSES.has(params.purpose)) {
      throw new AppError(`Cannot withdraw essential consent for purpose: ${params.purpose}`, {
        code: "CANNOT_WITHDRAW_ESSENTIAL_CONSENT",
        statusCode: 400
      });
    }

    const updated = await this.consentRepo.withdraw(params.userId, params.purpose);

    if (updated && this.auditRepo) {
      try {
        await this.auditRepo.create({
          action: "CONSENT_WITHDRAWN",
          actorId: params.userId,
          actorRole: "BUYER",
          entityId: updated.id,
          entityType: "ConsentLog",
          ip: params.ipAddress ?? "unknown",
          newValue: {
            isWithdrawn: true,
            purpose: params.purpose,
            withdrawnAt: updated.withdrawnAt?.toISOString()
          },
          userAgent: params.userAgent ?? "unknown"
        });
      } catch {
        // Non-blocking audit error
      }
    }

    return updated ? formatConsentDTO(updated) : null;
  }
}
