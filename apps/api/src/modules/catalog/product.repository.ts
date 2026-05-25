import { NotFoundError } from "@gorola/shared";
import { Prisma, type PrismaClient, type Product } from "@prisma/client";

export type CreateProductInput = {
  storeId: string;
  categoryId: string;
  subCategoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  isActive?: boolean;
};

export type UpdateProductInput = Partial<
  Pick<Product, "name" | "description" | "imageUrl" | "categoryId" | "subCategoryId" | "isActive" | "isDeleted">
>;

export type ListProductsInput = {
  categoryId?: string;
  subCategoryId?: string;
  storeId?: string;
  search?: string;
  cursor?: string;
  limit: number;
};

export type ProductListItem = {
  id: string;
  name: string;
  imageUrl: string;
  storeId: string;
  storeName: string;
  storeType: string;
  categoryId: string;
  highestPricedVariantId: string;
  price: string;
  unit: string;
  isInStock: boolean;
  isLowStock: boolean;
};

export type ProductListResult = {
  items: ProductListItem[];
  nextCursor: string | null;
};

export type ProductDetailResult = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  store: {
    id: string;
    name: string;
    phone: string;
    storeType: string;
  };
  variants: Array<{
    id: string;
    label: string;
    price: string;
    unit: string;
    stockQty: number;
    isInStock: boolean;
    isLowStock: boolean;
    lowStockThreshold: number;
    requiresFasting: boolean;
    allowedTimeslots: string[];
  }>;
};

const productListInclude = Prisma.validator<Prisma.ProductInclude>()({
  store: {
    select: {
      id: true,
      name: true,
      storeType: true
    }
  },
  variants: {
    where: {
      isActive: true
    },
    orderBy: {
      price: "desc"
    },
    take: 1,
    select: {
      id: true,
      price: true,
      unit: true,
      isInStock: true,
      isLowStock: true
    }
  }
});

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

export class ProductRepository {
  public constructor(private readonly db: PrismaClient) { }

  public async findById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<Product | null> {
    return this.db.product.findFirst({
      where: {
        id,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
  }

  public async findByStoreId(
    storeId: string,
    options?: { includeDeleted?: boolean; includeInactive?: boolean }
  ): Promise<Product[]> {
    return this.db.product.findMany({
      where: {
        storeId,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false }),
        ...(options?.includeInactive === true ? {} : { isActive: true })
      },
      orderBy: { name: "asc" }
    });
  }

  public async create(input: CreateProductInput): Promise<Product> {
    try {
      return await this.db.product.create({
        data: {
          storeId: input.storeId,
          categoryId: input.categoryId,
          subCategoryId: input.subCategoryId,
          name: input.name,
          description: input.description,
          imageUrl: input.imageUrl,
          isActive: input.isActive ?? true
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2003")) {
        throw new NotFoundError(
          "Store or category not found",
          { storeId: input.storeId, categoryId: input.categoryId },
          error
        );
      }
      throw error;
    }
  }

  public async update(id: string, data: UpdateProductInput): Promise<Product> {
    try {
      return await this.db.product.update({
        where: { id },
        data
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Product not found", { id }, error);
      }
      if (isPrismaError(error, "P2003")) {
        throw new NotFoundError(
          "Category not found",
          { categoryId: data.categoryId },
          error
        );
      }
      throw error;
    }
  }

  public async listForBuyer(input: ListProductsInput): Promise<ProductListResult> {
    const where: Prisma.ProductWhereInput = {
      isDeleted: false,
      isActive: true,
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.subCategoryId !== undefined ? { subCategoryId: input.subCategoryId } : {}),
      ...(input.storeId !== undefined ? { storeId: input.storeId } : {}),
      ...(input.search !== undefined && input.search.length > 0
        ? {
          name: {
            contains: input.search,
            mode: "insensitive"
          }
        }
        : {})
    };

    const rows: Prisma.ProductGetPayload<{ include: typeof productListInclude }>[] =
      await this.db.product.findMany({
        where,
        take: input.limit + 1,
        orderBy: { id: "asc" },
        include: productListInclude,
        ...(input.cursor !== undefined
          ? {
            cursor: { id: input.cursor },
            skip: 1
          }
          : {})
      });

    const hasNext = rows.length > input.limit;
    const page = hasNext ? rows.slice(0, input.limit) : rows;

    const items = page
      .filter((row) => row.variants.length > 0)
      .map((row) => ({
        id: row.id,
        productId: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        storeId: row.store.id,
        storeName: row.store.name,
        storeType: row.store.storeType,
        categoryId: row.categoryId,
        highestPricedVariantId: row.variants[0]!.id,
        price: row.variants[0]!.price.toFixed(2),
        unit: row.variants[0]!.unit,
        isInStock: row.variants[0]!.isInStock,
        isLowStock: row.variants[0]!.isLowStock
      }));

    return {
      items,
      nextCursor: hasNext ? page[page.length - 1]?.id ?? null : null
    };
  }

  public async getDetailForBuyer(id: string): Promise<ProductDetailResult> {
    const product = await this.db.product.findFirst({
      where: {
        id,
        isDeleted: false,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        store: {
          select: {
            id: true,
            name: true,
            phone: true,
            storeType: true
          }
        },
        variants: {
          where: {
            isActive: true
          },
          orderBy: {
            price: "asc"
          },
          select: {
            id: true,
            label: true,
            price: true,
            unit: true,
            stockQty: true,
            isInStock: true,
            isLowStock: true,
            lowStockThreshold: true,
            requiresFasting: true,
            allowedTimeslots: true
          }
        }
      }
    });

    if (product === null) {
      throw new NotFoundError("Product not found", { id });
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      store: {
        id: product.store.id,
        name: product.store.name,
        phone: product.store.phone,
        storeType: product.store.storeType
      },
      variants: product.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        price: variant.price.toFixed(2),
        unit: variant.unit,
        stockQty: variant.stockQty,
        isInStock: variant.isInStock,
        isLowStock: variant.isLowStock,
        lowStockThreshold: variant.lowStockThreshold,
        requiresFasting: variant.requiresFasting,
        allowedTimeslots: variant.allowedTimeslots
      }))
    };
  }
}
