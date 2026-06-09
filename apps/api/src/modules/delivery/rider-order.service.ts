import type { OrderRepository, OrderWithRelations } from "../order/order.repository.js";

export class RiderOrderService {
  public constructor(private readonly orders: OrderRepository) {}

  public async getActiveOrders(storeId: string): Promise<OrderWithRelations[]> {
    return this.orders.findManyByStore(storeId, {
      status: ["PREPARING", "OUT_FOR_DELIVERY"]
    });
  }
}
