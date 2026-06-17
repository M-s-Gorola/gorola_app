import { createHmac } from "node:crypto";

import Razorpay from "razorpay";

import type { PaymentGateway } from "./payment-gateway.interface.js";

export class RazorpayPaymentGateway implements PaymentGateway {
  private razorpay: Razorpay;

  constructor() {
    this.razorpay = new (Razorpay as unknown as new (config: { key_id: string; key_secret: string }) => Razorpay)({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || ""
    });
  }

  async createOrder(params: { amount: number; currency: string; receipt: string }): Promise<{ id: string }> {
    const order = await this.razorpay.orders.create({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt
    });
    return { id: order.id };
  }

  verifySignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const generated = createHmac("sha256", secret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest("hex");
    return generated === params.signature;
  }
}
