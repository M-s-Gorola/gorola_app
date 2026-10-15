import { describe, expect, it } from "vitest";

import type { InvoiceData } from "../../../modules/invoice/invoice.types.js";
import { formatInvoice } from "../../../modules/invoice/invoice-formatter.js";

describe("Invoice Formatter Unit Tests", () => {
  const sampleQuickInvoice: InvoiceData = {
    orderId: "ord-quick-12345",
    orderType: "QUICK",
    createdAt: new Date("2026-10-09T10:30:00.000Z"),
    status: "DELIVERED",
    seller: {
      storeName: "Fresh Daily Groceries",
      address: "123 Market Road, Mussoorie",
      phone: "+919876543210",
      gstin: "05AAAAA0000A1Z5"
    },
    buyer: {
      name: "John Doe",
      phone: "+919998887776",
      deliveryAddress: "Flat 4B, Hilltop Residency, Mussoorie"
    },
    items: [
      {
        name: "Fresh Farm Milk",
        variantLabel: "1 Liter",
        quantity: 2,
        unitPrice: 60.0,
        lineTotal: 120.0
      },
      {
        name: "Brown Bread",
        variantLabel: "400g",
        quantity: 1,
        unitPrice: 45.0,
        lineTotal: 45.0
      }
    ],
    pricing: {
      subtotal: 165.0,
      feeType: "Delivery Fee",
      feeAmount: 30.0,
      discountCode: "WELCOME50",
      discountSavingAmount: 50.0,
      appliedOfferTitle: "Morning Deals 10% OFF",
      offerSavingAmount: 16.5,
      taxRate: 18.0,
      grandTotal: 128.5
    }
  };

  it("should format quick commerce tax invoice with seller, buyer, itemized table, promotions, and GST", () => {
    const formatted = formatInvoice(sampleQuickInvoice);

    // Header & Meta
    expect(formatted).toContain("TAX INVOICE");
    expect(formatted).toContain("ord-quick-12345");
    expect(formatted).toContain("Fresh Daily Groceries");
    expect(formatted).toContain("05AAAAA0000A1Z5");

    // Buyer info
    expect(formatted).toContain("John Doe");
    expect(formatted).toContain("Flat 4B, Hilltop Residency, Mussoorie");

    // Items table
    expect(formatted).toContain("Fresh Farm Milk");
    expect(formatted).toContain("1 Liter");
    expect(formatted).toContain("120.00");
    expect(formatted).toContain("Brown Bread");
    expect(formatted).toContain("45.00");

    // Pricing breakdown
    expect(formatted).toContain("Subtotal");
    expect(formatted).toContain("165.00");
    expect(formatted).toContain("Delivery Fee");
    expect(formatted).toContain("30.00");
    expect(formatted).toContain("Coupon (WELCOME50)");
    expect(formatted).toContain("-₹50.00");
    expect(formatted).toContain("Offer (Morning Deals 10% OFF)");
    expect(formatted).toContain("-₹16.50");
    expect(formatted).toContain("GST (18.00%)");
    expect(formatted).toContain("Grand Total");
    expect(formatted).toContain("₹128.50");
  });

  it("should render 'Service Fee' for BOOKING orders and omit promotions when not applied", () => {
    const bookingInvoice: InvoiceData = {
      orderId: "ord-booking-999",
      orderType: "BOOKING",
      createdAt: new Date("2026-10-09T14:00:00.000Z"),
      status: "COMPLETED",
      seller: {
        storeName: "Expert Home Services",
        address: "45 Mall Road, Mussoorie"
      },
      buyer: {
        name: "Jane Smith",
        deliveryAddress: "Villa 12, Pine Forest, Mussoorie"
      },
      items: [
        {
          name: "Deep House Cleaning",
          variantLabel: "2 BHK",
          quantity: 1,
          unitPrice: 1500.0,
          lineTotal: 1500.0
        }
      ],
      pricing: {
        subtotal: 1500.0,
        feeType: "Service Fee",
        feeAmount: 50.0,
        discountCode: null,
        discountSavingAmount: 0,
        appliedOfferTitle: null,
        offerSavingAmount: 0,
        taxRate: null,
        grandTotal: 1550.0
      }
    };

    const formatted = formatInvoice(bookingInvoice);

    expect(formatted).toContain("Service Fee");
    expect(formatted).not.toContain("Delivery Fee");
    expect(formatted).not.toContain("Coupon");
    expect(formatted).not.toContain("Offer (");
    expect(formatted).not.toContain("GST (");
    expect(formatted).toContain("₹1550.00");
  });
});
