import { ConflictError, CONSENT_NOTICES } from "@gorola/shared";
import type { AgeGateLockout, PrismaClient, User } from "@prisma/client";

import { decryptPII, encryptPII, hashPII } from "../../lib/crypto.js";
import { getPrismaClient } from "../../lib/prisma.js";

export type CreateAdultBuyerInput = {
  phone: string;
  consentVersion: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  now?: Date | undefined;
};

export class AgeGateRepository {
  public constructor(private readonly customDb?: PrismaClient) {}

  private get db(): PrismaClient {
    return this.customDb ?? getPrismaClient();
  }

  async upsertLock(phoneHash: string, lockedUntil: Date): Promise<AgeGateLockout> {
    return this.db.ageGateLockout.upsert({
      where: { phoneHash },
      create: {
        phoneHash,
        lockedUntil,
        strikeCount: 1
      },
      update: {
        lockedUntil,
        strikeCount: { increment: 1 }
      }
    });
  }

  async findActiveByPhoneHash(
    phoneHash: string,
    now: Date = new Date()
  ): Promise<AgeGateLockout | null> {
    return this.db.ageGateLockout.findFirst({
      where: {
        phoneHash,
        lockedUntil: { gt: now }
      }
    });
  }

  async deleteByPhoneHash(phoneHash: string): Promise<number> {
    const result = await this.db.ageGateLockout.deleteMany({
      where: { phoneHash }
    });
    return result.count;
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db.ageGateLockout.deleteMany({
      where: {
        lockedUntil: { lte: now }
      }
    });
    return result.count;
  }

  async createAdultBuyerWithConsents(input: CreateAdultBuyerInput): Promise<User> {
    const normalized = input.phone.trim();
    const encryptedPhone = encryptPII(normalized);
    const phoneHash = hashPII(normalized);
    const now = input.now ?? new Date();

    const otpAuthText =
      CONSENT_NOTICES.OTP_AUTH[input.consentVersion as keyof typeof CONSENT_NOTICES.OTP_AUTH] ??
      CONSENT_NOTICES.OTP_AUTH["1.1"];
    const ageDeclarationText =
      CONSENT_NOTICES.AGE_DECLARATION[
        input.consentVersion as keyof typeof CONSENT_NOTICES.AGE_DECLARATION
      ] ?? CONSENT_NOTICES.AGE_DECLARATION["1.1"];

    try {
      const user = await this.db.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            phone: encryptedPhone,
            phoneHash,
            name: "",
            isVerified: true,
            ageConfirmedAt: now,
            ageConfirmedPolicyVersion: input.consentVersion,
            privacyPolicyVersionAccepted: input.consentVersion
          }
        });

        await tx.consentLog.createMany({
          data: [
            {
              userId: createdUser.id,
              purpose: "OTP_AUTH",
              consentVersion: input.consentVersion,
              noticeText: otpAuthText,
              ipAddress: input.ipAddress ?? null,
              userAgent: input.userAgent ?? null
            },
            {
              userId: createdUser.id,
              purpose: "AGE_DECLARATION",
              consentVersion: input.consentVersion,
              noticeText: ageDeclarationText,
              ipAddress: input.ipAddress ?? null,
              userAgent: input.userAgent ?? null
            }
          ]
        });

        await tx.auditLog.create({
          data: {
            actorId: createdUser.id,
            actorRole: "BUYER",
            action: "AGE_CONFIRMED",
            entityType: "USER",
            entityId: createdUser.id,
            newValue: {
              ageConfirmedAt: now.toISOString(),
              ageConfirmedPolicyVersion: input.consentVersion,
              privacyPolicyVersionAccepted: input.consentVersion
            },
            ip: input.ipAddress ?? "unknown",
            userAgent: input.userAgent ?? "unknown"
          }
        });

        return createdUser;
      });

      return {
        ...user,
        phone: decryptPII(user.phone)
      };
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ConflictError("User with this phone already exists", { field: "phone" }, error);
      }
      throw error;
    }
  }

  async confirmAdultLegacyBuyer(input: ConfirmAdultLegacyBuyerInput): Promise<User> {
    const now = input.now ?? new Date();
    const ageDeclarationText =
      CONSENT_NOTICES.AGE_DECLARATION[
        input.consentVersion as keyof typeof CONSENT_NOTICES.AGE_DECLARATION
      ] ?? CONSENT_NOTICES.AGE_DECLARATION["1.1"];

    const updatedUser = await this.db.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: input.userId },
        data: {
          ageConfirmedAt: now,
          ageConfirmedPolicyVersion: input.consentVersion,
          privacyPolicyVersionAccepted: input.consentVersion
        }
      });

      await tx.consentLog.create({
        data: {
          userId: input.userId,
          purpose: "AGE_DECLARATION",
          consentVersion: input.consentVersion,
          noticeText: ageDeclarationText,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          actorRole: "BUYER",
          action: "AGE_CONFIRMED",
          entityType: "USER",
          entityId: input.userId,
          newValue: {
            ageConfirmedAt: now.toISOString(),
            ageConfirmedPolicyVersion: input.consentVersion,
            privacyPolicyVersionAccepted: input.consentVersion
          },
          ip: input.ipAddress ?? "unknown",
          userAgent: input.userAgent ?? "unknown"
        }
      });

      return u;
    });

    return {
      ...updatedUser,
      phone: decryptPII(updatedUser.phone)
    };
  }
}

export type ConfirmAdultLegacyBuyerInput = {
  userId: string;
  consentVersion: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  now?: Date | undefined;
};

export const ageGateRepository = new AgeGateRepository();


