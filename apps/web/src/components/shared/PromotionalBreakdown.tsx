import { ChevronDown } from "lucide-react";
import { type ReactElement, useState } from "react";

export interface PromotionalBreakdownProps {
  discountSavingAmount?: number | string | null;
  offerSavingAmount?: number | string | null;
  appliedDiscountCode?: string | null;
  appliedOfferTitle?: string | null;
  totalDiscountAmount?: number | string | null;
  className?: string;
  currencyPrefix?: string;
  testIdPrefix?: string;
}

export function PromotionalBreakdown({
  discountSavingAmount,
  offerSavingAmount,
  appliedDiscountCode,
  appliedOfferTitle,
  totalDiscountAmount,
  className = "",
  currencyPrefix = "Rs ",
  testIdPrefix = "discount"
}: PromotionalBreakdownProps): ReactElement | null {
  const [isExpanded, setIsExpanded] = useState(false);

  const discountSavings = Math.max(0, Number(discountSavingAmount || 0));
  const offerSavings = Math.max(0, Number(offerSavingAmount || 0));

  let totalSavings = discountSavings + offerSavings;
  if (totalSavings === 0 && totalDiscountAmount) {
    totalSavings = Math.max(0, Number(totalDiscountAmount || 0));
  }

  if (totalSavings <= 0) {
    return null;
  }

  // Determine itemized breakdown rows
  const items: Array<{ id: string; label: string; amount: number; testId: string }> = [];

  if (offerSavings > 0 || (appliedOfferTitle && totalSavings > 0 && discountSavings === 0)) {
    const amount = offerSavings > 0 ? offerSavings : totalSavings;
    items.push({
      id: "store-offer",
      label: appliedOfferTitle ? `Store Offer (${appliedOfferTitle})` : "Store Offer",
      amount,
      testId: `${testIdPrefix}-offer-item`
    });
  }

  if (discountSavings > 0 || (appliedDiscountCode && totalSavings > 0 && offerSavings === 0)) {
    const amount = discountSavings > 0 ? discountSavings : totalSavings;
    items.push({
      id: "discount-code",
      label: appliedDiscountCode ? `Discount Code (${appliedDiscountCode})` : "Discount Code",
      amount,
      testId: `${testIdPrefix}-code-item`
    });
  }

  // If no specific breakdown items were populated but total savings exists (e.g. legacy fallback)
  if (items.length === 0) {
    items.push({
      id: "general-discount",
      label: appliedDiscountCode ? `Discount Code (${appliedDiscountCode})` : "Total Discount",
      amount: totalSavings,
      testId: `${testIdPrefix}-generic-item`
    });
  }

  const breakdownId = `promo-breakdown-${testIdPrefix}`;

  return (
    <div className={`space-y-1 ${className}`} data-testid={`${testIdPrefix}-summary-row`}>
      <div className="flex justify-between items-center text-gorola-pine font-semibold">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid={`${testIdPrefix}-breakdown-toggle`}
          aria-expanded={isExpanded}
          aria-controls={breakdownId}
          className="flex items-center gap-1.5 text-gorola-pine hover:text-emerald-800 transition-colors focus:outline-none select-none cursor-pointer p-0 bg-transparent border-0"
        >
          <span>Total Discount:</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <span className="font-semibold" data-testid={`${testIdPrefix}-total-amount`}>
          -{currencyPrefix}{totalSavings.toFixed(2)}
        </span>
      </div>

      {isExpanded && (
        <div
          id={breakdownId}
          className="space-y-1 pl-3 border-l-2 border-emerald-200/60 mt-1"
          data-testid={`${testIdPrefix}-breakdown-list`}
        >
          {items.map((item) => (
            <div
              key={item.id}
              data-testid={item.testId}
              className="flex justify-between items-start gap-4 text-xs text-gorola-pine/90 font-medium"
            >
              <span className="break-words text-left flex-1">• {item.label}</span>
              <span className="text-right whitespace-nowrap shrink-0">
                -{currencyPrefix}{item.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
