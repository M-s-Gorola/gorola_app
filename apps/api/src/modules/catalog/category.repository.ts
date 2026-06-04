import { ConflictError, NotFoundError } from "@gorola/shared";
import type { Category, PrismaClient } from "@prisma/client";

export type CreateCategoryInput = {
  slug: string;
  name: string;
  imageUrl?: string | null;
  icon?: string | null;
  displayOrder?: number;
  isActive?: boolean;
};

export type UpdateCategoryInput = Partial<
  Pick<Category, "slug" | "name" | "imageUrl" | "icon" | "displayOrder" | "isActive">
>;

export type BuyerCategory = Category & {
  productCount: number;
};

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

export class CategoryRepository {
  public constructor(private readonly db: PrismaClient) { }

  public async findById(
    id: string,
    options?: { includeInactive?: boolean }
  ): Promise<Category | null> {
    return this.db.category.findFirst({
      where: {
        id,
        ...(options?.includeInactive === true ? {} : { isActive: true })
      }
    });
  }

  public async findBySlug(
    slug: string,
    options?: { includeInactive?: boolean }
  ): Promise<Category | null> {
    return this.db.category.findFirst({
      where: {
        slug,
        ...(options?.includeInactive === true ? {} : { isActive: true })
      }
    });
  }

  public async findAll(options?: { includeInactive?: boolean }): Promise<Category[]> {
    return this.db.category.findMany({
      where: options?.includeInactive === true ? {} : { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });
  }

  public async findAllForBuyer(): Promise<BuyerCategory[]> {
    const categories = await this.findAll();
    if (categories.length === 0) {
      return [];
    }

    const categoryIds = categories.map((category) => category.id);
    const productCounts = await this.db.product.groupBy({
      by: ["categoryId"],
      where: {
        categoryId: { in: categoryIds },
        isActive: true,
        isDeleted: false,
        store: {
          isActive: true,
          isDeleted: false
        }
      },
      _count: {
        _all: true
      }
    });
    const countByCategory = new Map(productCounts.map((row) => [row.categoryId, row._count._all]));

    return categories.map((category) => ({
      ...category,
      productCount: countByCategory.get(category.id) ?? 0
    }));
  }

  public async create(input: CreateCategoryInput): Promise<Category> {
    try {
      return await this.db.category.create({
        data: {
          slug: input.slug,
          name: input.name,
          imageUrl: input.imageUrl ?? null,
          icon: input.icon ?? null,
          displayOrder: input.displayOrder ?? 0,
          isActive: input.isActive ?? true
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2002")) {
        throw new ConflictError(
          "Category with this slug already exists",
          { field: "slug" },
          error
        );
      }
      throw error;
    }
  }

  public async update(id: string, data: UpdateCategoryInput): Promise<Category> {
    try {
      return await this.db.category.update({
        where: { id },
        data
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Category not found", { id }, error);
      }
      if (isPrismaError(error, "P2002")) {
        throw new ConflictError(
          "Category with this slug already exists",
          { field: "slug" },
          error
        );
      }
      throw error;
    }
  }
}
