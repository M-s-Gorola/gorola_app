import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { UserRepository } from "../../../modules/user/user.repository.js";



describe("PII Field Encryption at Rest (8.1.2)", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const rawPhone = "+919999888777";

  async function cleanUser() {
    const piiHash = hashPII(rawPhone);
    const existingUsers = await db.user.findMany({
      where: {
        OR: [
          { phoneHash: piiHash },
          { phone: rawPhone }
        ]
      }
    });
    for (const u of existingUsers) {
      await db.cartItem.deleteMany({ where: { cart: { userId: u.id } } });
      await db.cart.deleteMany({ where: { userId: u.id } });
      await db.address.deleteMany({ where: { userId: u.id } });
      await db.orderItem.deleteMany({ where: { order: { userId: u.id } } });
      await db.order.deleteMany({ where: { userId: u.id } });
      await db.user.delete({ where: { id: u.id } });
    }
  }


  beforeEach(async () => {
    await cleanUser();
  });

  afterAll(async () => {
    await cleanUser();
    await disconnectPrisma();
  });

  it("encrypts phone number with enc: prefix and generates phoneHash on create", async () => {
    const user = await userRepo.create({
      phone: rawPhone,
      name: "Encrypted User Test"
    });

    const rawRecords = await db.$queryRawUnsafe<
      Array<{ phone: string; phoneHash: string }>
    >('SELECT phone, "phoneHash" FROM "User" WHERE id = $1', user.id);

    expect(rawRecords.length).toBe(1);
    const rawRecord = rawRecords[0]!;

    expect(rawRecord.phone).not.toBe(rawPhone);
    expect(rawRecord.phone.startsWith("enc:")).toBe(true);
    expect(rawRecord.phoneHash).toBeDefined();
    expect(rawRecord.phoneHash.length).toBe(64);

    const retrievedUser = await userRepo.findByPhone(rawPhone);
    expect(retrievedUser).not.toBeNull();
    expect(retrievedUser?.phone).toBe(rawPhone);
  });
});
