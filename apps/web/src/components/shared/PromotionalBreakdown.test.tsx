import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PromotionalBreakdown } from "./PromotionalBreakdown";

describe("PromotionalBreakdown Component (Phase 6.19.2)", () => {
  afterEach(cleanup);

  it("renders Total Discount summary with stacked Offer and Coupon when both are present", () => {
    render(
      <PromotionalBreakdown
        discountSavingAmount={50}
        offerSavingAmount={100}
        appliedDiscountCode="FESTIVE50"
        appliedOfferTitle="Diwali Special"
      />
    );

    const toggleBtn = screen.getByTestId("discount-breakdown-toggle");
    expect(toggleBtn).toHaveTextContent("Total Discount:");
    expect(screen.getByTestId("discount-total-amount")).toHaveTextContent("-Rs 150.00");

    // Initially collapsed
    expect(screen.queryByTestId("discount-breakdown-list")).not.toBeInTheDocument();

    // Expand
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("discount-breakdown-list")).toBeInTheDocument();

    // Check itemized lines
    const offerItem = screen.getByTestId("discount-offer-item");
    expect(offerItem).toHaveTextContent("Store Offer (Diwali Special)");
    expect(offerItem).toHaveTextContent("-Rs 100.00");

    const codeItem = screen.getByTestId("discount-code-item");
    expect(codeItem).toHaveTextContent("Discount Code (FESTIVE50)");
    expect(codeItem).toHaveTextContent("-Rs 50.00");
  });

  it("renders only Discount Code when coupon is applied without store offer", () => {
    render(
      <PromotionalBreakdown
        discountSavingAmount={25}
        offerSavingAmount={0}
        appliedDiscountCode="WELCOME10"
        appliedOfferTitle={null}
      />
    );

    const toggleBtn = screen.getByTestId("discount-breakdown-toggle");
    expect(screen.getByTestId("discount-total-amount")).toHaveTextContent("-Rs 25.00");

    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("discount-code-item")).toHaveTextContent("Discount Code (WELCOME10)");
    expect(screen.queryByTestId("discount-offer-item")).not.toBeInTheDocument();
  });

  it("renders only Store Offer when store offer is applied without coupon", () => {
    render(
      <PromotionalBreakdown
        discountSavingAmount={0}
        offerSavingAmount={30}
        appliedDiscountCode={null}
        appliedOfferTitle="Summer Sale"
      />
    );

    const toggleBtn = screen.getByTestId("discount-breakdown-toggle");
    expect(screen.getByTestId("discount-total-amount")).toHaveTextContent("-Rs 30.00");

    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("discount-offer-item")).toHaveTextContent("Store Offer (Summer Sale)");
    expect(screen.queryByTestId("discount-code-item")).not.toBeInTheDocument();
  });

  it("renders null (no DOM nodes) when total discount is 0 or null", () => {
    const { container } = render(
      <PromotionalBreakdown
        discountSavingAmount={0}
        offerSavingAmount={0}
        totalDiscountAmount={0}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("supports aria-expanded and aria-controls for accessibility compliance", () => {
    render(
      <PromotionalBreakdown
        discountSavingAmount={50}
        appliedDiscountCode="SAVE50"
      />
    );

    const toggleBtn = screen.getByTestId("discount-breakdown-toggle");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    const controlsId = toggleBtn.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(screen.getByTestId("discount-breakdown-list")).toHaveAttribute("id", controlsId!);
  });

  it("handles long text in offer title and coupon code gracefully", () => {
    const longTitle = "Special Super Holiday Independence Day Mega Flash Sale Promotion";
    const longCode = "SUMMER_FESTIVE_EXTENDED_SAVINGS_2026";

    render(
      <PromotionalBreakdown
        discountSavingAmount={20}
        offerSavingAmount={40}
        appliedOfferTitle={longTitle}
        appliedDiscountCode={longCode}
      />
    );

    fireEvent.click(screen.getByTestId("discount-breakdown-toggle"));

    expect(screen.getByTestId("discount-offer-item")).toHaveTextContent(`Store Offer (${longTitle})`);
    expect(screen.getByTestId("discount-code-item")).toHaveTextContent(`Discount Code (${longCode})`);
  });
});
