 
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError
} from "@gorola/shared";
import type { PrismaClient } from "@prisma/client";

import { ProductVariantRepository } from "../catalog/variant.repository.js";
import { StockMovementRepository } from "../inventory/stock-movement.repository.js";
import {
  type CreateOrderInput,
  OrderRepository,
  type OrderWithRelations
} from "./order.repository.js";

export class OrderService {
  public constructor(
    private readonly db: PrismaClient,
    private readonly orders: OrderRepository,
    private readonly variants: ProductVariantRepository,
    private readonly stockMovements: StockMovementRepository
  ) {}

  /**
   * Creates the order, then deducts stock and records SALE movements — all in one transaction.
   */
  public async placeOrderWithStock(input: CreateOrderInput): Promise<OrderWithRelations> {
    const orderId = await this.db.$transaction(async (tx) => {
      const byVariant = new Map<string, number>();
      for (const line of input.items) {
        byVariant.set(
          line.productVariantId,
          (byVariant.get(line.productVariantId) ?? 0) + line.quantity
        );
      }

      const lineIssues: Array<{
        productVariantId: string;
        requested: number;
        available: number;
      }> = [];

      for (const [productVariantId, totalQty] of byVariant) {
        const v = await tx.productVariant.findUnique({
          where: { id: productVariantId },
          include: { product: { select: { storeId: true } } }
        });
        if (v === null) {
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
        const { stockQtyBefore, stockQtyAfter } = await this.variants.decrementStock(
          item.productVariantId,
          item.quantity,
          input.storeId,
          tx
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

      return order.id;
    });

    const result = await this.orders.findById(orderId);
    if (result === null) {
      throw new Error("Invariant: order missing after successful transaction");
    }
    return result;
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

    await this.db.$transaction(async (tx) => {
      for (const item of current.items) {
        const { stockQtyBefore, stockQtyAfter } = await this.variants.incrementStock(
          item.productVariantId,
          item.quantity,
          current.storeId,
          tx
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
    });

    const result = await this.orders.findById(orderId);
    if (result === null) {
      throw new Error("Invariant: order missing after cancel");
    }
    return result;
  }
}
