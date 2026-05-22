import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";

describe("Electronics Store Seed Integration Tests", () => {
  const db = getPrismaClient();

  beforeAll(async () => {
    // 1. Ensure store "GoRola Electronics" exists
    const store = await db.store.upsert({
      where: { id: "store_gorola_electronics" },
      update: {
        storeType: "QUICK_COMMERCE",
        isActive: true
      },
      create: {
        id: "store_gorola_electronics",
        name: "GoRola Electronics",
        description: "Standard physical electronics and accessories.",
        phone: "+919999000004",
        address: "Mall Road, Mussoorie",
        storeType: "QUICK_COMMERCE",
        isActive: true
      }
    });

    // 2. Ensure store owner account exists
    const hashedPw = await hash("Owner#123", 10);
    await db.storeOwner.upsert({
      where: { email: "owner4@gorola.in" },
      update: {},
      create: {
        email: "owner4@gorola.in",
        passwordHash: hashedPw,
        storeId: store.id
      }
    });

    // 3. Ensure category & subcategory exist
    const category = await db.category.upsert({
      where: { slug: "electronics" },
      update: {},
      create: {
        slug: "electronics",
        name: "Electronics",
        imageUrl: "https://picsum.photos/seed/electronics/400/300",
        displayOrder: 4,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.upsert({
      where: { slug: "all-electronics" },
      update: { categoryId: category.id },
      create: {
        slug: "all-electronics",
        name: "All Electronics",
        imageUrl: "https://picsum.photos/seed/all-electronics/200/200",
        categoryId: category.id,
        displayOrder: 1,
        isActive: true
      }
    });

    // 4. Ensure 5 products exist
    const products = [
      { id: "prod_elec_1", name: "Phone Charger", price: "499.00", stockQty: 50 },
      { id: "prod_elec_2", name: "USB Cable", price: "199.00", stockQty: 100 },
      { id: "prod_elec_3", name: "Power Bank", price: "1299.00", stockQty: 30 },
      { id: "prod_elec_4", name: "Earphones", price: "799.00", stockQty: 40 },
      { id: "prod_elec_5", name: "Screen Protector", price: "149.00", stockQty: 150 }
    ];

    for (const prod of products) {
      const existingProduct = await db.product.findUnique({
        where: { id: prod.id },
        include: { variants: true }
      });

      if (existingProduct) {
        await db.product.update({
          where: { id: prod.id },
          data: {
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            name: prod.name
          }
        });

        const firstVariant = existingProduct.variants[0];
        if (firstVariant) {
          await db.productVariant.update({
            where: { id: firstVariant.id },
            data: {
              price: prod.price,
              stockQty: prod.stockQty,
              isActive: true
            }
          });
        } else {
          await db.productVariant.create({
            data: {
              productId: prod.id,
              label: "1 unit",
              price: prod.price,
              stockQty: prod.stockQty,
              unit: "1 unit",
              isActive: true
            }
          });
        }
      } else {
        await db.product.create({
          data: {
            id: prod.id,
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            name: prod.name,
            description: `Premium ${prod.name} for your daily needs.`,
            imageUrl: `https://picsum.photos/seed/${prod.id}/400/400`,
            isActive: true,
            variants: {
              create: [
                {
                  label: "1 unit",
                  price: prod.price,
                  stockQty: prod.stockQty,
                  unit: "1 unit",
                  isActive: true
                }
              ]
            }
          }
        });
      }
    }
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("should assert a store named 'GoRola Electronics' exists with storeType = QUICK_COMMERCE", async () => {
    const store = await db.store.findFirst({
      where: { name: "GoRola Electronics" }
    });

    expect(store).not.toBeNull();
    expect(store!.storeType).toBe("QUICK_COMMERCE");
    expect(store!.isActive).toBe(true);
  });

  it("should assert 5 electronics products exist in GoRola Electronics with positive active stock variants", async () => {
    const store = await db.store.findFirst({
      where: { name: "GoRola Electronics" }
    });

    expect(store).not.toBeNull();

    const products = await db.product.findMany({
      where: {
        storeId: store!.id
      },
      include: {
        variants: true
      }
    });

    expect(products.length).toBe(5);

    const productNames = products.map((p) => p.name);
    expect(productNames).toContain("Phone Charger");
    expect(productNames).toContain("USB Cable");
    expect(productNames).toContain("Power Bank");
    expect(productNames).toContain("Earphones");
    expect(productNames).toContain("Screen Protector");

    // Verify positive active stock variants for each product
    for (const prod of products) {
      expect(prod.variants.length).toBeGreaterThan(0);
      const mainVariant = prod.variants[0];
      expect(mainVariant).toBeDefined();
      expect(mainVariant!.stockQty).toBeGreaterThan(0);
      expect(mainVariant!.isActive).toBe(true);
    }
  });
});
