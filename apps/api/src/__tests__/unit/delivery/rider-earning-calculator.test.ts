import { EarningType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library.js";
import { describe, expect, it } from "vitest";

import { calculateRiderEarning } from "../../../modules/delivery/rider-earning-calculator.js";

describe("Rider Earning Calculator", () => {
  it("should calculate correct amount for PER_ORDER model with 80% earning rate", () => {
    const output = calculateRiderEarning({
      deliveryFee: new Decimal("50.00"),
      earningRatePct: new Decimal("80.00"),
      model: "PER_ORDER"
    });

    expect(output.earningType).toBe("PER_ORDER");
    expect(output.amount.toString()).toBe("40");
  });

  it("should calculate correct amount for PER_ORDER model with 100% earning rate", () => {
    const output = calculateRiderEarning({
      deliveryFee: new Decimal("50.00"),
      earningRatePct: new Decimal("100.00"),
      model: "PER_ORDER"
    });

    expect(output.amount.toString()).toBe("50");
  });

  it("should calculate correct amount for PER_ORDER model with 0% earning rate", () => {
    const output = calculateRiderEarning({
      deliveryFee: new Decimal("50.00"),
      earningRatePct: new Decimal("0.00"),
      model: "PER_ORDER"
    });

    expect(output.amount.toString()).toBe("0");
  });

  it("should round amounts to 2 decimal places", () => {
    const output = calculateRiderEarning({
      deliveryFee: new Decimal("33.33"),
      earningRatePct: new Decimal("80.00"),
      model: "PER_ORDER"
    });

    // 33.33 * 0.8 = 26.664 -> rounds to 26.66
    expect(output.amount.toString()).toBe("26.66");
  });

  it("should throw error for unknown models", () => {
    expect(() => {
      calculateRiderEarning({
        deliveryFee: new Decimal("50.00"),
        earningRatePct: new Decimal("80.00"),
        model: "INVALID" as unknown as EarningType
      });
    }).toThrow();
  });
});
