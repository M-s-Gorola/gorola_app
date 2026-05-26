import { AppError, ForbiddenError, NotFoundError } from "@gorola/shared";
import { type OrderStatus, Prisma, type PrismaClient } from "@prisma/client";

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

function maskPhone(phone: string): string {
  if (!phone) return "";
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

export class StoreOwnerService {
  public constructor(private readonly db: PrismaClient) {}

  public async getOrders(
    storeId: string,
    filters: { status?: OrderStatus; page: number; limit: number }
  ) {
    const { status, page, limit } = filters;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.OrderWhereInput = {
      storeId,
      ...(status ? { status } : {})
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
    }
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

    if (newStatus === "CANCELLED") {
      return orderService.cancelOrderWithStockRestore(orderId, "STORE_OWNER");
    } else {
      return orderService.updateStatus(orderId, newStatus, "STORE_OWNER");
    }
  }


  public async getDashboard(storeId: string): Promise<DashboardKpiSummary> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const store = await this.db.store.findUnique({
      where: { id: storeId },
      select: { storeType: true }
    });
    const isBooking = store?.storeType === "BOOKING_COMMERCE";

    // 1. Today's Order Count (all orders/bookings placed today regardless of status)
    const todayOrderCount = isBooking
      ? await this.db.bookingOrder.count({
          where: {
            order: {
              storeId,
              createdAt: {
                gte: startOfToday,
                lte: endOfToday
              }
            }
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

    // 4. Weekly Revenue Trend (daily revenue for the last 7 calendar days, including today)
    const weeklyRevenue: { date: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const sumResult = isBooking
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
                gte: dayStart,
                lte: dayEnd
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
    }
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
    }
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

    return this.db.product.update({
      where: { id: productId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.imageUrl ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.subCategoryId ? { subCategoryId: dto.subCategoryId, categoryId } : {})
      }
    });
  }

  public async softDeleteProduct(storeId: string, productId: string) {
    const product = await this.db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to delete this product");
    }

    return this.db.product.update({
      where: { id: productId },
      data: {
        isDeleted: true
      }
    });
  }

  public async updateProductStatus(storeId: string, productId: string, isActive: boolean) {
    const product = await this.db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to modify this product's status");
    }

    return this.db.product.update({
      where: { id: productId },
      data: {
        isActive
      }
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
    }
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
    }
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
    dto: { imageUrl: string; title: string; startsAt: string | Date; endsAt: string | Date }
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt.getTime() < startsAt.getTime()) {
      throw new AppError("endsAt cannot be before startsAt", {
        code: "VALIDATION_ERROR",
        statusCode: 400
      });
    }

    return this.db.advertisement.create({
      data: {
        storeId,
        title: dto.title,
        imageUrl: dto.imageUrl,
        startsAt,
        endsAt,
        isApproved: false,
        isActive: true
      }
    });
  }

  public async deleteAd(storeId: string, adId: string) {
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

    return this.db.offer.create({
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
  }

  public async deactivateOffer(storeId: string, offerId: string) {
    const offer = await this.db.offer.findUnique({
      where: { id: offerId }
    });

    if (!offer) {
      throw new NotFoundError("Offer not found");
    }

    if (offer.storeId !== storeId) {
      throw new ForbiddenError("You are not authorized to access this offer");
    }

    return this.db.offer.update({
      where: { id: offerId },
      data: { isActive: false }
    });
  }
}

