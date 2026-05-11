import { PrismaClient, OrderStatus, DiscountType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.info("Seeding E2E test data...");

  // 1. Seed Discount Code
  await prisma.discount.upsert({
    where: { code: "TESTDEAL10" },
    update: {
      isActive: true,
      discountValue: 10,
      discountType: DiscountType.PERCENTAGE,
      startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // Yesterday
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days from now
    },
    create: {
      code: "TESTDEAL10",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      isActive: true,
      usedCount: 0,
      startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  // 2. Seed a test user for E2E
  const testUser = await prisma.user.upsert({
    where: { phone: "+919876543210" },
    update: { isVerified: true },
    create: {
      phone: "+919876543210",
      name: "E2E Tester",
      isVerified: true,
    },
  });

  // 3. Seed orders with different statuses
  const store = await prisma.store.findFirst({
    where: { id: "store_gorola_hillside_mart" },
  });

  if (!store) {
    throw new Error("Store not found. Please run regular seed first.");
  }

  const variant = await prisma.productVariant.findFirst({
    where: { productId: "prod_rice_1" },
  });

  if (!variant) {
    throw new Error("Product variant not found. Please run regular seed first.");
  }

  const statuses: OrderStatus[] = [
    OrderStatus.PLACED,
    OrderStatus.PREPARING,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ];

  for (const status of statuses) {
    const orderId = `e2e_order_${status.toLowerCase()}`;
    await prisma.order.upsert({
      where: { id: orderId },
      update: { status },
      create: {
        id: orderId,
        userId: testUser.id,
        storeId: store.id,
        status,
        subtotal: 500,
        deliveryFee: 30,
        total: 530,
        paymentMethod: "COD",
        landmarkDescription: "Near the E2E tower",
        addressLabel: "E2E Home",
        items: {
          create: [
            {
              productName: "E2E Item",
              variantLabel: "1 kg",
              price: 500,
              quantity: 1,
              productVariantId: variant.id,
            },
          ],
        },
      },
    });
  }

  console.info("E2E test data seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
