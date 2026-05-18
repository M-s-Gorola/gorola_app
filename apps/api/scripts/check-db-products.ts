import { PrismaClient } from "@prisma/client";

const stagingDatabaseUrl = "postgresql://postgres:CjmrVEdpUWXdrhLwkRHvNBxTEYLYQAKN@turntable.proxy.rlwy.net:54541/railway";
console.log("Using Staging DATABASE_URL:", stagingDatabaseUrl);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: stagingDatabaseUrl,
    },
  },
});

async function main() {
  try {
    // 1. Fetch categories
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });

    console.log("Active categories found:", categories.map(c => ({ id: c.id, name: c.name, slug: c.slug })));

    // 2. Count active, not deleted products per category
    const categoryIds = categories.map((category) => category.id);
    const productCounts = await prisma.product.groupBy({
      by: ["categoryId"],
      where: {
        categoryId: { in: categoryIds },
        isActive: true,
        isDeleted: false
      },
      _count: {
        _all: true
      }
    });

    const countByCategory = new Map(productCounts.map((row) => [row.categoryId, row._count._all]));

    const result = categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      productCount: countByCategory.get(category.id) ?? 0
    }));

    console.log("Result of findAllForBuyer query on STAGING:", result);

    // Let's check some products under 'Medical tests'
    const medicalTestsCat = categories.find(c => c.slug === "medical-tests");
    if (medicalTestsCat) {
      const totalProducts = await prisma.product.count({
        where: { categoryId: medicalTestsCat.id }
      });
      const activeNotDeletedProducts = await prisma.product.count({
        where: {
          categoryId: medicalTestsCat.id,
          isActive: true,
          isDeleted: false
        }
      });
      console.log(`Medical tests category ID: ${medicalTestsCat.id}`);
      console.log(`Total products under Medical tests: ${totalProducts}`);
      console.log(`Active & not-deleted products under Medical tests: ${activeNotDeletedProducts}`);
    } else {
      console.log("Medical tests category not found!");
    }

  } catch (error) {
    console.error("Error connecting to database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
