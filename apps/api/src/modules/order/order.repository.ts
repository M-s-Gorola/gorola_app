import { NotFoundError, ValidationError } from "@gorola/shared";
import {
  type OrderStatus,
  type OrderStatusHistory,
  type PaymentMethod,
  Prisma,
  type PrismaClient
} from "@prisma/client";

/** Shared include graph for reads + post-create hydrate. */
export const orderRelationsInclude = {
  items: {
    orderBy: { id: "asc" as const },
    include: {
      productVariant: {
        select: {
          productId: true
        }
      }
    }
  },
  statusHistory: { orderBy: { changedAt: "asc" as const } },
  store: { select: { id: true, name: true, phone: true, storeType: true } },
  bookingOrder: true
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderRelationsInclude;
}>;

export type CreateOrderInput = {
  userId: string;
  storeId: string;
  subtotal: string | number;
  deliveryFee: string | number;
  total: string | number;
  paymentMethod: PaymentMethod;
  landmarkDescription: string;
  addressLabel?: string | null;
  flatRoom?: string | null;
  deliveryNote?: string | null;
  scheduledFor?: Date | null;
  items: Array<{
    productVariantId: string;
    productName: string;
    variantLabel: string;
    price: string | number;
    quantity: number;
  }>;
  changedBy: string;
};

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

type DbLike = PrismaClient | Prisma.TransactionClient;

async function getOrderWithRelations(db: DbLike, id: string): Promise<OrderWithRelations> {
  return db.order.findUniqueOrThrow({
    include: orderRelationsInclude,
    where: { id }
  });
}

export class OrderRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async create(
    input: CreateOrderInput,
    tx?: Prisma.TransactionClient
  ): Promise<OrderWithRelations> {
    if (input.items.length === 0) {
      throw new ValidationError("Order must contain at least one item");
    }

    const db: DbLike = tx ?? this.db;

    try {
      const order = await db.order.create({
        include: orderRelationsInclude,
        data: {
          userId: input.userId,
          storeId: input.storeId,
          subtotal: toDecimal(input.subtotal),
          deliveryFee: toDecimal(input.deliveryFee),
          total: toDecimal(input.total),
          paymentMethod: input.paymentMethod,
          landmarkDescription: input.landmarkDescription,
          addressLabel: input.addressLabel ?? null,
          flatRoom: input.flatRoom ?? null,
          deliveryNote: input.deliveryNote ?? null,
          scheduledFor: input.scheduledFor ?? null,
          items: {
            create: input.items.map((item) => ({
              productVariantId: item.productVariantId,
              productName: item.productName,
              variantLabel: item.variantLabel,
              price: toDecimal(item.price),
              quantity: item.quantity
            }))
          },
          statusHistory: {
            create: {
              status: "PLACED",
              note: null,
              changedBy: input.changedBy
            }
          }
        }
      });

      return order;
    } catch (error: unknown) {
      if (isPrismaError(error, "P2003")) {
        throw new NotFoundError(
          "User, store, or product variant not found",
          {
            userId: input.userId,
            storeId: input.storeId
          },
          error
        );
      }
      throw error;
    }
  }

  public async findById(id: string): Promise<OrderWithRelations | null> {
    return this.db.order.findUnique({
      include: orderRelationsInclude,
      where: { id }
    });
  }

  public async findByUserId(userId: string): Promise<OrderWithRelations[]> {
    return this.db.order.findMany({
      include: orderRelationsInclude,
      orderBy: { createdAt: "desc" },
      where: { userId }
    });
  }

  public async findByStoreId(storeId: string): Promise<OrderWithRelations[]> {
    return this.db.order.findMany({
      include: orderRelationsInclude,
      orderBy: { createdAt: "desc" },
      where: { storeId }
    });
  }

  public async updateStatus(
    orderId: string,
    status: OrderStatus,
    changedBy: string,
    note?: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderWithRelations> {
    const apply = async (db: DbLike): Promise<void> => {
      await db.order.update({
        where: { id: orderId },
        data: { status }
      });
      await db.orderStatusHistory.create({
        data: {
          orderId,
          status,
          note: note ?? null,
          changedBy
        }
      });
    };

    try {
      if (tx) {
        await apply(tx);
        return getOrderWithRelations(tx, orderId);
      }
      await this.db.$transaction(async (inner) => {
        await apply(inner);
      });
      return getOrderWithRelations(this.db, orderId);
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025") || isPrismaError(error, "P2003")) {
        throw new NotFoundError("Order not found", { orderId }, error);
      }
      throw error;
    }
  }

  public async addStatusHistory(
    orderId: string,
    status: OrderStatus,
    changedBy: string,
    note?: string
  ): Promise<OrderStatusHistory> {
    try {
      return await this.db.orderStatusHistory.create({
        data: {
          orderId,
          status,
          note: note ?? null,
          changedBy
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2003")) {
        throw new NotFoundError("Order not found", { orderId }, error);
      }
      throw error;
    }
  }

  public async updateRating(
    orderId: string,
    rating: boolean | null,
    ratingComment: string | null
  ): Promise<OrderWithRelations> {
    try {
      await this.db.order.update({
        where: { id: orderId },
        data: { rating, ratingComment }
      });
      return getOrderWithRelations(this.db, orderId);
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Order not found", { orderId }, error);
      }
      throw error;
    }
  }
}