import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConsentOptInCard } from "./ConsentOptInCard";

describe("ConsentOptInCard (Phase 8.9.2)", () => {
  it("renders canonical title, summary text, and essential badge for ORDER_PROCESSING", () => {
    render(
      <ConsentOptInCard
        purpose="ORDER_PROCESSING"
        hasExistingActiveConsent={false}
      />
    );

    expect(screen.getByText("Order Fulfillment & Location Services")).toBeInTheDocument();
    expect(screen.getByText("Essential")).toBeInTheDocument();
    expect(screen.getByText(/We collect your delivery address, GPS coordinates/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("when hasExistingActiveConsent=false for essential purpose, renders unchecked checkbox and modal trigger", () => {
    const handleCheckedChange = vi.fn();
    render(
      <ConsentOptInCard
        purpose="ORDER_PROCESSING"
        hasExistingActiveConsent={false}
        checked={false}
        onCheckedChange={handleCheckedChange}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("Order Fulfillment Notice")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.queryByText("Consent Active")).not.toBeInTheDocument();
  });

  it("when hasExistingActiveConsent=true for essential purpose, renders 'Consent Active' status pill and NO checkbox", () => {
    render(
      <ConsentOptInCard
        purpose="ORDER_PROCESSING"
        hasExistingActiveConsent={true}
      />
    );

    expect(screen.getByText("Consent Active")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renders amber 'Optional' badge and voluntary checkbox text for MARKETING_COMMS", () => {
    const handleCheckedChange = vi.fn();
    render(
      <ConsentOptInCard
        purpose="MARKETING_COMMS"
        checked={false}
        onCheckedChange={handleCheckedChange}
      />
    );

    expect(screen.getByText("Promotions & Seasonal Offers")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.getByText(/100% voluntary/i)).toBeInTheDocument();
    expect(screen.getByText(/Yes, send me seasonal Mussoorie harvest updates and coupons/i)).toBeInTheDocument();
  });

  it("in mode='informational', renders card without any checkbox or interactive toggle (for Privacy Policy & AgeStep)", () => {
    render(
      <ConsentOptInCard
        purpose="AGE_DECLARATION"
        mode="informational"
      />
    );

    expect(screen.getByText("Age Verification & Eligibility")).toBeInTheDocument();
    expect(screen.getByText("Essential")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Consent Active")).not.toBeInTheDocument();
    expect(screen.getByText("Age Declaration Notice")).toBeInTheDocument();
  });

  it("clicking the checkbox triggers onCheckedChange with boolean state", async () => {
    const user = userEvent.setup();
    const handleCheckedChange = vi.fn();

    render(
      <ConsentOptInCard
        purpose="ORDER_PROCESSING"
        hasExistingActiveConsent={false}
        checked={false}
        onCheckedChange={handleCheckedChange}
        checkboxTestId="custom-order-checkbox"
      />
    );

    const checkbox = screen.getByTestId("custom-order-checkbox");
    await user.click(checkbox);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it("supports keyboard navigation: pressing space on checkbox toggles state", async () => {
    const user = userEvent.setup();
    const handleCheckedChange = vi.fn();

    render(
      <ConsentOptInCard
        purpose="OTP_AUTH"
        checked={false}
        onCheckedChange={handleCheckedChange}
        checkboxTestId="otp-consent-checkbox"
      />
    );

    const checkbox = screen.getByTestId("otp-consent-checkbox");
    checkbox.focus();
    expect(checkbox).toHaveFocus();
    await user.keyboard(" ");
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it("when disabled=true, checkbox is disabled and clicking does not call onCheckedChange", async () => {
    const user = userEvent.setup();
    const handleCheckedChange = vi.fn();

    render(
      <ConsentOptInCard
        purpose="ORDER_PROCESSING"
        checked={false}
        onCheckedChange={handleCheckedChange}
        disabled={true}
        checkboxTestId="disabled-consent-checkbox"
      />
    );

    const checkbox = screen.getByTestId("disabled-consent-checkbox");
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(handleCheckedChange).not.toHaveBeenCalled();
  });

  it("renders error message with role='alert' when error prop is provided", () => {
    render(
      <ConsentOptInCard
        purpose="ORDER_PROCESSING"
        checked={false}
        error="You must accept the DPDP statutory terms to continue"
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("You must accept the DPDP statutory terms to continue");
  });
});
