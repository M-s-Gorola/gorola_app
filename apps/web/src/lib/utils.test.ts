import { describe, expect, it } from "vitest";

import { cn, formatCurrency, formatStatusLabel, getStatusBadgeClasses } from "./utils";

describe("utils", () => {
  describe("formatStatusLabel", () => {
    describe("Regular and Quick Commerce Orders", () => {
      it("formats standard statuses properly with capital letters", () => {
        expect(formatStatusLabel("PLACED")).toBe("Placed");
        expect(formatStatusLabel("PREPARING")).toBe("Preparing");
        expect(formatStatusLabel("CONFIRMED")).toBe("Confirmed");
        expect(formatStatusLabel("CANCELLED")).toBe("Cancelled");
      });

      it("formats OUT_FOR_DELIVERY as Out For Delivery when orderType is REGULAR or unspecified", () => {
        expect(formatStatusLabel("OUT_FOR_DELIVERY")).toBe("Out For Delivery");
        expect(formatStatusLabel("OUT_FOR_DELIVERY", "REGULAR")).toBe("Out For Delivery");
        expect(formatStatusLabel("OUT_FOR_DELIVERY", "QUICK")).toBe("Out For Delivery");
      });

      it("formats DELIVERED as Delivered when orderType is REGULAR or unspecified", () => {
        expect(formatStatusLabel("DELIVERED")).toBe("Delivered");
        expect(formatStatusLabel("DELIVERED", "REGULAR")).toBe("Delivered");
        expect(formatStatusLabel("DELIVERED", "QUICK")).toBe("Delivered");
      });
    });

    describe("Booking Commerce Orders (Field Technician / Service Visits)", () => {
      it("translates OUT_FOR_DELIVERY to On The Way for BOOKING orders", () => {
        expect(formatStatusLabel("OUT_FOR_DELIVERY", "BOOKING")).toBe("On The Way");
      });

      it("translates ON_THE_WAY to On The Way for BOOKING orders", () => {
        expect(formatStatusLabel("ON_THE_WAY", "BOOKING")).toBe("On The Way");
      });

      it("translates DELIVERED to Completed for BOOKING orders", () => {
        expect(formatStatusLabel("DELIVERED", "BOOKING")).toBe("Completed");
      });

      it("translates COMPLETED to Completed for BOOKING orders", () => {
        expect(formatStatusLabel("COMPLETED", "BOOKING")).toBe("Completed");
      });

      it("preserves approval terminology for BOOKING orders", () => {
        expect(formatStatusLabel("PENDING_APPROVAL", "BOOKING")).toBe("Pending Approval");
        expect(formatStatusLabel("APPROVED", "BOOKING")).toBe("Approved");
        expect(formatStatusLabel("REJECTED", "BOOKING")).toBe("Rejected");
        expect(formatStatusLabel("CANCELLED", "BOOKING")).toBe("Cancelled");
      });
    });

    describe("Edge and Special Cases", () => {
      it("returns empty string for empty, null, or undefined status", () => {
        expect(formatStatusLabel("")).toBe("");
        // @ts-expect-error test undefined input
        expect(formatStatusLabel(undefined)).toBe("");
        // @ts-expect-error test null input
        expect(formatStatusLabel(null)).toBe("");
      });

      it("handles lowercase and mixed-case inputs gracefully", () => {
        expect(formatStatusLabel("out_for_delivery", "BOOKING")).toBe("On The Way");
        expect(formatStatusLabel("delivered", "BOOKING")).toBe("Completed");
        expect(formatStatusLabel("pending_approval", "BOOKING")).toBe("Pending Approval");
      });
    });
  });

  describe("formatCurrency", () => {
    it("formats numerical numbers with Rs prefix and 2 decimal points", () => {
      expect(formatCurrency(120)).toBe("Rs 120.00");
      expect(formatCurrency(1499.5)).toBe("Rs 1499.50");
      expect(formatCurrency(0)).toBe("Rs 0.00");
    });

    it("formats numeric strings correctly", () => {
      expect(formatCurrency("250.75")).toBe("Rs 250.75");
    });

    it("handles null or undefined by returning Rs 0.00", () => {
      expect(formatCurrency(null)).toBe("Rs 0.00");
      expect(formatCurrency(undefined)).toBe("Rs 0.00");
    });
  });

  describe("cn (tailwind merge)", () => {
    it("merges class names correctly", () => {
      expect(cn("px-2", "py-1", true && "text-red-500")).toBe("px-2 py-1 text-red-500");
      expect(cn("px-2 px-4")).toBe("px-4");
    });
  });

  describe("getStatusBadgeClasses (consistent platform status colors)", () => {
    it("returns emerald/green classes for DELIVERED and COMPLETED", () => {
      expect(getStatusBadgeClasses("DELIVERED")).toContain("emerald");
      expect(getStatusBadgeClasses("COMPLETED")).toContain("emerald");
    });

    it("returns blue classes for OUT_FOR_DELIVERY and ON_THE_WAY", () => {
      expect(getStatusBadgeClasses("OUT_FOR_DELIVERY")).toContain("blue");
      expect(getStatusBadgeClasses("ON_THE_WAY")).toContain("blue");
    });

    it("returns indigo classes for PREPARING, APPROVED, and CONFIRMED", () => {
      expect(getStatusBadgeClasses("PREPARING")).toContain("indigo");
      expect(getStatusBadgeClasses("APPROVED")).toContain("indigo");
      expect(getStatusBadgeClasses("CONFIRMED")).toContain("indigo");
    });

    it("returns amber classes for PLACED and PENDING_APPROVAL", () => {
      expect(getStatusBadgeClasses("PLACED")).toContain("amber");
      expect(getStatusBadgeClasses("PENDING_APPROVAL")).toContain("amber");
    });

    it("returns red classes for CANCELLED and REJECTED", () => {
      expect(getStatusBadgeClasses("CANCELLED")).toContain("red");
      expect(getStatusBadgeClasses("REJECTED")).toContain("red");
    });

    it("handles unknown or empty statuses with neutral slate", () => {
      expect(getStatusBadgeClasses("")).toContain("slate");
      // @ts-expect-error test undefined
      expect(getStatusBadgeClasses(undefined)).toContain("slate");
    });
  });
});

