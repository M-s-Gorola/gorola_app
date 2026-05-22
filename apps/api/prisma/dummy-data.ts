import { PrismaClient } from "@prisma/client";

export async function seedDummyData(prisma: PrismaClient, storeAId: string, storeBId: string, storeCId: string, storeDId: string, storeEId: string) {
  // Wipe existing catalog data (respecting FK constraints)
  await prisma.stockMovement.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.subCategory.deleteMany({});
  await prisma.category.deleteMany({});

  // -------------------------
  // CATEGORIES
  // -------------------------
  const groceriesCategory = await prisma.category.upsert({
    where: { slug: "groceries" },
    update: { imageUrl: "https://picsum.photos/seed/groceries/400/300" },
    create: {
      slug: "groceries",
      name: "Groceries",
      imageUrl: "https://picsum.photos/seed/groceries/400/300",
      displayOrder: 1,
      isActive: true
    }
  });

  const medicalCategory = await prisma.category.upsert({
    where: { slug: "medical" },
    update: { imageUrl: "https://picsum.photos/seed/medical/400/300" },
    create: {
      slug: "medical",
      name: "Medical",
      imageUrl: "https://picsum.photos/seed/medical/400/300",
      displayOrder: 2,
      isActive: true
    }
  });

  const medicalTestsCategory = await prisma.category.upsert({
    where: { slug: "medical-tests" },
    update: { imageUrl: "https://picsum.photos/seed/medical-tests/400/300" },
    create: {
      slug: "medical-tests",
      name: "Medical tests",
      imageUrl: "https://picsum.photos/seed/medical-tests/400/300",
      displayOrder: 3,
      isActive: true
    }
  });

  const electronicsCategory = await prisma.category.upsert({
    where: { slug: "electronics" },
    update: { imageUrl: "https://picsum.photos/seed/electronics/400/300" },
    create: {
      slug: "electronics",
      name: "Electronics",
      imageUrl: "https://picsum.photos/seed/electronics/400/300",
      displayOrder: 4,
      isActive: true
    }
  });

  const repairsCategory = await prisma.category.upsert({
    where: { slug: "repairs" },
    update: { imageUrl: "https://picsum.photos/seed/repairs/400/300" },
    create: {
      slug: "repairs",
      name: "Repairs",
      imageUrl: "https://picsum.photos/seed/repairs/400/300",
      displayOrder: 5,
      isActive: true
    }
  });

  // -------------------------
  // SUBCATEGORIES - Groceries
  // -------------------------
  const subGrocRiceAtta = await prisma.subCategory.upsert({
    where: { slug: "rice-atta" },
    update: { categoryId: groceriesCategory.id },
    create: {
      slug: "rice-atta",
      name: "Rice, Atta & Dals",
      imageUrl: "https://picsum.photos/seed/rice-atta/200/200",
      categoryId: groceriesCategory.id,
      displayOrder: 1,
    }
  });

  const subGrocSnacks = await prisma.subCategory.upsert({
    where: { slug: "snacks" },
    update: { categoryId: groceriesCategory.id },
    create: {
      slug: "snacks",
      name: "Snacks & Biscuits",
      imageUrl: "https://picsum.photos/seed/snacks/200/200",
      categoryId: groceriesCategory.id,
      displayOrder: 2,
    }
  });

  const subGrocBeverages = await prisma.subCategory.upsert({
    where: { slug: "beverages" },
    update: { categoryId: groceriesCategory.id },
    create: {
      slug: "beverages",
      name: "Beverages",
      imageUrl: "https://picsum.photos/seed/beverages/200/200",
      categoryId: groceriesCategory.id,
      displayOrder: 3,
    }
  });

  // -------------------------
  // SUBCATEGORIES - Medical
  // -------------------------
  const subMedPain = await prisma.subCategory.upsert({
    where: { slug: "pain-relief" },
    update: { categoryId: medicalCategory.id },
    create: {
      slug: "pain-relief",
      name: "Pain Relief",
      imageUrl: "https://picsum.photos/seed/pain-relief/200/200",
      categoryId: medicalCategory.id,
      displayOrder: 1,
    }
  });

  const subMedFirstAid = await prisma.subCategory.upsert({
    where: { slug: "first-aid" },
    update: { categoryId: medicalCategory.id },
    create: {
      slug: "first-aid",
      name: "First Aid",
      imageUrl: "https://picsum.photos/seed/first-aid/200/200",
      categoryId: medicalCategory.id,
      displayOrder: 2,
    }
  });

  const subMedSupplements = await prisma.subCategory.upsert({
    where: { slug: "supplements" },
    update: { categoryId: medicalCategory.id },
    create: {
      slug: "supplements",
      name: "Supplements",
      imageUrl: "https://picsum.photos/seed/supplements/200/200",
      categoryId: medicalCategory.id,
      displayOrder: 3,
      isActive: true,
    }
  });

  const subMedTestsAll = await prisma.subCategory.upsert({
    where: { slug: "all-tests" },
    update: { categoryId: medicalTestsCategory.id },
    create: {
      slug: "all-tests",
      name: "All Tests",
      imageUrl: "https://picsum.photos/seed/all-tests/200/200",
      categoryId: medicalTestsCategory.id,
      displayOrder: 1,
      isActive: true,
    }
  });

  const subElecAll = await prisma.subCategory.upsert({
    where: { slug: "all-electronics" },
    update: { categoryId: electronicsCategory.id },
    create: {
      slug: "all-electronics",
      name: "All Electronics",
      imageUrl: "https://picsum.photos/seed/all-electronics/200/200",
      categoryId: electronicsCategory.id,
      displayOrder: 1,
      isActive: true,
    }
  });

  const subRepairsAll = await prisma.subCategory.upsert({
    where: { slug: "all-repairs" },
    update: { categoryId: repairsCategory.id },
    create: {
      slug: "all-repairs",
      name: "All Repairs",
      imageUrl: "https://picsum.photos/seed/all-repairs/200/200",
      categoryId: repairsCategory.id,
      displayOrder: 1,
      isActive: true,
    }
  });

  // -------------------------
  // PRODUCTS HELPER
  // -------------------------
  const createProduct = async (
    id: string,
    storeId: string,
    categoryId: string,
    subCategoryId: string,
    name: string,
    price: string,
    stockQty: number,
    unit: string,
    requiresFasting = false,
    allowedTimeslots?: string[]
  ) => {
    return prisma.product.upsert({
      where: { id },
      update: { categoryId, subCategoryId },
      create: {
        id,
        storeId,
        categoryId,
        subCategoryId,
        name,
        description: `Premium ${name} for your daily needs.`,
        imageUrl: `https://picsum.photos/seed/${id}/400/400`,
        isActive: true,
        variants: {
          create: [{
            label: unit,
            price,
            stockQty,
            unit,
            isActive: true,
            requiresFasting,
            allowedTimeslots: allowedTimeslots || []
          }]
        }
      }
    });
  };

  // -------------------------
  // SEED ALL PRODUCTS IN CHUNKS
  // -------------------------
  const productData = [
    // Groceries (Rice & Atta)
    { id: "prod_rice_1", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocRiceAtta.id, name: "Basmati Rice Premium", price: "525.00", stockQty: 40, unit: "5 kg" },
    { id: "prod_rice_2", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocRiceAtta.id, name: "Daily Sona Masoori Rice", price: "450.00", stockQty: 30, unit: "5 kg" },
    { id: "prod_atta_1", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocRiceAtta.id, name: "Whole Wheat Atta", price: "220.00", stockQty: 50, unit: "5 kg" },
    { id: "prod_atta_2", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocRiceAtta.id, name: "Multigrain Atta", price: "260.00", stockQty: 25, unit: "5 kg" },
    { id: "prod_dal_1", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocRiceAtta.id, name: "Yellow Toor Dal", price: "140.00", stockQty: 60, unit: "1 kg" },

    // Groceries (Snacks)
    { id: "prod_snack_1", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocSnacks.id, name: "Potato Chips Salted", price: "20.00", stockQty: 100, unit: "1 pack" },
    { id: "prod_snack_2", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocSnacks.id, name: "Spicy Bhujia", price: "45.00", stockQty: 80, unit: "200 g" },
    { id: "prod_snack_3", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocSnacks.id, name: "Chocolate Chip Cookies", price: "60.00", stockQty: 50, unit: "150 g" },
    { id: "prod_snack_4", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocSnacks.id, name: "Digestive Biscuits", price: "40.00", stockQty: 70, unit: "250 g" },
    { id: "prod_snack_5", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocSnacks.id, name: "Roasted Peanuts", price: "35.00", stockQty: 90, unit: "200 g" },

    // Groceries (Beverages)
    { id: "prod_bev_1", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocBeverages.id, name: "Assam Tea Leaves", price: "150.00", stockQty: 40, unit: "250 g" },
    { id: "prod_bev_2", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocBeverages.id, name: "Instant Coffee", price: "180.00", stockQty: 30, unit: "50 g" },
    { id: "prod_bev_3", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocBeverages.id, name: "Mango Juice", price: "110.00", stockQty: 50, unit: "1 L" },
    { id: "prod_bev_4", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocBeverages.id, name: "Cola Soft Drink", price: "40.00", stockQty: 100, unit: "750 ml" },
    { id: "prod_bev_5", storeId: storeAId, categoryId: groceriesCategory.id, subCategoryId: subGrocBeverages.id, name: "Sparkling Water", price: "60.00", stockQty: 80, unit: "1 L" },

    // Medical (Pain Relief)
    { id: "prod_pain_1", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedPain.id, name: "Paracetamol 650", price: "42.00", stockQty: 120, unit: "1 strip" },
    { id: "prod_pain_2", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedPain.id, name: "Ibuprofen 400", price: "55.00", stockQty: 100, unit: "1 strip" },
    { id: "prod_pain_3", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedPain.id, name: "Pain Relief Spray", price: "145.00", stockQty: 40, unit: "50 g" },
    { id: "prod_pain_4", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedPain.id, name: "Aspirin 75mg", price: "25.00", stockQty: 150, unit: "1 strip" },
    { id: "prod_pain_5", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedPain.id, name: "Muscle Relaxant Ointment", price: "85.00", stockQty: 60, unit: "30 g" },

    // Medical (First Aid)
    { id: "prod_fa_1", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedFirstAid.id, name: "Adhesive Bandages", price: "30.00", stockQty: 200, unit: "1 box" },
    { id: "prod_fa_2", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedFirstAid.id, name: "Antiseptic Liquid", price: "65.00", stockQty: 80, unit: "100 ml" },
    { id: "prod_fa_3", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedFirstAid.id, name: "Cotton Roll", price: "20.00", stockQty: 150, unit: "50 g" },
    { id: "prod_fa_4", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedFirstAid.id, name: "Medical Tape", price: "40.00", stockQty: 100, unit: "1 roll" },
    { id: "prod_fa_5", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedFirstAid.id, name: "Crepe Bandage", price: "90.00", stockQty: 50, unit: "1 roll" },

    // Medical (Supplements)
    { id: "prod_sup_1", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedSupplements.id, name: "Vitamin C 500mg", price: "110.00", stockQty: 90, unit: "1 strip" },
    { id: "prod_sup_2", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedSupplements.id, name: "Multivitamin Capsules", price: "250.00", stockQty: 60, unit: "1 bottle" },
    { id: "prod_sup_3", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedSupplements.id, name: "Calcium + D3", price: "140.00", stockQty: 80, unit: "1 strip" },
    { id: "prod_sup_4", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedSupplements.id, name: "Iron Supplements", price: "130.00", stockQty: 70, unit: "1 strip" },
    { id: "prod_sup_5", storeId: storeBId, categoryId: medicalCategory.id, subCategoryId: subMedSupplements.id, name: "Protein Powder", price: "950.00", stockQty: 20, unit: "500 g" },

    // Medical Tests (Dedicated Booking Store C)
    { id: "prod_test_1", storeId: storeCId, categoryId: medicalTestsCategory.id, subCategoryId: subMedTestsAll.id, name: "Blood Sugar (Fasting)", price: "80.00", stockQty: 999, unit: "Test", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
    { id: "prod_test_2", storeId: storeCId, categoryId: medicalTestsCategory.id, subCategoryId: subMedTestsAll.id, name: "CBC Panel (Fasting)", price: "350.00", stockQty: 999, unit: "Test", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
    { id: "prod_test_3", storeId: storeCId, categoryId: medicalTestsCategory.id, subCategoryId: subMedTestsAll.id, name: "Lipid Profile (Fasting)", price: "650.00", stockQty: 999, unit: "Test", requiresFasting: true, allowedTimeslots: ["06:00-09:00"] },
    { id: "prod_test_4", storeId: storeCId, categoryId: medicalTestsCategory.id, subCategoryId: subMedTestsAll.id, name: "Thyroid (TSH)", price: "450.00", stockQty: 999, unit: "Test", requiresFasting: false, allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00", "15:00-18:00"] },
    { id: "prod_test_5", storeId: storeCId, categoryId: medicalTestsCategory.id, subCategoryId: subMedTestsAll.id, name: "Urine Routine", price: "120.00", stockQty: 999, unit: "Test", requiresFasting: false, allowedTimeslots: ["06:00-09:00", "09:00-12:00", "12:00-15:00", "15:00-18:00"] },

    // Electronics (Dedicated Quick Commerce Store D)
    { id: "prod_elec_1", storeId: storeDId, categoryId: electronicsCategory.id, subCategoryId: subElecAll.id, name: "Phone Charger", price: "499.00", stockQty: 50, unit: "1 unit" },
    { id: "prod_elec_2", storeId: storeDId, categoryId: electronicsCategory.id, subCategoryId: subElecAll.id, name: "USB Cable", price: "199.00", stockQty: 100, unit: "1 unit" },
    { id: "prod_elec_3", storeId: storeDId, categoryId: electronicsCategory.id, subCategoryId: subElecAll.id, name: "Power Bank", price: "1299.00", stockQty: 30, unit: "1 unit" },
    { id: "prod_elec_4", storeId: storeDId, categoryId: electronicsCategory.id, subCategoryId: subElecAll.id, name: "Earphones", price: "799.00", stockQty: 40, unit: "1 unit" },
    { id: "prod_elec_5", storeId: storeDId, categoryId: electronicsCategory.id, subCategoryId: subElecAll.id, name: "Screen Protector", price: "149.00", stockQty: 150, unit: "1 unit" },

    // Repairs (Dedicated Booking Commerce Store E)
    { id: "prod_rep_1", storeId: storeEId, categoryId: repairsCategory.id, subCategoryId: subRepairsAll.id, name: "Phone Screen Repair", price: "999.00", stockQty: 999, unit: "Service", requiresFasting: false, allowedTimeslots: ["09:00-12:00", "12:00-15:00", "15:00-18:00"] },
    { id: "prod_rep_2", storeId: storeEId, categoryId: repairsCategory.id, subCategoryId: subRepairsAll.id, name: "Phone Battery Replacement", price: "599.00", stockQty: 999, unit: "Service", requiresFasting: false, allowedTimeslots: ["09:00-12:00", "12:00-15:00", "15:00-18:00"] },
    { id: "prod_rep_3", storeId: storeEId, categoryId: repairsCategory.id, subCategoryId: subRepairsAll.id, name: "Laptop Keyboard Repair", price: "1499.00", stockQty: 999, unit: "Service", requiresFasting: false, allowedTimeslots: ["09:00-12:00", "12:00-15:00", "15:00-18:00"] },
    { id: "prod_rep_4", storeId: storeEId, categoryId: repairsCategory.id, subCategoryId: subRepairsAll.id, name: "AC Service", price: "799.00", stockQty: 999, unit: "Service", requiresFasting: false, allowedTimeslots: ["09:00-12:00", "12:00-15:00", "15:00-18:00"] }
  ];

  console.info(`Seeding ${productData.length} products in chunks of 5...`);
  const chunkSize = 5;
  for (let i = 0; i < productData.length; i += chunkSize) {
    const chunk = productData.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((p: any) => createProduct(p.id, p.storeId, p.categoryId, p.subCategoryId, p.name, p.price, p.stockQty, p.unit, p.requiresFasting, p.allowedTimeslots))
    );
  }

  // -------------------------
  // ADVERTISEMENTS
  // -------------------------
  await prisma.advertisement.deleteMany({});
  await prisma.advertisement.createMany({
    data: [
      {
        id: "adv_1",
        storeId: storeAId,
        title: "Fresh Groceries Delivered",
        imageUrl: "https://fastly.picsum.photos/id/19/2500/1667.jpg?hmac=7epGozH4QjToGaBf_xb2HbFTXoV5o8n_cYzB7I4lt6g",
        linkUrl: "/categories/groceries",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days from now
        isApproved: true,
        isActive: true
      },
      {
        id: "adv_2",
        storeId: storeAId,
        title: "Medical Essentials at Your Door",
        imageUrl: "https://fastly.picsum.photos/id/55/4608/3072.jpg?hmac=ahGhylwdN52ULB37deeMZX6T_G7NiERtoPhwydMvUKQ",
        linkUrl: "/categories/medical",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        isApproved: true,
        isActive: true
      },
      {
        id: "adv_3",
        storeId: storeBId,
        title: "Mountain Medico Special Offers",
        imageUrl: "https://fastly.picsum.photos/id/11/2500/1667.jpg?hmac=xxjFJtAPgshYkysU_aqx2sZir-kIOjNR9vx0te7GycQ",
        linkUrl: "/categories/medical",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        isApproved: true,
        isActive: true
      }
    ]
  });

  console.info("Dummy data seeded successfully (41 products, 3 advertisements across 9 subcategories)");
}
