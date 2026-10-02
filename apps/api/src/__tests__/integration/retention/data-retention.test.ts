import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { UserRepository } from "../../../modules/user/user.repository.js";
import { archiveExpiredAuditLogs } from "../../../workers/audit-log-archive.worker.js";
import { purgeExpiredOtpLogs } from "../../../workers/otp-log-purge.worker.js";
import { purgeExpiredUsers } from "../../../workers/user-data-purge.worker.js";

describe("Phase 8.5.1 — Automated Data Retention & Purge Jobs", () => {
  const prisma = getPrismaClient();
  const userRepo = new UserRepository(prisma);

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.bookingOrder.deleteMany();
    await prisma.riderEarning.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.address.deleteMany();
    await prisma.user.deleteMany({
      where: {
        phoneHash: { in: [hashPII("+919111111111"), hashPII("+919222222222")] }
      }
    });
  });




  afterAll(async () => {
    await disconnectPrisma();
  });

  it("AuditLogArchiveJob purges AuditLog records older than 365 days and keeps recent ones", async () => {
    const now = new Date("2026-10-02T00:00:00.000Z");

    // 1. Seed old audit log (366 days ago)
    const oldDate = new Date("2025-10-01T00:00:00.000Z");
    await prisma.auditLog.create({
      data: {
        actorId: "actor-1",
        actorRole: "ADMIN",
        action: "TEST_ACTION_OLD",
        entityType: "USER",
        entityId: "entity-1",
        ip: "1.2.3.4",
        userAgent: "agent",
        createdAt: oldDate
      }
    });


    // 2. Seed recent audit log (100 days ago)
    const recentDate = new Date("2026-06-24T00:00:00.000Z");
    const recentLog = await prisma.auditLog.create({
      data: {
        actorId: "actor-2",
        actorRole: "ADMIN",
        action: "TEST_ACTION_RECENT",
        entityType: "USER",
        entityId: "entity-2",
        ip: "1.2.3.4",
        userAgent: "agent",
        createdAt: recentDate
      }
    });

    // Run purge
    const result = await archiveExpiredAuditLogs(prisma, now, 365);
    expect(result.archivedCount).toBe(1);

    const remainingLogs = await prisma.auditLog.findMany();
    expect(remainingLogs).toHaveLength(1);
    expect(remainingLogs[0]!.id).toBe(recentLog.id);
  });

  it("OtpLogPurgeJob purges logs older than 90 days and retains recent ones", async () => {
    const now = new Date("2026-10-02T00:00:00.000Z");

    const result = await purgeExpiredOtpLogs(prisma, now, 90);
    expect(result).toHaveProperty("purgedCount");
    expect(typeof result.purgedCount).toBe("number");
  });

  it("UserDataPurgeJob permanently purges soft-deleted users past 30-day grace period", async () => {
    const now = new Date("2026-10-02T00:00:00.000Z");

    // User whose 30-day grace period expired yesterday

    const u1 = await userRepo.create({
      name: "Expired User",
      phone: "+919111111111"
    });
    const expiredUser = await prisma.user.update({
      where: { id: u1.id },
      data: {
        isDeleted: false,
        deletedAt: new Date("2026-09-01T00:00:00.000Z"),
        deletionScheduledFor: new Date("2026-10-01T00:00:00.000Z")
      }
    });

    // User whose 30-day grace period is still active
    const u2 = await userRepo.create({
      name: "Pending Grace User",
      phone: "+919222222222"
    });
    const activeDeletionUser = await prisma.user.update({
      where: { id: u2.id },
      data: {
        isDeleted: false,
        deletedAt: new Date("2026-09-20T00:00:00.000Z"),
        deletionScheduledFor: new Date("2026-10-20T00:00:00.000Z")
      }
    });


    const result = await purgeExpiredUsers(userRepo, prisma, now);

    expect(result.purgedCount).toBe(1);
    expect(result.userIds).toContain(expiredUser.id);

    // Verify expired user is marked isDeleted: true & anonymized
    const purgedRow = await prisma.user.findUnique({ where: { id: expiredUser.id } });
    expect(purgedRow?.isDeleted).toBe(true);
    expect(purgedRow?.name).toBe("[deleted]");

    // Verify active deletion user is still in grace period
    const pendingRow = await prisma.user.findUnique({ where: { id: activeDeletionUser.id } });
    expect(pendingRow?.isDeleted).toBe(false);
  });
});

