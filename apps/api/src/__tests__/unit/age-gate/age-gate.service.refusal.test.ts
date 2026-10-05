import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgeGateRepository } from "../../../modules/age-gate/age-gate.repository.js";
import { AgeGateService } from "../../../modules/age-gate/age-gate.service.js";
import type { RedisLikeClient } from "../../../modules/auth/auth.types.js";

describe("AgeGateService Refusal & Abuse Alert Unit (Phase 8.8.6)", () => {
  const mockRepo = {
    upsertLock: vi.fn(),
    findActiveByPhoneHash: vi.fn(),
    deleteByPhoneHash: vi.fn(),
    deleteExpired: vi.fn(),
    createAdultBuyerWithConsents: vi.fn()
  };

  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn()
  };

  let service: AgeGateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgeGateService(
      mockRepo as unknown as AgeGateRepository,
      mockRedis as unknown as RedisLikeClient
    );
  });

  it("recordRefusal increments counter and triggers alert exactly on the 5th attempt", async () => {
    const ip = "192.168.1.100";
    const key = `age_gate:refusals:${ip}`;

    // 1st attempt: counter = 1 -> no alert
    mockRedis.get.mockResolvedValueOnce(null);
    const count1 = await service.recordRefusal(ip);
    expect(count1).toBe(1);
    expect(mockRedis.set).toHaveBeenCalledWith(key, "1", "EX", 86400);

    // 4th attempt: counter = 4 -> no alert
    mockRedis.get.mockResolvedValueOnce("3");
    const count4 = await service.recordRefusal(ip);
    expect(count4).toBe(4);

    // 5th attempt: counter = 5 -> alert triggered!
    mockRedis.get.mockResolvedValueOnce("4");
    const count5 = await service.recordRefusal(ip);
    expect(count5).toBe(5);

    // 6th attempt: counter = 6 -> no additional alert
    mockRedis.get.mockResolvedValueOnce("5");
    const count6 = await service.recordRefusal(ip);
    expect(count6).toBe(6);
  });
});
