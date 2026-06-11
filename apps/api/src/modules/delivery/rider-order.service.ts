import { AppError, ForbiddenError, NotFoundError } from "@gorola/shared";
import { type OrderStatus } from "@prisma/client";

import type { OrderRepository, OrderWithRelations } from "../order/order.repository.js";
import type { RiderRepository } from "./rider.repository.js";

export type RiderOrderEventEmitter = {
  emitStatusChanged: (orderId: string, status: string) => void | Promise<void>;
};

export class RiderOrderService {
  public constructor(
    private readonly orders: OrderRepository,
    private readonly riders: RiderRepository,
    private readonly emitter?: RiderOrderEventEmitter
  ) {}

  public async getActiveOrders(storeIds: string[], riderId: string): Promise<OrderWithRelations[]> {
    const rider = await this.riders.findById(riderId);
    if (!rider) {
      throw new NotFoundError("Rider not found");
    }

    if (rider.riderType === "FIELD_TECHNICIAN") {
      const now = new Date();
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const startOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

      return this.orders.findManyByStore(storeIds, {
        status: ["APPROVED", "OUT_FOR_DELIVERY"],
        orderType: "BOOKING",
        scheduledDateFrom: startOfToday,
        scheduledDateTo: startOfTomorrow
      });
    }

    return this.orders.findManyByStore(storeIds, {
      status: ["PREPARING", "OUT_FOR_DELIVERY"],
      orderType: "QUICK"
    });
  }

  public async updateOrderStatus(
    storeIds: string | string[],
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string
  ): Promise<OrderWithRelations> {
    const order = await this.orders.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const isAuthorized = Array.isArray(storeIds) ? storeIds.includes(order.storeId) : order.storeId === storeIds;
    if (!isAuthorized) {
      throw new ForbiddenError("You are not authorized to update this order");
    }

    const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
      PLACED: [],
      PREPARING: ["OUT_FOR_DELIVERY"],
      OUT_FOR_DELIVERY: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
      PENDING_APPROVAL: [],
      APPROVED: ["OUT_FOR_DELIVERY"]
    };

    const currentStatus = order.status;

    if (order.orderType === "QUICK" && currentStatus === "APPROVED") {
      throw new AppError(`Invalid status transition from ${currentStatus} to ${newStatus}`, {
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 422
      });
    }
    if (order.orderType === "BOOKING" && currentStatus === "PREPARING") {
      throw new AppError(`Invalid status transition from ${currentStatus} to ${newStatus}`, {
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 422
      });
    }

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
