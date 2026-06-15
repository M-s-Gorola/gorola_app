import { ForbiddenError, NotFoundError, ValidationError } from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockPaymentGateway } from "../../../modules/payment/mock-payment-gateway.js";
import { PaymentService } from "../../../modules/payment/payment.service.js";

describe("PaymentService Unit Tests", () => {
  let dbMock: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: PaymentService;
  let gateway: MockPaymentGateway;

  beforeEach(() => {
    dbMock = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new PaymentService(dbMock as unknown as PrismaClient);
    gateway = new MockPaymentGateway();
  });

  describe("initiatePayment", () => {
    it("throws NotFoundError if order does not exist", async () => {
      dbMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.initiatePayment("non-existent-order", "buyer-1", gateway)
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError if order does not belong to buyer", async () => {
      dbMock.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "buyer-2",
        paymentMethod: "UPI",
        total: "100.00",
      });

      await expect(
        service.initiatePayment("order-1", "buyer-1", gateway)
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ValidationError if payment method is COD", async () => {
      dbMock.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "buyer-1",
        paymentMethod: "COD",
        total: "100.00",
      });

      await expect(
        service.initiatePayment("order-1", "buyer-1", gateway)
      ).rejects.toThrow(ValidationError);
    });

    it("calls gateway.createOrder with amount in paise and updates DB with razorpayOrderId", async () => {
      dbMock.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "buyer-1",
        paymentMethod: "UPI",
        total: "150.50",
      });

      dbMock.order.update.mockResolvedValue({
        id: "order-1",
        razorpayOrderId: "rp_order_mock_order-1",
      });

      const result = await service.initiatePayment("order-1", "buyer-1", gateway);

      expect(result.razorpayOrderId).toBe("rp_order_mock_order-1");
      expect(result.amount).toBe(15050); // 150.50 * 100
      expect(result.currency).toBe("INR");

      expect(dbMock.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: { razorpayOrderId: "rp_order_mock_order-1" },
      });
    });
  });

  describe("verifyPayment", () => {
    it("throws NotFoundError if order does not exist", async () => {
      dbMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyPayment("non-existent-order", "buyer-1", "pay-1", "sig-1", gateway)
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError if order does not belong to buyer", async () => {
      dbMock.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "buyer-2",
        razorpayOrderId: "rp_order-1",
      });

      await expect(
        service.verifyPayment("order-1", "buyer-1", "pay-1", "sig-1", gateway)
      ).rejects.toThrow(ForbiddenError);
    });

    it("updates order to CAPTURED when signature is verified", async () => {
      dbMock.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "buyer-1",
        razorpayOrderId: "rp_order-1",
      });

      dbMock.order.update.mockResolvedValue({
        id: "order-1",
        paymentStatus: "CAPTURED",
      });

      gateway.mockVerifyResult = true;

      const result = await service.verifyPayment("order-1", "buyer-1", "pay-1", "sig-1", gateway);
      expect(result.success).toBe(true);

      expect(dbMock.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: {
          paymentStatus: "CAPTURED",
          razorpayPaymentId: "pay-1",
        },
      });
    });

    it("updates order to FAILED and throws ValidationError when signature fails verification", async () => {
      dbMock.order.findUnique.mockResolvedValue({
        id: "order-1",
        userId: "buyer-1",
        razorpayOrderId: "rp_order-1",
      });

      dbMock.order.update.mockResolvedValue({
        id: "order-1",
        paymentStatus: "FAILED",
      });

      gateway.mockVerifyResult = false;

      await expect(
        service.verifyPayment("order-1", "buyer-1", "pay-1", "sig-1", gateway)
      ).rejects.toThrow(ValidationError);

      expect(dbMock.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: {
          paymentStatus: "FAILED",
        },
      });
    });
  });
});
