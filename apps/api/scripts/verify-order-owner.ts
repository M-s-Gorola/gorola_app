import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: "e2e_order_placed" }
  });
  if (order) {
    console.log("Order found:", order.id);
    console.log("Order userId:", order.userId);
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    console.log("User phone:", user?.phone);
  } else {
    console.log("Order not found");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
