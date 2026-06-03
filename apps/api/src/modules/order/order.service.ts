 
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError
} from "@gorola/shared";
import { type OrderStatus, type PrismaClient, type ProductVariant } from "@prisma/client";

import { ProductVariantRepository } from "../catalog/variant.repository.js";
import { StockMovementRepository } from "../inventory/stock-movement.repository.js";
import {
  type CreateOrderInput,
  orderRelationsInclude,
  OrderRepository,
  type OrderWithRelations
} from "./order.repository.js";

export type OrderEventEmitter = {
  emitStatusChanged: (orderId: string, status: string) => void | Promise<void>;
};

export class OrderService {
  public constructor(
    private readonly db: PrismaClient,
    private readonly orders: OrderRepository,
    private readonly variants: ProductVariantRepository,
    private readonly stockMovements: StockMovementRepository,
    private readonly emitter?: OrderEventEmitter
  ) {}

  public async updateStatus(
    orderId: string,
    status: OrderStatus,
    changedBy: string,
    note?: string
  ): Promise<OrderWithRelations> {
    const order = await this.orders.updateStatus(orderId, status, changedBy, note);
    if (this.emitter) {
      void this.emitter.emitStatusChanged(orderId, status);
    }
    return order;
  }

  /**
   * Creates the order, then deducts stock and records SALE movements — all in one transaction.
   */
  public async placeOrderWithStock(input: CreateOrderInput): Promise<OrderWithRelations> {
    return this.db.$transaction(
      async (tx) => {
        const byVariant = new Map<string, number>();
        for (const line of input.items) {
          byVariant.set(
            line.productVariantId,
            (byVariant.get(line.productVariantId) ?? 0) + line.quantity
          );
        }

        const variantIds = Array.from(byVariant.keys());
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: { select: { storeId: true } } }
        });

        const variantMap = new Map<
          string,
          ProductVariant & { product: { storeId: string } }
        >(variants.map((v) => [v.id, v]));

        const lineIssues: Array<{
          productVariantId: string;
          requested: number;
          available: number;
        }> = [];

        for (const [productVariantId, totalQty] of byVariant) {
          const v = variantMap.get(productVariantId);
          if (!v) {
            throw new NotFoundError("Product variant not found for line item", { productVariantId });
          }
          if (v.product.storeId !== input.storeId) {
            throw new ForbiddenError("Line item variant is not in this order's store", {
              productVariantId,
              storeId: input.storeId
            });
          }
          if (v.stockQty < totalQty) {
            lineIssues.push({
              productVariantId,
              requested: totalQty,
              available: v.stockQty
            });
          }
        }

        if (lineIssues.length > 0) {
          throw new UnprocessableEntityError("Insufficient stock for one or more line items", {
            lineItems: lineIssues
          });
        }

        const order = await this.orders.create(input, tx);

        for (const item of order.items) {
          const preFetched = variantMap.get(item.productVariantId);
          const { stockQtyBefore, stockQtyAfter } = await this.variants.decrementStock(
            item.productVariantId,
            item.quantity,
            input.storeId,
            tx,
            { beforeRow: preFetched }
          );
          await this.stockMovements.create(
            {
              storeId: input.storeId,
              productVariantId: item.productVariantId,
              orderId: order.id,
              type: "SALE",
              quantity: item.quantity,
              stockQtyBefore,
              stockQtyAfter
            },
            tx
          );
        }

        return order;
      },
      {
        timeout: 15000,
        maxWait: 5000
      }
    );
  }

  /**
   * Restores stock for all line items and records CANCELLATION_RESTORE movements, then sets status CANCELLED.
   */
  public async cancelOrderWithStockRestore(
    orderId: string,
    changedBy: string,
    note?: string
  ): Promise<OrderWithRelations> {
    const current = await this.orders.findById(orderId);
    if (current === null) {
      throw new NotFoundError("Order not found", { orderId });
    }
    if (current.status === "CANCELLED") {
      return current;
    }
    if (current.status === "DELIVERED") {
      throw new ConflictError("Order cannot be cancelled after delivery", { orderId });
    }

    if (current.orderType === "BOOKING") {
      return this.db.$transaction(async (tx) => {
        await this.orders.updateStatus(orderId, "CANCELLED", changedBy, note, tx);

        if (this.emitter) {
          void this.emitter.emitStatusChanged(orderId, "CANCELLED");
        }

        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: orderRelationsInclude
        });
      });
    }

    return this.db.$transaction(
      async (tx) => {
        const variantIds = current.items.map((i) => i.productVariantId);
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: { select: { storeId: true } } }
        });

        const variantMap = new Map<
          string,
          ProductVariant & { product: { storeId: string } }
        >(variants.map((v) => [v.id, v]));

        for (const item of current.items) {
          const preFetched = variantMap.get(item.productVariantId);
          const { stockQtyBefore, stockQtyAfter } = await this.variants.incrementStock(
            item.productVariantId,
            item.quantity,
            current.storeId,
            tx,
            { beforeRow: preFetched }
          );
          await this.stockMovements.create(
            {
              storeId: current.storeId,
              productVariantId: item.productVariantId,
              orderId: current.id,
              type: "CANCELLATION_RESTORE",
              quantity: item.quantity,
              stockQtyBefore,
              stockQtyAfter
            },
            tx
          );
        }

        await this.orders.updateStatus(orderId, "CANCELLED", changedBy, note, tx);

        if (this.emitter) {
          void this.emitter.emitStatusChanged(orderId, "CANCELLED");
        }

        // Fetch final state inside transaction to ensure consistency
        return tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: orderRelationsInclude
        });
      },
      {
        timeout: 15000,
        maxWait: 5000
      }
    );
  }
}
