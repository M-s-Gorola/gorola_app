import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SupportPage } from "./SupportPage";

describe("SupportPage (/support)", () => {
  it("renders Mussoorie support desk, support@gorola.in email, operating hours, and FAQs", () => {
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>
    );

    // Main Heading & Subtitle
    expect(screen.getByRole("heading", { level: 1, name: /Customer Support & Help Desk/i })).toBeInTheDocument();
    expect(screen.getByText(/We're here to help with your orders, mountain deliveries, and inquiries/i)).toBeInTheDocument();

    // Primary Support Email
    const supportEmailLinks = screen.getAllByRole("link", { name: /support@gorola\.in/i });
    expect(supportEmailLinks.length).toBeGreaterThanOrEqual(1);
    expect(supportEmailLinks[0]).toHaveAttribute("href", "mailto:support@gorola.in");

    // Operating Hours
    expect(screen.getByText(/7:00 AM – 11:00 PM IST/i)).toBeInTheDocument();
    expect(screen.getByText(/Mussoorie Operations Desk/i)).toBeInTheDocument();

    // Quick Help Action Cards
    expect(screen.getByRole("heading", { name: /Live Order Assistance/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Merchant & Rider Inquiries/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Data Privacy & Grievances/i })).toBeInTheDocument();

    // Privacy Grievance Email Reference
    expect(screen.getByRole("link", { name: /privacy@gorola\.in/i })).toHaveAttribute(
      "href",
      "mailto:privacy@gorola.in"
    );

    // FAQs Section
    expect(screen.getByRole("heading", { name: /Frequently Asked Questions/i })).toBeInTheDocument();
    expect(screen.getByText(/How does mountain weather affect delivery times\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Can I cancel or modify my order after placing it\?/i)).toBeInTheDocument();
    expect(screen.getByText(/How do refunds work for failed or cancelled orders\?/i)).toBeInTheDocument();

    // Links to Order History & Privacy
    const ordersLink = screen.getByRole("link", { name: /View Order History/i });
    expect(ordersLink).toBeInTheDocument();
    expect(ordersLink).toHaveAttribute("href", "/account/orders");
  });

  it("expands FAQ answers when accordion triggers are clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>
    );

    const weatherFaqTrigger = screen.getByRole("button", {
      name: /How does mountain weather affect delivery times\?/i,
    });
    expect(weatherFaqTrigger).toBeInTheDocument();

    // Expand FAQ
    await user.click(weatherFaqTrigger);
    expect(
      await screen.findByText(/During intense fog, heavy monsoon rains, or snow in upper Landour/i)
    ).toBeInTheDocument();
  });
});
