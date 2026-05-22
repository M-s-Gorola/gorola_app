import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";

describe("Repairs Store Seed Integration Tests", () => {
  const db = getPrismaClient();

  beforeAll(async () => {
    // 1. Ensure store "GoRola Repairs" exists
    const store = await db.store.upsert({
      where: { id: "store_gorola_repairs" },
      update: {
        storeType: "BOOKING_COMMERCE",
        bookingLeadDays: 1,
        isActive: true
      },
      create: {
        id: "store_gorola_repairs",
        name: "GoRola Repairs",
        description: "On-demand expert hardware repairs at your doorstep.",
        phone: "+919999000005",
        address: "Clock Tower, Mussoorie",
        storeType: "BOOKING_COMMERCE",
        bookingLeadDays: 1,
        isActive: true
      }
    });

    // 2. Ensure store owner account exists
    const hashedPw = await hash("Owner#123", 10);
    await db.storeOwner.upsert({
      where: { email: "owner5@gorola.in" },
      update: {},
      create: {
        email: "owner5@gorola.in",
        passwordHash: hashedPw,
        storeId: store.id
      }
    });

    // 3. Ensure category & subcategory exist
    const category = await db.category.upsert({
      where: { slug: "repairs" },
      update: {},
      create: {
        slug: "repairs",
        name: "Repairs",
        imageUrl: "https://picsum.photos/seed/repairs/400/300",
        displayOrder: 5,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.upsert({
      where: { slug: "all-repairs" },
      update: { categoryId: category.id },
      create: {
        slug: "all-repairs",
        name: "All Repairs",
        imageUrl: "https://picsum.photos/seed/all-repairs/200/200",
        categoryId: category.id,
        displayOrder: 1,
        isActive: true
      }
    });

    // 4. Ensure 4 services exist
    const products = [
      { id: "prod_rep_1", name: "Phone Screen Repair", price: "999.00" },
      { id: "prod_rep_2", name: "Phone Battery Replacement", price: "599.00" },
      { id: "prod_rep_3", name: "Laptop Keyboard Repair", price: "1499.00" },
      { id: "prod_rep_4", name: "AC Service", price: "799.00" }
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
              requiresFasting: false,
              allowedTimeslots: ["09:00-12:00", "12:00-15:00", "15:00-18:00"],
              isActive: true
            }
          });
        } else {
          await db.productVariant.create({
            data: {
              productId: prod.id,
              label: "Service",
              price: prod.price,
              unit: "Service",
              requiresFasting: false,
              allowedTimeslots: ["09:00-12:00", "12:00-15:00", "15:00-18:00"],
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
            description: `Professional, guaranteed ${prod.name} at your home.`,
            imageUrl: `https://picsum.photos/seed/${prod.id}/400/400`,
            isActive: true,
            variants: {
              create: [
                {
                  label: "Service",
                  price: prod.price,
                  unit: "Service",
                  requiresFasting: false,
                  allowedTimeslots: ["09:00-12:00", "12:00-15:00", "15:00-18:00"],
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

  it("should assert store 'GoRola Repairs' exists with storeType = BOOKING_COMMERCE and bookingLeadDays = 1", async () => {
    const store = await db.store.findFirst({
      where: { name: "GoRola Repairs" }
    });

    expect(store).not.toBeNull();
    expect(store!.storeType).toBe("BOOKING_COMMERCE");
    expect(store!.bookingLeadDays).toBe(1);
    expect(store!.isActive).toBe(true);
  });

  it("should assert 4 repairs products exist under that store, each with requiresFasting = false and scheduling timeslots", async () => {
    const store = await db.store.findFirst({
      where: { name: "GoRola Repairs" }
    });

    expect(store).not.toBeNull();

    const products = await db.product.findMany({
      where: { storeId: store!.id },
      include: { variants: true }
    });

    expect(products.length).toBe(4);

    const productNames = products.map((p) => p.name);
    expect(productNames).toContain("Phone Screen Repair");
    expect(productNames).toContain("Phone Battery Replacement");
    expect(productNames).toContain("Laptop Keyboard Repair");
    expect(productNames).toContain("AC Service");

    for (const prod of products) {
      expect(prod.variants.length).toBeGreaterThan(0);
      const mainVariant = prod.variants[0];
      expect(mainVariant).toBeDefined();
      expect(mainVariant!.requiresFasting).toBe(false);
      expect(mainVariant!.allowedTimeslots).toContain("09:00-12:00");
      expect(mainVariant!.allowedTimeslots).toContain("12:00-15:00");
      expect(mainVariant!.allowedTimeslots).toContain("15:00-18:00");
    }
  });
});
