import { PrismaClient, OrderStatus, DiscountType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.info("Seeding E2E test data...");

  // Reset all StoreOwner 2FA states to ensure clean test-run environment
  await prisma.storeOwner.updateMany({
    data: {
      totpEnabled: false,
      totpSecret: null,
    },
  });

  const store = await prisma.store.findFirst({
    where: { id: "store_gorola_hillside_mart" },
  });

  if (!store) {
    throw new Error("Store not found. Please run regular seed first.");
  }

  // 1. Seed Discount Code
  await prisma.discount.upsert({
    where: {
      storeId_code: {
        storeId: store.id,
        code: "TESTDEAL10",
      },
    },
    update: {
      isActive: true,
      discountValue: 10,
      discountType: DiscountType.PERCENTAGE,
      startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // Yesterday
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days from now
    },
    create: {
      storeId: store.id,
      code: "TESTDEAL10",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      isActive: true,
      usedCount: 0,
      startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  // 2. Seed test users for E2E
  const phones = ["+919876543210", "+919876543211", "+919876543212", "+919876543214"];
  const users = await Promise.all(phones.map(async (phone) => {
    return prisma.user.upsert({
      where: { phone },
      update: { isVerified: true },
      create: {
        phone,
        name: `E2E Tester ${phone.slice(-4)}`,
        isVerified: true,
      },
    });
  }));

  const user10 = users[0];
  const user11 = users[1];
  const user12 = users[2];

  // 3. Seed orders for the main order test user (9876543212)
  const variant = await prisma.productVariant.findFirst({
    where: { productId: "prod_rice_1" },
  });

  if (!variant) {
    throw new Error("Product variant not found. Please run regular seed first.");
  }

  // Wipe existing E2E orders to ensure correct ownership
  await prisma.orderItem.deleteMany({
    where: { orderId: { startsWith: "e2e_order_" } }
  });
  await prisma.orderStatusHistory.deleteMany({
    where: { orderId: { startsWith: "e2e_order_" } }
  });
  await prisma.order.deleteMany({
    where: { id: { startsWith: "e2e_order_" } }
  });

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
        userId: user12.id,
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
