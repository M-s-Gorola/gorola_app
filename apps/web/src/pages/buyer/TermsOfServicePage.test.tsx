import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { TermsOfServicePage } from "./TermsOfServicePage";

describe("TermsOfServicePage (/terms)", () => {
  it("renders terms of service headings, 18+ eligibility requirement, Mussoorie hill operations, and links", () => {
    render(
      <MemoryRouter>
        <TermsOfServicePage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /GoRola Terms of Service/i })).toBeInTheDocument();

    // Section: Eligibility (18+)
    expect(screen.getByRole("heading", { name: /1\. Eligibility & Account Creation/i })).toBeInTheDocument();
    expect(screen.getAllByText(/at least 18 years of age/i).length).toBeGreaterThanOrEqual(1);

    // Section: Mussoorie Hill Operations & Weather Mode
    expect(screen.getByRole("heading", { name: /2\. Hill-Station Operations & Weather Delivery Modes/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Mussoorie/i).length).toBeGreaterThanOrEqual(1);

    // Section: Orders, Pricing, and Payments
    expect(screen.getByRole("heading", { name: /3\. Ordering, Pricing & Payments/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Razorpay/i).length).toBeGreaterThanOrEqual(1);

    // Section: Cancellations & Refunds
    expect(screen.getByRole("heading", { name: /4\. Cancellations, Returns & Refunds/i })).toBeInTheDocument();

    // Section: User Conduct & Prohibited Activities
    expect(screen.getByRole("heading", { name: /5\. User Conduct & Prohibited Uses/i })).toBeInTheDocument();

    // Section: Limitation of Liability & Force Majeure
    expect(screen.getByRole("heading", { name: /6\. Disclaimers, Liability & Force Majeure/i })).toBeInTheDocument();

    // Section: Governing Law
    expect(screen.getByRole("heading", { name: /7\. Governing Law & Dispute Resolution/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Dehradun, Uttarakhand/i).length).toBeGreaterThanOrEqual(1);

    // Link to privacy policy
    const privacyLink = screen.getByRole("link", { name: /Privacy Policy/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });
});
