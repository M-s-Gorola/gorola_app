import { describe, expect, it } from "vitest";

import { evaluateDateOfBirth } from "../../../modules/age-gate/age.util.js";

describe("Age Calculation Logic (8.8.2 evaluateDateOfBirth)", () => {
  it("evaluates exact 18th birthday as adult on IST calendar date", () => {
    const now = new Date("2026-10-05T10:00:00+05:30"); // 5 Oct 2026 IST

    // Exactly 18 today (born 5 Oct 2008)
    const resExact = evaluateDateOfBirth("2008-10-05", now);
    expect(resExact).toEqual({ valid: true, isAdult: true });

    // 1 day under 18 (born 6 Oct 2008)
    const resUnder = evaluateDateOfBirth("2008-10-06", now);
    expect(resUnder).toEqual({ valid: true, isAdult: false });

    // 1 day over 18 (born 4 Oct 2008)
    const resOver = evaluateDateOfBirth("2008-10-04", now);
    expect(resOver).toEqual({ valid: true, isAdult: true });
  });

  it("handles Asia/Kolkata midnight time zone boundaries correctly", () => {
    // 2026-10-04T19:00:00Z is 2026-10-05T00:30:00+05:30 (already 5 Oct in IST)
    const now1 = new Date("2026-10-04T19:00:00Z");
    const res1 = evaluateDateOfBirth("2008-10-05", now1);
    expect(res1).toEqual({ valid: true, isAdult: true });

    // 2026-10-05T19:00:00Z is 2026-10-06T00:30:00+05:30 (already 6 Oct in IST)
    const now2 = new Date("2026-10-05T19:00:00Z");
    const res2 = evaluateDateOfBirth("2008-10-06", now2);
    expect(res2).toEqual({ valid: true, isAdult: true });
  });

  it("handles leap year birthdays accurately", () => {
    // Born on leap day 29 Feb 2008
    // In non-leap year 2026, turns 18 on 1 March 2026
    const feb28_2026 = new Date("2026-02-28T12:00:00+05:30");
    const resFeb28 = evaluateDateOfBirth("2008-02-29", feb28_2026);
    expect(resFeb28).toEqual({ valid: true, isAdult: false });

    const mar01_2026 = new Date("2026-03-01T12:00:00+05:30");
    const resMar01 = evaluateDateOfBirth("2008-02-29", mar01_2026);
    expect(resMar01).toEqual({ valid: true, isAdult: true });

    // In leap year 2028 (29 Feb 2028)
    const feb29_2028 = new Date("2028-02-29T12:00:00+05:30");
    const resLeapDay28 = evaluateDateOfBirth("2010-02-28", feb29_2028);
    expect(resLeapDay28).toEqual({ valid: true, isAdult: true });

    const resLeapDayMar1 = evaluateDateOfBirth("2010-03-01", feb29_2028);
    expect(resLeapDayMar1).toEqual({ valid: true, isAdult: false });
  });

  it("rejects invalid, impossible, out-of-range, and malformed dates with { valid: false }", () => {
    const now = new Date("2026-10-05T12:00:00+05:30");

    const invalidInputs = [
      "2010-02-30", // Invalid day in Feb
      "2010-13-01", // Invalid month 13
      "2010-04-31", // April has 30 days
      "2010-2-5",   // Bad format (not padded)
      "abcd",       // Non-date string
      "",           // Empty string
      "   ",        // Whitespace string
      "1899-12-31", // Year < 1900
      "2026-10-06", // Future date relative to now
      "2010-01-01T00:00:00Z", // Full ISO timestamp instead of YYYY-MM-DD
      "2010-01-01'; DROP TABLE \"User\";--" // SQL injection attempt
    ];

    for (const input of invalidInputs) {
      const res = evaluateDateOfBirth(input, now);
      expect(res).toEqual({ valid: false });
    }
  });

  it("never throws for non-string, null, or undefined inputs and returns { valid: false }", () => {
    const now = new Date("2026-10-05T12:00:00+05:30");

    expect(evaluateDateOfBirth(undefined, now)).toEqual({ valid: false });
    expect(evaluateDateOfBirth(null, now)).toEqual({ valid: false });
    expect(evaluateDateOfBirth(123456, now)).toEqual({ valid: false });
    expect(evaluateDateOfBirth({}, now)).toEqual({ valid: false });
  });

  it("never echoes the date of birth in the return object (strict PII protection)", () => {
    const now = new Date("2026-10-05T12:00:00+05:30");
    const res = evaluateDateOfBirth("2000-01-01", now);
    expect(Object.keys(res)).toEqual(["valid", "isAdult"]);
    expect(JSON.stringify(res)).not.toContain("2000-01-01");
  });
});
