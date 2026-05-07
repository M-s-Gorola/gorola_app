import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TopographicBg } from "./TopographicBg";

describe("TopographicBg", () => {
  it("renders a decorative SVG with aria-hidden", () => {
    const { container } = render(<TopographicBg />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies opacity style from prop (default 0.2)", () => {
    const { container } = render(<TopographicBg />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveStyle({ opacity: "0.2" });
  });

  it("applies custom opacity", () => {
    const { container } = render(<TopographicBg opacity={0.2} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveStyle({ opacity: "0.2" });
  });
});
