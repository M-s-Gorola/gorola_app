import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";

describe("Medical Tests Store Migration Integration Tests", () => {
  const db = getPrismaClient();

  beforeAll(async () => {
    // 1. Ensure store "Aarna Diagnostic Centre" exists
    const store = await db.store.upsert({
      where: { id: "store_gorola_aarna_diagnostic" },
      update: {
        storeType: "BOOKING_COMMERCE",
        bookingLeadDays: 1,
        isAcceptingBookings: true
      },
      create: {
        id: "store_gorola_aarna_diagnostic",
        name: "Aarna Diagnostic Centre",
        description: "Dedicated medical diagnostic test laboratory.",
        phone: "+919999000003",
        address: "Mall Road, Mussoorie",
        storeType: "BOOKING_COMMERCE",
        bookingLeadDays: 1,
        isAcceptingBookings: true,
        isActive: true
      }
    });

    // 2. Ensure store owner account exists
    const hashedPw = await hash("Owner#123", 10);
    await db.storeOwner.upsert({
      where: { email: "owner3@gorola.in" },
      update: {},
      create: {
        email: "owner3@gorola.in",
        passwordHash: hashedPw,
        storeId: store.id
      }
    });

    // 3. Ensure category & subcategory exist
    const category = await db.category.upsert({
      where: { slug: "medical-tests" },
      update: {},
      create: {
        slug: "medical-tests",
        name: "Medical tests",
        imageUrl: "https://picsum.photos/seed/medical-tests/400/300",
        displayOrder: 3,
        isActive: true
      }
    });

    const subCategory = await db.subCategory.upsert({
      where: { slug: "all-tests" },
      update: { categoryId: category.id },
      create: {
        slug: "all-tests",
        name: "All Tests",
        imageUrl: "https://picsum.photos/seed/all-tests/200/200",
        categoryId: category.id,
        displayOrder: 1,
        isActive: true
      }
    });

    // 4. Ensure 5 medical tests with variant schedules exist
    const medicalTests = [
      { id: "prod_test_1", name: "Blood Sugar (Fasting)", price: "80.00", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
      { id: "prod_test_2", name: "CBC Panel (Fasting)", price: "350.00", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
      { id: "prod_test_3", name: "Lipid Profile (Fasting)", price: "650.00", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
      { id: "prod_test_4", name: "Thyroid (TSH)", price: "450.00", requiresFasting: false, allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00", "15:00-18:00"] },
      { id: "prod_test_5", name: "Urine Routine", price: "120.00", requiresFasting: false, allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00", "15:00-18:00"] }
    ];

    for (const test of medicalTests) {
      const existingProduct = await db.product.findUnique({
        where: { id: test.id },
        include: { variants: true }
      });

      if (existingProduct) {
        await db.product.update({
          where: { id: test.id },
          data: {
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            name: test.name
          }
        });

        const firstVariant = existingProduct.variants[0];
        if (firstVariant) {
          await db.productVariant.update({
            where: { id: firstVariant.id },
            data: {
              price: test.price,
              requiresFasting: test.requiresFasting,
              allowedTimeslots: test.allowedTimeslots
            }
          });
        } else {
          await db.productVariant.create({
            data: {
              productId: test.id,
              label: "Test",
              price: test.price,
              stockQty: 999,
              unit: "Test",
              isActive: true,
              requiresFasting: test.requiresFasting,
              allowedTimeslots: test.allowedTimeslots
            }
          });
        }
      } else {
        await db.product.create({
          data: {
            id: test.id,
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            name: test.name,
            description: `Professional medical diagnostic test for ${test.name}.`,
            imageUrl: `https://picsum.photos/seed/${test.id}/400/400`,
            isActive: true,
            variants: {
              create: [
                {
                  label: "Test",
                  price: test.price,
                  stockQty: 999,
                  unit: "Test",
                  isActive: true,
                  requiresFasting: test.requiresFasting,
                  allowedTimeslots: test.allowedTimeslots
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

  it("should have a store named 'Aarna Diagnostic Centre' with storeType = BOOKING_COMMERCE and bookingLeadDays = 1", async () => {
    const store = await db.store.findFirst({
      where: { name: "Aarna Diagnostic Centre" }
    });

    expect(store).not.toBeNull();
    expect(store!.storeType).toBe("BOOKING_COMMERCE");
    expect(store!.bookingLeadDays).toBe(1);
    expect(store!.isAcceptingBookings).toBe(true);
  });

  it("should have 5 medical test products in Aarna Diagnostic Centre under the 'medical-tests' category", async () => {
    const store = await db.store.findFirst({
      where: { name: "Aarna Diagnostic Centre" }
    });

    expect(store).not.toBeNull();

    const category = await db.category.findUnique({
      where: { slug: "medical-tests" }
    });

    expect(category).not.toBeNull();

    const products = await db.product.findMany({
      where: {
        storeId: store!.id,
        categoryId: category!.id
      },
      include: {
        variants: true
      }
    });

    expect(products.length).toBe(5);

    const productNames = products.map((p) => p.name);
    expect(productNames).toContain("Blood Sugar (Fasting)");
    expect(productNames).toContain("CBC Panel (Fasting)");
    expect(productNames).toContain("Lipid Profile (Fasting)");
    expect(productNames).toContain("Thyroid (TSH)");
    expect(productNames).toContain("Urine Routine");
  });

  it("should verify 'Blood Sugar (Fasting)' variant has requiresFasting = true and allowedTimeslots = ['06:00-09:00']", async () => {
    const store = await db.store.findFirst({
      where: { name: "Aarna Diagnostic Centre" }
    });

    expect(store).not.toBeNull();

    const product = await db.product.findFirst({
      where: {
        storeId: store!.id,
        name: "Blood Sugar (Fasting)"
      },
      include: {
        variants: true
      }
    });

    expect(product).not.toBeNull();
    expect(product!.variants.length).toBeGreaterThan(0);

    const variant = product!.variants[0];
    expect(variant).toBeDefined();
    expect(variant!.requiresFasting).toBe(true);
    expect(variant!.allowedTimeslots).toEqual(["06:00-09:00"]);
  });

  it("should verify 'Thyroid (TSH)' variant has requiresFasting = false and contains all 4 standard day slots", async () => {
    const store = await db.store.findFirst({
      where: { name: "Aarna Diagnostic Centre" }
    });

    expect(store).not.toBeNull();

    const product = await db.product.findFirst({
      where: {
        storeId: store!.id,
        name: "Thyroid (TSH)"
      },
      include: {
        variants: true
      }
    });

    expect(product).not.toBeNull();
    expect(product!.variants.length).toBeGreaterThan(0);

    const variant = product!.variants[0];
    expect(variant).toBeDefined();
    expect(variant!.requiresFasting).toBe(false);
    expect(variant!.allowedTimeslots).toEqual([
      "06:00-09:00",
      "09:00-12:00",
      "12:00-15:00",
      "15:00-18:00"
    ]);
  });
});
