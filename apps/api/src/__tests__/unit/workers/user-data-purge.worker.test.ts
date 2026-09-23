import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { UserRepository } from "../../../modules/user/user.repository.js";
import { purgeExpiredUsers } from "../../../workers/user-data-purge.worker.js";

describe("purgeExpiredUsers Worker (DPDP Act Sec 12 30-Day Purge)", () => {
  it("purges users whose 30-day grace period has passed and are not reactivated", async () => {
    const mockPrisma = {
      user: {
        findMany: vi.fn().mockResolvedValueOnce([
          { id: "expired_u1" },
          { id: "expired_u2" }
        ])
      }
    } as unknown as PrismaClient;

    const mockUserRepo = {
      permanentPurgeAndAnonymize: vi.fn().mockResolvedValue(undefined)
    } as unknown as UserRepository;

    const result = await purgeExpiredUsers(mockUserRepo, mockPrisma);

    expect(result.purgedCount).toBe(2);
    expect(result.userIds).toEqual(["expired_u1", "expired_u2"]);
    expect(mockUserRepo.permanentPurgeAndAnonymize).toHaveBeenCalledWith("expired_u1");
    expect(mockUserRepo.permanentPurgeAndAnonymize).toHaveBeenCalledWith("expired_u2");
  });

  it("does not purge anything if no expired accounts exist", async () => {
    const mockPrisma = {
      user: {
        findMany: vi.fn().mockResolvedValueOnce([])
      }
    } as unknown as PrismaClient;

    const mockUserRepo = {
      permanentPurgeAndAnonymize: vi.fn()
    } as unknown as UserRepository;

    const result = await purgeExpiredUsers(mockUserRepo, mockPrisma);

    expect(result.purgedCount).toBe(0);
    expect(mockUserRepo.permanentPurgeAndAnonymize).not.toHaveBeenCalled();
  });
});
