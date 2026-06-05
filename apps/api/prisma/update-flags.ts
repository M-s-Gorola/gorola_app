import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updates = [
    {
      key: "SCHEDULED_DELIVERY_ENABLED",
      description: "Future scheduled delivery toggle."
    },
    {
      key: "UPI_PAYMENT_ENABLED",
      description: "Future UPI checkout toggle."
    },
    {
      key: "CARD_PAYMENT_ENABLED",
      description: "Future card checkout toggle."
    }
  ];

  for (const item of updates) {
    await prisma.featureFlag.update({
      where: { key: item.key },
      data: { description: item.description }
    });
    console.log(`Updated ${item.key} description to: "${item.description}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
