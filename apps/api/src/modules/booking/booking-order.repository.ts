import { type BookingApprovalStatus, Prisma, type PrismaClient } from "@prisma/client";

type DbLike = PrismaClient | Prisma.TransactionClient;

export class BookingOrderRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(orderId: string, tx?: DbLike) {
    const client = tx ?? this.db;
    return client.bookingOrder.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            items: { orderBy: { id: "asc" } },
            statusHistory: { orderBy: { changedAt: "asc" } },
            store: { select: { id: true, name: true, phone: true, storeType: true } },
            user: { select: { phone: true, name: true } }
          }
        }
      }
    });
  }

  public async findByStoreId(
    storeId: string,
    filters: { status?: BookingApprovalStatus; page?: number; limit?: number } = {},
    tx?: DbLike
  ) {
    const client = tx ?? this.db;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingOrderWhereInput = {
      order: {
        storeId
      },
      ...(filters.status ? { approvalStatus: filters.status } : {})
    };

    const [items, total] = await Promise.all([
      client.bookingOrder.findMany({
        where,
        include: {
          order: {
            include: {
              items: { orderBy: { id: "asc" } },
              statusHistory: { orderBy: { changedAt: "asc" } },
              store: { select: { id: true, name: true, phone: true, storeType: true } },
              user: { select: { phone: true, name: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      client.bookingOrder.count({ where })
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
