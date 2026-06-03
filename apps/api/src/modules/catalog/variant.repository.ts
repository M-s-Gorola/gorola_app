import { ForbiddenError, NotFoundError, UnprocessableEntityError, ValidationError } from "@gorola/shared";
import { Prisma, type PrismaClient, type ProductVariant } from "@prisma/client";

export type CreateProductVariantInput = {
  productId: string;
  label: string;
  price: string | number;
  stockQty?: number;
  unit: string;
  isActive?: boolean;
  lowStockThreshold?: number;
};

export type UpdateProductVariantInput = Partial<{
  label: string;
  price: string | number;
  stockQty: number;
  unit: string;
  isActive: boolean;
  isAvailableForBooking: boolean;
  lowStockThreshold: number;
}>;

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

function toDecimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(typeof value === "number" ? String(value) : value);
}

export class ProductVariantRepository {
  public constructor(private readonly db: PrismaClient) {}

  /**
   * Atomic deduction; fails when stock would go below zero (e.g. concurrent last-unit).
   * `storeId` must match the product's store (defense in depth for cross-tenant use).
   */
  public async decrementStock(
    variantId: string,
    quantity: number,
    storeId: string,
    tx: Prisma.TransactionClient,
    options?: {
      beforeRow?: (ProductVariant & { product: { storeId: string } }) | null | undefined;
    }
  ): Promise<{ stockQtyBefore: number; stockQtyAfter: number }> {
    if (quantity <= 0) {
      throw new ValidationError("Stock decrement quantity must be positive", { quantity });
    }

    const beforeRow =
      options?.beforeRow ??
      (await tx.productVariant.findUnique({
        where: { id: variantId },
        include: { product: { select: { storeId: true } } }
      }));

    if (beforeRow === null) {
      throw new NotFoundError("Product variant not found", { id: variantId });
    }
    if (beforeRow.product.storeId !== storeId) {
      throw new ForbiddenError("Product variant is not in this store", { variantId, storeId });
    }
    if (beforeRow.stockQty < quantity) {
      throw new UnprocessableEntityError("Not enough stock for this variant", {
        productVariantId: variantId,
        requested: quantity,
        available: beforeRow.stockQty
      });
    }

    const newQty = beforeRow.stockQty - quantity;
    const result = await tx.productVariant.updateMany({
      where: { id: variantId, stockQty: { gte: quantity } },
      data: {
        stockQty: { decrement: quantity },
        isInStock: newQty > 0,
        isLowStock: newQty <= beforeRow.lowStockThreshold
      }
    });
    if (result.count === 0) {
      const latest = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      throw new UnprocessableEntityError("Not enough stock for this variant (concurrent change)", {
        productVariantId: variantId,
        requested: quantity,
        available: latest.stockQty
      });
    }

    return {
      stockQtyBefore: beforeRow.stockQty,
      stockQtyAfter: beforeRow.stockQty - quantity
    };
  }

  public async incrementStock(
    variantId: string,
    quantity: number,
    storeId: string,
    tx: Prisma.TransactionClient,
    options?: {
      beforeRow?: (ProductVariant & { product: { storeId: string } }) | null | undefined;
    }
  ): Promise<{ stockQtyBefore: number; stockQtyAfter: number }> {
    if (quantity <= 0) {
      throw new ValidationError("Stock increment quantity must be positive", { quantity });
    }

    const beforeRow =
      options?.beforeRow ??
      (await tx.productVariant.findUnique({
        where: { id: variantId },
        include: { product: { select: { storeId: true } } }
      }));

    if (beforeRow === null) {
      throw new NotFoundError("Product variant not found", { id: variantId });
    }
    if (beforeRow.product.storeId !== storeId) {
      throw new ForbiddenError("Product variant is not in this store", { variantId, storeId });
    }

    const newQty = beforeRow.stockQty + quantity;
    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: {
        stockQty: { increment: quantity },
        isInStock: newQty > 0,
        isLowStock: newQty <= beforeRow.lowStockThreshold
      }
    });
    return {
      stockQtyBefore: beforeRow.stockQty,
      stockQtyAfter: updated.stockQty
    };
  }

  public async setStock(
    variantId: string,
    setQty: number,
    storeId: string,
    tx: Prisma.TransactionClient,
    options?: {
      beforeRow?: (ProductVariant & { product: { storeId: string } }) | null | undefined;
    }
  ): Promise<{ stockQtyBefore: number; stockQtyAfter: number }> {
    if (setQty < 0) {
      throw new ValidationError("Stock quantity cannot be negative", { setQty });
    }

    const beforeRow =
      options?.beforeRow ??
      (await tx.productVariant.findUnique({
        where: { id: variantId },
        include: { product: { select: { storeId: true } } }
      }));

    if (beforeRow === null) {
      throw new NotFoundError("Product variant not found", { id: variantId });
    }
    if (beforeRow.product.storeId !== storeId) {
      throw new ForbiddenError("Product variant is not in this store", { variantId, storeId });
    }

    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: {
        stockQty: setQty,
        isInStock: setQty > 0,
        isLowStock: setQty <= beforeRow.lowStockThreshold
      }
    });
    return {
      stockQtyBefore: beforeRow.stockQty,
      stockQtyAfter: updated.stockQty
    };
  }

  public async findById(
    id: string,
    options?: { includeInactive?: boolean }
  ): Promise<ProductVariant | null> {
    return this.db.productVariant.findFirst({
      where: {
        id,
        ...(options?.includeInactive === true ? {} : { isActive: true })
      }
    });
  }

  public async findByProductId(
    productId: string,
    options?: { includeInactive?: boolean }
  ): Promise<ProductVariant[]> {
    return this.db.productVariant.findMany({
      where: {
        productId,
        ...(options?.includeInactive === true ? {} : { isActive: true })
      },
      orderBy: { label: "asc" }
    });
  }

  public async create(input: CreateProductVariantInput): Promise<ProductVariant> {
    try {
      return await this.db.productVariant.create({
        data: {
          productId: input.productId,
          label: input.label,
          price: toDecimal(input.price),
          stockQty: input.stockQty ?? 0,
          lowStockThreshold: input.lowStockThreshold ?? 5,
          isInStock: (input.stockQty ?? 0) > 0,
          isLowStock: (input.stockQty ?? 0) <= (input.lowStockThreshold ?? 5),
          unit: input.unit,
          isActive: input.isActive ?? true
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2003")) {
        throw new NotFoundError("Product not found", { productId: input.productId }, error);
      }
      throw error;
    }
  }

  public async update(id: string, data: UpdateProductVariantInput): Promise<ProductVariant> {
    try {
      const { price, ...rest } = data;
      const updated = await this.db.productVariant.update({
        where: { id },
        data: {
          ...rest,
          ...(price !== undefined ? { price: toDecimal(price) } : {})
        }
      });

      // Recalculate flags if stockQty or lowStockThreshold changed
      if (data.stockQty !== undefined || data.lowStockThreshold !== undefined) {
        return await this.db.productVariant.update({
          where: { id },
          data: {
            isInStock: updated.stockQty > 0,
            isLowStock: updated.stockQty <= updated.lowStockThreshold
          }
        });
      }
      return updated;
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Product variant not found", { id }, error);
      }
      throw error;
    }
  }
}
