import { Prisma, type PrismaClient } from "@prisma/client";

export type SearchResult = {
  categories: Array<{ id: string; name: string; slug: string; imageUrl: string | null }>;
  subCategories: Array<{ id: string; name: string; slug: string; imageUrl: string | null; categorySlug: string }>;
  products: Array<{ id: string; name: string; imageUrl: string; price: string; unit: string }>;
};

const productListInclude = Prisma.validator<Prisma.ProductInclude>()({
  variants: {
    where: { isActive: true },
    orderBy: { price: "desc" },
    take: 1,
    select: { id: true, price: true, unit: true }
  }
});

export class SearchRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async searchGlobally(query: string, limit: number = 5): Promise<SearchResult> {
    const [categories, rawSubCategories, products] = await Promise.all([
      this.db.category.findMany({
        where: {
          isActive: true,
          name: { contains: query, mode: "insensitive" }
        },
        take: limit,
        select: { id: true, name: true, slug: true, imageUrl: true }
      }),
      this.db.subCategory.findMany({
        where: {
          isActive: true,
          name: { contains: query, mode: "insensitive" }
        },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          category: {
            select: { slug: true }
          }
        }
      }),
      this.db.product.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          store: {
            isActive: true,
            isDeleted: false
          },
          name: { contains: query, mode: "insensitive" }
        },
        take: limit,
        include: productListInclude
      })
    ]);

    const mappedProducts = products
      .filter((p) => p.variants.length > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        price: p.variants[0]!.price.toFixed(2),
        unit: p.variants[0]!.unit
      }));

    const mappedSubCategories = rawSubCategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      slug: sub.slug,
      imageUrl: sub.imageUrl,
      categorySlug: sub.category.slug
    }));

    return {
      categories,
      subCategories: mappedSubCategories,
      products: mappedProducts
    };
  }

  public async getSearchSuggestions(query: string, limit: number = 5) {
    const [categories, subcategories, products] = await Promise.all([
      this.db.category.findMany({
        where: {
          isActive: true,
          name: { contains: query, mode: "insensitive" }
        },
        take: limit,
        select: { id: true, name: true, slug: true }
      }),
      this.db.subCategory.findMany({
        where: {
          isActive: true,
          name: { contains: query, mode: "insensitive" }
        },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          category: {
            select: { slug: true }
          }
        }
      }),
      this.db.product.findMany({
        where: {
          isActive: true,
          isDeleted: false,
          store: {
            isActive: true,
            isDeleted: false
          },
          name: { contains: query, mode: "insensitive" }
        },
        take: limit,
        select: {
          id: true,
          name: true,
          store: {
            select: {
              storeType: true
            }
          }
        }
      })
    ]);

    return {
      categories,
      subcategories,
      products
    };
  }
}
