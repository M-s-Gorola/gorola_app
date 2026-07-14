import { Decimal } from "@prisma/client/runtime/library.js";

export type EarningModel = "PER_ORDER" | "PER_KM";

export interface EarningInput {
  deliveryFee: Decimal;        // what the buyer was charged
  earningRatePct: Decimal;     // e.g. 80.00 for 80% — resolved by service before calling
  distanceKm?: Decimal | null; // null/undefined for PER_ORDER; populated for PER_KM
  model: EarningModel;         // which formula to use
}

export interface EarningOutput {
  amount: Decimal;             // rider's payout (rounded to 2dp)
  earningType: EarningModel;   // recorded verbatim on the RiderEarning row
}

export function calculateRiderEarning(input: EarningInput): EarningOutput {
  if (input.model === "PER_ORDER") {
    return {
      amount: input.deliveryFee.mul(input.earningRatePct.div(new Decimal(100))).toDecimalPlaces(2),
      earningType: "PER_ORDER"
    };
  }
  throw new Error(`EarningModel '${input.model}' is not yet implemented`);
}
