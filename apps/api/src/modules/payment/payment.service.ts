import { ForbiddenError, NotFoundError, ValidationError } from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";

import type { PaymentGateway } from "./payment-gateway.interface.js";

export class PaymentService {
  constructor(private readonly db: PrismaClient) {}

  async initiatePayment(orderId: string, buyerId: string, gateway: PaymentGateway) {
    const order = await this.db.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new NotFoundError("Order not found", { orderId });
    }

    if (order.userId !== buyerId) {
      throw new ForbiddenError("You do not have permission to initiate payment for this order", { orderId });
    }

    if (order.paymentMethod === "COD") {
      throw new ValidationError("Payment initiation is only valid for UPI and CARD orders.");
    }

    const totalAmount = Number(order.total);
    const amountInPaise = Math.round(totalAmount * 100);

    const gatewayOrder = await gateway.createOrder({
      amount: amountInPaise,
      currency: "INR",
      receipt: order.id
    });

    const updatedOrder = await this.db.order.update({
      where: { id: order.id },
      data: {
        razorpayOrderId: gatewayOrder.id
      }
    });

    return {
      razorpayOrderId: updatedOrder.razorpayOrderId,
      amount: amountInPaise,
      currency: "INR"
    };
  }

  async verifyPayment(
    orderId: string,
    buyerId: string,
    razorpayPaymentId: string,
    signature: string,
    gateway: PaymentGateway
  ) {
    const order = await this.db.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new NotFoundError("Order not found", { orderId });
    }

    if (order.userId !== buyerId) {
      throw new ForbiddenError("You do not have permission to verify payment for this order", { orderId });
    }

    if (!order.razorpayOrderId) {
      throw new ValidationError("Razorpay order ID is missing from the order record.");
    }

    const verified = gateway.verifySignature({
      orderId: order.razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature
    });

    if (verified) {
      await this.db.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "CAPTURED",
          razorpayPaymentId
        }
      });
      return { success: true };
    } else {
      await this.db.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "FAILED"
        }
      });
      throw new ValidationError("Payment signature verification failed.");
    }
  }
}
