import { type PrismaClient } from "@prisma/client";

export type AdminDashboardData = {
  totalOrdersToday: number;
  totalRevenueToday: number;
  perStoreBreakdown: {
    storeId: string;
    storeName: string;
    ordersToday: number;
    revenueToday: number;
    pendingOrdersCount: number;
  }[];
  weeklyRevenue: { date: string; revenue: number }[];
  lowStockAlertCount: number;
  totalActiveBuyers: number;
  totalProducts: number;
  pendingAdApprovalsCount: number;
  featureFlags: { key: string; value: boolean }[];
};

export class AdminService {
  public constructor(private readonly db: PrismaClient) {}

  public async getDashboard(
    range = "WEEK",
    groupBy = "DAILY"
  ): Promise<AdminDashboardData> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1. Fetch all stores
    const stores = await this.db.store.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true }
    });

    // 2. Fetch all orders created today across active stores
    const ordersToday = await this.db.order.findMany({
      where: {
        createdAt: { gte: startOfToday, lte: endOfToday },
        store: { isDeleted: false }
      },
      select: {
        storeId: true,
        total: true,
        status: true,
        orderType: true,
        bookingOrder: { select: { approvalStatus: true } }
      }
    });

    const isRevenueOrder = (o: {
      orderType: string;
      status: string;
      bookingOrder: { approvalStatus: string } | null;
    }): boolean => {
      if (o.orderType === "BOOKING") {
        return (
          o.bookingOrder?.approvalStatus === "APPROVED" ||
          o.bookingOrder?.approvalStatus === "PENDING_APPROVAL"
        );
      }
      return o.status === "DELIVERED" || o.status === "PLACED";
    };

    const totalOrdersToday = ordersToday.length;
    const totalRevenueToday = ordersToday
      .filter(isRevenueOrder)
      .reduce((acc, o) => acc + Number(o.total), 0);

    // 3. Dynamic revenue trend — same logic as StoreDashboardPage
    const weeklyRevenue: { date: string; revenue: number }[] = [];
    const now = new Date();
    let rangeStart = new Date(now);
    let rangeEnd = new Date(now);

    if (range === "TODAY") {
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (range === "WEEK") {
      rangeStart.setDate(now.getDate() - 6);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (range === "MONTH") {
      rangeStart.setDate(now.getDate() - 29);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
    } else if (range === "YEAR") {
      rangeStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      rangeEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      // ALL
      rangeStart = new Date(2020, 0, 1, 0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
    }

    const trendOrders = await this.db.order.findMany({
      where: {
        store: { isDeleted: false },
        OR: [
          { orderType: "QUICK", status: { in: ["DELIVERED", "PLACED"] } },
          {
            orderType: "BOOKING",
            bookingOrder: { approvalStatus: { in: ["APPROVED", "PENDING_APPROVAL"] } }
          }
        ],
        createdAt: { gte: rangeStart, lte: rangeEnd }
      },
      select: { total: true, createdAt: true }
    });

    const resolvedGroupBy = range === "TODAY" ? "HOURLY" : groupBy;

    if (resolvedGroupBy === "HOURLY") {
      for (let hour = 0; hour < 24; hour++) {
        const label = `${String(hour).padStart(2, "0")}:00`;
        const sum = trendOrders
          .filter((o) => new Date(o.createdAt).getHours() === hour)
          .reduce((acc, o) => acc + Number(o.total), 0);
        weeklyRevenue.push({ date: label, revenue: sum });
      }
    } else if (resolvedGroupBy === "DAILY") {
      if (range === "WEEK") {
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const date = String(d.getDate()).padStart(2, "0");
          const dayStart = new Date(d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(d);
          dayEnd.setHours(23, 59, 59, 999);
          const sum = trendOrders
            .filter((o) => { const oct = new Date(o.createdAt); return oct >= dayStart && oct <= dayEnd; })
            .reduce((acc, o) => acc + Number(o.total), 0);
          weeklyRevenue.push({ date: `${year}-${month}-${date}`, revenue: sum });
        }
      } else if (range === "MONTH") {
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          const dayStart = new Date(d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(d);
          dayEnd.setHours(23, 59, 59, 999);
          const sum = trendOrders
            .filter((o) => { const oct = new Date(o.createdAt); return oct >= dayStart && oct <= dayEnd; })
            .reduce((acc, o) => acc + Number(o.total), 0);
          weeklyRevenue.push({ date: label, revenue: sum });
        }
      } else {
        // YEAR / ALL — group by weekday pattern
        const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        for (const w of weekdays) {
          const sum = trendOrders
            .filter((o) => new Date(o.createdAt).toLocaleDateString("en-US", { weekday: "short" }) === w)
            .reduce((acc, o) => acc + Number(o.total), 0);
          weeklyRevenue.push({ date: w, revenue: sum });
        }
      }
    } else if (resolvedGroupBy === "MONTHLY") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      for (const m of months) {
        const sum = trendOrders
          .filter((o) => new Date(o.createdAt).toLocaleDateString("en-US", { month: "short" }) === m)
          .reduce((acc, o) => acc + Number(o.total), 0);
        weeklyRevenue.push({ date: m, revenue: sum });
      }
    } else if (resolvedGroupBy === "YEARLY") {
      const currentYear = now.getFullYear();
      for (let i = 4; i >= 0; i--) {
        const targetYear = currentYear - i;
        const sum = trendOrders
          .filter((o) => new Date(o.createdAt).getFullYear() === targetYear)
          .reduce((acc, o) => acc + Number(o.total), 0);
        weeklyRevenue.push({ date: String(targetYear), revenue: sum });
      }
    }

    // 4. Pending orders across all active stores
    const pendingOrders = await this.db.order.findMany({
      where: {
        store: { isDeleted: false },
        OR: [
          { status: "PLACED", orderType: "QUICK" },
          { bookingOrder: { approvalStatus: "PENDING_APPROVAL" }, orderType: "BOOKING" }
        ]
      },
      select: { storeId: true }
    });

    // 5. Per-store breakdown (in-memory, no N+1)
    const perStoreBreakdown = stores.map((s) => {
      const storeOrders = ordersToday.filter((o) => o.storeId === s.id);
      const revenue = storeOrders.filter(isRevenueOrder).reduce((acc, o) => acc + Number(o.total), 0);
      const pendingCount = pendingOrders.filter((o) => o.storeId === s.id).length;
      return {
        storeId: s.id,
        storeName: s.name,
        ordersToday: storeOrders.length,
        revenueToday: revenue,
        pendingOrdersCount: pendingCount
      };
    });

    // 6. Platform-wide metrics
    const [lowStockAlertCount, totalActiveBuyers, totalProducts, pendingAdApprovalsCount, flags] =
      await Promise.all([
        this.db.productVariant.count({
          where: { isLowStock: true, isActive: true, product: { isDeleted: false, store: { isDeleted: false } } }
        }),
        this.db.user.count({ where: { isDeleted: false, isVerified: true } }),
        this.db.product.count({ where: { isDeleted: false, isActive: true, store: { isDeleted: false } } }),
        this.db.advertisement.count({ where: { isApproved: false, isActive: true, store: { isDeleted: false } } }),
        this.db.featureFlag.findMany({ select: { key: true, value: true }, orderBy: { key: "asc" } })
      ]);

    return {
      totalOrdersToday,
      totalRevenueToday,
      perStoreBreakdown,
      weeklyRevenue,
      lowStockAlertCount,
      totalActiveBuyers,
      totalProducts,
      pendingAdApprovalsCount,
      featureFlags: flags
    };
  }
}
