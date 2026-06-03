import { NotFoundError } from "@gorola/shared";
import { type Discount, Prisma, type PrismaClient } from "@prisma/client";

export type CreateDiscountInput = {
  storeId: string;
  code: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: string | number;
  usageLimit?: number | null;
  minOrderAmount?: string | number | null;
  startsAt: Date;
  endsAt: Date;
};

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

function toDecimal(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === undefined || value === null) {
    return null;
  }
  return new Prisma.Decimal(typeof value === "number" ? String(value) : value);
}

export class DiscountRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findActiveByCode(
    code: string,
    storeId: string,
    now: Date = new Date()
  ): Promise<Discount | null> {
    return this.db.discount.findFirst({
      where: {
        storeId,
        code,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now }
      }
    });
  }

  public async create(input: CreateDiscountInput): Promise<Discount> {
    try {
      return await this.db.discount.create({
        data: {
          storeId: input.storeId,
          code: input.code,
          discountType: input.discountType,
          discountValue: toDecimal(input.discountValue)!,
          usageLimit: input.usageLimit ?? null,
          minOrderAmount: toDecimal(input.minOrderAmount),
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          isActive: true
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2003")) {
        throw new NotFoundError("Store not found", { storeId: input.storeId }, error);
      }
      throw error;
    }
  }

  public async incrementUsedCount(id: string): Promise<Discount> {
    try {
      return await this.db.discount.update({
        where: { id },
        data: { usedCount: { increment: 1 } }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Discount not found", { id }, error);
      }
      throw error;
    }
  }
}