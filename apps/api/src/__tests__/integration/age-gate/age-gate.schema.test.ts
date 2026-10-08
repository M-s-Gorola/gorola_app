import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";

async function cleanSchemaTestGraph(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe('DELETE FROM "ConsentLog";');
  await db.ageGateLockout.deleteMany();
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("Age Gate Schema & Migration (8.8.1)", () => {
  const db = getPrismaClient();

  beforeEach(async () => {
    await cleanSchemaTestGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("User model supports ageConfirmedAt and ageConfirmedPolicyVersion fields", async () => {
    const ageConfirmedAt = new Date("2026-10-05T12:00:00Z");
    const user = await db.user.create({
      data: {
        name: "Adult User",
        phone: "+919876543210",
        phoneHash: "adult_phone_hash_1",
        ageConfirmedAt,
        ageConfirmedPolicyVersion: "1.1"
      }
    });

    expect(user.id).toBeDefined();
    expect(user.ageConfirmedAt).toEqual(ageConfirmedAt);
    expect(user.ageConfirmedPolicyVersion).toBe("1.1");

    const fetched = await db.user.findUnique({
      where: { id: user.id }
    });
    expect(fetched?.ageConfirmedAt).toEqual(ageConfirmedAt);
    expect(fetched?.ageConfirmedPolicyVersion).toBe("1.1");
  });

  it("AgeGateLockout model enforces unique phoneHash constraint", async () => {
    const lockedUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const lock1 = await db.ageGateLockout.create({
      data: {
        phoneHash: "locked_hash_test_1",
        lockedUntil,
        strikeCount: 1
      }
    });
    expect(lock1.id).toBeDefined();
    expect(lock1.phoneHash).toBe("locked_hash_test_1");
    expect(lock1.strikeCount).toBe(1);

    // Duplicate create with same phoneHash must reject with P2002
    await expect(
      db.ageGateLockout.create({
        data: {
          phoneHash: "locked_hash_test_1",
          lockedUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          strikeCount: 2
        }
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("ConsentPurposeConfig contains AGE_DECLARATION canonical row with isEssential = true", async () => {
    const purpose = await db.consentPurposeConfig.findUnique({
      where: { key: "AGE_DECLARATION" }
    });

    expect(purpose).not.toBeNull();
    expect(purpose?.key).toBe("AGE_DECLARATION");
    expect(purpose?.isEssential).toBe(true);
    expect(purpose?.displayName).toBe("Age Confirmation");
  });

  it("ConsentLog can be created with purpose AGE_DECLARATION for a user", async () => {
    const user = await db.user.create({
      data: {
        name: "Consent User",
        phone: "+919876543211",
        phoneHash: "consent_phone_hash_1"
      }
    });

    const consent = await db.consentLog.create({
      data: {
        userId: user.id,
        purpose: "AGE_DECLARATION",
        consentVersion: "1.1",
        noticeText: "Age declaration notice text"
      }
    });

    expect(consent.id).toBeDefined();
    expect(consent.purpose).toBe("AGE_DECLARATION");
    expect(consent.consentVersion).toBe("1.1");
  });

  it("Deleting a User does not delete AgeGateLockout records (zero relation)", async () => {
    const user = await db.user.create({
      data: {
        name: "User To Delete",
        phone: "+919876543212",
        phoneHash: "user_phone_hash_to_delete"
      }
    });

    const lockedUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const lock = await db.ageGateLockout.create({
      data: {
        phoneHash: "user_phone_hash_to_delete",
        lockedUntil
      }
    });

    // Delete user
    await db.user.delete({
      where: { id: user.id }
    });

    // Lock must still exist
    const remainingLock = await db.ageGateLockout.findUnique({
      where: { id: lock.id }
    });
    expect(remainingLock).not.toBeNull();
    expect(remainingLock?.id).toBe(lock.id);
  });
});
