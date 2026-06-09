import { AppError, ForbiddenError, NotFoundError } from "@gorola/shared";
import { type OrderStatus } from "@prisma/client";

import type { OrderRepository, OrderWithRelations } from "../order/order.repository.js";

export type RiderOrderEventEmitter = {
  emitStatusChanged: (orderId: string, status: string) => void | Promise<void>;
};

export class RiderOrderService {
  public constructor(
    private readonly orders: OrderRepository,
    private readonly emitter?: RiderOrderEventEmitter
  ) {}

  public async getActiveOrders(storeId: string): Promise<OrderWithRelations[]> {
    return this.orders.findManyByStore(storeId, {
      status: ["PREPARING", "OUT_FOR_DELIVERY"]
    });
  }

  public async updateOrderStatus(
    storeId: string,
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string
  ): Promise<OrderWithRelations> {
    const order = await this.orders.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to update this order");
    }

    const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
      PLACED: [],
      PREPARING: ["OUT_FOR_DELIVERY"],
      OUT_FOR_DELIVERY: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
      PENDING_APPROVAL: [],
      APPROVED: []
    };

    const currentStatus = order.status;
    // eslint-disable-next-line security/detect-object-injection
    const allowed = currentStatus in VALID_TRANSITIONS ? VALID_TRANSITIONS[currentStatus]! : [];

    if (newStatus === "CANCELLED") {
      throw new ForbiddenError("Riders are not allowed to cancel orders");
    }

    if (!allowed.includes(newStatus)) {
      throw new AppError(`Invalid status transition from ${currentStatus} to ${newStatus}`, {
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 422
      });
    }

    const updated = await this.orders.updateStatus(orderId, newStatus, changedBy);

    if (this.emitter) {
      void this.emitter.emitStatusChanged(orderId, newStatus);
    }

    return updated;
  }
}
