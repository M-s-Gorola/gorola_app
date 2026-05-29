import { ForbiddenError, NotFoundError, ValidationError } from "@gorola/shared";
import { type Prisma, type PrismaClient, type StockMovement, type StockMovementType } from "@prisma/client";

export type CreateStockMovementInput = {
  storeId: string;
  productVariantId: string;
  orderId: string | null;
  type: StockMovementType;
  /** Units moved; always > 0. */
  quantity: number;
  stockQtyBefore: number;
  stockQtyAfter: number;
  note?: string;
  reason?: string;
};

type DbLike = PrismaClient | Prisma.TransactionClient;

function client(db: PrismaClient, override?: Prisma.TransactionClient): DbLike {
  return override ?? db;
}

export class StockMovementRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async create(
    input: CreateStockMovementInput,
    tx?: Prisma.TransactionClient
  ): Promise<StockMovement> {
    if (input.quantity <= 0) {
      throw new ValidationError("Stock movement quantity must be positive", {
        quantity: input.quantity
      });
    }

    if (input.type === "SALE" && input.stockQtyAfter !== input.stockQtyBefore - input.quantity) {
      throw new ValidationError("SALE movement: stockQtyAfter must equal stockQtyBefore - quantity", {
        type: input.type,
        stockQtyBefore: input.stockQtyBefore,
        stockQtyAfter: input.stockQtyAfter,
        quantity: input.quantity
      });
    }
    if (
      input.type === "CANCELLATION_RESTORE" &&
      input.stockQtyAfter !== input.stockQtyBefore + input.quantity
    ) {
      throw new ValidationError(
        "CANCELLATION_RESTORE movement: stockQtyAfter must equal stockQtyBefore + quantity",
        {
          type: input.type,
          stockQtyBefore: input.stockQtyBefore,
          stockQtyAfter: input.stockQtyAfter,
          quantity: input.quantity
        }
      );
    }

    if (input.type === "REFILL" && input.stockQtyAfter !== input.stockQtyBefore + input.quantity) {
      throw new ValidationError("REFILL movement: stockQtyAfter must equal stockQtyBefore + quantity", {
        type: input.type,
        stockQtyBefore: input.stockQtyBefore,
        stockQtyAfter: input.stockQtyAfter,
        quantity: input.quantity
      });
    }
    if (input.type === "INITIAL" && input.stockQtyAfter !== input.stockQtyBefore + input.quantity) {
      throw new ValidationError("INITIAL movement: stockQtyAfter must equal stockQtyBefore + quantity", {
        type: input.type,
        stockQtyBefore: input.stockQtyBefore,
        stockQtyAfter: input.stockQtyAfter,
        quantity: input.quantity
      });
    }
    if (
      input.type === "ADJUSTMENT" &&
      Math.abs(input.stockQtyAfter - input.stockQtyBefore) !== input.quantity
    ) {
      throw new ValidationError(
        "ADJUSTMENT movement: quantity must match the absolute difference between before and after",
        {
          type: input.type,
          stockQtyBefore: input.stockQtyBefore,
          stockQtyAfter: input.stockQtyAfter,
          quantity: input.quantity
        }
      );
    }

    const d = client(this.db, tx);
    const variant = await d.productVariant.findUnique({
      where: { id: input.productVariantId },
      include: { product: { select: { storeId: true } } }
    });
    if (variant === null) {
      throw new NotFoundError("Product variant not found", { productVariantId: input.productVariantId });
    }
    if (variant.product.storeId !== input.storeId) {
      throw new ForbiddenError("Product variant is not in this store", {
        productVariantId: input.productVariantId,
        storeId: input.storeId
      });
    }

    return d.stockMovement.create({
      data: {
        productVariantId: input.productVariantId,
        orderId: input.orderId,
        type: input.type,
        quantity: input.quantity,
        stockQtyBefore: input.stockQtyBefore,
        stockQtyAfter: input.stockQtyAfter,
        note: input.note ?? null,
        reason: input.reason ?? null
      }
    });
  }

  public async findByVariantId(
    productVariantId: string,
    tx?: Prisma.TransactionClient
  ): Promise<StockMovement[]> {
    const d = client(this.db, tx);
    return d.stockMovement.findMany({
      where: { productVariantId },
      orderBy: { createdAt: "desc" }
    });
  }

  public async findByOrderId(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<StockMovement[]> {
    const d = client(this.db, tx);
    return d.stockMovement.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" }
    });
  }
}
