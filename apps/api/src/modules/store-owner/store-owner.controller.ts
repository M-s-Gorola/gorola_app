import { ValidationError } from "@gorola/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getPrismaClient } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import type { AccessTokenVerifier } from "../auth/auth.types.js";
import { StoreOwnerRepository } from "./store-owner.repository.js";
import { StoreOwnerService } from "./store-owner.service.js";

function getRequestId(request: FastifyRequest, reply: FastifyReply): string {
  return reply.getHeader("x-request-id")?.toString() ?? request.id;
}

export function registerStoreOwnerRoutes(
  app: FastifyInstance,
  deps: {
    tokenVerifier: AccessTokenVerifier;
    orderService?: unknown;
    orders?: unknown;
  }
): void {
  const prisma = getPrismaClient();
  const storeOwnerService = new StoreOwnerService(prisma);
  const storeOwnerRepository = new StoreOwnerRepository(prisma);
  const preHandler = [requireAuth(deps.tokenVerifier), requireRole(["STORE_OWNER"])];

  app.get("/api/v1/store/dashboard", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const storeId = owner.storeId;
    const data = await storeOwnerService.getDashboard(storeId);

    return {
      success: true,
      data,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.get("/api/v1/store/orders", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const storeId = owner.storeId;
    const query = request.query as Record<string, string | undefined>;

    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 10;
    const status = query.status as import("@prisma/client").OrderStatus | undefined;

    const data = await storeOwnerService.getOrders(storeId, {
      ...(status ? { status } : {}),
      page,
      limit
    });

    return {
      success: true,
      data: data.data,
      meta: {
        total: data.meta.total,
        page: data.meta.page,
        limit: data.meta.limit,
        hasMore: data.meta.hasMore,
        requestId: getRequestId(request, reply)
      }
    };
  });

  app.put("/api/v1/store/orders/:orderId/status", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const storeId = owner.storeId;
    const params = request.params as Record<string, string>;
    const orderId = params.orderId;
    if (!orderId) {
      throw new ValidationError("Order ID is required");
    }
    const body = request.body as { status?: string };
    const newStatus = body.status;

    if (!newStatus) {
      throw new ValidationError("Status is required");
    }

    const order = await storeOwnerService.updateOrderStatus(
      storeId,
      orderId,
      newStatus as import("@prisma/client").OrderStatus,
      deps.orderService as {
        cancelOrderWithStockRestore: (orderId: string, actor: string) => Promise<unknown>;
        updateStatus: (
          orderId: string,
          newStatus: import("@prisma/client").OrderStatus,
          actor: string
        ) => Promise<unknown>;
      }
    );

    return {
      success: true,
      data: order,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // GET /api/v1/store/categories
  app.get("/api/v1/store/categories", { preHandler }, async (request, reply) => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        subCategories: {
          where: { isActive: true },
          orderBy: { name: "asc" }
        }
      },
      orderBy: { name: "asc" }
    });

    return {
      success: true,
      data: categories,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // 1. GET /api/v1/store/products
  const getProductsQuerySchema = z.object({
    search: z.string().trim().min(1).optional(),
    subCategoryId: z.string().min(1).optional(),
    lowStock: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10)
  });

  app.get("/api/v1/store/products", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const parsed = getProductsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query parameters", parsed.error.flatten());
    }

    const queryParams: {
      page: number;
      limit: number;
      search?: string;
      subCategoryId?: string;
      lowStock?: boolean;
    } = {
      page: parsed.data.page,
      limit: parsed.data.limit
    };
    if (parsed.data.search !== undefined) {
      queryParams.search = parsed.data.search;
    }
    if (parsed.data.subCategoryId !== undefined) {
      queryParams.subCategoryId = parsed.data.subCategoryId;
    }
    if (parsed.data.lowStock !== undefined) {
      queryParams.lowStock = parsed.data.lowStock;
    }

    const result = await storeOwnerService.getProducts(owner.storeId, queryParams);

    return {
      success: true,
      data: result.data,
      meta: {
        total: result.meta.total,
        page: result.meta.page,
        limit: result.meta.limit,
        hasMore: result.meta.hasMore,
        requestId: getRequestId(request, reply)
      }
    };
  });

  // GET /api/v1/store/products/:id
  app.get("/api/v1/store/products/:id", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const productId = params.id;
    if (!productId) {
      throw new ValidationError("Product ID is required");
    }

    const product = await storeOwnerService.getProductById(owner.storeId, productId);

    return {
      success: true,
      data: product,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // 2. POST /api/v1/store/products
  const createProductBodySchema = z.object({
    name: z.string().trim().min(1, "Product name is required"),
    subCategoryId: z.string().min(1, "Sub-category is required"),
    description: z.string().trim().default(""),
    imageUrl: z.string().trim().min(1, "Image URL/path is required"),
    variants: z.array(
      z.object({
        label: z.string().trim().min(1, "Variant label is required"),
        price: z.coerce.number().positive("Price must be positive"),
        stockQty: z.coerce.number().int().nonnegative("Stock quantity must be non-negative").default(0),
        unit: z.string().trim().min(1, "Unit is required"),
        lowStockThreshold: z.coerce.number().int().nonnegative().optional()
      })
    ).min(1, "At least one variant is required")
  });

  app.post("/api/v1/store/products", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const parsed = createProductBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid product data", parsed.error.flatten());
    }

    const variantsMapped = parsed.data.variants.map((v) => {
      const variantItem: {
        label: string;
        price: number;
        stockQty: number;
        unit: string;
        lowStockThreshold?: number;
      } = {
        label: v.label,
        price: v.price,
        stockQty: v.stockQty,
        unit: v.unit
      };
      if (v.lowStockThreshold !== undefined) {
        variantItem.lowStockThreshold = v.lowStockThreshold;
      }
      return variantItem;
    });

    const createPayload = {
      name: parsed.data.name,
      subCategoryId: parsed.data.subCategoryId,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      variants: variantsMapped
    };

    const product = await storeOwnerService.createProduct(owner.storeId, createPayload);

    reply.code(201);
    return {
      success: true,
      data: product,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // 3. PUT /api/v1/store/products/:id
  const updateProductBodySchema = z.object({
    name: z.string().trim().min(1).optional(),
    subCategoryId: z.string().min(1).optional(),
    description: z.string().trim().optional(),
    imageUrl: z.string().trim().optional()
  });

  app.put("/api/v1/store/products/:id", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const productId = params.id;
    if (!productId) {
      throw new ValidationError("Product ID is required");
    }

    const parsed = updateProductBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid product update data", parsed.error.flatten());
    }

    const updatePayload: {
      name?: string;
      subCategoryId?: string;
      description?: string;
      imageUrl?: string;
    } = {};
    if (parsed.data.name !== undefined) {
      updatePayload.name = parsed.data.name;
    }
    if (parsed.data.subCategoryId !== undefined) {
      updatePayload.subCategoryId = parsed.data.subCategoryId;
    }
    if (parsed.data.description !== undefined) {
      updatePayload.description = parsed.data.description;
    }
    if (parsed.data.imageUrl !== undefined) {
      updatePayload.imageUrl = parsed.data.imageUrl;
    }

    const product = await storeOwnerService.updateProduct(owner.storeId, productId, updatePayload);

    return {
      success: true,
      data: product,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // 4. DELETE /api/v1/store/products/:id
  app.delete("/api/v1/store/products/:id", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const productId = params.id;
    if (!productId) {
      throw new ValidationError("Product ID is required");
    }

    await storeOwnerService.softDeleteProduct(owner.storeId, productId);

    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // 5. PUT /api/v1/store/products/:id/variants/:variantId
  const updateVariantBodySchema = z.object({
    label: z.string().trim().min(1).optional(),
    price: z.coerce.number().positive().optional(),
    stockQty: z.coerce.number().int().nonnegative().optional(),
    unit: z.string().trim().min(1).optional(),
    lowStockThreshold: z.coerce.number().int().nonnegative().optional(),
    isActive: z.boolean().optional()
  });

  app.put("/api/v1/store/products/:id/variants/:variantId", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const productId = params.id;
    const variantId = params.variantId;
    if (!productId || !variantId) {
      throw new ValidationError("Product ID and Variant ID are required");
    }

    const parsed = updateVariantBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid variant update data", parsed.error.flatten());
    }

    const variantPayload: {
      label?: string;
      price?: number;
      stockQty?: number;
      unit?: string;
      lowStockThreshold?: number;
      isActive?: boolean;
    } = {};
    if (parsed.data.label !== undefined) {
      variantPayload.label = parsed.data.label;
    }
    if (parsed.data.price !== undefined) {
      variantPayload.price = parsed.data.price;
    }
    if (parsed.data.stockQty !== undefined) {
      variantPayload.stockQty = parsed.data.stockQty;
    }
    if (parsed.data.unit !== undefined) {
      variantPayload.unit = parsed.data.unit;
    }
    if (parsed.data.lowStockThreshold !== undefined) {
      variantPayload.lowStockThreshold = parsed.data.lowStockThreshold;
    }
    if (parsed.data.isActive !== undefined) {
      variantPayload.isActive = parsed.data.isActive;
    }

    const variant = await storeOwnerService.updateVariant(owner.storeId, productId, variantId, variantPayload);

    return {
      success: true,
      data: variant,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // 6. POST /api/v1/store/products/:id/variants
  const createVariantBodySchema = z.object({
    label: z.string().trim().min(1),
    price: z.coerce.number().positive(),
    stockQty: z.coerce.number().int().nonnegative(),
    unit: z.string().trim().min(1),
    lowStockThreshold: z.coerce.number().int().nonnegative().optional()
  });

  app.post("/api/v1/store/products/:id/variants", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const productId = params.id;
    if (!productId) {
      throw new ValidationError("Product ID is required");
    }

    const parsed = createVariantBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid variant data", parsed.error.flatten());
    }

    const createPayload: {
      label: string;
      price: number;
      stockQty: number;
      unit: string;
      lowStockThreshold?: number;
    } = {
      label: parsed.data.label,
      price: parsed.data.price,
      stockQty: parsed.data.stockQty,
      unit: parsed.data.unit
    };
    if (parsed.data.lowStockThreshold !== undefined) {
      createPayload.lowStockThreshold = parsed.data.lowStockThreshold;
    }

    const variant = await storeOwnerService.createVariant(owner.storeId, productId, createPayload);

    reply.code(201);
    return {
      success: true,
      data: variant,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // 7. PUT /api/v1/store/products/:id/status
  const updateProductStatusBodySchema = z.object({
    isActive: z.boolean()
  });

  app.put("/api/v1/store/products/:id/status", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const productId = params.id;
    if (!productId) {
      throw new ValidationError("Product ID is required");
    }

    const parsed = updateProductStatusBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid product status data", parsed.error.flatten());
    }

    const product = await storeOwnerService.updateProductStatus(owner.storeId, productId, parsed.data.isActive);

    return {
      success: true,
      data: product,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // 8. GET /api/v1/store/profile
  app.get("/api/v1/store/profile", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await prisma.storeOwner.findUnique({
      where: { id: userId },
      include: { store: true }
    });
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    return {
      success: true,
      data: owner.store,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // Advertisements Management Schema
  const createAdBodySchema = z.object({
    imageUrl: z.string().trim().min(1, "Image URL is required"),
    title: z.string().trim().min(1, "Title is required"),
    startsAt: z.string().trim().min(1, "startsAt is required"),
    endsAt: z.string().trim().min(1, "endsAt is required")
  });

  // GET /api/v1/store/advertisements
  app.get("/api/v1/store/advertisements", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const ads = await storeOwnerService.getAds(owner.storeId);

    return {
      success: true,
      data: ads,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // POST /api/v1/store/advertisements
  app.post("/api/v1/store/advertisements", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const parsed = createAdBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid advertisement data", parsed.error.flatten());
    }

    const ad = await storeOwnerService.createAd(owner.storeId, parsed.data);

    reply.code(201);
    return {
      success: true,
      data: ad,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // DELETE /api/v1/store/advertisements/:id
  app.delete("/api/v1/store/advertisements/:id", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const adId = params.id;
    if (!adId) {
      throw new ValidationError("Advertisement ID is required");
    }

    await storeOwnerService.deleteAd(owner.storeId, adId);

    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // Offers Management Schema
  const createOfferBodySchema = z.object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional(),
    discountType: z.enum(["PERCENTAGE", "FLAT"]),
    discountValue: z.coerce.number().positive("Discount value must be positive"),
    startsAt: z.string().trim().min(1, "startsAt is required"),
    endsAt: z.string().trim().min(1, "endsAt is required"),
    minOrderAmount: z.coerce.number().nonnegative().optional(),
    maxDiscount: z.coerce.number().nonnegative().optional()
  });

  // GET /api/v1/store/offers
  app.get("/api/v1/store/offers", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const offers = await storeOwnerService.getOffers(owner.storeId);

    return {
      success: true,
      data: offers,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // POST /api/v1/store/offers
  app.post("/api/v1/store/offers", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const parsed = createOfferBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid offer data", parsed.error.flatten());
    }

    const offer = await storeOwnerService.createOffer(owner.storeId, parsed.data);

    reply.code(201);
    return {
      success: true,
      data: offer,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // PUT /api/v1/store/offers/:id/deactivate
  app.put("/api/v1/store/offers/:id/deactivate", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const offerId = params.id;
    if (!offerId) {
      throw new ValidationError("Offer ID is required");
    }

    await storeOwnerService.deactivateOffer(owner.storeId, offerId);

    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // Discounts Management Schema
  const createDiscountBodySchema = z.object({
    code: z.string().trim().min(1, "Code is required"),
    discountType: z.enum(["PERCENTAGE", "FLAT"]),
    discountValue: z.coerce.number().positive("Discount value must be positive"),
    maxUsageCount: z.coerce.number().int().positive().optional(),
    startsAt: z.string().trim().min(1, "startsAt is required"),
    endsAt: z.string().trim().min(1, "endsAt is required")
  });

  // GET /api/v1/store/discounts
  app.get("/api/v1/store/discounts", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const discounts = await storeOwnerService.getDiscounts(owner.storeId);

    return {
      success: true,
      data: discounts.map((d) => ({
        id: d.id,
        code: d.code,
        discountType: d.discountType,
        discountValue: Number(d.discountValue),
        usedCount: d.usedCount,
        maxUsageCount: d.usageLimit,
        isActive: d.isActive,
        startsAt: d.startsAt.toISOString(),
        endsAt: d.endsAt.toISOString()
      })),
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // POST /api/v1/store/discounts
  app.post("/api/v1/store/discounts", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const parsed = createDiscountBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid discount data", parsed.error.flatten());
    }

    const discount = await storeOwnerService.createDiscount(owner.storeId, parsed.data);

    reply.code(201);
    return {
      success: true,
      data: {
        id: discount.id,
        code: discount.code,
        discountType: discount.discountType,
        discountValue: Number(discount.discountValue),
        usedCount: discount.usedCount,
        maxUsageCount: discount.usageLimit,
        isActive: discount.isActive,
        startsAt: discount.startsAt.toISOString(),
        endsAt: discount.endsAt.toISOString()
      },
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // PUT /api/v1/store/discounts/:id/deactivate
  app.put("/api/v1/store/discounts/:id/deactivate", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const discountId = params.id;
    if (!discountId) {
      throw new ValidationError("Discount ID is required");
    }

    await storeOwnerService.deactivateDiscount(owner.storeId, discountId);

    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // DELETE /api/v1/store/discounts/:id
  app.delete("/api/v1/store/discounts/:id", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const discountId = params.id;
    if (!discountId) {
      throw new ValidationError("Discount ID is required");
    }

    await storeOwnerService.deleteDiscount(owner.storeId, discountId);

    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // DELETE /api/v1/store/offers/:id
  app.delete("/api/v1/store/offers/:id", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const offerId = params.id;
    if (!offerId) {
      throw new ValidationError("Offer ID is required");
    }

    await storeOwnerService.deleteOffer(owner.storeId, offerId);

    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // PUT /api/v1/store/discounts/:id
  app.put("/api/v1/store/discounts/:id", { preHandler }, async (request) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const discountId = params.id;
    if (!discountId) {
      throw new ValidationError("Discount ID is required");
    }

    const body = request.body as {
      code?: string;
      discountType?: "PERCENTAGE" | "FLAT";
      discountValue?: number;
      maxUsageCount?: number;
      startsAt?: string;
      endsAt?: string;
      isActive?: boolean;
    };

    let startsAt: Date | undefined;
    let endsAt: Date | undefined;
    if (body.startsAt) {
      startsAt = new Date(body.startsAt);
      if (isNaN(startsAt.getTime())) {
        throw new ValidationError("Invalid startsAt date string");
      }
    }
    if (body.endsAt) {
      endsAt = new Date(body.endsAt);
      if (isNaN(endsAt.getTime())) {
        throw new ValidationError("Invalid endsAt date string");
      }
    }

    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new ValidationError("endsAt cannot be before startsAt");
    }

    if (body.discountValue !== undefined && body.discountType === "PERCENTAGE" && body.discountValue > 100) {
      throw new ValidationError("Percentage discount cannot exceed 100%");
    }

    const updateData: {
      code?: string;
      discountType?: "PERCENTAGE" | "FLAT";
      discountValue?: number;
      maxUsageCount?: number;
      startsAt?: Date;
      endsAt?: Date;
      isActive?: boolean;
    } = {};

    if (body.code !== undefined) updateData.code = body.code;
    if (body.discountType !== undefined) updateData.discountType = body.discountType;
    if (body.discountValue !== undefined) updateData.discountValue = body.discountValue;
    if (body.maxUsageCount !== undefined) updateData.maxUsageCount = body.maxUsageCount;
    if (startsAt !== undefined) updateData.startsAt = startsAt;
    if (endsAt !== undefined) updateData.endsAt = endsAt;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await storeOwnerService.updateDiscount(owner.storeId, discountId, updateData);

    return {
      success: true,
      data: updated
    };
  });

  // PUT /api/v1/store/offers/:id
  app.put("/api/v1/store/offers/:id", { preHandler }, async (request) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const params = request.params as Record<string, string>;
    const offerId = params.id;
    if (!offerId) {
      throw new ValidationError("Offer ID is required");
    }

    const body = request.body as {
      title?: string;
      description?: string;
      discountType?: "PERCENTAGE" | "FLAT";
      discountValue?: number;
      minOrderAmount?: number;
      maxDiscount?: number;
      startsAt?: string;
      endsAt?: string;
      isActive?: boolean;
    };

    let startsAt: Date | undefined;
    let endsAt: Date | undefined;
    if (body.startsAt) {
      startsAt = new Date(body.startsAt);
      if (isNaN(startsAt.getTime())) {
        throw new ValidationError("Invalid startsAt date string");
      }
    }
    if (body.endsAt) {
      endsAt = new Date(body.endsAt);
      if (isNaN(endsAt.getTime())) {
        throw new ValidationError("Invalid endsAt date string");
      }
    }

    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new ValidationError("endsAt cannot be before startsAt");
    }

    if (body.discountValue !== undefined && body.discountType === "PERCENTAGE" && body.discountValue > 100) {
      throw new ValidationError("Percentage discount cannot exceed 100%");
    }

    const updateData: {
      title?: string;
      description?: string;
      discountType?: "PERCENTAGE" | "FLAT";
      discountValue?: number;
      minOrderAmount?: number | null;
      maxDiscount?: number | null;
      startsAt?: Date;
      endsAt?: Date;
      isActive?: boolean;
    } = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.discountType !== undefined) updateData.discountType = body.discountType;
    if (body.discountValue !== undefined) updateData.discountValue = body.discountValue;
    if (body.minOrderAmount !== undefined) updateData.minOrderAmount = body.minOrderAmount;
    if (body.maxDiscount !== undefined) updateData.maxDiscount = body.maxDiscount;
    if (startsAt !== undefined) updateData.startsAt = startsAt;
    if (endsAt !== undefined) updateData.endsAt = endsAt;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await storeOwnerService.updateOffer(owner.storeId, offerId, updateData);

    return {
      success: true,
      data: updated
    };
  });

  // GET /api/v1/store/settings
  app.get("/api/v1/store/settings", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const data = await storeOwnerService.getSettings(owner.storeId);
    return {
      success: true,
      data,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // PUT /api/v1/store/settings
  const updateStoreSettingsSchema = z.object({
    name: z.string().trim().min(1, "Store name is required"),
    description: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    address: z.string().trim().optional(),
    weatherModeDeliveryWindowStart: z.string().trim().optional(),
    weatherModeDeliveryWindowEnd: z.string().trim().optional()
  });

  app.put("/api/v1/store/settings", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const owner = await storeOwnerRepository.findById(userId);
    if (!owner) {
      throw new ValidationError("Store owner profile not found");
    }

    const parsed = updateStoreSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid settings data", parsed.error.flatten());
    }

    await storeOwnerService.updateSettings(owner.storeId, parsed.data);

    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });

  // PUT /api/v1/auth/store-owner/change-password
  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(1, "New password is required")
  });

  app.put("/api/v1/auth/store-owner/change-password", { preHandler }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw new ValidationError("User subject missing from auth context");
    }

    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid password data", parsed.error.flatten());
    }

    await storeOwnerService.changePassword(userId, parsed.data);

    return {
      success: true,
      meta: {
        requestId: getRequestId(request, reply)
      }
    };
  });
}


