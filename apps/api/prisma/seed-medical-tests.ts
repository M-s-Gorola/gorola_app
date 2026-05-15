import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.info("Starting Medical Tests seeding...");

    // 1. Find the store (Mountain Medico)
    const store = await prisma.store.findFirst({
      where: { name: "Mountain Medico" }
    });

    if (!store) {
      throw new Error("Store 'Mountain Medico' not found. Please run the main seed first.");
    }

    // 2. Find or Create Category
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

    // 3. Find or Create SubCategory
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

    // 4. Detailed Medical Tests List (75 items)
    const tests = [
      { id: "test_01", name: "CBC (Complete Blood Count)", price: "300.00" },
      { id: "test_02", name: "HbA1c (Glycated Hemoglobin)", price: "550.00" },
      { id: "test_03", name: "Lipid Profile", price: "800.00" },
      { id: "test_04", name: "Liver Function Test (LFT)", price: "950.00" },
      { id: "test_05", name: "Kidney Function Test (KFT)", price: "900.00" },
      { id: "test_06", name: "Thyroid Profile (T3, T4, TSH)", price: "600.00" },
      { id: "test_07", name: "Blood Sugar (Fasting)", price: "80.00" },
      { id: "test_08", name: "Blood Sugar (Post-Prandial)", price: "80.00" },
      { id: "test_09", name: "Vitamin B12", price: "1200.00" },
      { id: "test_10", name: "Vitamin D (25-OH)", price: "1500.00" },
      { id: "test_11", name: "Urine Routine & Microscopy", price: "150.00" },
      { id: "test_12", name: "C-Reactive Protein (CRP)", price: "450.00" },
      { id: "test_13", name: "Erythrocyte Sedimentation Rate (ESR)", price: "100.00" },
      { id: "test_14", name: "Dengue NS1 Antigen", price: "1100.00" },
      { id: "test_15", name: "Malaria Parasite (Smear)", price: "200.00" },
      { id: "test_16", name: "HBsAg (Hepatitis B Surface Antigen)", price: "350.00" },
      { id: "test_17", name: "HIV 1 & 2 (Antibody)", price: "500.00" },
      { id: "test_18", name: "PSA (Prostate Specific Antigen)", price: "1200.00" },
      { id: "test_19", name: "Serum Creatinine", price: "200.00" },
      { id: "test_20", name: "Serum Uric Acid", price: "220.00" },
      { id: "test_21", name: "Serum Electrolytes (Na, K, Cl)", price: "650.00" },
      { id: "test_22", name: "Calcium", price: "250.00" },
      { id: "test_23", name: "Ferritin", price: "850.00" },
      { id: "test_24", name: "Iron Profile", price: "900.00" },
      { id: "test_25", name: "Prothrombin Time (PT/INR)", price: "400.00" },
      { id: "test_26", name: "SGOT (AST)", price: "250.00" },
      { id: "test_27", name: "SGPT (ALT)", price: "250.00" },
      { id: "test_28", name: "Alkaline Phosphatase", price: "280.00" },
      { id: "test_29", name: "Total Bilirubin", price: "200.00" },
      { id: "test_30", name: "Albumin", price: "200.00" },
      { id: "test_31", name: "Globulin", price: "200.00" },
      { id: "test_32", name: "A/G Ratio", price: "100.00" },
      { id: "test_33", name: "Urea", price: "200.00" },
      { id: "test_34", name: "BUN (Blood Urea Nitrogen)", price: "220.00" },
      { id: "test_35", name: "Total Cholesterol", price: "250.00" },
      { id: "test_36", name: "HDL Cholesterol", price: "300.00" },
      { id: "test_37", name: "LDL Cholesterol", price: "300.00" },
      { id: "test_38", name: "VLDL Cholesterol", price: "300.00" },
      { id: "test_39", name: "Triglycerides", price: "350.00" },
      { id: "test_40", name: "T3 (Total)", price: "250.00" },
      { id: "test_41", name: "T4 (Total)", price: "250.00" },
      { id: "test_42", name: "TSH", price: "300.00" },
      { id: "test_43", name: "FT3 (Free)", price: "400.00" },
      { id: "test_44", name: "FT4 (Free)", price: "400.00" },
      { id: "test_45", name: "Anti-TPO Antibody", price: "1500.00" },
      { id: "test_46", name: "Anti-TG Antibody", price: "1500.00" },
      { id: "test_47", name: "Hb (Hemoglobin)", price: "120.00" },
      { id: "test_48", name: "PCV (Packed Cell Volume)", price: "120.00" },
      { id: "test_49", name: "Platelet Count", price: "150.00" },
      { id: "test_50", name: "TLC (Total Leucocyte Count)", price: "150.00" },
      { id: "test_51", name: "DLC (Differential)", price: "150.00" },
      { id: "test_52", name: "Blood Group (ABO & Rh)", price: "200.00" },
      { id: "test_53", name: "RA Factor (Qualitative)", price: "400.00" },
      { id: "test_54", name: "Widal Test", price: "300.00" },
      { id: "test_55", name: "VDRL (RPR)", price: "250.00" },
      { id: "test_56", name: "Pregnancy Test (Urine)", price: "100.00" },
      { id: "test_57", name: "Cardiac Profile (Mini)", price: "2500.00" },
      { id: "test_58", name: "Diabetic Profile (Basic)", price: "1200.00" },
      { id: "test_59", name: "Full Body Checkup (Silver)", price: "3500.00" },
      { id: "test_60", name: "Full Body Checkup (Gold)", price: "5500.00" },
      { id: "test_61", name: "Serum Amylase", price: "600.00" },
      { id: "test_62", name: "Serum Lipase", price: "700.00" },
      { id: "test_63", name: "Prolactin", price: "650.00" },
      { id: "test_64", name: "FSH", price: "550.00" },
      { id: "test_65", name: "LH", price: "550.00" },
      { id: "test_66", name: "Testosterone (Total)", price: "800.00" },
      { id: "test_67", name: "Estradiol (E2)", price: "750.00" },
      { id: "test_68", name: "Progesterone", price: "750.00" },
      { id: "test_69", name: "Magnesium", price: "450.00" },
      { id: "test_70", name: "Phosphorus", price: "300.00" },
      { id: "test_71", name: "Sodium", price: "250.00" },
      { id: "test_72", name: "Potassium", price: "250.00" },
      { id: "test_73", name: "Chloride", price: "250.00" },
      { id: "test_74", name: "Serum Albumin", price: "250.00" },
      { id: "test_75", name: "Total Protein", price: "250.00" }
    ];

    console.info(`Seeding ${tests.length} tests in chunks of 5...`);

    // Process in chunks to avoid overwhelming the connection pool (limited to 9)
    const chunkSize = 5;
    for (let i = 0; i < tests.length; i += chunkSize) {
      const chunk = tests.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((t) =>
          prisma.product.upsert({
            where: { id: `prod_med_${t.id}` },
            update: { categoryId: category.id, subCategoryId: subCategory.id },
            create: {
              id: `prod_med_${t.id}`,
              storeId: store.id,
              categoryId: category.id,
              subCategoryId: subCategory.id,
              name: t.name,
              description: `Professional medical diagnostic test for ${t.name}. Result TAT: 24 hours.`,
              imageUrl: `https://picsum.photos/seed/${t.id}/400/400`,
              isActive: true,
              variants: {
                create: [{ label: "Test", price: t.price, stockQty: 999, unit: "Test", isActive: true }]
              }
            }
          })
        )
      );
    }

    console.info(`Successfully seeded ${tests.length} medical tests for Mountain Medico.`);

  } catch (error) {
    console.error("Error seeding medical tests:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
