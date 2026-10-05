import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { ageGateRepository } from "../../../modules/age-gate/age-gate.repository.js";

async function cleanLockoutTestDb(db: PrismaClient): Promise<void> {
  await db.ageGateLockout.deleteMany();
}

describe("AgeGateRepository Integration (8.8.3)", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanLockoutTestDb(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("upsertLock creates a new row with strikeCount 1, and increments on second call", async () => {
    const phoneHash = "hash_upsert_test_1";
    const lockedUntil1 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const created = await ageGateRepository.upsertLock(phoneHash, lockedUntil1);
    expect(created.id).toBeDefined();
    expect(created.phoneHash).toBe(phoneHash);
    expect(created.strikeCount).toBe(1);
    expect(created.lockedUntil).toEqual(lockedUntil1);

    const lockedUntil2 = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    const updated = await ageGateRepository.upsertLock(phoneHash, lockedUntil2);
    expect(updated.id).toBe(created.id);
    expect(updated.phoneHash).toBe(phoneHash);
    expect(updated.strikeCount).toBe(2);
    expect(updated.lockedUntil).toEqual(lockedUntil2);

    const all = await db.ageGateLockout.findMany({ where: { phoneHash } });
    expect(all.length).toBe(1);
  });

  it("findActiveByPhoneHash returns row when lockedUntil > now, and null when lockedUntil <= now", async () => {
    const activeHash = "hash_active_1";
    const expiredHash = "hash_expired_1";
    const now = new Date("2026-10-05T12:00:00Z");

    await ageGateRepository.upsertLock(activeHash, new Date("2026-10-06T12:00:00Z"));
    await ageGateRepository.upsertLock(expiredHash, new Date("2026-10-04T12:00:00Z"));

    const active = await ageGateRepository.findActiveByPhoneHash(activeHash, now);
    expect(active).not.toBeNull();
    expect(active?.phoneHash).toBe(activeHash);

    const expired = await ageGateRepository.findActiveByPhoneHash(expiredHash, now);
    expect(expired).toBeNull();
  });

  it("deleteByPhoneHash deletes single row and deleteExpired deletes only expired records", async () => {
    const hashA = "hash_delete_a";
    const hashB = "hash_delete_b";
    const now = new Date("2026-10-05T12:00:00Z");

    await ageGateRepository.upsertLock(hashA, new Date("2026-10-10T12:00:00Z"));
    await ageGateRepository.upsertLock(hashB, new Date("2026-10-01T12:00:00Z"));

    const deletedA = await ageGateRepository.deleteByPhoneHash(hashA);
    expect(deletedA).toBe(1);

    const deletedNonExistent = await ageGateRepository.deleteByPhoneHash("non_existent");
    expect(deletedNonExistent).toBe(0);

    const expiredCount = await ageGateRepository.deleteExpired(now);
    expect(expiredCount).toBe(1);

    const count = await db.ageGateLockout.count();
    expect(count).toBe(0);
  });

  it("privacy guarantee: table never contains raw phone number", async () => {
    const rawPhone = "+919876543210";
    const phoneHash = hashPII(rawPhone);
    const lockedUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await ageGateRepository.upsertLock(phoneHash, lockedUntil);

    const rows = await db.$queryRawUnsafe<Array<{ row_to_json: string }>>(
      'SELECT row_to_json(t)::text FROM "AgeGateLockout" t;'
    );
    expect(rows.length).toBe(1);
    expect(rows[0]?.row_to_json).not.toContain("9876543210");
    expect(rows[0]?.row_to_json).toContain(phoneHash);
  });
});
