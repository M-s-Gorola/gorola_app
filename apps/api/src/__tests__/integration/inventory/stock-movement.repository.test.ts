import { ForbiddenError, NotFoundError, ValidationError } from "@gorola/shared";
import type { Category, PrismaClient, Product, ProductVariant, Store, User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { StockMovementRepository } from "../../../modules/inventory/stock-movement.repository.js";
import { OrderRepository } from "../../../modules/order/order.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";

async function clean(db: PrismaClient): Promise<void> {
  await db.stockMovement.deleteMany();
  await db.orderStatusHistory.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.address.deleteMany();
  await db.user.deleteMany();
  await db.productVariant.deleteMany();
  await db.product.deleteMany();
  await db.storeOwner.deleteMany();
  await db.advertisement.deleteMany();
  await db.offer.deleteMany();
  await db.discount.deleteMany();
  await db.riderLocation.deleteMany();

  await db.deliveryRider.deleteMany();

  await db.store.deleteMany();
  await db.subCategory.deleteMany();
  await db.category.deleteMany();
}

describe("StockMovementRepository", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const variantRepo = new ProductVariantRepository(db);
  const orderRepo = new OrderRepository(db);
  const repo = new StockMovementRepository(db);

  let user: User;
  let store: Store;
  let category: Category;
  let subCategory: { id: string };
  let product: Product;
  let variant: ProductVariant;
  let orderId: string;

  beforeEach(async () => {
    await clean(db);
    user = await userRepo.create({ phone: "+919700000001", name: "M User" });
    store = await storeRepo.create({
      name: "M Store",
      description: "d",
      phone: "+911100000001",
      address: "Hill"
    });
    category = await categoryRepo.create({ slug: "m-cat", name: "M Cat", imageUrl: "https://example.com/cat.jpg" });
    subCategory = await db.subCategory.create({
      data: { slug: "m-sub", name: "M Sub", categoryId: category.id }
    });
    product = await productRepo.create({
      storeId: store.id,
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: "M Product",
      description: "d",
      imageUrl: "https://m.jpg"
    });
    variant = await variantRepo.create({
      productId: product.id,
      label: "1u",
      price: "10",
      stockQty: 5,
      unit: "u"
    });
    const order = await orderRepo.create({
      userId: user.id,
      storeId: store.id,
      subtotal: "20",
      deliveryFee: "0",
      total: "20",
      paymentMethod: "COD",
      landmarkDescription: "Near gate",
      items: [
        {
          productVariantId: variant.id,
          productName: "M Product",
          variantLabel: "1u",
          price: "10",
          quantity: 1
        }
      ],
      changedBy: "buyer:system"
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("records a SALE with correct before/after", async () => {
      const m = await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId,
        type: "SALE",
        quantity: 1,
        stockQtyBefore: 5,
        stockQtyAfter: 4
      });
      expect(m.type).toBe("SALE");
      expect(m.quantity).toBe(1);
      expect(m.stockQtyBefore).toBe(5);
      expect(m.stockQtyAfter).toBe(4);
    });

    it("rejects non-positive quantity", async () => {
      await expect(
        repo.create({
          storeId: store.id,
          productVariantId: variant.id,
          orderId,
          type: "SALE",
          quantity: 0,
          stockQtyBefore: 5,
          stockQtyAfter: 5
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects inconsistent SALE before/after", async () => {
      await expect(
        repo.create({
          storeId: store.id,
          productVariantId: variant.id,
          orderId,
          type: "SALE",
          quantity: 2,
          stockQtyBefore: 10,
          stockQtyAfter: 6
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects CANCELLATION_RESTORE with inconsistent after", async () => {
      await expect(
        repo.create({
          storeId: store.id,
          productVariantId: variant.id,
          orderId,
          type: "CANCELLATION_RESTORE",
          quantity: 1,
          stockQtyBefore: 4,
          stockQtyAfter: 4
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects when variant is not in store", async () => {
      const other = await storeRepo.create({
        name: "Nope",
        description: "d",
        phone: "+911100000002",
        address: "X"
      });
      await expect(
        repo.create({
          storeId: other.id,
          productVariantId: variant.id,
          orderId,
          type: "SALE",
          quantity: 1,
          stockQtyBefore: 5,
          stockQtyAfter: 4
        })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws when variant id does not exist", async () => {
      await expect(
        repo.create({
          storeId: store.id,
          productVariantId: "cuid_doesnotexist_xxxxxxxxxx",
          orderId,
          type: "SALE",
          quantity: 1,
          stockQtyBefore: 5,
          stockQtyAfter: 4
        })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("records a REFILL correctly", async () => {
      const m = await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId: null, // Refill doesn't need an order
        type: "REFILL",
        quantity: 10,
        stockQtyBefore: 5,
        stockQtyAfter: 15
      });
      expect(m.type).toBe("REFILL");
      expect(m.stockQtyAfter).toBe(15);
    });

    it("records an ADJUSTMENT (increase) correctly", async () => {
      const m = await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId: null,
        type: "ADJUSTMENT",
        quantity: 2,
        stockQtyBefore: 15,
        stockQtyAfter: 17
      });
      expect(m.type).toBe("ADJUSTMENT");
    });

    it("records an ADJUSTMENT (decrease) correctly", async () => {
      const m = await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId: null,
        type: "ADJUSTMENT",
        quantity: 3,
        stockQtyBefore: 17,
        stockQtyAfter: 14
      });
      expect(m.type).toBe("ADJUSTMENT");
    });

    it("records an INITIAL correctly", async () => {
      const m = await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId: null,
        type: "INITIAL",
        quantity: 50,
        stockQtyBefore: 0,
        stockQtyAfter: 50
      });
      expect(m.type).toBe("INITIAL");
    });
  });

  describe("findByVariantId and findByOrderId", () => {
    it("returns movements for variant in descending time order", async () => {
      await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId,
        type: "SALE",
        quantity: 1,
        stockQtyBefore: 5,
        stockQtyAfter: 4
      });
      const order2 = await orderRepo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "10",
        deliveryFee: "0",
        total: "10",
        paymentMethod: "COD",
        landmarkDescription: "A",
        items: [
          {
            productVariantId: variant.id,
            productName: "M Product",
            variantLabel: "1u",
            price: "10",
            quantity: 1
          }
        ],
        changedBy: "b"
      });
      await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId: order2.id,
        type: "SALE",
        quantity: 1,
        stockQtyBefore: 4,
        stockQtyAfter: 3
      });
      const list = await repo.findByVariantId(variant.id);
      expect(list).toHaveLength(2);
      expect(list[0]!.orderId).toBe(order2.id);
    });

    it("returns movements for an order in ascending time", async () => {
      const m1 = await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId,
        type: "SALE",
        quantity: 1,
        stockQtyBefore: 5,
        stockQtyAfter: 4
      });
      const m2 = await repo.create({
        storeId: store.id,
        productVariantId: variant.id,
        orderId,
        type: "CANCELLATION_RESTORE",
        quantity: 1,
        stockQtyBefore: 4,
        stockQtyAfter: 5
      });
      const byOrder = await repo.findByOrderId(orderId);
      expect(byOrder.map((m) => m.id)).toEqual([m1.id, m2.id]);
    });
  });
});
