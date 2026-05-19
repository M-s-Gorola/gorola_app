import type { PrismaClient } from "@prisma/client";

export type DashboardKpiSummary = {
  todayOrderCount: number;
  todayRevenue: number;
  pendingOrdersCount: number;
  weeklyRevenue: { date: string; revenue: number }[];
  topProducts: { name: string; soldCount: number }[];
  lowStockItems: { productName: string; variantLabel: string; stockQty: number }[];
  activeAdvertisementsCount: number;
  activeOffersCount: number;
};

export class StoreOwnerService {
  public constructor(private readonly db: PrismaClient) {}

  public async getDashboard(storeId: string): Promise<DashboardKpiSummary> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1. Today's Order Count (all orders placed today regardless of status)
    const todayOrderCount = await this.db.order.count({
      where: {
        storeId,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    // 2. Today's Revenue (sum of total for today's DELIVERED + PLACED orders)
    const revenueResult = await this.db.order.aggregate({
      _sum: {
        total: true
      },
      where: {
        storeId,
        status: {
          in: ["DELIVERED", "PLACED"]
        },
        createdAt: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });
    const todayRevenue = Number(revenueResult._sum.total ?? 0);

    // 3. Pending Orders Count (count of PLACED orders)
    const pendingOrdersCount = await this.db.order.count({
      where: {
        storeId,
        status: "PLACED"
      }
    });

    // 4. Weekly Revenue Trend (daily revenue for the last 7 calendar days, including today)
    const weeklyRevenue: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const sumResult = await this.db.order.aggregate({
        _sum: {
          total: true
        },
        where: {
          storeId,
          status: {
            in: ["DELIVERED", "PLACED"]
          },
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      });

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${date}`;

      weeklyRevenue.push({
        date: dateStr,
        revenue: Number(sumResult._sum.total ?? 0)
      });
    }

    // 5. Top 5 Products by total items sold (quantity in OrderItem) in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const groupResult = await this.db.orderItem.groupBy({
      by: ["productName"],
      _sum: {
        quantity: true
      },
      where: {
        order: {
          storeId,
          status: {
            in: ["DELIVERED", "PLACED"]
          },
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      },
      orderBy: {
        _sum: {
          quantity: "desc"
        }
      },
      take: 5
    });

    const topProducts = groupResult.map((item) => ({
      name: item.productName,
      soldCount: item._sum.quantity ?? 0
    }));

    // 6. Low stock items (variants where isLowStock = true)
    const lowStockVariants = await this.db.productVariant.findMany({
      where: {
        product: {
          storeId,
          isDeleted: false
        },
        isLowStock: true,
        isActive: true
      },
      include: {
        product: true
      }
    });

    const lowStockItems = lowStockVariants.map((v) => ({
      productName: v.product.name,
      variantLabel: v.label,
      stockQty: v.stockQty
    }));

    // 7. Active approved advertisements count
    const activeAdvertisementsCount = await this.db.advertisement.count({
      where: {
        storeId,
        isActive: true,
        isApproved: true
      }
    });

    // 8. Active offers count
    const activeOffersCount = await this.db.offer.count({
      where: {
        storeId,
        isActive: true
      }
    });

    return {
      todayOrderCount,
      todayRevenue,
      pendingOrdersCount,
      weeklyRevenue,
      topProducts,
      lowStockItems,
      activeAdvertisementsCount,
      activeOffersCount
    };
  }
}
