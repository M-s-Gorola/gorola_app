export interface PaymentGateway {
  createOrder(params: { amount: number; currency: string; receipt: string }): Promise<{ id: string }>;
  verifySignature(params: { orderId: string; paymentId: string; signature: string }): boolean;
}
