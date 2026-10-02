import type { PrismaClient } from "@prisma/client";

import type { ConsentLog, ConsentPurpose, RecordConsentInput } from "./consent.types.js";

export class ConsentRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async create(input: RecordConsentInput): Promise<ConsentLog> {
    return this.prisma.consentLog.create({
      data: {
        consentVersion: input.consentVersion ?? "1.0",
        ipAddress: input.ipAddress ?? null,
        isWithdrawn: false,
        noticeText: input.noticeText,
        purpose: input.purpose,
        userAgent: input.userAgent ?? null,
        userId: input.userId,
        withdrawnAt: null
      }
    });
  }

  public async findAllByUserId(userId: string): Promise<ConsentLog[]> {
    return this.prisma.consentLog.findMany({
      orderBy: { createdAt: "desc" },
      where: { userId }
    });
  }

  public async findLatestByUserIdAndPurpose(
    userId: string,
    purpose: ConsentPurpose
  ): Promise<ConsentLog | null> {
    return this.prisma.consentLog.findFirst({
      orderBy: { createdAt: "desc" },
      where: { purpose, userId }
    });
  }

  public async withdraw(userId: string, purpose: ConsentPurpose): Promise<ConsentLog | null> {
    const existing = await this.prisma.consentLog.findFirst({
      orderBy: { createdAt: "desc" },
      where: { isWithdrawn: false, purpose, userId }
    });

    if (!existing) {
      return null;
    }

    return this.prisma.consentLog.update({
      data: {
        isWithdrawn: true,
        withdrawnAt: new Date()
      },
      where: { id: existing.id }
    });
  }

  public async withdrawAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.consentLog.updateMany({
      data: {
        isWithdrawn: true,
        withdrawnAt: new Date()
      },
      where: { isWithdrawn: false, userId }
    });
    return result.count;
  }
}
