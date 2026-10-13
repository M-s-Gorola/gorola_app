import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeliveryNoteInput } from "./DeliveryNoteInput";

describe("DeliveryNoteInput (Phase 6.19.4)", () => {
  it("renders textarea with customizable label and placeholder", () => {
    const handleChange = vi.fn();
    render(
      <DeliveryNoteInput
        id="test-instructions"
        label="Instructions for Field Technician"
        onChange={handleChange}
        placeholder="e.g. Bring extra lancets"
        value=""
      />
    );

    expect(screen.getByLabelText("Instructions for Field Technician")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Bring extra lancets")).toBeInTheDocument();
    expect(screen.getByText("0 / 500 characters")).toBeInTheDocument();
  });

  it("enforces maxLength={500} and displays live character counter", async () => {
    const handleChange = vi.fn();
    render(
      <DeliveryNoteInput
        onChange={handleChange}
        value="Gate code 1234"
      />
    );

    expect(screen.getByText("14 / 500 characters")).toBeInTheDocument();

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("maxLength", "500");
  });

  it("trims excess whitespace on blur and invokes onChange", async () => {
    const handleChange = vi.fn();
    render(
      <DeliveryNoteInput
        onChange={handleChange}
        value="   Please call upon arrival   "
      />
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.blur(textarea);

    expect(handleChange).toHaveBeenCalledWith("Please call upon arrival");
  });

  it("accepts multiline input and special characters safely", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DeliveryNoteInput
        onChange={handleChange}
        value=""
      />
    );

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Line 1{enter}Line 2 - #402 & special: <tag>");

    expect(handleChange).toHaveBeenCalled();
  });
});
