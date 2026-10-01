import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect,it } from "vitest";

import { ConsentNoticeModal } from "./ConsentNoticeModal";

describe("ConsentNoticeModal (DPDP Phase 8.2.9.5)", () => {
  it("renders trigger button and modal is closed by default", () => {
    render(<ConsentNoticeModal purpose="OTP_AUTH" />);
    const trigger = screen.getByTestId("view-notice-btn-OTP_AUTH");
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByTestId("consent-notice-modal")).not.toBeInTheDocument();
  });

  it("clicking trigger opens modal with OTP_AUTH 5-section notice", async () => {
    const user = userEvent.setup();
    render(<ConsentNoticeModal purpose="OTP_AUTH" />);

    await user.click(screen.getByTestId("view-notice-btn-OTP_AUTH"));

    const modal = await screen.findByTestId("consent-notice-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByText(/Authentication & Account Security/i)).toBeInTheDocument();
    expect(screen.getByText(/Purpose of Processing/i)).toBeInTheDocument();
    expect(screen.getByText(/Categories of Personal Data Collected/i)).toBeInTheDocument();
    expect(screen.getByText(/Third-Party Recipients & Processors/i)).toBeInTheDocument();
    expect(screen.getByText(/Retention Period/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Rights & Complaints/i)).toBeInTheDocument();
    expect(screen.getByText(/Exotel|authorized SMS Gateway Partners/i)).toBeInTheDocument();
    expect(screen.getAllByText(/dpo@gorola.com/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Data Protection Board of India/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders ORDER_PROCESSING notice with accurate GPS retention and display name disclosures", async () => {
    const user = userEvent.setup();
    render(<ConsentNoticeModal purpose="ORDER_PROCESSING" />);

    await user.click(screen.getByTestId("view-notice-btn-ORDER_PROCESSING"));

    expect(await screen.findByTestId("consent-notice-modal")).toBeInTheDocument();
    expect(screen.getByText(/Order Fulfillment & Location Services/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ola Maps/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Razorpay/i)).toBeInTheDocument();
    expect(screen.getByText(/7 years under Indian GST/i)).toBeInTheDocument();
    expect(screen.getByText(/Your saved delivery address \(including GPS pin\) is stored until you delete it or your account/i)).toBeInTheDocument();
    expect(screen.queryByText(/deleted immediately upon successful delivery verification/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Display Name \(if you have set one\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Data Protection Board of India/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders MARKETING_COMMS notice with SMS promotion channel and voluntary withdrawal terms", async () => {
    const user = userEvent.setup();
    render(<ConsentNoticeModal purpose="MARKETING_COMMS" />);

    await user.click(screen.getByTestId("view-notice-btn-MARKETING_COMMS"));

    expect(await screen.findByTestId("consent-notice-modal")).toBeInTheDocument();
    expect(screen.getByText(/Promotions & Seasonal Offers/i)).toBeInTheDocument();
    expect(screen.getByText(/Phone Number — used to send SMS promotional messages/i)).toBeInTheDocument();
    expect(screen.getByText(/authorised SMS gateway partners/i)).toBeInTheDocument();
    expect(screen.getAllByText(/withdraw your consent/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders ANALYTICS notice with Zero PII telemetry disclosure", async () => {
    const user = userEvent.setup();
    render(<ConsentNoticeModal purpose="ANALYTICS" />);

    await user.click(screen.getByTestId("view-notice-btn-ANALYTICS"));

    expect(await screen.findByTestId("consent-notice-modal")).toBeInTheDocument();
    expect(screen.getByText(/Usage & Performance Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero PII/i)).toBeInTheDocument();
  });

  it("allows custom triggerLabel and triggerClassName", () => {
    render(
      <ConsentNoticeModal
        purpose="OTP_AUTH"
        triggerLabel="Custom Notice Link"
        triggerClassName="text-red-500"
      />
    );
    expect(screen.getByText("Custom Notice Link")).toBeInTheDocument();
  });
});
