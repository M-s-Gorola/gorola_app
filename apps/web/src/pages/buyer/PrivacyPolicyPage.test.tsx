import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PrivacyPolicyPage } from "./PrivacyPolicyPage";

describe("PrivacyPolicyPage (/privacy)", () => {
  it("renders statutory DPDP policy information, all 11 statutory sections, and legal rights links", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicyPage />
      </MemoryRouter>
    );

    // Header & Identification
    expect(screen.getByRole("heading", { level: 1, name: /GoRola Privacy Policy/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Digital Personal Data Protection \(DPDP\) Act 2023/i).length).toBeGreaterThanOrEqual(1);

    // Section 1: Who We Are & Data Fiduciary Details
    expect(screen.getByRole("heading", { name: /1\. Overview & Data Fiduciary Details/i })).toBeInTheDocument();

    // Section 2: Personal Data Categories
    expect(screen.getByRole("heading", { name: /2\. Categories of Personal Data Collected/i })).toBeInTheDocument();

    // Section 3: Specified Purposes of Processing
    expect(screen.getByRole("heading", { name: /3\. Specified Purposes of Data Processing/i })).toBeInTheDocument();

    // Section 4: Retention Schedules & Auto-Purge Timelines
    expect(screen.getByRole("heading", { name: /4\. Retention Schedules & Auto-Purge Timelines/i })).toBeInTheDocument();
    expect(screen.getAllByText(/30-Day Grace Period/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/7-Year GST/i).length).toBeGreaterThanOrEqual(1);

    // Section 5: Third-Party Processors & Infrastructure
    expect(screen.getByRole("heading", { name: /5\. Third-Party Service Partners & Infrastructure/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Exotel/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Ola Maps/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Razorpay/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Railway/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Vercel/i).length).toBeGreaterThanOrEqual(1);

    // Section 6: User Rights
    expect(screen.getByRole("heading", { name: /6\. Your Statutory Data Principal Rights/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Right to Access & Portability/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Right to Correction & Erasure/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Right of Grievance Redressal/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Right to Nominate/i).length).toBeGreaterThanOrEqual(1);

    // Section 7: Children's Data
    expect(screen.getByRole("heading", { name: /7\. Protection of Children's Data/i })).toBeInTheDocument();
    expect(screen.getAllByText(/18 years of age/i).length).toBeGreaterThanOrEqual(1);

    // Section 8: Security & Breach Protocol
    expect(screen.getByRole("heading", { name: /8\. Technical Security Safeguards & Breach Notification/i })).toBeInTheDocument();
    expect(screen.getAllByText(/72 hours/i).length).toBeGreaterThanOrEqual(1);

    // Section 9: DPO and Statutory Grievance Redressal
    expect(screen.getByRole("heading", { name: /9\. Data Protection Officer & Grievance Redressal/i })).toBeInTheDocument();
    expect(screen.getAllByText(/dpo@gorola.com/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Data Protection Board of India \(DPBI\)/i).length).toBeGreaterThanOrEqual(1);

    // Section 10: Policy Updates & Versioning
    expect(screen.getByRole("heading", { name: /10\. Policy Updates & Versioning/i })).toBeInTheDocument();

    // Section 11: Governing Law & Jurisdiction
    expect(screen.getByRole("heading", { name: /11\. Governing Law & Jurisdiction/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Dehradun, Uttarakhand/i).length).toBeGreaterThanOrEqual(1);

    // Link to manage privacy settings
    const manageLink = screen.getByRole("link", { name: /Manage Privacy & Consent Settings/i });
    expect(manageLink).toBeInTheDocument();
    expect(manageLink).toHaveAttribute("href", "/account/privacy");
  });
});
