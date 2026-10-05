import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPII } from "../../../lib/crypto.js";
import type { AgeGateRepository } from "../../../modules/age-gate/age-gate.repository.js";
import { AgeGateService } from "../../../modules/age-gate/age-gate.service.js";

describe("AgeGateService Unit (8.8.3)", () => {
  const mockRepo = {
    upsertLock: vi.fn(),
    findActiveByPhoneHash: vi.fn(),
    deleteByPhoneHash: vi.fn(),
    deleteExpired: vi.fn()
  };

  let service: AgeGateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgeGateService(mockRepo as unknown as AgeGateRepository);
  });

  it("lockPhone calls repo with hashed phone and +90 days expiry, never passing raw phone", async () => {
    const rawPhone = "+919876543210";
    const expectedHash = hashPII(rawPhone);
    const now = new Date("2026-10-05T12:00:00Z");

    mockRepo.upsertLock.mockResolvedValue({
      id: "lock_1",
      phoneHash: expectedHash,
      lockedUntil: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      strikeCount: 1
    });

    await service.lockPhone(rawPhone, now);

    expect(mockRepo.upsertLock).toHaveBeenCalledTimes(1);
    const firstCall = mockRepo.upsertLock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall) {
      const [calledHash, calledExpiry] = firstCall;
      expect(calledHash).toBe(expectedHash);
      expect(calledHash).not.toContain(rawPhone);
      expect(calledExpiry.getTime()).toBe(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    }
  });

  it("isPhoneLocked returns true only when repo returns active lockout", async () => {
    const rawPhone = "+919876543210";
    const now = new Date("2026-10-05T12:00:00Z");

    mockRepo.findActiveByPhoneHash.mockResolvedValueOnce({
      id: "lock_1",
      phoneHash: hashPII(rawPhone),
      lockedUntil: new Date("2026-10-10T12:00:00Z")
    });

    const isLocked = await service.isPhoneLocked(rawPhone, now);
    expect(isLocked).toBe(true);

    mockRepo.findActiveByPhoneHash.mockResolvedValueOnce(null);
    const isUnlocked = await service.isPhoneLocked(rawPhone, now);
    expect(isUnlocked).toBe(false);
  });

  it("handles special characters and SQL injection attempts gracefully", async () => {
    const malformedPhone = "+91'; DROP TABLE \"User\";--";
    const now = new Date("2026-10-05T12:00:00Z");

    mockRepo.findActiveByPhoneHash.mockResolvedValue(null);
    const isLocked = await service.isPhoneLocked(malformedPhone, now);
    expect(isLocked).toBe(false);
    expect(mockRepo.findActiveByPhoneHash).toHaveBeenCalledWith(hashPII(malformedPhone), now);
  });
});
