import { describe, expect, it, vi } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import { AdminService } from "../../../modules/admin/admin.service.js";

describe("Admin Age Gate Service Unit Tests (8.8.8)", () => {
  it("should compute phoneHash BEFORE purging/anonymizing when erasing an underage user", async () => {
    const rawPhone = "+919876543210";
    const expectedHash = hashPII(rawPhone);

    const user = {
      id: "user_test_123",
      phone: rawPhone,
      phoneHash: expectedHash,
      name: "Minor User",
      isDeleted: false,
      isActive: true
    };

    let hashCapturedAtUpsert: string | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb: any = {
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockImplementation(() => {
          return Promise.resolve({ ...user, isDeleted: true, phoneHash: null });
        })
      },
      address: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      cart: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      order: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      consentLog: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      ageGateLockout: {
        upsert: vi.fn().mockImplementation((args: { where: { phoneHash: string } }) => {
          hashCapturedAtUpsert = args.where.phoneHash;
          return Promise.resolve({
            id: "lock_1",
            phoneHash: args.where.phoneHash,
            lockedUntil: new Date(),
            strikeCount: 1
          });
        })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit_1" })
      }
    };

    const adminService = new AdminService(mockDb);
    const result = await adminService.eraseUnderageUser(
      user.id,
      "Parent request confirmed underage user",
      "admin_1",
      "127.0.0.1",
      "TestAgent"
    );

    expect(result.erased).toBe(true);
    expect(hashCapturedAtUpsert).toBe(expectedHash);
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "USER_ERASED_UNDERAGE",
          actorRole: "ADMIN",
          entityType: "User",
          entityId: user.id,
          newValue: { reason: "Parent request confirmed underage user" }
        })
      })
    );

    // Ensure audit log does not contain raw phone
    const auditCallArgs = mockDb.auditLog.create.mock.calls[0][0];
    expect(JSON.stringify(auditCallArgs)).not.toContain("9876543210");
  });
});
