import { CONSENT_NOTICES } from "@gorola/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AgeStep } from "./AgeStep";

describe("AgeStep Component (8.8.10)", () => {
  it("renders age-day, age-month, age-year inputs with no type=date and no min/max attributes", () => {
    render(
      <AgeStep
        onConfirm={vi.fn()}
      />
    );

    const dayInput = screen.getByTestId("age-day");
    const monthInput = screen.getByTestId("age-month");
    const yearInput = screen.getByTestId("age-year");

    expect(dayInput).toBeInTheDocument();
    expect(monthInput).toBeInTheDocument();
    expect(yearInput).toBeInTheDocument();

    expect(dayInput).not.toHaveAttribute("type", "date");
    expect(monthInput).not.toHaveAttribute("type", "date");
    expect(yearInput).not.toHaveAttribute("type", "date");

    expect(dayInput).not.toHaveAttribute("min");
    expect(dayInput).not.toHaveAttribute("max");
    expect(monthInput).not.toHaveAttribute("min");
    expect(monthInput).not.toHaveAttribute("max");
    expect(yearInput).not.toHaveAttribute("min");
    expect(yearInput).not.toHaveAttribute("max");

    // Associated labels / accessibility
    expect(dayInput).toHaveAccessibleName(/day/i);
    expect(monthInput).toHaveAccessibleName(/month/i);
    expect(yearInput).toHaveAccessibleName(/year/i);
  });

  it("renders canonical AGE_DECLARATION text from @gorola/shared", () => {
    render(<AgeStep onConfirm={vi.fn()} />);
    expect(screen.getByText(CONSENT_NOTICES.AGE_DECLARATION["1.1"])).toBeInTheDocument();
  });

  it("the Continue button (age-continue-btn) is disabled until all three fields have values", async () => {
    const user = userEvent.setup();
    render(<AgeStep onConfirm={vi.fn()} />);

    const continueBtn = screen.getByTestId("age-continue-btn");
    expect(continueBtn).toBeDisabled();

    await user.type(screen.getByTestId("age-day"), "14");
    expect(continueBtn).toBeDisabled();

    await user.type(screen.getByTestId("age-month"), "05");
    expect(continueBtn).toBeDisabled();

    await user.type(screen.getByTestId("age-year"), "1990");
    expect(continueBtn).toBeEnabled();
  });

  it("invalid entries show age-error with 'Please enter a valid date of birth.' and do not advance", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<AgeStep onConfirm={onConfirm} />);

    const invalidDates = [
      { d: "31", m: "02", y: "2010" }, // 31 Feb
      { d: "10", m: "13", y: "2010" }, // Month 13
      { d: "00", m: "05", y: "2010" }, // Day 0
      { d: "10", m: "05", y: "99" },   // 2-digit year
      { d: "10", m: "05", y: "1899" }, // Year < 1900
      { d: "10", m: "05", y: "2099" }  // Future year
    ];

    for (const item of invalidDates) {
      await user.clear(screen.getByTestId("age-day"));
      await user.type(screen.getByTestId("age-day"), item.d);

      await user.clear(screen.getByTestId("age-month"));
      await user.type(screen.getByTestId("age-month"), item.m);

      await user.clear(screen.getByTestId("age-year"));
      await user.type(screen.getByTestId("age-year"), item.y);

      await user.click(screen.getByTestId("age-continue-btn"));

      const error = screen.getByTestId("age-error");
      expect(error).toBeInTheDocument();
      expect(error).toHaveTextContent("Please enter a valid date of birth.");
      expect(error).toHaveAttribute("aria-live", "polite");
      expect(onConfirm).not.toHaveBeenCalled();
    }
  });

  it("valid entry 10/03/2012 shows confirmation view with 'You entered 10 March 2012. Is this correct?' and Edit returns to fields with values filled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<AgeStep onConfirm={onConfirm} />);

    await user.type(screen.getByTestId("age-day"), "10");
    await user.type(screen.getByTestId("age-month"), "03");
    await user.type(screen.getByTestId("age-year"), "2012");
    await user.click(screen.getByTestId("age-continue-btn"));

    // Confirm step
    expect(screen.getByTestId("age-confirm-text")).toHaveTextContent("You entered 10 March 2012. Is this correct?");
    expect(screen.getByTestId("age-confirm-yes-btn")).toBeInTheDocument();
    const editBtn = screen.getByTestId("age-confirm-edit-btn");
    expect(editBtn).toBeInTheDocument();

    // Click edit -> returns to fields
    await user.click(editBtn);
    expect(screen.getByTestId("age-day")).toHaveValue("10");
    expect(screen.getByTestId("age-month")).toHaveValue("03");
    expect(screen.getByTestId("age-year")).toHaveValue("2012");
  });

  it("clicking Yes, continue posts once with formatted YYYY-MM-DD and disables button while in flight", async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void;
    const onConfirm = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
    });

    render(<AgeStep onConfirm={onConfirm} />);

    await user.type(screen.getByTestId("age-day"), "10");
    await user.type(screen.getByTestId("age-month"), "03");
    await user.type(screen.getByTestId("age-year"), "2012");
    await user.click(screen.getByTestId("age-continue-btn"));

    const yesBtn = screen.getByTestId("age-confirm-yes-btn");
    await user.click(yesBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("2012-03-10");

    // Double clicking while in flight
    expect(yesBtn).toBeDisabled();
    await user.click(yesBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Resolve
    resolvePromise!();
    await waitFor(() => {
      expect(yesBtn).toBeEnabled();
    });
  });

  it("renders refusal screen (age-blocked-step) with canonical copy when mode is blocked", () => {
    render(<AgeStep mode="blocked" onConfirm={vi.fn()} />);

    const blocked = screen.getByTestId("age-blocked-step");
    expect(blocked).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /we can't create your account/i })).toBeInTheDocument();
    expect(blocked).toHaveTextContent("GoRola is available only to people aged 18 and over. If you think this is a mistake, write to privacy@gorola.in.");

    // No control returning to date fields
    expect(screen.queryByTestId("age-day")).not.toBeInTheDocument();
    expect(screen.queryByTestId("age-continue-btn")).not.toBeInTheDocument();
  });

  it("handles leap year edge dates correctly (29/02/2008 valid vs 29/02/2009 invalid)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<AgeStep onConfirm={onConfirm} />);

    // 29 Feb in non-leap year 2009 -> invalid
    await user.type(screen.getByTestId("age-day"), "29");
    await user.type(screen.getByTestId("age-month"), "02");
    await user.type(screen.getByTestId("age-year"), "2009");
    await user.click(screen.getByTestId("age-continue-btn"));
    expect(screen.getByTestId("age-error")).toHaveTextContent("Please enter a valid date of birth.");

    // 29 Feb in leap year 2008 -> valid
    await user.clear(screen.getByTestId("age-year"));
    await user.type(screen.getByTestId("age-year"), "2008");
    await user.click(screen.getByTestId("age-continue-btn"));
    expect(screen.getByTestId("age-confirm-text")).toHaveTextContent("You entered 29 February 2008. Is this correct?");
  });

  it("age copy guard: full rendered text contains no age numbers other than 18", () => {
    const { container: entryContainer } = render(<AgeStep onConfirm={vi.fn()} />);
    const entryText = entryContainer.textContent ?? "";
    const ageMatches = entryText.match(/\b\d+\b/g) ?? [];
    // The only standalone number in the descriptive text should be 18 (years/cutoff)
    // Excluding single-digit placeholders like Day/Month if parsed
    const ageNumbers = ageMatches.filter((n) => n === "18" || n === "21" || n === "16" || n === "13");
    expect(ageNumbers.every((n) => n === "18")).toBe(true);

    const { container: blockedContainer } = render(<AgeStep mode="blocked" onConfirm={vi.fn()} />);
    const blockedText = blockedContainer.textContent ?? "";
    const blockedMatches = (blockedText.match(/\b\d+\b/g) ?? []).filter(
      (n) => n === "18" || n === "21" || n === "16" || n === "13"
    );
    expect(blockedMatches.every((n) => n === "18")).toBe(true);
  });
});
