import { ConflictError, NotFoundError, ValidationError } from "@gorola/shared";
import { type ActorRole, type OrderStatus, type PaymentMethod, Prisma, type PrismaClient, StoreType } from "@prisma/client";
import { hash } from "bcryptjs";

import { getRedisClient } from "../../lib/redis.js";
import { AuditRepository } from "../audit/audit.repository.js";
import { CategoryRepository } from "../catalog/category.repository.js";
import { SubCategoryRepository } from "../catalog/sub-category.repository.js";
import { OrderRepository } from "../order/order.repository.js";
import { OrderService } from "../order/order.service.js";

function maskPhone(phone: string): string {
  if (!phone) return "";
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

function maskEmail(email: string): string {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return "****";
  const local = parts[0];
  const domain = parts[1];
  if (!local || !domain) return "****";
  if (local.length <= 2) {
    return `${"*".repeat(local.length)}@${domain}`;
  }
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

function maskIp(ip: string): string {
  if (!ip) return "";
  if (ip.includes(":")) {
    const segments = ip.split(":");
    if (segments.length <= 2) return "IPv6:***";
    return `${segments[0]}:****:****:${segments[segments.length - 1]}`;
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.***.***`;
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
  private readonly categoryRepo: CategoryRepository;
  private readonly subCategoryRepo: SubCategoryRepository;
  private readonly auditRepo: AuditRepository;

  public constructor(private readonly db: PrismaClient) {
    this.categoryRepo = new CategoryRepository(db);
    this.subCategoryRepo = new SubCategoryRepository(db);
    this.auditRepo = new AuditRepository(db);
  }

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

  public async getCategories() {
    const categories = await this.db.category.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        subCategories: {
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
        }
      }
    });

    const categoryIds = categories.map((c) => c.id);
    const productCounts = await this.db.product.groupBy({
      by: ["categoryId"],
      where: {
        categoryId: { in: categoryIds },
        isDeleted: false
      },
      _count: {
        _all: true
      }
    });
    const countByCategory = new Map(productCounts.map((row) => [row.categoryId, row._count._all]));

    const subCategoryIds = categories.flatMap((c) => c.subCategories.map((sc) => sc.id));
    const subProductCounts = await this.db.product.groupBy({
      by: ["subCategoryId"],
      where: {
        subCategoryId: { in: subCategoryIds },
        isDeleted: false
      },
      _count: {
        _all: true
      }
    });
    const countBySubCategory = new Map(subProductCounts.map((row) => [row.subCategoryId, row._count._all]));

    return categories.map((c) => ({
      ...c,
      productCount: countByCategory.get(c.id) ?? 0,
      subCategories: c.subCategories.map((sc) => ({
        ...sc,
        productCount: countBySubCategory.get(sc.id) ?? 0
      }))
    }));
  }

  public async createCategory(
    dto: {
      name: string;
      slug: string;
      imageUrl?: string | null;
      displayOrder?: number;
      isActive?: boolean;
      commerceType?: StoreType;
    },
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    const category = await this.categoryRepo.create(dto);

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_CATEGORY_CREATE",
        entityType: "Category",
        entityId: category.id,
        oldValue: Prisma.JsonNull,
        newValue: {
          name: category.name,
          slug: category.slug,
          commerceType: category.commerceType,
          isActive: category.isActive
        },
        ip,
        userAgent
      }
    });

    return category;
  }

  public async updateCategory(
    id: string,
    dto: {
      name?: string;
      slug?: string;
      imageUrl?: string | null;
      displayOrder?: number;
      isActive?: boolean;
      commerceType?: StoreType;
    },
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    const oldCategory = await this.db.category.findUnique({ where: { id } });
    if (!oldCategory) {
      throw new NotFoundError("Category not found");
    }

    const updated = await this.categoryRepo.update(id, dto);

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_CATEGORY_UPDATE",
        entityType: "Category",
        entityId: id,
        oldValue: {
          name: oldCategory.name,
          slug: oldCategory.slug,
          commerceType: oldCategory.commerceType,
          isActive: oldCategory.isActive
        },
        newValue: {
          name: updated.name,
          slug: updated.slug,
          commerceType: updated.commerceType,
          isActive: updated.isActive
        },
        ip,
        userAgent
      }
    });

    return updated;
  }

  public async deleteCategory(id: string, adminId: string, ip: string, userAgent: string) {
    const category = await this.db.category.findUnique({
      where: { id }
    });
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const productCount = await this.db.product.count({
      where: { categoryId: id, isDeleted: false }
    });
    if (productCount > 0) {
      throw new ConflictError(
        "Cannot delete category with associated products",
        { code: "CANNOT_DELETE_CATEGORY_WITH_PRODUCTS" }
      );
    }

    await this.db.$transaction(async (tx) => {
      const subCategories = await tx.subCategory.findMany({
        where: { categoryId: id }
      });
      for (const sc of subCategories) {
        const subProdCount = await tx.product.count({
          where: { subCategoryId: sc.id, isDeleted: false }
        });
        if (subProdCount > 0) {
          throw new ConflictError(
            "Cannot delete category because some subcategories contain products",
            { code: "CANNOT_DELETE_CATEGORY_WITH_PRODUCTS" }
          );
        }
      }

      await tx.subCategory.deleteMany({
        where: { categoryId: id }
      });

      await tx.category.delete({
        where: { id }
      });
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_CATEGORY_DELETE",
        entityType: "Category",
        entityId: id,
        oldValue: { name: category.name, slug: category.slug },
        newValue: Prisma.JsonNull,
        ip,
        userAgent
      }
    });
  }

  public async reorderCategories(
    items: { id: string; displayOrder: number }[],
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    await this.db.$transaction(
      items.map((item) =>
        this.db.category.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder }
        })
      )
    );

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_CATEGORY_REORDER",
        entityType: "Category",
        entityId: "global",
        oldValue: Prisma.JsonNull,
        newValue: { items },
        ip,
        userAgent
      }
    });
  }

  public async createSubCategory(
    categorySlug: string,
    dto: {
      name: string;
      slug: string;
      imageUrl?: string | null;
      displayOrder?: number;
      isActive?: boolean;
    },
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    const category = await this.db.category.findUnique({
      where: { slug: categorySlug }
    });
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const subCategory = await this.subCategoryRepo.create(category.id, dto);

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_SUBCATEGORY_CREATE",
        entityType: "SubCategory",
        entityId: subCategory.id,
        oldValue: Prisma.JsonNull,
        newValue: {
          name: subCategory.name,
          slug: subCategory.slug,
          categoryId: subCategory.categoryId,
          isActive: subCategory.isActive
        },
        ip,
        userAgent
      }
    });

    return subCategory;
  }

  public async updateSubCategory(
    id: string,
    dto: {
      name?: string;
      slug?: string;
      imageUrl?: string | null;
      displayOrder?: number;
      isActive?: boolean;
    },
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    const oldSubCategory = await this.db.subCategory.findUnique({ where: { id } });
    if (!oldSubCategory) {
      throw new NotFoundError("Subcategory not found");
    }

    const updated = await this.subCategoryRepo.update(id, dto);

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_SUBCATEGORY_UPDATE",
        entityType: "SubCategory",
        entityId: id,
        oldValue: {
          name: oldSubCategory.name,
          slug: oldSubCategory.slug,
          isActive: oldSubCategory.isActive
        },
        newValue: {
          name: updated.name,
          slug: updated.slug,
          isActive: updated.isActive
        },
        ip,
        userAgent
      }
    });

    return updated;
  }

  public async reorderSubCategories(
    items: { id: string; displayOrder: number }[],
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    await this.subCategoryRepo.reorder(items);

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "ADMIN_SUBCATEGORY_REORDER",
        entityType: "SubCategory",
        entityId: "global",
        oldValue: Prisma.JsonNull,
        newValue: { items },
        ip,
        userAgent
      }
    });
  }

  public async getFlags() {
    return this.db.featureFlag.findMany({
      orderBy: { key: "asc" }
    });
  }

  public async updateFlag(
    key: string,
    value: boolean,
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    const oldFlag = await this.db.featureFlag.findUnique({
      where: { key }
    });
    if (!oldFlag) {
      throw new NotFoundError("Feature flag not found");
    }

    const updated = await this.db.$transaction(async (tx) => {
      const flag = await tx.featureFlag.update({
        where: { key },
        data: { value, updatedBy: adminId }
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "ADMIN_FEATURE_FLAG_UPDATE",
          entityType: "FeatureFlag",
          entityId: key,
          oldValue: { value: oldFlag.value },
          newValue: { value },
          ip,
          userAgent
        }
      });

      return flag;
    });

    const isTest = process.env.NODE_ENV === "test";
    const redis = isTest ? null : getRedisClient();
    if (redis) {
      try {
        await redis.del(`feature_flag:${key}`);
      } catch (err) {
        console.error("Redis del flag error", err);
      }
    }

    return updated;
  }

  public async getAds(status?: string) {
    const where: Prisma.AdvertisementWhereInput = {
      store: { isDeleted: false }
    };

    if (status === "PENDING") {
      where.isApproved = false;
      where.isActive = true;
    } else if (status === "APPROVED") {
      where.isApproved = true;
      where.isActive = true;
    }

    const ads = await this.db.advertisement.findMany({
      where,
      include: {
        store: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return ads.map((ad) => ({
      id: ad.id,
      storeId: ad.storeId,
      storeName: ad.store.name,
      title: ad.title,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl,
      startsAt: ad.startsAt,
      endsAt: ad.endsAt,
      isApproved: ad.isApproved,
      isActive: ad.isActive,
      submittedAt: ad.createdAt
    }));
  }

  public async approveAd(
    adId: string,
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    const oldAd = await this.db.advertisement.findUnique({
      where: { id: adId }
    });
    if (!oldAd) {
      throw new NotFoundError("Advertisement not found");
    }

    const updated = await this.db.$transaction(async (tx) => {
      const ad = await tx.advertisement.update({
        where: { id: adId },
        data: { isApproved: true, isActive: true }
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "ADMIN_ADVERTISEMENT_APPROVE",
          entityType: "Advertisement",
          entityId: adId,
          oldValue: { isApproved: oldAd.isApproved, isActive: oldAd.isActive },
          newValue: { isApproved: true, isActive: true },
          ip,
          userAgent
        }
      });

      return ad;
    });

    return updated;
  }

  public async rejectAd(
    adId: string,
    reason: string,
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    if (!reason || reason.trim() === "") {
      throw new ValidationError("Rejection reason is required");
    }

    const oldAd = await this.db.advertisement.findUnique({
      where: { id: adId }
    });
    if (!oldAd) {
      throw new NotFoundError("Advertisement not found");
    }

    const updated = await this.db.$transaction(async (tx) => {
      const ad = await tx.advertisement.update({
        where: { id: adId },
        data: { isApproved: false, isActive: false }
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "ADMIN_ADVERTISEMENT_REJECT",
          entityType: "Advertisement",
          entityId: adId,
          oldValue: { isApproved: oldAd.isApproved, isActive: oldAd.isActive },
          newValue: { isApproved: false, isActive: false, reason },
          ip,
          userAgent
        }
      });

      return ad;
    });

    return updated;
  }

  public async deactivateAd(
    adId: string,
    adminId: string,
    ip: string,
    userAgent: string
  ) {
    const oldAd = await this.db.advertisement.findUnique({
      where: { id: adId }
    });
    if (!oldAd) {
      throw new NotFoundError("Advertisement not found");
    }

    const updated = await this.db.$transaction(async (tx) => {
      const ad = await tx.advertisement.update({
        where: { id: adId },
        data: { isActive: false }
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "ADMIN_ADVERTISEMENT_DEACTIVATE",
          entityType: "Advertisement",
          entityId: adId,
          oldValue: { isApproved: oldAd.isApproved, isActive: oldAd.isActive },
          newValue: { isApproved: oldAd.isApproved, isActive: false },
          ip,
          userAgent
        }
      });

      return ad;
    });

    return updated;
  }

  public async getAuditLogs(filters: {
    actorRole?: ActorRole | undefined;
    action?: string | undefined;
    entityType?: string | undefined;
    entityId?: string | undefined;
    from?: string | Date | undefined;
    to?: string | Date | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
  }) {
    const { items, nextCursor } = await this.auditRepo.findMany(filters);

    const buyersMap = new Map<string, string>();
    const merchantsMap = new Map<string, string>();
    const adminsMap = new Map<string, string>();

    const buyerIds = new Set<string>();
    const merchantIds = new Set<string>();
    const adminIds = new Set<string>();

    for (const log of items) {
      if (log.actorRole === "BUYER") {
        buyerIds.add(log.actorId);
      } else if (log.actorRole === "STORE_OWNER") {
        merchantIds.add(log.actorId);
      } else if (log.actorRole === "ADMIN") {
        adminIds.add(log.actorId);
      }
    }

    const [buyers, merchants, admins] = await Promise.all([
      buyerIds.size > 0
        ? this.db.user.findMany({
            where: { id: { in: Array.from(buyerIds) } },
            select: { id: true, phone: true }
          })
        : [],
      merchantIds.size > 0
        ? this.db.storeOwner.findMany({
            where: { id: { in: Array.from(merchantIds) } },
            select: { id: true, email: true }
          })
        : [],
      adminIds.size > 0
        ? this.db.admin.findMany({
            where: { id: { in: Array.from(adminIds) } },
            select: { id: true, email: true }
          })
        : []
    ]);

    for (const b of buyers) {
      buyersMap.set(b.id, maskPhone(b.phone));
    }
    for (const m of merchants) {
      merchantsMap.set(m.id, maskEmail(m.email));
    }
    for (const a of admins) {
      adminsMap.set(a.id, maskEmail(a.email));
    }

    const mapped = items.map((log) => {
      let actorMasked = "system-service";
      if (log.actorRole === "BUYER") {
        actorMasked = buyersMap.get(log.actorId) ?? "Unknown Buyer";
      } else if (log.actorRole === "STORE_OWNER") {
        actorMasked = merchantsMap.get(log.actorId) ?? "Unknown Merchant";
      } else if (log.actorRole === "ADMIN") {
        actorMasked = adminsMap.get(log.actorId) ?? "Unknown Admin";
      } else if (log.actorRole === "SYSTEM") {
        actorMasked = "SYSTEM";
      }

      return {
        id: log.id,
        actorId: log.actorId,
        actorRole: log.actorRole,
        actorMasked,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        oldValue: log.oldValue,
        newValue: log.newValue,
        ipMasked: maskIp(log.ip),
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString()
      };
    });

    return {
      items: mapped,
      nextCursor
    };
  }

  public async exportAuditLogsCsv(filters: {
    actorRole?: ActorRole | undefined;
    action?: string | undefined;
    entityType?: string | undefined;
    entityId?: string | undefined;
    from?: string | Date | undefined;
    to?: string | Date | undefined;
  }): Promise<string> {
    const { items } = await this.getAuditLogs({ ...filters, limit: 1000 });

    const headers = [
      "Timestamp",
      "Actor (Masked)",
      "Role",
      "Action",
      "Entity Type",
      "Entity ID",
      "IP (Masked)",
      "Old Value",
      "New Value"
    ];
    const rows = items.map((log) => {
      const oldValueStr = log.oldValue ? JSON.stringify(log.oldValue) : "";
      const newValueStr = log.newValue ? JSON.stringify(log.newValue) : "";
      return [
        log.createdAt,
        log.actorMasked,
        log.actorRole,
        log.action,
        log.entityType,
        log.entityId,
        log.ipMasked,
        oldValueStr,
        newValueStr
      ];
    });

    const csvContent = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    return csvContent;
  }
}
