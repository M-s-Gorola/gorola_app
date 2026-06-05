import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedDummyData } from "./dummy-data";

const ADMIN_EMAIL = "admin@gorola.in";
const ADMIN_PASSWORD = "AdminGorola#123";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const storeA = await prisma.store.upsert({
    where: { id: "store_gorola_hillside_mart" },
    update: {},
    create: {
      id: "store_gorola_hillside_mart",
      name: "Hillside Mart",
      description: "Groceries and daily essentials for Mussoorie.",
      phone: "+919999000001",
      address: "Landour Road, Mussoorie",
      isActive: true
    }
  });

  const storeB = await prisma.store.upsert({
    where: { id: "store_gorola_mountain_medico" },
    update: {},
    create: {
      id: "store_gorola_mountain_medico",
      name: "Mountain Medico",
      description: "Trusted medical supplies and pharmacy items.",
      phone: "+919999000002",
      address: "Library Chowk, Mussoorie",
      isActive: true
    }
  });

  const storeC = await prisma.store.upsert({
    where: { id: "store_gorola_aarna_diagnostic" },
    update: {},
    create: {
      id: "store_gorola_aarna_diagnostic",
      name: "Aarna Diagnostic Centre",
      description: "Dedicated medical diagnostic test laboratory.",
      phone: "+919999000003",
      address: "Mall Road, Mussoorie",
      storeType: "BOOKING_COMMERCE",
      bookingLeadDays: 1,
      isAcceptingBookings: true,
      isActive: true
    }
  });

  const storeD = await prisma.store.upsert({
    where: { id: "store_gorola_electronics" },
    update: {},
    create: {
      id: "store_gorola_electronics",
      name: "GoRola Electronics",
      description: "Standard physical electronics and accessories.",
      phone: "+919999000004",
      address: "Mall Road, Mussoorie",
      storeType: "QUICK_COMMERCE",
      isActive: true
    }
  });

  const storeE = await prisma.store.upsert({
    where: { id: "store_gorola_repairs" },
    update: {},
    create: {
      id: "store_gorola_repairs",
      name: "GoRola Repairs",
      description: "On-demand expert hardware repairs at your doorstep.",
      phone: "+919999000005",
      address: "Clock Tower, Mussoorie",
      storeType: "BOOKING_COMMERCE",
      bookingLeadDays: 1,
      isActive: true
    }
  });

  const hashedPw = await hash("Owner#123", 10);

  await prisma.storeOwner.upsert({
    where: { email: "owner1@gorola.in" },
    update: { passwordHash: hashedPw },
    create: {
      email: "owner1@gorola.in",
      passwordHash: hashedPw,
      storeId: storeA.id
    }
  });

  await prisma.storeOwner.upsert({
    where: { email: "owner2@gorola.in" },
    update: { passwordHash: hashedPw },
    create: {
      email: "owner2@gorola.in",
      passwordHash: hashedPw,
      storeId: storeB.id
    }
  });

  await prisma.storeOwner.upsert({
    where: { email: "owner3@gorola.in" },
    update: { passwordHash: hashedPw },
    create: {
      email: "owner3@gorola.in",
      passwordHash: hashedPw,
      storeId: storeC.id
    }
  });

  await prisma.storeOwner.upsert({
    where: { email: "owner4@gorola.in" },
    update: { passwordHash: hashedPw },
    create: {
      email: "owner4@gorola.in",
      passwordHash: hashedPw,
      storeId: storeD.id
    }
  });

  await prisma.storeOwner.upsert({
    where: { email: "owner5@gorola.in" },
    update: { passwordHash: hashedPw },
    create: {
      email: "owner5@gorola.in",
      passwordHash: hashedPw,
      storeId: storeE.id
    }
  });

  // ── System Admin Account ──────────────────────────────────────────────────
  // Created once. If the row already exists it is left untouched.
  // On first login the admin is redirected to /admin/setup-2fa for TOTP setup.
  const adminPwHash = await hash(ADMIN_PASSWORD, 12);
  await prisma.admin.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminPwHash
      // totpSecret left null — triggers mandatory /admin/setup-2fa on first login
    }
  });

  // Import and run dummy data seeder
  await seedDummyData(prisma, storeA.id, storeB.id, storeC.id, storeD.id, storeE.id);

  await prisma.featureFlag.createMany({
    data: [
      {
        key: "WEATHER_MODE_ACTIVE",
        value: false,
        description: "System-wide weather mode toggle.",
        updatedBy: "system"
      },
      {
        key: "RIDER_INTERFACE_ENABLED",
        value: false,
        description: "Future rider module toggle.",
        updatedBy: "system"
      },
      {
        key: "REAL_TIME_LOCATION_ENABLED",
        value: false,
        description: "Future live rider location toggle.",
        updatedBy: "system"
      },
      {
        key: "SCHEDULED_DELIVERY_ENABLED",
        value: false,
        description: "Future scheduled delivery toggle.",
        updatedBy: "system"
      },
      {
        key: "ADVERTISEMENTS_ENABLED",
        value: true,
        description: "Enable store advertisement placement.",
        updatedBy: "system"
      },
      {
        key: "OFFERS_ENABLED",
        value: true,
        description: "Enable store offers and discounts.",
        updatedBy: "system"
      },
      {
        key: "DISCOUNTS_ENABLED",
        value: true,
        description: "Enable coupon code support.",
        updatedBy: "system"
      },
      {
        key: "UPI_PAYMENT_ENABLED",
        value: false,
        description: "Future UPI checkout toggle.",
        updatedBy: "system"
      },
      {
        key: "CARD_PAYMENT_ENABLED",
        value: false,
        description: "Future card checkout toggle.",
        updatedBy: "system"
      }
    ],
    skipDuplicates: true
  });

  console.info("Seed completed", {
    stores: [storeA.name, storeB.name, storeC.name, storeD.name, storeE.name],
    admin: ADMIN_EMAIL
  });
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
