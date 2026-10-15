import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { fetchInvoiceData } from "../../../modules/invoice/invoice-data-fetcher.js";

async function cleanStoreGraph(db: ReturnType<typeof getPrismaClient>): Promise<void> {
  await db.orderItem.deleteMany();
  await db.bookingOrder.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.riderLocation.deleteMany();
  await db.riderStore.deleteMany();
  await db.deliveryRider.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.store.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
  await db.systemSetting.deleteMany();
}

describe("Invoice Data Fetcher Integration Tests", () => {
  const db = getPrismaClient();

  beforeAll(async () => {
    // Database connection established
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanStoreGraph(db);
  });

  it("should fetch complete invoice data for a quick commerce order with snapshot fields", async () => {
    // Create GSTIN setting
    await db.systemSetting.create({
      data: { key: "GST_NUMBER", value: "05AAAAA0000A1Z5", updatedBy: "system" }
    });

    const store = await db.store.create({
      data: {
        name: "Mountain Grocers",
        description: "Fresh mountain groceries",
        address: "Mall Road, Mussoorie",
        phone: "+919876543210"
      }
    });

    const user = await db.user.create({
      data: {
        name: "Alice Wonderland",
        phone: "+919123456780",
        isVerified: true
      }
    });

    const cat = await db.category.create({
      data: { name: "Essentials", slug: "essentials", isActive: true }
    });
    const subCat = await db.subCategory.create({
      data: { name: "Dairy", slug: "dairy", categoryId: cat.id }
    });

    const product = await db.product.create({
      data: {
        name: "Artisan Cheese",
        description: "Fresh cheese",
        imageUrl: "cheese.png",
        storeId: store.id,
        categoryId: cat.id,
        subCategoryId: subCat.id
      }
    });

    const variant = await db.productVariant.create({
      data: {
        productId: product.id,
        label: "200g",
        price: 250,
        stockQty: 20,
        unit: "pack"
      }
    });

    const order = await db.order.create({
      data: {
        userId: user.id,
        storeId: store.id,
        orderType: "QUICK",
        status: "DELIVERED",
        subtotal: 500,
        deliveryFee: 30,
        discountSavingAmount: 50,
        offerSavingAmount: 25,
        appliedDiscountCode: "SAVE50",
        appliedOfferTitle: "Cheese Week 10% OFF",
        taxRate: 18.0,
        total: 455,
        landmarkDescription: "Near Clock Tower, Mussoorie",
        items: {
          create: {
            productVariantId: variant.id,
            productName: "Artisan Cheese",
            variantLabel: "200g",
            quantity: 2,
            price: 250
          }
        }
      }
    });

    const invoiceData = await fetchInvoiceData(order.id, db);

    expect(invoiceData.orderId).toBe(order.id);
    expect(invoiceData.orderType).toBe("QUICK");
    expect(invoiceData.seller.storeName).toBe("Mountain Grocers");
    expect(invoiceData.seller.gstin).toBe("05AAAAA0000A1Z5");
    expect(invoiceData.buyer.name).toBe("Alice Wonderland");
    expect(invoiceData.items).toHaveLength(1);
    expect(invoiceData.items[0]!.name).toBe("Artisan Cheese");
    expect(invoiceData.items[0]!.variantLabel).toBe("200g");
    expect(invoiceData.items[0]!.quantity).toBe(2);
    expect(invoiceData.items[0]!.lineTotal).toBe(500);
    expect(invoiceData.pricing.subtotal).toBe(500);
    expect(invoiceData.pricing.feeType).toBe("Delivery Fee");
    expect(invoiceData.pricing.feeAmount).toBe(30);
    expect(invoiceData.pricing.discountCode).toBe("SAVE50");
    expect(invoiceData.pricing.discountSavingAmount).toBe(50);
    expect(invoiceData.pricing.appliedOfferTitle).toBe("Cheese Week 10% OFF");
    expect(invoiceData.pricing.offerSavingAmount).toBe(25);
    expect(invoiceData.pricing.taxRate).toBe(18);
    expect(invoiceData.pricing.grandTotal).toBe(455);
  });
});
