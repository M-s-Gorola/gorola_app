import type { PaymentGateway } from "./payment-gateway.interface.js";

export class MockPaymentGateway implements PaymentGateway {
  // Allow overriding verifySignature for testing tampered/invalid signature scenarios
  public mockVerifyResult = true;

  async createOrder(params: { amount: number; currency: string; receipt: string }): Promise<{ id: string }> {
    return { id: `rp_order_mock_${params.receipt}` };
  }

  verifySignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    void params;
    return this.mockVerifyResult;
  }
}
