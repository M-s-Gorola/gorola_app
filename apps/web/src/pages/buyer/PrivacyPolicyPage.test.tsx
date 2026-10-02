import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PrivacyPolicyPage } from "./PrivacyPolicyPage";

describe("PrivacyPolicyPage (/privacy)", () => {
  it("renders statutory DPDP policy information, bolded third-party services, and rights links", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicyPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /GoRola Privacy Policy/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Digital Personal Data Protection \(DPDP\) Act 2023/i).length).toBeGreaterThanOrEqual(1);

    // Bolded Third-party services
    expect(screen.getAllByText(/Exotel/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Ola Maps/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Razorpay/i).length).toBeGreaterThanOrEqual(1);

    // DPO and statutory body
    expect(screen.getByText(/dpo@gorola.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Protection Board of India \(DPBI\)/i)).toBeInTheDocument();

    // Link to manage privacy settings
    const manageLink = screen.getByRole("link", { name: /Manage Privacy & Consent Settings/i });
    expect(manageLink).toBeInTheDocument();
    expect(manageLink).toHaveAttribute("href", "/account/privacy");
  });
});
