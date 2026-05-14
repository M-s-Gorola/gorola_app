import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: "e2e_order_placed" }
  });
  console.log("Order found:", order ? order.id : "null");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
