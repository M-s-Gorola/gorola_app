import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

async function main() {
  const prisma = new PrismaClient();
  try {
    console.info("Starting Phase 7.6 migration...");

    // 1. Ensure store "Aarna Diagnostic Centre" exists
    const store = await prisma.store.upsert({
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
    console.info(`Upserted store: ${store.name}`);

    // 2. Ensure store owner account exists
    const hashedPw = await hash("Owner#123", 10);
    const owner = await prisma.storeOwner.upsert({
      where: { email: "owner3@gorola.in" },
      update: {},
      create: {
        email: "owner3@gorola.in",
        passwordHash: hashedPw,
        storeId: store.id
      }
    });
    console.info(`Upserted store owner: ${owner.email}`);

    // 3. Ensure category & subcategory exist
    const category = await prisma.category.upsert({
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

    const subCategory = await prisma.subCategory.upsert({
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
    console.info("Category and SubCategory ensured.");

    // 4. Ensure 5 medical tests with variant schedules exist
    const medicalTests = [
      { id: "prod_test_1", name: "Blood Sugar (Fasting)", price: "80.00", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
      { id: "prod_test_2", name: "CBC Panel (Fasting)", price: "350.00", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
      { id: "prod_test_3", name: "Lipid Profile (Fasting)", price: "650.00", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
      { id: "prod_test_4", name: "Thyroid (TSH)", price: "450.00", requiresFasting: false, allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00", "15:00-18:00"] },
      { id: "prod_test_5", name: "Urine Routine", price: "120.00", requiresFasting: false, allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00", "15:00-18:00"] }
    ];

    for (const test of medicalTests) {
      const existingProduct = await prisma.product.findUnique({
        where: { id: test.id },
        include: { variants: true }
      });

      if (existingProduct) {
        await prisma.product.update({
          where: { id: test.id },
          data: {
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            name: test.name
          }
        });

        if (existingProduct.variants.length > 0) {
          await prisma.productVariant.update({
            where: { id: existingProduct.variants[0].id },
            data: {
              price: test.price,
              requiresFasting: test.requiresFasting,
              allowedTimeslots: test.allowedTimeslots
            }
          });
        } else {
          await prisma.productVariant.create({
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
        await prisma.product.create({
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
      console.info(`Ensured test: ${test.name}`);
    }

    console.info("Migration 7.6 completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
