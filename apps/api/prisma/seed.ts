import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { encryptPII, hashPII } from "../src/lib/crypto.js";
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

  // ── Delivery Rider / Field Technician Accounts ───────────────────────────
  const riderPwHash = await hash("Rider#123", 10);

  await prisma.deliveryRider.upsert({
    where: { email: "rider1@gorola.in" },
    update: { passwordHash: riderPwHash },
    create: {
      name: "Hillside Rider",
      phone: encryptPII("+919000000001"),
      phoneHash: hashPII("+919000000001"),
      email: "rider1@gorola.in",
      passwordHash: riderPwHash,
      riderType: "DELIVERY",
      isActive: true,
      stores: {
        create: {
          storeId: storeA.id,
          isPrimary: true
        }
      }
    }
  });

  await prisma.deliveryRider.upsert({
    where: { email: "rider2@gorola.in" },
    update: { passwordHash: riderPwHash },
    create: {
      name: "Aarna Technician",
      phone: encryptPII("+919000000002"),
      phoneHash: hashPII("+919000000002"),
      email: "rider2@gorola.in",
      passwordHash: riderPwHash,
      riderType: "FIELD_TECHNICIAN",
      isActive: true,
      stores: {
        create: {
          storeId: storeC.id,
          isPrimary: true
        }
      }
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

  await prisma.systemSetting.createMany({
    data: [
      {
        key: "DELIVERY_CHARGE",
        value: "30",
        description: "Quick commerce order delivery fee",
        updatedBy: "system"
      },
      {
        key: "SERVICE_CHARGE",
        value: "0",
        description: "Booking commerce service charge",
        updatedBy: "system"
      },
      {
        key: "GST_RATE",
        value: "0",
        description: "GST percentage applied to orders. Set to 0 to disable tax.",
        updatedBy: "system"
      },
      {
        key: "GST_NUMBER",
        value: "",
        description: "Business GSTIN for tax invoice generation (e.g. 05AAAAA0000A1Z5).",
        updatedBy: "system"
      },
      {
        key: "RIDER_EARNING_RATE_PCT",
        value: "100",
        description: "Default payout percentage for delivery riders on quick commerce orders.",
        updatedBy: "system"
      },
      {
        key: "TECHNICIAN_EARNING_RATE_PCT",
        value: "100",
        description: "Default payout percentage for field technicians on booking commerce services.",
        updatedBy: "system"
      }
    ],
    skipDuplicates: true
  });

  const consentPurposes = [
    {
      key: "OTP_AUTH",
      displayName: "Authentication & Account Security",
      description: "Verifies your identity via One-Time Password.",
      isEssential: true,
      retentionSummary: "Lifetime of account; deleted within 30 days of account erasure."
    },
    {
      key: "ORDER_PROCESSING",
      displayName: "Order Fulfillment & Location Services",
      description: "Processes your location and order details for delivery.",
      isEssential: true,
      retentionSummary: "Addresses deleted on erasure. Order GPS nulled on erasure; financials kept 7 years (GST)."
    },
    {
      key: "MARKETING_COMMS",
      displayName: "Promotions & Seasonal Offers",
      description: "Sends you optional hill-station discounts and store coupons.",
      isEssential: false,
      retentionSummary: "Scrubbed from all distributions within 48 hours of withdrawal."
    },
    {
      key: "ANALYTICS",
      displayName: "Usage & Performance Analytics",
      description: "Collects anonymous performance telemetry to improve the app.",
      isEssential: false,
      retentionSummary: "Aggregated logs purged or anonymised after 180 days."
    },
    {
      key: "AGE_DECLARATION",
      displayName: "Age Confirmation",
      description: "Confirmation that you are 18 or over. Your date of birth is used once and never stored.",
      isEssential: true,
      retentionSummary: "The date you confirmed is kept for the life of your account. Your date of birth is never stored."
    }
  ];

  for (const purpose of consentPurposes) {
    await prisma.consentPurposeConfig.upsert({
      where: { key: purpose.key },
      update: {
        displayName: purpose.displayName,
        description: purpose.description,
        isEssential: purpose.isEssential,
        retentionSummary: purpose.retentionSummary
      },
      create: {
        key: purpose.key,
        displayName: purpose.displayName,
        description: purpose.description,
        isEssential: purpose.isEssential,
        retentionSummary: purpose.retentionSummary
      }
    });
  }

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
