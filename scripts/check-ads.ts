import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_TEST || "postgresql://localhost:5432/gorola_test"
    }
  }
});

async function main() {
  const ads = await prisma.advertisement.findMany({
    include: {
      store: true
    }
  });
  console.log("Advertisements in DB:", JSON.stringify(ads, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
