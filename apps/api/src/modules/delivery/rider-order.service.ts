import { AppError, ForbiddenError, NotFoundError } from "@gorola/shared";
import { type OrderStatus } from "@prisma/client";

import type { OrderRepository, OrderWithRelations } from "../order/order.repository.js";
import type { RiderRepository } from "./rider.repository.js";
import type { RiderEarningsService } from "./rider-earnings.service.js";

export type RiderOrderEventEmitter = {
  emitStatusChanged: (orderId: string, status: string) => void | Promise<void>;
};

export class RiderOrderService {
  public constructor(
    private readonly orders: OrderRepository,
    private readonly riders: RiderRepository,
    private readonly emitter?: RiderOrderEventEmitter,
    private readonly riderEarnings?: RiderEarningsService
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

      const bookings = await this.orders.findManyByStore(storeIds, {
        status: ["APPROVED", "OUT_FOR_DELIVERY"],
        orderType: "BOOKING",
        scheduledDateFrom: startOfToday,
        scheduledDateTo: startOfTomorrow
      });
      return bookings.filter((o) => o.bookingOrder?.assignedTechnicianId === riderId);
    }

    const quickOrders = await this.orders.findManyByStore(storeIds, {
      status: ["PREPARING", "OUT_FOR_DELIVERY"],
      orderType: "QUICK"
    });
    return quickOrders.filter((o) => o.riderId === null || o.riderId === riderId);
  }

  public async acceptOrder(
    storeIds: string | string[],
    orderId: string,
    riderId: string
  ): Promise<OrderWithRelations> {
    const order = await this.orders.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const isAuthorized = Array.isArray(storeIds) ? storeIds.includes(order.storeId) : order.storeId === storeIds;
    if (!isAuthorized) {
      throw new ForbiddenError("You are not authorized to update this order");
    }

    if (order.riderId !== null) {
      throw new AppError("Rider is already assigned to this order", {
        code: "RIDER_ALREADY_ASSIGNED",
        statusCode: 422
      });
    }

    const isQuick = order.orderType === "QUICK";
    const expectedStatus = isQuick ? "PREPARING" : "APPROVED";
    if (order.status !== expectedStatus) {
      throw new AppError(`Cannot accept order in status ${order.status}`, {
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 422
      });
    }

    const rider = await this.riders.findById(riderId);
    const riderName = rider?.name ?? "Rider";

    const note = `Order accepted by rider: ${riderName}`;
    const changedBy = `rider:${riderId}`;

    const updated = await this.orders.updateStatus(orderId, expectedStatus, changedBy, note, undefined, riderId);

    if (this.emitter) {
      void this.emitter.emitStatusChanged(orderId, expectedStatus);
    }

    return updated;
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

    if (order.orderType === "QUICK" && newStatus === "OUT_FOR_DELIVERY") {
      throw new AppError("Riders cannot dispatch quick commerce orders", {
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

    const riderId = changedBy.startsWith("rider:") ? changedBy.substring(6) : changedBy;
    const assignedRiderId = await this.riders.getRiderIdByOrderId(orderId);
    if (assignedRiderId !== riderId) {
      throw new ForbiddenError("You are not the assigned rider for this order");
    }

    const updated = await this.orders.updateStatus(orderId, newStatus, changedBy);

    if (newStatus === "DELIVERED" && this.riderEarnings) {
      try {
        const riderId = changedBy.startsWith("rider:") ? changedBy.substring(6) : changedBy;
        await this.riderEarnings.createEarningForDelivery(
          riderId,
          orderId,
          order.deliveryFee,
          order.storeId
        );
      } catch (err) {
        console.error("Failed to create rider earning:", err);
      }
    }

    if (this.emitter) {
      void this.emitter.emitStatusChanged(orderId, newStatus);
    }

    return updated;
  }
}
