import { ForbiddenError, NotFoundError, ValidationError } from "@gorola/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingOrderService } from "../../../modules/booking/booking-order.service.js";

// Mock repository
const mockRepository = {
  findById: vi.fn(),
  findByStoreId: vi.fn()
};

// Mock Prisma models and operations
const mockStore = {
  findUnique: vi.fn()
};

const mockAddress = {
  findUnique: vi.fn()
};

const mockProductVariant = {
  findUnique: vi.fn()
};

const mockOrder = {
  create: vi.fn(),
  update: vi.fn(),
  findUniqueOrThrow: vi.fn()
};

const mockBookingOrder = {
  create: vi.fn(),
  update: vi.fn()
};

const mockOrderStatusHistory = {
  create: vi.fn()
};

const mockTx = {
  order: mockOrder,
  bookingOrder: mockBookingOrder,
  orderStatusHistory: mockOrderStatusHistory
} as never;

const mockDb = {
  store: mockStore,
  address: mockAddress,
  productVariant: mockProductVariant,
  $transaction: vi.fn()
};

describe("BookingOrderService (unit)", () => {
  let service: BookingOrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(
      (fn: (t: never) => Promise<unknown>) => fn(mockTx)
    );
    service = new BookingOrderService(mockDb as never, mockRepository as never);
  });

  describe("placeBookingRequest", () => {
    it("should throw ValidationError if items list is empty", async () => {
      await expect(
        service.placeBookingRequest("u1", "s1", [], {
          scheduledDate: new Date(),
          timeslot: "06:00-09:00",
          addressId: "a1"
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("should throw NotFoundError if store does not exist", async () => {
      mockStore.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.placeBookingRequest(
          "u1",
          "s1",
          [{ productId: "p1", variantId: "v1" }],
          {
            scheduledDate: new Date(),
            timeslot: "06:00-09:00",
            addressId: "a1"
          }
        )
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("should throw AppError with INVALID_STORE_TYPE if store is not BOOKING_COMMERCE", async () => {
      mockStore.findUnique.mockResolvedValueOnce({
        id: "s1",
        storeType: "QUICK_COMMERCE",
        isAcceptingBookings: true
      });

      await expect(
        service.placeBookingRequest(
          "u1",
          "s1",
          [{ productId: "p1", variantId: "v1" }],
          {
            scheduledDate: new Date(),
            timeslot: "06:00-09:00",
            addressId: "a1"
          }
        )
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INVALID_STORE_TYPE"
        })
      );
    });

    it("should throw AppError with STORE_NOT_ACCEPTING_BOOKINGS if store acceptsBookings is false", async () => {
      mockStore.findUnique.mockResolvedValueOnce({
        id: "s1",
        storeType: "BOOKING_COMMERCE",
        isAcceptingBookings: false
      });

      await expect(
        service.placeBookingRequest(
          "u1",
          "s1",
          [{ productId: "p1", variantId: "v1" }],
          {
            scheduledDate: new Date(),
            timeslot: "06:00-09:00",
            addressId: "a1"
          }
        )
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "STORE_NOT_ACCEPTING_BOOKINGS"
        })
      );
    });

    it("should throw AppError with INVALID_BOOKING_DATE if date is in past or too early", async () => {
      mockStore.findUnique.mockResolvedValueOnce({
        id: "s1",
        storeType: "BOOKING_COMMERCE",
        isAcceptingBookings: true,
        bookingLeadDays: 1
      });

      const today = new Date(); // today fails since lead day is 1

      await expect(
        service.placeBookingRequest(
          "u1",
          "s1",
          [{ productId: "p1", variantId: "v1" }],
          {
            scheduledDate: today,
            timeslot: "06:00-09:00",
            addressId: "a1"
          }
        )
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INVALID_BOOKING_DATE"
        })
      );
    });

    it("should throw NotFoundError if address does not exist", async () => {
      mockStore.findUnique.mockResolvedValueOnce({
        id: "s1",
        storeType: "BOOKING_COMMERCE",
        isAcceptingBookings: true,
        bookingLeadDays: 1
      });

      mockAddress.findUnique.mockResolvedValueOnce(null);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await expect(
        service.placeBookingRequest(
          "u1",
          "s1",
          [{ productId: "p1", variantId: "v1" }],
          {
            scheduledDate: tomorrow,
            timeslot: "06:00-09:00",
            addressId: "a1"
          }
        )
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("should throw ForbiddenError if address belongs to someone else", async () => {
      mockStore.findUnique.mockResolvedValueOnce({
        id: "s1",
        storeType: "BOOKING_COMMERCE",
        isAcceptingBookings: true,
        bookingLeadDays: 1
      });

      mockAddress.findUnique.mockResolvedValueOnce({
        id: "a1",
        userId: "someone-else"
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await expect(
        service.placeBookingRequest(
          "u1",
          "s1",
          [{ productId: "p1", variantId: "v1" }],
          {
            scheduledDate: tomorrow,
            timeslot: "06:00-09:00",
            addressId: "a1"
          }
        )
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("approveBooking", () => {
    it("should throw NotFoundError if booking order not found", async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.approveBooking("s1", "ord1", "owner1")).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it("should throw ForbiddenError if store owner is not linked to order store", async () => {
      mockRepository.findById.mockResolvedValueOnce({
        order: { storeId: "other-store" }
      });

      await expect(service.approveBooking("s1", "ord1", "owner1")).rejects.toBeInstanceOf(
        ForbiddenError
      );
    });

    it("should throw ValidationError if order status is not PENDING_APPROVAL", async () => {
      mockRepository.findById.mockResolvedValueOnce({
        order: { storeId: "s1", status: "APPROVED" }
      });

      await expect(service.approveBooking("s1", "ord1", "owner1")).rejects.toBeInstanceOf(
        ValidationError
      );
    });
  });

  describe("rejectBooking", () => {
    it("should throw NotFoundError if booking order not found", async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.rejectBooking("s1", "ord1", "owner1", "Slot full")).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });

  describe("cancelBookingByBuyer", () => {
    it("should throw NotFoundError if booking order not found", async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.cancelBookingByBuyer("u1", "ord1")).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it("should throw ForbiddenError if order userId does not match caller", async () => {
      mockRepository.findById.mockResolvedValueOnce({
        order: { userId: "other-user" }
      });

      await expect(service.cancelBookingByBuyer("u1", "ord1")).rejects.toBeInstanceOf(
        ForbiddenError
      );
    });

    it("should throw AppError with CANNOT_CANCEL_APPROVED_BOOKING if approvalStatus is not PENDING_APPROVAL", async () => {
      mockRepository.findById.mockResolvedValueOnce({
        approvalStatus: "APPROVED",
        order: { userId: "u1" }
      });

      await expect(service.cancelBookingByBuyer("u1", "ord1")).rejects.toThrowError(
        expect.objectContaining({
          code: "CANNOT_CANCEL_APPROVED_BOOKING"
        })
      );
    });
  });
});
