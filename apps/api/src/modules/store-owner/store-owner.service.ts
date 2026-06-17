import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from "@gorola/shared";
import { type OrderStatus, Prisma, type PrismaClient } from "@prisma/client";
import { compare, hash } from "bcryptjs";

import { ProductVariantRepository } from "../catalog/variant.repository.js";
import { StockMovementRepository } from "../inventory/stock-movement.repository.js";

export type DashboardKpiSummary = {
  todayOrderCount: number;
  todayRevenue: number;
  pendingOrdersCount: number;
  weeklyRevenue: { date: string; revenue: number }[];
  topProducts: { name: string; soldCount: number }[];
  lowStockItems: { productName: string; variantLabel: string; stockQty: number }[];
  activeAdvertisementsCount: number;
  activeOffersCount: number;
  activeDiscountsCount: number;
};

function maskPhone(phone: string): string {
  if (!phone) return "";
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

export class StoreOwnerService {
  public constructor(private readonly db: PrismaClient) {}

  public async getOrders(
    storeId: string,
    filters: {
      status?: OrderStatus;
      page: number;
      limit: number;
      dateFilter?: string | undefined;
      customFrom?: string | undefined;
      customTo?: string | undefined;
    }
  ) {
    const { status, page, limit, dateFilter, customFrom, customTo } = filters;
    const skip = (page - 1) * limit;
    const take = limit;

    let createdAtRange: { gte?: Date; lte?: Date } | undefined;

    if (dateFilter) {
      const now = new Date();
      if (dateFilter === "TODAY") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        createdAtRange = { gte: start, lte: end };
      } else if (dateFilter === "TOMORROW") {
        const start = new Date(now);
        start.setDate(now.getDate() + 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setDate(now.getDate() + 1);
        end.setHours(23, 59, 59, 999);
        createdAtRange = { gte: start, lte: end };
      } else if (dateFilter === "THIS_WEEK") {
        const dayOfWeek = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        createdAtRange = { gte: start, lte: end };
      } else if (dateFilter === "THIS_MONTH") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        createdAtRange = { gte: start, lte: end };
      } else if (dateFilter === "CUSTOM" && (customFrom || customTo)) {
        const range: { gte?: Date; lte?: Date } = {};
        if (customFrom) {
          const parts = customFrom.split("-").map(Number);
          const year = parts[0] ?? 0;
          const month = parts[1] ?? 1;
          const day = parts[2] ?? 1;
          const start = new Date(year, month - 1, day, 0, 0, 0, 0);
          range.gte = start;
        }
        if (customTo) {
          const parts = customTo.split("-").map(Number);
          const year = parts[0] ?? 0;
          const month = parts[1] ?? 1;
          const day = parts[2] ?? 1;
          const end = new Date(year, month - 1, day, 23, 59, 59, 999);
          range.lte = end;
        }
        createdAtRange = range;
      }
    }

    const where: Prisma.OrderWhereInput = {
      storeId,
      ...(status ? { status } : {}),
      ...(createdAtRange ? { createdAt: createdAtRange } : {})
    };

    const [total, orders] = await Promise.all([
      this.db.order.count({ where }),
      this.db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          items: { orderBy: { id: "asc" } },
          statusHistory: { orderBy: { changedAt: "asc" } },
          store: { select: { id: true, name: true, phone: true } },
          user: { select: { phone: true, name: true } }
        }
      })
    ]);

    const mapped = orders.map((o) => {
      const { user, ...rest } = o;
      return {
        ...rest,
        buyerMaskedPhone: maskPhone(user?.phone ?? "")
      };
    });

    return {
      data: mapped,
      meta: {
        total,
        page,
        limit,
        hasMore: total > page * limit
      }
    };
  }

  public async updateOrderStatus(
    storeId: string,
    orderId: string,
    newStatus: OrderStatus,
    orderService: {
      cancelOrderWithStockRestore: (orderId: string, actor: string) => Promise<unknown>;
      updateStatus: (orderId: string, newStatus: OrderStatus, actor: string) => Promise<unknown>;
    },
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const order = await this.db.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to access this order");
    }

    const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
      PLACED: ["PREPARING", "CANCELLED"],
      PREPARING: ["OUT_FOR_DELIVERY", "CANCELLED"],
      OUT_FOR_DELIVERY: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
      PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
      APPROVED: ["PREPARING", "CANCELLED"]
    };

    const currentStatus = order.status;
    // eslint-disable-next-line security/detect-object-injection
    const allowed = currentStatus in VALID_TRANSITIONS ? VALID_TRANSITIONS[currentStatus] : [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(`Invalid status transition from ${currentStatus} to ${newStatus}`, {
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 422
      });
    }

    const changedBy = `store-owner:${ownerId}`;
    const result = newStatus === "CANCELLED"
      ? await orderService.cancelOrderWithStockRestore(orderId, changedBy)
      : await orderService.updateStatus(orderId, newStatus, changedBy);

    await this.db.auditLog.create({
      data: {
        actorId: ownerId,
        actorRole: "STORE_OWNER",
        action: "STORE_ORDER_STATUS_UPDATE",
        entityType: "Order",
        entityId: orderId,
        oldValue: { status: currentStatus },
        newValue: { status: newStatus },
        ip,
        userAgent
      }
    });

    return result;
  }


  public async getDashboard(
    storeId: string,
    range = "WEEK",
    groupBy = "DAILY"
  ): Promise<DashboardKpiSummary> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const store = await this.db.store.findUnique({
      where: { id: storeId },
      select: { storeType: true }
    });
    const isBooking = store?.storeType === "BOOKING_COMMERCE";

    // 1. Today's Order Count (approved bookings scheduled today for BOOKING_COMMERCE, or orders placed today for QUICK_COMMERCE)
    const todayOrderCount = isBooking
      ? await this.db.bookingOrder.count({
          where: {
            order: {
              storeId
            },
            scheduledDate: {
              gte: startOfToday,
              lte: endOfToday
            },
            approvalStatus: "APPROVED"
          }
        })
      : await this.db.order.count({
          where: {
            storeId,
            createdAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        });

    // 2. Today's Revenue (sum of total for today's DELIVERED/APPROVED + PLACED/PENDING orders)
    const revenueResult = isBooking
      ? await this.db.order.aggregate({
          _sum: {
            total: true
          },
          where: {
            storeId,
            bookingOrder: {
              approvalStatus: {
                in: ["APPROVED", "PENDING_APPROVAL"]
              }
            },
            createdAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        })
      : await this.db.order.aggregate({
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

    // 3. Pending Orders Count (count of PLACED / PENDING_APPROVAL requests)
    const pendingOrdersCount = isBooking
      ? await this.db.bookingOrder.count({
          where: {
            order: {
              storeId
            },
            approvalStatus: "PENDING_APPROVAL"
          }
        })
      : await this.db.order.count({
          where: {
            storeId,
            status: "PLACED"
          }
        });

    // 4. Dynamic Multi-Dimensional Revenue Trend Aggregation
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
    } else { // "ALL"
      rangeStart = new Date(2020, 0, 1, 0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
    }

    const orders = await this.db.order.findMany({
      where: {
        storeId,
        ...(isBooking
          ? {
              bookingOrder: {
                approvalStatus: {
                  in: ["APPROVED", "PENDING_APPROVAL"]
                }
              }
            }
          : {
              status: {
                in: ["DELIVERED", "PLACED"]
              }
            }),
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      },
      select: {
        total: true,
        createdAt: true
      }
    });

    const resolvedGroupBy = range === "TODAY" ? "HOURLY" : groupBy;

    if (resolvedGroupBy === "HOURLY") {
      for (let hour = 0; hour < 24; hour++) {
        const label = `${String(hour).padStart(2, "0")}:00`;
        const sum = orders
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
          const dateStr = `${year}-${month}-${date}`;

          const dayStart = new Date(d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(d);
          dayEnd.setHours(23, 59, 59, 999);

          const sum = orders
            .filter((o) => {
              const oct = new Date(o.createdAt);
              return oct >= dayStart && oct <= dayEnd;
            })
            .reduce((acc, o) => acc + Number(o.total), 0);

          weeklyRevenue.push({ date: dateStr, revenue: sum });
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

          const sum = orders
            .filter((o) => {
              const oct = new Date(o.createdAt);
              return oct >= dayStart && oct <= dayEnd;
            })
            .reduce((acc, o) => acc + Number(o.total), 0);

          weeklyRevenue.push({ date: label, revenue: sum });
        }
      } else if (range === "YEAR" || range === "ALL") {
        const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        for (const w of weekdays) {
          const sum = orders
            .filter((o) => {
              const dayName = new Date(o.createdAt).toLocaleDateString("en-US", { weekday: "short" });
              return dayName === w;
            })
            .reduce((acc, o) => acc + Number(o.total), 0);
          weeklyRevenue.push({ date: w, revenue: sum });
        }
      }
    } else if (resolvedGroupBy === "MONTHLY") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      for (const m of months) {
        const sum = orders
          .filter((o) => {
            const mName = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short" });
            return mName === m;
          })
          .reduce((acc, o) => acc + Number(o.total), 0);
        weeklyRevenue.push({ date: m, revenue: sum });
      }
    } else if (resolvedGroupBy === "YEARLY") {
      const currentYear = now.getFullYear();
      for (let i = 4; i >= 0; i--) {
        const targetYear = currentYear - i;
        const sum = orders
          .filter((o) => new Date(o.createdAt).getFullYear() === targetYear)
          .reduce((acc, o) => acc + Number(o.total), 0);
        weeklyRevenue.push({ date: String(targetYear), revenue: sum });
      }
    }

    // 5. Top 5 Products by total items sold (quantity in OrderItem) in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const groupResult = isBooking
      ? await this.db.orderItem.groupBy({
          by: ["productName"],
          _sum: {
            quantity: true
          },
          where: {
            order: {
              storeId,
              bookingOrder: {
                approvalStatus: {
                  in: ["APPROVED", "PENDING_APPROVAL"]
                }
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
        })
      : await this.db.orderItem.groupBy({
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

    // 6. Low stock items (variants where isLowStock = true) - empty for booking
    const lowStockItems = isBooking
      ? []
      : await (async () => {
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
          return lowStockVariants.map((v) => ({
            productName: v.product.name,
            variantLabel: v.label,
            stockQty: v.stockQty
          }));
        })();

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

    // 9. Active discounts count
    const activeDiscountsCount = await this.db.discount.count({
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
      activeOffersCount,
      activeDiscountsCount
    };
  }

  public async getProducts(
    storeId: string,
    filters: { search?: string; subCategoryId?: string; lowStock?: boolean; page: number; limit: number }
  ) {
    const { search, subCategoryId, lowStock, page, limit } = filters;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.ProductWhereInput = {
      storeId,
      isDeleted: false,
      ...(subCategoryId ? { subCategoryId } : {}),
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive"
            }
          }
        : {}),
      ...(lowStock === true
        ? {
            variants: {
              some: {
                isLowStock: true,
                isActive: true
              }
            }
          }
        : {})
    };

    const [total, products] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          variants: {
            orderBy: { label: "asc" }
          },
          subCategory: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        hasMore: total > page * limit
      }
    };
  }

  public async getProductById(storeId: string, productId: string) {
    const product = await this.db.product.findUnique({
      where: { id: productId, isDeleted: false },
      include: {
        variants: {
          orderBy: { label: "asc" }
        },
        subCategory: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    if (product.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to view this product");
    }
    return product;
  }

  public async createProduct(
    storeId: string,
    dto: {
      name: string;
      subCategoryId: string;
      description: string;
      imageUrl: string;
      variants: {
        label: string;
        price: number;
        stockQty: number;
        unit: string;
        lowStockThreshold?: number;
      }[];
    },
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const subCategory = await this.db.subCategory.findUnique({
      where: { id: dto.subCategoryId }
    });
    if (!subCategory) {
      throw new NotFoundError("Subcategory not found");
    }

    const labels = dto.variants.map((v) => v.label.trim().toLowerCase());
    const uniqueLabels = new Set(labels);
    if (uniqueLabels.size !== labels.length) {
      throw new AppError("Duplicate variant labels within the same product are not allowed", {
        code: "CONFLICT",
        statusCode: 409
      });
    }

    return this.db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          storeId,
          categoryId: subCategory.categoryId,
          subCategoryId: dto.subCategoryId,
          name: dto.name,
          description: dto.description,
          imageUrl: dto.imageUrl,
          isActive: true
        }
      });

      const variants = await Promise.all(
        dto.variants.map(async (v) => {
          const lowStockThreshold = v.lowStockThreshold ?? 5;
          const isInStock = v.stockQty > 0;
          const isLowStock = v.stockQty <= lowStockThreshold;

          const variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              label: v.label,
              price: new Prisma.Decimal(v.price.toString()),
              stockQty: v.stockQty,
              lowStockThreshold,
              isLowStock,
              isInStock,
              unit: v.unit,
              isActive: true
            }
          });

          await tx.stockMovement.create({
            data: {
              productVariantId: variant.id,
              type: "INITIAL",
              quantity: v.stockQty,
              stockQtyBefore: 0,
              stockQtyAfter: v.stockQty
            }
          });

          return variant;
        })
      );

      await tx.auditLog.create({
        data: {
          actorId: ownerId,
          actorRole: "STORE_OWNER",
          action: "STORE_PRODUCT_CREATE",
          entityType: "Product",
          entityId: product.id,
          newValue: {
            name: product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            subCategoryId: product.subCategoryId
          },
          ip,
          userAgent
        }
      });

      return {
        ...product,
        variants
      };
    });
  }

  public async updateProduct(
    storeId: string,
    productId: string,
    dto: {
      name?: string;
      subCategoryId?: string;
      description?: string;
      imageUrl?: string;
    },
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const product = await this.db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to modify this product");
    }

    let categoryId = product.categoryId;
    if (dto.subCategoryId) {
      const subCategory = await this.db.subCategory.findUnique({
        where: { id: dto.subCategoryId }
      });
      if (!subCategory) {
        throw new NotFoundError("Subcategory not found");
      }
      categoryId = subCategory.categoryId;
    }

    return this.db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.description ? { description: dto.description } : {}),
          ...(dto.imageUrl ? { imageUrl: dto.imageUrl } : {}),
          ...(dto.subCategoryId ? { subCategoryId: dto.subCategoryId, categoryId } : {})
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: ownerId,
          actorRole: "STORE_OWNER",
          action: "STORE_PRODUCT_UPDATE",
          entityType: "Product",
          entityId: productId,
          oldValue: { name: product.name, description: product.description, imageUrl: product.imageUrl, subCategoryId: product.subCategoryId },
          newValue: { name: updated.name, description: updated.description, imageUrl: updated.imageUrl, subCategoryId: updated.subCategoryId },
          ip,
          userAgent
        }
      });

      return updated;
    });
  }

  public async softDeleteProduct(
    storeId: string,
    productId: string,
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const product = await this.db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to delete this product");
    }

    return this.db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          isDeleted: true
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: ownerId,
          actorRole: "STORE_OWNER",
          action: "STORE_PRODUCT_UPDATE",
          entityType: "Product",
          entityId: productId,
          oldValue: { isDeleted: product.isDeleted },
          newValue: { isDeleted: true },
          ip,
          userAgent
        }
      });

      return updated;
    });
  }

  public async updateProductStatus(
    storeId: string,
    productId: string,
    isActive: boolean,
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const product = await this.db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to modify this product's status");
    }

    return this.db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          isActive
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: ownerId,
          actorRole: "STORE_OWNER",
          action: "STORE_PRODUCT_STATUS_UPDATE",
          entityType: "Product",
          entityId: productId,
          oldValue: { isActive: product.isActive },
          newValue: { isActive },
          ip,
          userAgent
        }
      });

      return updated;
    });
  }

  public async updateVariant(
    storeId: string,
    productId: string,
    variantId: string,
    dto: {
      label?: string;
      price?: number;
      stockQty?: number;
      unit?: string;
      lowStockThreshold?: number;
      isActive?: boolean;
      isAvailableForBooking?: boolean;
    },
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const product = await this.db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to access this product");
    }

    const variant = await this.db.productVariant.findUnique({
      where: { id: variantId }
    });

    if (!variant || variant.productId !== productId) {
      throw new NotFoundError("Product variant not found");
    }

    return this.db.$transaction(async (tx) => {
      const currentStock = variant.stockQty;
      const targetStock = dto.stockQty !== undefined ? dto.stockQty : currentStock;
      const threshold = dto.lowStockThreshold !== undefined ? dto.lowStockThreshold : variant.lowStockThreshold;

      const isInStock = targetStock > 0;
      const isLowStock = targetStock <= threshold;

      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...(dto.label ? { label: dto.label } : {}),
          ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price.toString()) } : {}),
          ...(dto.stockQty !== undefined ? { stockQty: dto.stockQty } : {}),
          ...(dto.unit ? { unit: dto.unit } : {}),
          ...(dto.lowStockThreshold !== undefined ? { lowStockThreshold: dto.lowStockThreshold } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.isAvailableForBooking !== undefined ? { isAvailableForBooking: dto.isAvailableForBooking } : {}),
          isInStock,
          isLowStock
        }
      });

      if (dto.stockQty !== undefined && dto.stockQty !== currentStock) {
        const delta = Math.abs(dto.stockQty - currentStock);
        await tx.stockMovement.create({
          data: {
            productVariantId: variantId,
            type: "ADJUSTMENT",
            quantity: delta,
            stockQtyBefore: currentStock,
            stockQtyAfter: targetStock
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: ownerId,
          actorRole: "STORE_OWNER",
          action: "STORE_VARIANT_UPDATE",
          entityType: "ProductVariant",
          entityId: variantId,
          oldValue: {
            label: variant.label,
            price: Number(variant.price),
            stockQty: variant.stockQty,
            unit: variant.unit,
            isActive: variant.isActive
          },
          newValue: {
            label: updated.label,
            price: Number(updated.price),
            stockQty: updated.stockQty,
            unit: updated.unit,
            isActive: updated.isActive
          },
          ip,
          userAgent
        }
      });

      return updated;
    });
  }

  public async createVariant(
    storeId: string,
    productId: string,
    dto: {
      label: string;
      price: number;
      stockQty: number;
      unit: string;
      lowStockThreshold?: number;
    },
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const product = await this.db.product.findUnique({
      where: { id: productId, isDeleted: false }
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to view this product");
    }

    // Check unique label (case-insensitive and trimmed) under this product
    const normalizedLabel = dto.label.trim().toLowerCase();
    const existingVariants = await this.db.productVariant.findMany({
      where: { productId }
    });
    const labelExists = existingVariants.some(
      (v) => v.label.trim().toLowerCase() === normalizedLabel
    );

    if (labelExists) {
      throw new AppError("Duplicate variant labels within the same product are not allowed", {
        code: "CONFLICT",
        statusCode: 409
      });
    }

    const lowStockThreshold = dto.lowStockThreshold ?? 5;
    const isInStock = dto.stockQty > 0;
    const isLowStock = dto.stockQty <= lowStockThreshold;

    return this.db.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          label: dto.label,
          price: new Prisma.Decimal(dto.price.toString()),
          stockQty: dto.stockQty,
          lowStockThreshold,
          isLowStock,
          isInStock,
          unit: dto.unit,
          isActive: true
        }
      });

      await tx.stockMovement.create({
        data: {
          productVariantId: variant.id,
          type: "INITIAL",
          quantity: dto.stockQty,
          stockQtyBefore: 0,
          stockQtyAfter: dto.stockQty
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: ownerId,
          actorRole: "STORE_OWNER",
          action: "STORE_VARIANT_CREATE",
          entityType: "ProductVariant",
          entityId: variant.id,
          newValue: {
            label: variant.label,
            price: Number(variant.price),
            stockQty: variant.stockQty,
            unit: variant.unit
          },
          ip,
          userAgent
        }
      });

      return variant;
    });
  }

  public async getAds(storeId: string) {
    return this.db.advertisement.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" }
    });
  }

  public async createAd(
    storeId: string,
    dto: { imageUrl: string; title: string; linkUrl: string; startsAt: string | Date; endsAt: string | Date },
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt.getTime() < startsAt.getTime()) {
      throw new AppError("endsAt cannot be before startsAt", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    const ad = await this.db.advertisement.create({
      data: {
        storeId,
        title: dto.title,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl,
        startsAt,
        endsAt,
        isApproved: false,
        isActive: true
      }
    });

    await this.db.auditLog.create({
      data: {
        actorId: ownerId,
        actorRole: "STORE_OWNER",
        action: "STORE_AD_CREATE",
        entityType: "Advertisement",
        entityId: ad.id,
        newValue: {
          title: ad.title,
          imageUrl: ad.imageUrl,
          linkUrl: ad.linkUrl
        },
        ip,
        userAgent
      }
    });

    return ad;
  }

  public async deleteAd(
    storeId: string,
    adId: string,
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const ad = await this.db.advertisement.findUnique({
      where: { id: adId }
    });

    if (!ad) {
      throw new NotFoundError("Advertisement not found");
    }

    if (ad.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to access this advertisement");
    }

    if (ad.isApproved) {
      throw new AppError("Cannot delete an approved advertisement", {
        code: "CANNOT_DELETE_APPROVED_AD",
        statusCode: 422
      });
    }

    await this.db.advertisement.delete({
      where: { id: adId }
    });

    await this.db.auditLog.create({
      data: {
        actorId: ownerId,
        actorRole: "STORE_OWNER",
        action: "STORE_AD_DELETE",
        entityType: "Advertisement",
        entityId: adId,
        oldValue: {
          title: ad.title,
          imageUrl: ad.imageUrl,
          linkUrl: ad.linkUrl
        },
        ip,
        userAgent
      }
    });
  }

  public async getOffers(storeId: string) {
    return this.db.offer.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" }
    });
  }

  public async createOffer(
    storeId: string,
    dto: {
      title: string;
      description?: string | undefined;
      discountType: "PERCENTAGE" | "FLAT";
      discountValue: number;
      startsAt: string | Date;
      endsAt: string | Date;
      minOrderAmount?: number | undefined;
      maxDiscount?: number | undefined;
    },
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt.getTime() < startsAt.getTime()) {
      throw new AppError("endsAt cannot be before startsAt", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    if (dto.discountType === "PERCENTAGE" && dto.discountValue > 100) {
      throw new AppError("Percentage discount cannot exceed 100%", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    if (dto.discountValue <= 0) {
      throw new AppError("Discount value must be greater than 0", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    const offer = await this.db.offer.create({
      data: {
        storeId,
        title: dto.title,
        description: dto.description || dto.title,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderAmount: dto.minOrderAmount ?? null,
        maxDiscount: dto.maxDiscount ?? null,
        startsAt,
        endsAt,
        isActive: true
      }
    });

    await this.db.auditLog.create({
      data: {
        actorId: ownerId,
        actorRole: "STORE_OWNER",
        action: "STORE_OFFER_CREATE",
        entityType: "Offer",
        entityId: offer.id,
        newValue: {
          title: offer.title,
          discountType: offer.discountType,
          discountValue: Number(offer.discountValue)
        },
        ip,
        userAgent
      }
    });

    return offer;
  }

  public async deactivateOffer(
    storeId: string,
    offerId: string,
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const offer = await this.db.offer.findUnique({
      where: { id: offerId }
    });

    if (!offer) {
      throw new NotFoundError("Offer not found");
    }

    if (offer.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to access this offer");
    }

    const updated = await this.db.offer.update({
      where: { id: offerId },
      data: { isActive: false }
    });

    await this.db.auditLog.create({
      data: {
        actorId: ownerId,
        actorRole: "STORE_OWNER",
        action: "STORE_OFFER_DEACTIVATE",
        entityType: "Offer",
        entityId: offerId,
        oldValue: { isActive: offer.isActive },
        newValue: { isActive: false },
        ip,
        userAgent
      }
    });

    return updated;
  }

  public async getDiscounts(storeId: string) {
    return this.db.discount.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" }
    });
  }

  public async createDiscount(
    storeId: string,
    dto: {
      code: string;
      discountType: "PERCENTAGE" | "FLAT";
      discountValue: number;
      maxUsageCount?: number | undefined;
      minOrderAmount?: number | undefined;
      startsAt: string | Date;
      endsAt: string | Date;
    }
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt.getTime() < startsAt.getTime()) {
      throw new AppError("endsAt cannot be before startsAt", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    if (dto.discountType === "PERCENTAGE" && dto.discountValue > 100) {
      throw new AppError("Percentage discount cannot exceed 100%", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    if (dto.discountValue <= 0) {
      throw new AppError("Discount value must be greater than 0", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    const code = dto.code.trim().toUpperCase();

    const existing = await this.db.discount.findFirst({
      where: { storeId, code }
    });

    if (existing) {
      throw new AppError("A discount code with this name already exists for this store", {
        code: "CONFLICT",
        statusCode: 409
      });
    }

    return this.db.discount.create({
      data: {
        storeId,
        code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        usageLimit: dto.maxUsageCount ?? null,
        minOrderAmount: dto.minOrderAmount ?? null,
        startsAt,
        endsAt,
        isActive: true
      }
    });
  }

  public async deactivateDiscount(storeId: string, discountId: string) {
    const discount = await this.db.discount.findUnique({
      where: { id: discountId }
    });

    if (!discount) {
      throw new NotFoundError("Discount not found");
    }

    if (discount.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to access this discount");
    }

    return this.db.discount.update({
      where: { id: discountId },
      data: { isActive: false }
    });
  }

  public async deleteDiscount(storeId: string, discountId: string) {
    const discount = await this.db.discount.findUnique({
      where: { id: discountId }
    });

    if (!discount) {
      throw new NotFoundError("Discount not found");
    }

    if (discount.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to delete this discount");
    }

    return this.db.discount.delete({
      where: { id: discountId }
    });
  }

  public async deleteOffer(
    storeId: string,
    offerId: string,
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const offer = await this.db.offer.findUnique({
      where: { id: offerId }
    });

    if (!offer) {
      throw new NotFoundError("Offer not found");
    }

    if (offer.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to delete this offer");
    }

    await this.db.offer.delete({
      where: { id: offerId }
    });

    await this.db.auditLog.create({
      data: {
        actorId: ownerId,
        actorRole: "STORE_OWNER",
        action: "STORE_OFFER_DELETE",
        entityType: "Offer",
        entityId: offerId,
        oldValue: {
          title: offer.title,
          discountType: offer.discountType,
          discountValue: Number(offer.discountValue)
        },
        ip,
        userAgent
      }
    });
  }

  public async updateDiscount(
    storeId: string,
    discountId: string,
    dto: {
      code?: string;
      discountType?: "PERCENTAGE" | "FLAT";
      discountValue?: number;
      maxUsageCount?: number | null;
      minOrderAmount?: number | null;
      startsAt?: Date | undefined;
      endsAt?: Date | undefined;
      isActive?: boolean;
    }
  ) {
    const discount = await this.db.discount.findUnique({
      where: { id: discountId }
    });

    if (!discount) {
      throw new NotFoundError("Discount not found");
    }

    if (discount.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to update this discount");
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (code !== discount.code) {
        const existing = await this.db.discount.findFirst({
          where: { storeId, code }
        });
        if (existing) {
          throw new AppError("A discount code with this name already exists for this store", {
            code: "CONFLICT",
            statusCode: 409
          });
        }
      }
    }

    if (dto.discountValue !== undefined && dto.discountValue <= 0) {
      throw new AppError("Discount value must be greater than 0", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    const updateData: Prisma.DiscountUpdateInput = {};
    if (dto.code !== undefined) updateData.code = dto.code.trim().toUpperCase();
    if (dto.discountType !== undefined) updateData.discountType = dto.discountType;
    if (dto.discountValue !== undefined) updateData.discountValue = new Prisma.Decimal(dto.discountValue.toString());
    if (dto.maxUsageCount !== undefined) updateData.usageLimit = dto.maxUsageCount;
    if (dto.minOrderAmount !== undefined) updateData.minOrderAmount = dto.minOrderAmount ? new Prisma.Decimal(dto.minOrderAmount.toString()) : null;
    if (dto.startsAt !== undefined) updateData.startsAt = dto.startsAt;
    if (dto.endsAt !== undefined) updateData.endsAt = dto.endsAt;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.db.discount.update({
      where: { id: discountId },
      data: updateData
    });
  }

  public async updateOffer(
    storeId: string,
    offerId: string,
    dto: {
      title?: string;
      description?: string;
      discountType?: "PERCENTAGE" | "FLAT";
      discountValue?: number;
      minOrderAmount?: number | null;
      maxDiscount?: number | null;
      startsAt?: Date | undefined;
      endsAt?: Date | undefined;
      isActive?: boolean;
    }
  ) {
    const offer = await this.db.offer.findUnique({
      where: { id: offerId }
    });

    if (!offer) {
      throw new NotFoundError("Offer not found");
    }

    if (offer.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to update this offer");
    }

    if (dto.discountValue !== undefined && dto.discountValue <= 0) {
      throw new AppError("Discount value must be greater than 0", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    const updateData: Prisma.OfferUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.discountType !== undefined) updateData.discountType = dto.discountType;
    if (dto.discountValue !== undefined) updateData.discountValue = new Prisma.Decimal(dto.discountValue.toString());
    if (dto.minOrderAmount !== undefined) updateData.minOrderAmount = dto.minOrderAmount ? new Prisma.Decimal(dto.minOrderAmount.toString()) : null;
    if (dto.maxDiscount !== undefined) updateData.maxDiscount = dto.maxDiscount ? new Prisma.Decimal(dto.maxDiscount.toString()) : null;
    if (dto.startsAt !== undefined) updateData.startsAt = dto.startsAt;
    if (dto.endsAt !== undefined) updateData.endsAt = dto.endsAt;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.db.offer.update({
      where: { id: offerId },
      data: updateData
    });
  }

  public async getSettings(storeId: string) {
    const store = await this.db.store.findUnique({
      where: { id: storeId }
    });
    if (!store) {
      throw new NotFoundError("Store not found");
    }

    const owner = await this.db.storeOwner.findFirst({
      where: { storeId }
    });
    if (!owner) {
      throw new NotFoundError("Store owner not found");
    }

    let weatherModeDeliveryWindowStart = "";
    let weatherModeDeliveryWindowEnd = "";
    if (store.weatherModeDeliveryWindow) {
      const match = store.weatherModeDeliveryWindow.match(/^(\d+)-(\d+)\s*min$/);
      if (match) {
        weatherModeDeliveryWindowStart = match[1] ?? "";
        weatherModeDeliveryWindowEnd = match[2] ?? "";
      }
    }

    return {
      name: store.name,
      description: store.description ?? "",
      phone: store.phone ?? "",
      address: store.address ?? "",
      weatherModeDeliveryWindowStart,
      weatherModeDeliveryWindowEnd,
      email: owner.email,
      totpEnabled: owner.totpEnabled
    };
  }

  public async updateSettings(
    storeId: string,
    dto: {
      name: string;
      description?: string | undefined;
      phone?: string | undefined;
      address?: string | undefined;
      weatherModeDeliveryWindowStart?: string | undefined;
      weatherModeDeliveryWindowEnd?: string | undefined;
    }
  ) {
    if (!dto.name || dto.name.trim() === "") {
      throw new AppError("Store name cannot be empty", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    let weatherModeDeliveryWindow: string | null = null;
    if (dto.weatherModeDeliveryWindowStart && dto.weatherModeDeliveryWindowEnd) {
      weatherModeDeliveryWindow = `${dto.weatherModeDeliveryWindowStart}-${dto.weatherModeDeliveryWindowEnd} min`;
    }

    await this.db.store.update({
      where: { id: storeId },
      data: {
        name: dto.name,
        description: dto.description ?? "",
        phone: dto.phone ?? "",
        address: dto.address ?? "",
        weatherModeDeliveryWindow
      }
    });
  }

  public async changePassword(
    storeOwnerId: string,
    dto: {
      currentPassword?: string;
      newPassword?: string;
    }
  ) {
    if (!dto.currentPassword || !dto.newPassword) {
      throw new AppError("Current password and new password are required", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    const owner = await this.db.storeOwner.findUnique({
      where: { id: storeOwnerId }
    });
    if (!owner) {
      throw new NotFoundError("Store owner not found");
    }

    const isMatch = await compare(dto.currentPassword, owner.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid current password");
    }

    const newHash = await hash(dto.newPassword, 8);
    await this.db.storeOwner.update({
      where: { id: storeOwnerId },
      data: {
        passwordHash: newHash
      }
    });
  }

  public async setStoreAvailability(storeId: string, value: boolean) {
    const store = await this.db.store.findUnique({
      where: { id: storeId }
    });
    if (!store) {
      throw new NotFoundError("Store not found");
    }

    await this.db.store.update({
      where: { id: storeId },
      data: {
        isAcceptingOrders: value
      }
    });
  }

  public async setVariantAvailability(storeId: string, productId: string, variantId: string, value: boolean) {
    const product = await this.db.product.findUnique({
      where: { id: productId }
    });
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    if (product.storeId !== storeId) {
      throw new ForbiddenError("Product does not belong to this store");
    }

    const variant = await this.db.productVariant.findUnique({
      where: { id: variantId }
    });
    if (!variant) {
      throw new NotFoundError("Product variant not found");
    }
    if (variant.productId !== productId) {
      throw new ForbiddenError("Variant does not belong to this product");
    }

    await this.db.productVariant.update({
      where: { id: variantId },
      data: {
        isAvailableForBooking: value
      }
    });
  }

  public async getStoreType(storeId: string): Promise<string> {
    const store = await this.db.store.findUnique({
      where: { id: storeId },
      select: { storeType: true }
    });
    if (!store) {
      throw new NotFoundError("Store not found");
    }
    return store.storeType;
  }

  private async enforceQuickCommerce(storeId: string) {
    const storeType = await this.getStoreType(storeId);
    if (storeType !== "QUICK_COMMERCE") {
      throw new AppError("Operation not allowed on this store type", {
        code: "INVALID_STORE_TYPE",
        statusCode: 400
      });
    }
  }

  public async restockVariant(
    storeId: string,
    productId: string,
    variantId: string,
    addQty: number,
    note?: string
  ) {
    await this.enforceQuickCommerce(storeId);

    return this.db.$transaction(async (tx) => {
      // 1. Verify product belongs to store
      const product = await tx.product.findUnique({
        where: { id: productId }
      });
      if (!product || product.storeId !== storeId) {
        throw new ForbiddenError("Product does not belong to this store");
      }

      // 2. Increment stock using repository logic
      const variantRepo = new ProductVariantRepository(this.db);
      const { stockQtyBefore, stockQtyAfter } = await variantRepo.incrementStock(
        variantId,
        addQty,
        storeId,
        tx
      );

      // 3. Log stock movement
      const movementRepo = new StockMovementRepository(this.db);
      await movementRepo.create(
        {
          storeId,
          productVariantId: variantId,
          orderId: null,
          type: "REFILL",
          quantity: addQty,
          stockQtyBefore,
          stockQtyAfter,
          ...(note ? { note } : {})
        },
        tx
      );

      // 4. Return updated variant
      return tx.productVariant.findUniqueOrThrow({
        where: { id: variantId }
      });
    });
  }

  public async adjustVariantStock(
    storeId: string,
    productId: string,
    variantId: string,
    setQty: number,
    reason: string
  ) {
    await this.enforceQuickCommerce(storeId);

    if (!reason || reason.trim() === "") {
      throw new AppError("Adjustment reason is required", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    return this.db.$transaction(async (tx) => {
      // 1. Verify product belongs to store
      const product = await tx.product.findUnique({
        where: { id: productId }
      });
      if (!product || product.storeId !== storeId) {
        throw new ForbiddenError("Product does not belong to this store");
      }

      // 2. Set stock using repository logic
      const variantRepo = new ProductVariantRepository(this.db);
      const { stockQtyBefore, stockQtyAfter } = await variantRepo.setStock(
        variantId,
        setQty,
        storeId,
        tx
      );

      // 3. Log stock movement
      const quantity = Math.abs(stockQtyAfter - stockQtyBefore);
      const movementRepo = new StockMovementRepository(this.db);
      await movementRepo.create(
        {
          storeId,
          productVariantId: variantId,
          orderId: null,
          type: "ADJUSTMENT",
          quantity,
          stockQtyBefore,
          stockQtyAfter,
          reason
        },
        tx
      );

      // 4. Return updated variant
      return tx.productVariant.findUniqueOrThrow({
        where: { id: variantId }
      });
    });
  }

  public async updateLowStockThreshold(
    storeId: string,
    productId: string,
    variantId: string,
    threshold: number
  ) {
    await this.enforceQuickCommerce(storeId);

    if (threshold < 0) {
      throw new AppError("Threshold cannot be negative", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    return this.db.$transaction(async (tx) => {
      // 1. Verify product belongs to store
      const product = await tx.product.findUnique({
        where: { id: productId }
      });
      if (!product || product.storeId !== storeId) {
        throw new ForbiddenError("Product does not belong to this store");
      }

      const variant = await tx.productVariant.findUnique({
        where: { id: variantId }
      });
      if (!variant || variant.productId !== productId) {
        throw new NotFoundError("Product variant not found");
      }

      // 2. Update threshold & recalculate isLowStock
      const isLowStock = variant.stockQty <= threshold;
      return tx.productVariant.update({
        where: { id: variantId },
        data: {
          lowStockThreshold: threshold,
          isLowStock
        }
      });
    });
  }

  public async getStockHistory(storeId: string, productId: string) {
    await this.enforceQuickCommerce(storeId);

    // 1. Verify product belongs to store
    const product = await this.db.product.findUnique({
      where: { id: productId },
      include: { variants: true }
    });
    if (!product || product.storeId !== storeId) {
      throw new ForbiddenError("Product does not belong to this store");
    }

    const variantIds = product.variants.map((v) => v.id);

    // 2. Retrieve stock movements
    return this.db.stockMovement.findMany({
      where: {
        productVariantId: { in: variantIds }
      },
      include: {
        productVariant: {
          select: {
            id: true,
            label: true,
            unit: true,
            product: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  public async bulkValidateProducts(storeId: string, rows: BulkProductRow[]) {
    const conflicts: BulkProductConflict[] = [];
    let totalVariantRows = 0;

    const store = await this.db.store.findUnique({
      where: { id: storeId }
    });
    if (!store) {
      throw new AppError("Store not found", { statusCode: 404 });
    }
    const storeType = store.storeType;

    let i = 0;
    for (const row of rows) {
      const rowNum = ++i;
      totalVariantRows += row.variants.length;

      // Check if product name exists in store
      const existingProduct = await this.db.product.findFirst({
        where: { storeId, name: row.productName, isDeleted: false }
      });
      if (existingProduct) {
        conflicts.push({
          row: rowNum,
          type: "PRODUCT_NAME_EXISTS",
          productName: row.productName
        });
      }

      // Check if subcategory exists
      const subCategory = await this.db.subCategory.findFirst({
        where: { name: { equals: row.subCategoryName, mode: "insensitive" } },
        include: { category: true }
      });
      if (!subCategory) {
        conflicts.push({
          row: rowNum,
          type: "SUBCATEGORY_NOT_FOUND",
          subCategoryName: row.subCategoryName
        });
      } else if (subCategory.category.commerceType !== storeType) {
        conflicts.push({
          row: rowNum,
          type: "COMMERCE_TYPE_MISMATCH",
          subCategoryName: row.subCategoryName,
          commerceType: subCategory.category.commerceType
        });
      }

      // Check duplicate variant labels within the same row
      const labels = row.variants.map((v) => v.label.trim().toLowerCase());
      const uniqueLabels = new Set(labels);
      if (uniqueLabels.size !== labels.length) {
        const seen = new Set<string>();
        for (const v of row.variants) {
          const l = v.label.trim().toLowerCase();
          if (seen.has(l)) {
            conflicts.push({
              row: rowNum,
              type: "DUPLICATE_VARIANT_LABEL",
              label: v.label
            });
            break;
          }
          seen.add(l);
        }
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      totalRows: rows.length,
      totalVariantRows
    };
  }

  public async bulkConfirmProducts(
    storeId: string,
    rows: BulkProductRow[],
    mode: "strict" | "skip",
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const { conflicts } = await this.bulkValidateProducts(storeId, rows);

    if (mode === "strict" && conflicts.length > 0) {
      throw new AppError("Bulk insertion conflicts detected in strict mode", {
        code: "BULK_CONFLICT",
        statusCode: 409,
        details: { conflicts }
      });
    }

    const conflictRowNums = new Set(conflicts.map((c) => c.row));
    const cleanRows = rows.filter((_, idx) => !conflictRowNums.has(idx + 1));

    if (cleanRows.length === 0) {
      return {
        inserted: 0,
        skipped: rows.length
      };
    }

    await this.db.$transaction(async (tx) => {
      for (const row of cleanRows) {
        const subCategory = await tx.subCategory.findFirst({
          where: { name: { equals: row.subCategoryName, mode: "insensitive" } }
        });
        if (!subCategory) {
          throw new NotFoundError(`Subcategory not found: ${row.subCategoryName}`);
        }

        const product = await tx.product.create({
          data: {
            storeId,
            categoryId: subCategory.categoryId,
            subCategoryId: subCategory.id,
            name: row.productName,
            description: row.description,
            imageUrl: row.imageUrl,
            isActive: true
          }
        });

        for (const v of row.variants) {
          const lowStockThreshold = v.lowStockThreshold ?? 5;
          const isInStock = v.stockQty > 0;
          const isLowStock = v.stockQty <= lowStockThreshold;

          const variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              label: v.label,
              price: new Prisma.Decimal(v.price.toString()),
              stockQty: v.stockQty,
              lowStockThreshold,
              isLowStock,
              isInStock,
              unit: v.unit,
              isActive: true
            }
          });

          await tx.stockMovement.create({
            data: {
              productVariantId: variant.id,
              type: "INITIAL",
              quantity: v.stockQty,
              stockQtyBefore: 0,
              stockQtyAfter: v.stockQty
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: ownerId,
          actorRole: "STORE_OWNER",
          action: "STORE_BULK_PRODUCT_INSERT",
          entityType: "Product",
          entityId: "BULK",
          newValue: {
            insertedCount: cleanRows.length,
            skippedCount: rows.length - cleanRows.length
          },
          ip,
          userAgent
        }
      });
    });

    return {
      inserted: cleanRows.length,
      skipped: rows.length - cleanRows.length
    };
  }

  public async bulkValidateRestock(storeId: string, rows: BulkRestockRow[]) {
    const conflicts: BulkRestockConflict[] = [];

    let i = 0;
    for (const row of rows) {
      const rowNum = ++i;

      const matchingProducts = await this.db.product.findMany({
        where: { storeId, name: row.productName, isDeleted: false }
      });

      if (matchingProducts.length === 0) {
        conflicts.push({
          row: rowNum,
          type: "PRODUCT_NOT_FOUND",
          productName: row.productName
        });
        continue;
      }

      if (matchingProducts.length > 1) {
        conflicts.push({
          row: rowNum,
          type: "AMBIGUOUS_PRODUCT_NAME",
          productName: row.productName
        });
        continue;
      }

      const product = matchingProducts[0]!;

      const variant = await this.db.productVariant.findFirst({
        where: { productId: product.id, label: row.variantLabel }
      });

      if (!variant) {
        conflicts.push({
          row: rowNum,
          type: "VARIANT_NOT_FOUND",
          productName: row.productName,
          variantLabel: row.variantLabel
        });
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      totalRows: rows.length
    };
  }

  public async bulkConfirmRestock(
    storeId: string,
    rows: BulkRestockRow[],
    mode: "strict" | "skip",
    ownerId: string,
    ip: string,
    userAgent: string
  ) {
    const { conflicts } = await this.bulkValidateRestock(storeId, rows);

    if (mode === "strict" && conflicts.length > 0) {
      throw new AppError("Bulk restock conflicts detected in strict mode", {
        code: "BULK_CONFLICT",
        statusCode: 409,
        details: { conflicts }
      });
    }

    const conflictRowNums = new Set(conflicts.map((c) => c.row));
    const cleanRows = rows.filter((_, idx) => !conflictRowNums.has(idx + 1));

    if (cleanRows.length === 0) {
      return {
        updated: 0,
        skipped: rows.length
      };
    }

    let updatedCount = 0;

    await this.db.$transaction(async (tx) => {
      for (const row of cleanRows) {
        const product = await tx.product.findFirstOrThrow({
          where: { storeId, name: row.productName, isDeleted: false }
        });

        const variant = await tx.productVariant.findFirstOrThrow({
          where: { productId: product.id, label: row.variantLabel }
        });

        const oldQty = variant.stockQty;
        const newQty = row.newStockQty;

        if (oldQty !== newQty) {
          const quantity = Math.abs(newQty - oldQty);
          const lowStockThreshold = variant.lowStockThreshold;
          const isLowStock = newQty <= lowStockThreshold;
          const isInStock = newQty > 0;

          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              stockQty: newQty,
              isLowStock,
              isInStock
            }
          });

          await tx.stockMovement.create({
            data: {
              productVariantId: variant.id,
              type: "ADJUSTMENT",
              quantity,
              stockQtyBefore: oldQty,
              stockQtyAfter: newQty,
              reason: "Bulk restock update"
            }
          });

          updatedCount++;
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: ownerId,
          actorRole: "STORE_OWNER",
          action: "STORE_BULK_RESTOCK",
          entityType: "ProductVariant",
          entityId: "BULK",
          newValue: {
            updatedCount,
            skippedCount: rows.length - updatedCount
          },
          ip,
          userAgent
        }
      });
    });

    return {
      updated: updatedCount,
      skipped: rows.length - updatedCount
    };
  }
}

export type BulkProductRow = {
  productName: string;
  subCategoryName: string;
  description: string;
  imageUrl: string;
  variants: {
    label: string;
    price: number;
    stockQty: number;
    unit: string;
    lowStockThreshold?: number | undefined;
  }[];
};

export type BulkProductConflict =
  | { row: number; type: "PRODUCT_NAME_EXISTS"; productName: string }
  | { row: number; type: "SUBCATEGORY_NOT_FOUND"; subCategoryName: string }
  | { row: number; type: "COMMERCE_TYPE_MISMATCH"; subCategoryName: string; commerceType: string }
  | { row: number; type: "DUPLICATE_VARIANT_LABEL"; label: string };

export type BulkRestockRow = {
  productName: string;
  variantLabel: string;
  newStockQty: number;
};

export type BulkRestockConflict =
  | { row: number; type: "PRODUCT_NOT_FOUND"; productName: string }
  | { row: number; type: "AMBIGUOUS_PRODUCT_NAME"; productName: string }
  | { row: number; type: "VARIANT_NOT_FOUND"; productName: string; variantLabel: string };


