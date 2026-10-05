import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { purgeExpiredAgeGateLockouts } from "../../../workers/age-gate-lockout-purge.worker.js";
import { getScheduledJobs, runAllRetentionPurgeJobs } from "../../../workers/scheduler.js";

describe("Phase 8.8.9 — Age Gate Lockout Purge Worker", () => {
  const prisma = getPrismaClient();

  const expiredPhone = "+919111111111";
  const activePhone = "+919222222222";
  const expiredHash = hashPII(expiredPhone);
  const activeHash = hashPII(activePhone);

  beforeEach(async () => {
    await prisma.ageGateLockout.deleteMany({
      where: {
        phoneHash: { in: [expiredHash, activeHash] }
      }
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("with one expired and one active lockout, purgeExpiredAgeGateLockouts(now) returns 1, deletes only the expired row and leaves the active one", async () => {
    const now = new Date("2026-10-06T00:00:00.000Z");

    // 1. Seed expired lockout (locked until yesterday)
    const yesterday = new Date("2026-10-05T00:00:00.000Z");
    await prisma.ageGateLockout.create({
      data: {
        phoneHash: expiredHash,
        lockedUntil: yesterday,
        strikeCount: 1
      }
    });

    // 2. Seed active lockout (locked until 90 days in future)
    const futureDate = new Date("2027-01-04T00:00:00.000Z");
    await prisma.ageGateLockout.create({
      data: {
        phoneHash: activeHash,
        lockedUntil: futureDate,
        strikeCount: 1
      }
    });

    // 3. Execute purge worker
    const result = await purgeExpiredAgeGateLockouts(now);
    expect(result.purgedCount).toBe(1);

    // 4. Verify expired lockout was deleted from database
    const expiredRecord = await prisma.ageGateLockout.findUnique({
      where: { phoneHash: expiredHash }
    });
    expect(expiredRecord).toBeNull();

    // 5. Verify active lockout still remains
    const activeRecord = await prisma.ageGateLockout.findUnique({
      where: { phoneHash: activeHash }
    });
    expect(activeRecord).not.toBeNull();
    expect(activeRecord?.lockedUntil).toEqual(futureDate);
  });

  it("the scheduler's job list includes a job named age-gate-lockout-purge that runs daily", () => {
    const jobs = getScheduledJobs();
    const ageGateJob = jobs.find((j) => j.name === "age-gate-lockout-purge");

    expect(ageGateJob).toBeDefined();
    expect(ageGateJob?.cron).toMatch(/(daily|0\s+\d+\s+\*\s+\*\s+\*)/i);
  });

  it("runAllRetentionPurgeJobs triggers age-gate-lockout-purge and returns ageGateLockoutsPurged count", async () => {
    const now = new Date("2026-10-06T00:00:00.000Z");

    // Seed an expired lockout
    await prisma.ageGateLockout.create({
      data: {
        phoneHash: expiredHash,
        lockedUntil: new Date("2026-10-01T00:00:00.000Z"),
        strikeCount: 1
      }
    });

    const purgeResult = await runAllRetentionPurgeJobs({ prisma }, now);
    expect(purgeResult).toHaveProperty("ageGateLockoutsPurged");
    expect(purgeResult.ageGateLockoutsPurged).toBeGreaterThanOrEqual(1);
  });
});
