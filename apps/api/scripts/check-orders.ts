import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.order.count();
  const order = await prisma.order.findUnique({ where: { id: 'e2e_order_cancelled' }, include: { items: true } });
  console.log('ORDER ITEMS:', order.items);
  const cart = await prisma.cart.findFirst({ where: { userId: order.userId }, include: { items: true } });
  console.log('CART ITEMS:', cart.items);
}
main().catch(console.error).finally(() => prisma.$disconnect());
