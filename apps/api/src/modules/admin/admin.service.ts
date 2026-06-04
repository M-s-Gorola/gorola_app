import { ConflictError, NotFoundError } from "@gorola/shared";
import { type OrderStatus, type PaymentMethod, Prisma, type PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

import { OrderRepository } from "../order/order.repository.js";
import { OrderService } from "../order/order.service.js";

function maskPhone(phone: string): string {
  if (!phone) return "";
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

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

  public async getOrders(filters: {
    storeId?: string | undefined;
    status?: OrderStatus | undefined;
    paymentMethod?: PaymentMethod | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
  }) {
    const limit = filters.limit ?? 50;
    const { storeId, status, paymentMethod, startsAt, endsAt, cursor } = filters;

    const where: Prisma.OrderWhereInput = {
      ...(storeId ? { storeId } : {}),
      ...(status ? { status } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(startsAt || endsAt ? {
        createdAt: {
          ...(startsAt ? { gte: new Date(startsAt) } : {}),
          ...(endsAt ? { lte: new Date(endsAt) } : {})
        }
      } : {})
    };

    const orders = await this.db.order.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ],
      include: {
        store: { select: { id: true, name: true } },
        user: { select: { phone: true } },
        items: true
      }
    });

    const hasMore = orders.length > limit;
    const pageItems = hasMore ? orders.slice(0, limit) : orders;

    const mapped = pageItems.map((o) => {
      const itemsCount = o.items.reduce((sum, item) => sum + item.quantity, 0);
      return {
        id: o.id,
        buyerMaskedPhone: maskPhone(o.user?.phone ?? ""),
        storeName: o.store.name,
        itemsCount,
        total: Number(o.total),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        paymentMethod: o.paymentMethod
      };
    });

    const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1]!.id : null;

    const stores = await this.db.store.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });

    return {
      items: mapped,
      nextCursor,
      stores
    };
  }

  public async forceUpdateOrderStatus(
    orderId: string,
    status: OrderStatus,
    auditNote: string,
    adminId: string,
    ip: string,
    userAgent: string,
    deps: {
      orderService: OrderService;
      ordersRepo: OrderRepository;
    }
  ) {
    const order = await this.db.order.findUnique({
      where: { id: orderId }
    });
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (status === "CANCELLED") {
      const updated = await deps.orderService.cancelOrderWithStockRestore(orderId, "ADMIN", auditNote);
      await this.db.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "ADMIN_FORCE_STATUS_UPDATE",
          entityType: "Order",
          entityId: orderId,
          oldValue: { status: order.status },
          newValue: { status: "CANCELLED", note: auditNote },
          ip,
          userAgent
        }
      });
      return updated;
    }

    return this.db.$transaction(async (tx) => {
      const updated = await deps.ordersRepo.updateStatus(orderId, status, "ADMIN", auditNote, tx);
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "ADMIN_FORCE_STATUS_UPDATE",
          entityType: "Order",
          entityId: orderId,
          oldValue: { status: order.status },
          newValue: { status, note: auditNote },
          ip,
          userAgent
        }
      });
      return updated;
    });
  }

  public async getOrderDetail(orderId: string) {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true, name: true, phone: true, storeType: true } },
        user: { select: { phone: true, name: true } },
        items: true,
        statusHistory: { orderBy: { changedAt: "asc" } }
      }
    });
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    return {
      ...order,
      buyerMaskedPhone: maskPhone(order.user?.phone ?? ""),
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee)
    };
  }

  public async exportOrdersCsv(filters: {
    storeId?: string | undefined;
    status?: OrderStatus | undefined;
    paymentMethod?: PaymentMethod | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
  }): Promise<string> {
    const { storeId, status, paymentMethod, startsAt, endsAt } = filters;

    const where: Prisma.OrderWhereInput = {
      ...(storeId ? { storeId } : {}),
      ...(status ? { status } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(startsAt || endsAt ? {
        createdAt: {
          ...(startsAt ? { gte: new Date(startsAt) } : {}),
          ...(endsAt ? { lte: new Date(endsAt) } : {})
        }
      } : {})
    };

    const orders = await this.db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        store: { select: { name: true } },
        user: { select: { phone: true } },
        items: true
      }
    });

    const headers = ["Order ID", "Date", "Store", "Buyer Phone", "Items Count", "Total (INR)", "Status", "Payment Method"];
    const rows = orders.map((o) => {
      const itemsCount = o.items.reduce((sum, item) => sum + item.quantity, 0);
      return [
        o.id,
        o.createdAt.toISOString(),
        o.store.name,
        maskPhone(o.user?.phone ?? ""),
        itemsCount,
        Number(o.total).toFixed(2),
        o.status,
        o.paymentMethod
      ];
    });

    const csvContent = [
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    return csvContent;
  }

  public async getUsers(filters: { phone?: string | undefined }) {
    const { phone } = filters;
    const where: Prisma.UserWhereInput = {
      isDeleted: false,
      ...(phone ? { phone: { contains: phone } } : {})
    };

    const users = await this.db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        orders: {
          select: {
            total: true
          }
        }
      }
    });

    return users.map((u) => {
      const orderCount = u.orders.length;
      const totalSpent = u.orders.reduce((sum, o) => sum + Number(o.total), 0);
      return {
        id: u.id,
        maskedPhone: maskPhone(u.phone),
        name: u.name,
        orderCount,
        totalSpent,
        createdAt: u.createdAt.toISOString(),
        isActive: u.isActive
      };
    });
  }

  public async getUserDetail(userId: string) {
    const user = await this.db.user.findFirst({
      where: { id: userId, isDeleted: false },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            store: { select: { name: true } }
          }
        },
        addresses: {
          where: { isDeleted: false }
        }
      }
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      maskedPhone: maskPhone(user.phone),
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      orders: user.orders.map((o) => ({
        id: o.id,
        storeName: o.store.name,
        total: Number(o.total),
        status: o.status,
        createdAt: o.createdAt.toISOString()
      })),
      addresses: user.addresses.map((a) => ({
        id: a.id,
        flatRoom: a.flatRoom,
        landmarkDescription: a.landmarkDescription
      }))
    };
  }

  public async suspendUser(userId: string, adminId: string, ip: string, userAgent: string) {
    const user = await this.db.user.findFirst({
      where: { id: userId, isDeleted: false }
    });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { isActive: false }
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_USER_SUSPEND",
        entityType: "User",
        entityId: userId,
        oldValue: { isActive: user.isActive },
        newValue: { isActive: false },
        ip,
        userAgent
      }
    });

    return updated;
  }

  public async unsuspendUser(userId: string, adminId: string, ip: string, userAgent: string) {
    const user = await this.db.user.findFirst({
      where: { id: userId, isDeleted: false }
    });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { isActive: true }
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_USER_UNSUSPEND",
        entityType: "User",
        entityId: userId,
        oldValue: { isActive: user.isActive },
        newValue: { isActive: true },
        ip,
        userAgent
      }
    });

    return updated;
  }

  public async createStore(
    dto: {
      storeName: string;
      description: string;
      phone: string;
      landmarkAddress: string;
      storeType: "QUICK_COMMERCE" | "BOOKING_COMMERCE";
      ownerEmail: string;
      ownerTempPassword: string;
    },
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    const existingOwner = await this.db.storeOwner.findFirst({
      where: { email: dto.ownerEmail, isDeleted: false }
    });
    if (existingOwner) {
      throw new ConflictError("Store owner with this email already exists", { field: "ownerEmail" });
    }

    const passwordHash = await hash(dto.ownerTempPassword, 8);

    return this.db.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name: dto.storeName,
          description: dto.description,
          phone: dto.phone,
          address: dto.landmarkAddress,
          storeType: dto.storeType,
          isActive: true
        }
      });

      const owner = await tx.storeOwner.create({
        data: {
          email: dto.ownerEmail,
          passwordHash,
          storeId: store.id
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "ADMIN_STORE_CREATE",
          entityType: "Store",
          entityId: store.id,
          oldValue: Prisma.DbNull,
          newValue: {
            name: store.name,
            storeType: store.storeType,
            ownerEmail: owner.email
          },
          ip,
          userAgent
        }
      });

      return {
        storeId: store.id,
        storeType: store.storeType,
        ownerId: owner.id
      };
    });
  }

  public async getStores() {
    const stores = await this.db.store.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
      include: {
        owners: {
          where: { isDeleted: false },
          select: { email: true }
        },
        _count: {
          select: {
            orders: true,
            products: { where: { isDeleted: false } }
          }
        }
      }
    });

    const orders = await this.db.order.findMany({
      where: {
        status: { not: "CANCELLED" },
        store: { isDeleted: false }
      },
      select: {
        storeId: true,
        total: true
      }
    });

    const revenueByStore = new Map<string, number>();
    for (const order of orders) {
      const current = revenueByStore.get(order.storeId) ?? 0;
      revenueByStore.set(order.storeId, current + Number(order.total));
    }

    return stores.map((s) => {
      const firstOwner = s.owners[0];
      const ownerEmail = firstOwner ? firstOwner.email : "";
      const revenue = revenueByStore.get(s.id) ?? 0;

      return {
        id: s.id,
        name: s.name,
        storeType: s.storeType,
        ownerEmail,
        orderCount: s._count.orders,
        revenue,
        productCount: s._count.products,
        isActive: s.isActive
      };
    });
  }

  public async getStoreDetail(storeId: string) {
    const store = await this.db.store.findFirst({
      where: { id: storeId, isDeleted: false },
      include: {
        owners: {
          where: { isDeleted: false },
          select: { id: true, email: true, createdAt: true }
        },
        _count: {
          select: {
            products: { where: { isDeleted: false } },
            orders: true
          }
        }
      }
    });

    if (!store) {
      throw new NotFoundError("Store not found");
    }

    const orders = await this.db.order.findMany({
      where: { storeId, status: { not: "CANCELLED" } },
      select: { total: true }
    });
    const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

    return {
      id: store.id,
      name: store.name,
      description: store.description,
      phone: store.phone,
      address: store.address,
      storeType: store.storeType,
      isActive: store.isActive,
      createdAt: store.createdAt.toISOString(),
      revenue,
      productCount: store._count.products,
      orderCount: store._count.orders,
      owners: store.owners.map((o) => ({
        id: o.id,
        email: o.email,
        createdAt: o.createdAt.toISOString()
      }))
    };
  }

  public async updateStoreStatus(storeId: string, isActive: boolean, adminId: string, ip: string, userAgent: string) {
    const store = await this.db.store.findFirst({
      where: { id: storeId, isDeleted: false }
    });
    if (!store) {
      throw new NotFoundError("Store not found");
    }

    const updated = await this.db.store.update({
      where: { id: storeId },
      data: { isActive }
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: isActive ? "ADMIN_STORE_ACTIVATE" : "ADMIN_STORE_DEACTIVATE",
        entityType: "Store",
        entityId: storeId,
        oldValue: { isActive: store.isActive },
        newValue: { isActive },
        ip,
        userAgent
      }
    });

    return updated;
  }
}
