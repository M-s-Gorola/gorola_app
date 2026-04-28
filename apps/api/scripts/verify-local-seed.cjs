/**
 * Verifies local seeded data required for buyer Phase 2.6/2.7 flows.
 * Exits non-zero when required categories are missing.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "../..", "..");
const envPath = path.join(workspaceRoot, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { slug: "asc" }
  });
  const products = await prisma.product.count({
    where: { isActive: true, isDeleted: false }
  });

  const slugs = categories.map((c) => c.slug);
  const required = ["groceries", "medical"];
  const missing = required.filter((slug) => !slugs.includes(slug));

  console.info(
    JSON.stringify(
      {
        activeCategorySlugs: slugs,
        activeProductCount: products,
        missingRequiredCategorySlugs: missing
      },
      null,
      2
    )
  );

  if (missing.length > 0) {
    throw new Error(`Missing required categories: ${missing.join(", ")}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
