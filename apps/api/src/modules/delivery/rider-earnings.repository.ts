import type { EarningType,PrismaClient, RiderEarning } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library.js";

export class RiderEarningsRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async createEarning(data: {
    riderId: string;
    orderId: string;
    amount: Decimal;
    earningType: EarningType;
    distanceKm?: Decimal | null;
  }): Promise<RiderEarning> {
    return this.db.riderEarning.create({
      data: {
        riderId: data.riderId,
        orderId: data.orderId,
        amount: data.amount,
        earningType: data.earningType,
        distanceKm: data.distanceKm ?? null
      }
    });
  }

  public async getSummary(riderId: string): Promise<{
    today: { count: number; total: Decimal };
    thisWeek: { count: number; total: Decimal };
    thisMonth: { count: number; total: Decimal };
  }> {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    
    // startOfWeek: assuming week starts on Monday
    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getUTCDay();
    const diff = startOfWeek.getUTCDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setUTCDate(diff);

    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

    const [todayAgg, weekAgg, monthAgg] = await Promise.all([
      this.db.riderEarning.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { riderId, createdAt: { gte: startOfToday } }
      }),
      this.db.riderEarning.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { riderId, createdAt: { gte: startOfWeek } }
      }),
      this.db.riderEarning.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { riderId, createdAt: { gte: startOfMonth } }
      })
    ]);

    return {
      today: {
        count: todayAgg._count.id ?? 0,
        total: todayAgg._sum.amount ?? new Decimal(0)
      },
      thisWeek: {
        count: weekAgg._count.id ?? 0,
        total: weekAgg._sum.amount ?? new Decimal(0)
      },
      thisMonth: {
        count: monthAgg._count.id ?? 0,
        total: monthAgg._sum.amount ?? new Decimal(0)
      }
    };
  }

  public async getHistory(
    riderId: string,
    cursor?: string,
    limit: number = 20,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ items: RiderEarning[]; nextCursor: string | null; filterSummary: { count: number; total: Decimal } }> {
    const filterWhere: { riderId: string; createdAt?: { gte?: Date; lte?: Date } } = { riderId };
    if (startDate || endDate) {
      filterWhere.createdAt = {};
      if (startDate) {
        filterWhere.createdAt.gte = startDate;
      }
      if (endDate) {
        filterWhere.createdAt.lte = endDate;
      }
    }

    const [items, aggregate] = await Promise.all([
      this.db.riderEarning.findMany({
        where: filterWhere,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" }
      }),
      this.db.riderEarning.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: filterWhere
      })
    ]);

    const hasMore = items.length > limit;
    const paginatedItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && paginatedItems.length > 0 ? paginatedItems[paginatedItems.length - 1]!.id : null;

    return {
      items: paginatedItems,
      nextCursor,
      filterSummary: {
        count: aggregate._count.id ?? 0,
        total: aggregate._sum.amount ?? new Decimal(0)
      }
    };
  }
}
