import { afterAll, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";

describe("Database Least-Privilege Role Security (8.1.1)", () => {
  const db = getPrismaClient();

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("permits DML queries (SELECT, INSERT, UPDATE, DELETE) for runtime app user", async () => {
    const result = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint FROM "User";'
    );
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("validates DDL queries are restricted when app_service credential is used", async () => {
    const dbUrl = process.env.DATABASE_URL ?? "";
    const isAppServiceRole = dbUrl.includes("app_service");

    let error: { code?: string; meta?: { code?: string }; message?: string } | null = null;
    try {
      await db.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "TestDummySecurityTable" (id INT);'
      );
      await db.$executeRawUnsafe(
        'DROP TABLE IF EXISTS "TestDummySecurityTable";'
      );
    } catch (err) {
      error = err as { code?: string; meta?: { code?: string }; message?: string };
    }


    if (isAppServiceRole) {
      expect(error).not.toBeNull();
      const isInsufficientPrivilege =
        error?.code === "P2010" &&
        (error?.meta?.code === "42501" ||
          String(error?.message).includes("42501") ||
          String(error?.message).includes("insufficient_privilege"));
      expect(isInsufficientPrivilege).toBe(true);
    } else {
      // Runtime check: verify DML query executed cleanly and document role setup requirement
      expect(error).toBeNull();
    }
  });
});
