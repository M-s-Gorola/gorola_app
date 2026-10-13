import { afterAll, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";

describe("DPDP Consent Seed Harmonization (Phase 6.19.3)", () => {
  const db = getPrismaClient();

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("ensures ORDER_PROCESSING consent purpose configuration covers both delivery riders and field service technicians", async () => {
    const purpose = await db.consentPurposeConfig.findUnique({
      where: { key: "ORDER_PROCESSING" }
    });
    expect(purpose).toBeDefined();
    expect(purpose?.description).toMatch(/field service technicians/i);
    expect(purpose?.description).toMatch(/scheduled on-site service appointments/i);
  });
});
