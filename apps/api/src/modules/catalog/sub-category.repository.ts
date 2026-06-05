import { ConflictError, NotFoundError } from "@gorola/shared";
import type { PrismaClient, SubCategory } from "@prisma/client";

export type CreateSubCategoryInput = {
  name: string;
  slug: string;
  imageUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
};

export type UpdateSubCategoryInput = Partial<
  Pick<SubCategory, "name" | "slug" | "imageUrl" | "displayOrder" | "isActive">
>;

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

export class SubCategoryRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(id: string): Promise<SubCategory | null> {
    return this.db.subCategory.findUnique({
      where: { id }
    });
  }

  public async findBySlug(slug: string): Promise<SubCategory | null> {
    return this.db.subCategory.findUnique({
      where: { slug }
    });
  }

  public async findAllByCategorySlug(
    categorySlug: string,
    options?: { includeInactive?: boolean }
  ): Promise<SubCategory[]> {
    const category = await this.db.category.findUnique({
      where: { slug: categorySlug }
    });

    if (!category) {
      throw new NotFoundError("Category not found", { slug: categorySlug });
    }

    return this.db.subCategory.findMany({
      where: {
        categoryId: category.id,
        ...(options?.includeInactive === true ? {} : { isActive: true })
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });
  }

  public async create(categoryId: string, input: CreateSubCategoryInput): Promise<SubCategory> {
    try {
      return await this.db.subCategory.create({
        data: {
          categoryId,
          name: input.name,
          slug: input.slug,
          imageUrl: input.imageUrl ?? null,
          displayOrder: input.displayOrder ?? 0,
          isActive: input.isActive ?? true
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2002")) {
        throw new ConflictError(
          "Subcategory with this slug already exists",
          { field: "slug" },
          error
        );
      }
      throw error;
    }
  }

  public async update(id: string, input: UpdateSubCategoryInput): Promise<SubCategory> {
    try {
      return await this.db.subCategory.update({
        where: { id },
        data: input
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Subcategory not found", { id }, error);
      }
      if (isPrismaError(error, "P2002")) {
        throw new ConflictError(
          "Subcategory with this slug already exists",
          { field: "slug" },
          error
        );
      }
      throw error;
    }
  }

  public async reorder(items: { id: string; displayOrder: number }[]): Promise<void> {
    await this.db.$transaction(
      items.map((item) =>
        this.db.subCategory.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder }
        })
      )
    );
  }
}
