import { NotFoundError, ValidationError } from "@gorola/shared";
import type {
  Category,
  PrismaClient,
  Product,
  ProductVariant,
  Store,
  User
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { OrderRepository } from "../../../modules/order/order.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";

async function cleanOrderIntegrationGraph(db: PrismaClient): Promise<void> {
  await db.riderLocation.deleteMany();
  await db.deliveryRider.deleteMany();
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
  await db.store.deleteMany();
  await db.category.deleteMany();
}

describe("OrderRepository", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const variantRepo = new ProductVariantRepository(db);
  const repo = new OrderRepository(db);

  let user: User;
  let store: Store;
  let category: Category;
  let product: Product;
  let variantA: ProductVariant;
  let variantB: ProductVariant;

  beforeEach(async () => {
    await cleanOrderIntegrationGraph(db);
    user = await userRepo.create({ phone: "+919800000001", name: "Order User" });
    store = await storeRepo.create({
      name: "Order Store",
      description: "d",
      phone: "+911111111177",
      address: "Road"
    });
    category = await categoryRepo.create({ slug: "order-cat", name: "Order Cat" });
    product = await productRepo.create({
      storeId: store.id,
      categoryId: category.id,
      name: "Order Product",
      description: "d",
      imageUrl: "https://example.com/p.jpg"
    });
    variantA = await variantRepo.create({
      productId: product.id,
      label: "500g",
      price: "45",
      stockQty: 100,
      unit: "pack"
    });
    variantB = await variantRepo.create({
      productId: product.id,
      label: "1kg",
      price: "80",
      stockQty: 100,
      unit: "pack"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("create", () => {
    it("creates order with items and initial status history", async () => {
      const order = await repo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "170.00",
        deliveryFee: "20.00",
        total: "190.00",
        paymentMethod: "COD",
        landmarkDescription: "Near clock tower",
        items: [
          {
            productVariantId: variantA.id,
            productName: "Order Product",
            variantLabel: "500g",
            price: "45.00",
            quantity: 2
          },
          {
            productVariantId: variantB.id,
            productName: "Order Product",
            variantLabel: "1kg",
            price: "80.00",
            quantity: 1
          }
        ],
        changedBy: "SYSTEM"
      });

      expect(order.userId).toBe(user.id);
      expect(order.storeId).toBe(store.id);
      expect(order.status).toBe("PLACED");
      expect(order.items).toHaveLength(2);
      expect(order.statusHistory).toHaveLength(1);
      expect(order.statusHistory[0]?.status).toBe("PLACED");
      expect(order.statusHistory[0]?.changedBy).toBe("SYSTEM");
      expect(order.store.id).toBe(store.id);
      expect(order.store.name).toBe("Order Store");
      expect(order.store.phone).toBe("+911111111177");
    });

    it("throws ValidationError when items are empty", async () => {
      await expect(
        repo.create({
          userId: user.id,
          storeId: store.id,
          subtotal: "0",
          deliveryFee: "0",
          total: "0",
          paymentMethod: "COD",
          landmarkDescription: "x",
          items: [],
          changedBy: "SYSTEM"
        })
      ).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError for missing foreign keys", async () => {
      await expect(
        repo.create({
          userId: "nonexistent_cuid_xyz",
          storeId: store.id,
          subtotal: "10",
          deliveryFee: "1",
          total: "11",
          paymentMethod: "COD",
          landmarkDescription: "x",
          items: [
            {
              productVariantId: variantA.id,
              productName: "p",
              variantLabel: "v",
              price: "10",
              quantity: 1
            }
          ],
          changedBy: "SYSTEM"
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("findById", () => {
    it("returns order by id with relations", async () => {
      const created = await repo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "10",
        deliveryFee: "1",
        total: "11",
        paymentMethod: "UPI",
        landmarkDescription: "x",
        items: [
          {
            productVariantId: variantA.id,
            productName: "p",
            variantLabel: "v",
            price: "10",
            quantity: 1
          }
        ],
        changedBy: "SYSTEM"
      });
      const found = await repo.findById(created.id);
      expect(found?.id).toBe(created.id);
      expect(found?.items).toHaveLength(1);
      expect(found?.statusHistory).toHaveLength(1);
      expect(found?.store.phone).toBe("+911111111177");
      expect(found?.store.name).toBe("Order Store");
    });

    it("returns null when id does not exist", async () => {
      expect(await repo.findById("nonexistent_cuid_xyz")).toBeNull();
    });
  });

  describe("findByUserId and findByStoreId", () => {
    it("returns orders by user sorted newest first", async () => {
      const one = await repo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "10",
        deliveryFee: "1",
        total: "11",
        paymentMethod: "COD",
        landmarkDescription: "x",
        items: [{ productVariantId: variantA.id, productName: "p", variantLabel: "v", price: "10", quantity: 1 }],
        changedBy: "SYSTEM"
      });
      const two = await repo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "20",
        deliveryFee: "1",
        total: "21",
        paymentMethod: "COD",
        landmarkDescription: "x",
        items: [{ productVariantId: variantB.id, productName: "p", variantLabel: "v", price: "20", quantity: 1 }],
        changedBy: "SYSTEM"
      });
      const list = await repo.findByUserId(user.id);
      expect(list.map((o) => o.id)).toEqual([two.id, one.id]);
    });

    it("returns orders by store sorted newest first", async () => {
      await repo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "10",
        deliveryFee: "1",
        total: "11",
        paymentMethod: "COD",
        landmarkDescription: "x",
        items: [{ productVariantId: variantA.id, productName: "p", variantLabel: "v", price: "10", quantity: 1 }],
        changedBy: "SYSTEM"
      });
      const list = await repo.findByStoreId(store.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.storeId).toBe(store.id);
    });
  });

  describe("updateStatus", () => {
    it("updates status and appends history", async () => {
      const created = await repo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "10",
        deliveryFee: "1",
        total: "11",
        paymentMethod: "COD",
        landmarkDescription: "x",
        items: [{ productVariantId: variantA.id, productName: "p", variantLabel: "v", price: "10", quantity: 1 }],
        changedBy: "SYSTEM"
      });

      const updated = await repo.updateStatus(created.id, "PREPARING", "store-owner-1", "accepted");
      expect(updated.status).toBe("PREPARING");
      expect(updated.statusHistory).toHaveLength(2);
      expect(updated.statusHistory[1]?.status).toBe("PREPARING");
    });

    it("throws NotFoundError when order does not exist", async () => {
      await expect(
        repo.updateStatus("nonexistent_cuid_xyz", "PREPARING", "x")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("addStatusHistory", () => {
    it("adds status history entry without changing current order status", async () => {
      const created = await repo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "10",
        deliveryFee: "1",
        total: "11",
        paymentMethod: "CARD",
        landmarkDescription: "x",
        items: [{ productVariantId: variantA.id, productName: "p", variantLabel: "v", price: "10", quantity: 1 }],
        changedBy: "SYSTEM"
      });

      await repo.addStatusHistory(created.id, "PREPARING", "store-owner-1", "queued");
      const found = await repo.findById(created.id);
      expect(found?.status).toBe("PLACED");
      expect(found?.statusHistory).toHaveLength(2);
      expect(found?.statusHistory[1]?.note).toBe("queued");
    });

    it("throws NotFoundError when order does not exist", async () => {
      await expect(
        repo.addStatusHistory("nonexistent_cuid_xyz", "PREPARING", "x")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("security", () => {
    it("does not execute SQL from crafted changedBy", async () => {
      const created = await repo.create({
        userId: user.id,
        storeId: store.id,
        subtotal: "10",
        deliveryFee: "1",
        total: "11",
        paymentMethod: "COD",
        landmarkDescription: "x",
        items: [{ productVariantId: variantA.id, productName: "p", variantLabel: "v", price: "10", quantity: 1 }],
        changedBy: "SYSTEM"
      });

      const malicious = "store'; DROP TABLE \"OrderStatusHistory\";--";
      await repo.addStatusHistory(created.id, "PREPARING", malicious);
      const found = await repo.findById(created.id);
      expect(found?.statusHistory[1]?.changedBy).toBe(malicious);
      expect(await db.orderStatusHistory.count()).toBeGreaterThanOrEqual(2);
    });
  });
});