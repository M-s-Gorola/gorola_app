import { ConflictError, NotFoundError } from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { UserRepository } from "../../../modules/user/user.repository.js";

async function cleanUserGraph(db: PrismaClient): Promise<void> {
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
}

describe("UserRepository", () => {
  const db = getPrismaClient();
  const repo = new UserRepository(db);

  beforeEach(async () => {
    await cleanUserGraph(db);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates a user with phone and name", async () => {
      const user = await repo.create({ phone: "+919876543210", name: "Test User" });
      expect(user.id).toBeTruthy();
      expect(user.phone).toBe("+919876543210");
      expect(user.name).toBe("Test User");
      expect(user.isVerified).toBe(false);
      expect(user.isDeleted).toBe(false);
    });

    it("creates a user with isVerified true", async () => {
      const user = await repo.create({
        phone: "+919876543211",
        name: "Verified",
        isVerified: true
      });
      expect(user.isVerified).toBe(true);
    });

    it("throws ConflictError when phone already exists", async () => {
      await repo.create({ phone: "+919876543212", name: "First" });
      await expect(repo.create({ phone: "+919876543212", name: "Second" })).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe("findById", () => {
    it("returns user by id", async () => {
      const created = await repo.create({ phone: "+919876543220", name: "By Id" });
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("returns null when id does not exist", async () => {
      const found = await repo.findById("nonexistent_cuid_xyz");
      expect(found).toBeNull();
    });

    it("returns null for soft-deleted user by default", async () => {
      const created = await repo.create({ phone: "+919876543221", name: "Deleted" });
      await repo.softDelete(created.id);
      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it("returns soft-deleted user when includeDeleted is true", async () => {
      const created = await repo.create({ phone: "+919876543222", name: "Deleted2" });
      await repo.softDelete(created.id);
      const found = await repo.findById(created.id, { includeDeleted: true });
      expect(found).not.toBeNull();
      expect(found?.isDeleted).toBe(true);
    });
  });

  describe("ensureBuyerByPhone", () => {
    it("creates verified buyer when none exists", async () => {
      const u = await repo.ensureBuyerByPhone("+919800000070");
      expect(u.phone).toBe("+919800000070");
      expect(u.isVerified).toBe(true);
      expect(u.name).toBe("");
    });

    it("returns same row when called twice for one phone", async () => {
      const first = await repo.ensureBuyerByPhone("+919800000071");
      const second = await repo.ensureBuyerByPhone("+919800000071");
      expect(second.id).toBe(first.id);
    });

    it("sets isVerified when user existed unverified", async () => {
      const pending = await repo.create({
        isVerified: false,
        name: "",
        phone: "+919800000072"
      });
      const u = await repo.ensureBuyerByPhone("+919800000072");
      expect(u.id).toBe(pending.id);
      expect(u.isVerified).toBe(true);
    });
  });

  describe("findByPhone", () => {
    it("returns user by phone", async () => {
      await repo.create({ phone: "+919876543230", name: "Phone User" });
      const found = await repo.findByPhone("+919876543230");
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Phone User");
    });

    it("returns null when phone does not exist", async () => {
      const found = await repo.findByPhone("+919000000000");
      expect(found).toBeNull();
    });

    it("returns null for soft-deleted user by default", async () => {
      const created = await repo.create({ phone: "+919876543231", name: "Gone" });
      await repo.softDelete(created.id);
      const found = await repo.findByPhone("+919876543231");
      expect(found).toBeNull();
    });

    it("returns soft-deleted user when includeDeleted is true", async () => {
      const created = await repo.create({ phone: "+919876543232", name: "Gone2" });
      await repo.softDelete(created.id);
      const found = await repo.findByPhone("+919876543232", { includeDeleted: true });
      expect(found?.isDeleted).toBe(true);
    });
  });

  describe("update", () => {
    it("updates name and isVerified", async () => {
      const created = await repo.create({ phone: "+919876543240", name: "Old" });
      const updated = await repo.update(created.id, { name: "New", isVerified: true });
      expect(updated.name).toBe("New");
      expect(updated.isVerified).toBe(true);
    });

    it("throws NotFoundError when id does not exist", async () => {
      await expect(
        repo.update("nonexistent_cuid_xyz", { name: "Nobody" })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError when phone conflicts with another user", async () => {
      await repo.create({ phone: "+919876543250", name: "A" });
      const b = await repo.create({ phone: "+919876543251", name: "B" });
      await expect(repo.update(b.id, { phone: "+919876543250" })).rejects.toThrow(ConflictError);
    });
  });

  describe("softDelete", () => {
    it("sets isDeleted to true", async () => {
      const created = await repo.create({ phone: "+919876543260", name: "ToDelete" });
      const deleted = await repo.softDelete(created.id);
      expect(deleted.isDeleted).toBe(true);
      const again = await db.user.findUnique({ where: { id: created.id } });
      expect(again?.isDeleted).toBe(true);
    });

    it("throws NotFoundError when id does not exist", async () => {
      await expect(repo.softDelete("nonexistent_cuid_xyz")).rejects.toThrow(NotFoundError);
    });
  });

  describe("security", () => {
    it("does not treat SQL injection-like phone string as raw SQL", async () => {
      const malicious = "+919000'; DROP TABLE \"User\";--";
      const user = await repo.create({ phone: malicious, name: "Safe" });
      const found = await repo.findByPhone(malicious);
      expect(found?.id).toBe(user.id);
      const count = await db.user.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});
