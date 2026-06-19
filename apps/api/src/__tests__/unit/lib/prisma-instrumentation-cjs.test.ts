import { PrismaInstrumentation } from "@prisma/instrumentation";
import { describe, expect, it } from "vitest";

describe("@prisma/instrumentation export structure", () => {
  it("exposes PrismaInstrumentation as a named export function", () => {
    expect(PrismaInstrumentation).toBeTypeOf("function");
    expect(new PrismaInstrumentation()).toBeDefined();
  });
});
