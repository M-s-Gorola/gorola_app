import { NotFoundError, ValidationError } from "@gorola/shared";
import type { Category, PrismaClient, Product, ProductVariant, Store, User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CartRepository } from "../../../modules/cart/cart.repository.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { StoreRepository } from "../../../modules/store/store.repository.js";
import { UserRepository } from "../../../modules/user/user.repository.js";

async function cleanCartIntegrationGraph(db: PrismaClient): Promise<void> {
  await db.riderLocation.deleteMany();
  await db.deliveryRider.deleteMany();
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

describe("CartRepository", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const variantRepo = new ProductVariantRepository(db);
  const repo = new CartRepository(db);

  let user: User;
  let store: Store;
  let category: Category;
  let product: Product;
  let variantA: ProductVariant;
  let variantB: ProductVariant;

  beforeEach(async () => {
    await cleanCartIntegrationGraph(db);
    user = await userRepo.create({ phone: "+919700000001", name: "Cart User" });
    store = await storeRepo.create({
      name: "Cart Store",
      description: "d",
      phone: "+911111111199",
      address: "Road"
    });
    category = await categoryRepo.create({ slug: "cart-cat", name: "Cart Cat" });
    product = await productRepo.create({
      storeId: store.id,
      categoryId: category.id,
      name: "Cart Product",
      description: "d",
      imageUrl: "https://example.com/p.jpg"
    });
    variantA = await variantRepo.create({
      productId: product.id,
      label: "500g",
      price: "55",
      stockQty: 100,
      unit: "pack"
    });
    variantB = await variantRepo.create({
      productId: product.id,
      label: "1kg",
      price: "100",
      stockQty: 50,
      unit: "pack"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  describe("findByUserId", () => {
    it("returns null when cart does not exist", async () => {
      expect(await repo.findByUserId(user.id)).toBeNull();
    });

    it("returns cart with items for user", async () => {
      await repo.addItem(user.id, variantA.id, 2);
      const cart = await repo.findByUserId(user.id);
      expect(cart).not.toBeNull();
      expect(cart?.userId).toBe(user.id);
      expect(cart?.items).toHaveLength(1);
      expect(cart?.items[0]?.productVariantId).toBe(variantA.id);
      expect(cart?.items[0]?.quantity).toBe(2);
    });
  });

  describe("addItem", () => {
    it("creates cart automatically on first add", async () => {
      const cart = await repo.addItem(user.id, variantA.id, 1);
      expect(cart.userId).toBe(user.id);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.quantity).toBe(1);
    });

    it("increments quantity when same variant already exists", async () => {
      await repo.addItem(user.id, variantA.id, 2);
      const cart = await repo.addItem(user.id, variantA.id, 3);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.quantity).toBe(5);
    });

    it("adds second variant as a separate line", async () => {
      await repo.addItem(user.id, variantA.id, 1);
      const cart = await repo.addItem(user.id, variantB.id, 2);
      expect(cart.items).toHaveLength(2);
      const quantities = cart.items.map((x) => x.quantity).sort((a, b) => a - b);
      expect(quantities).toEqual([1, 2]);
    });

    it("throws ValidationError for non-positive quantity", async () => {
      await expect(repo.addItem(user.id, variantA.id, 0)).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError when user does not exist", async () => {
      await expect(repo.addItem("nonexistent_cuid_xyz", variantA.id, 1)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when variant does not exist", async () => {
      await expect(repo.addItem(user.id, "nonexistent_cuid_xyz", 1)).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateQty", () => {
    it("updates quantity for an existing cart item", async () => {
      await repo.addItem(user.id, variantA.id, 2);
      const cart = await repo.updateQty(user.id, variantA.id, 7);
      expect(cart.items[0]?.quantity).toBe(7);
    });

    it("throws ValidationError for non-positive quantity", async () => {
      await repo.addItem(user.id, variantA.id, 2);
      await expect(repo.updateQty(user.id, variantA.id, 0)).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError when item does not exist", async () => {
      await expect(repo.updateQty(user.id, variantA.id, 2)).rejects.toThrow(NotFoundError);
    });

    it("serializes concurrent updateQty mutations for the same variant in registration order", async () => {
      await repo.addItem(user.id, variantA.id, 1);
      await Promise.all([
        repo.updateQty(user.id, variantA.id, 4),
        repo.updateQty(user.id, variantA.id, 40),
        repo.updateQty(user.id, variantA.id, 6)
      ]);
      const cart = await repo.findByUserId(user.id);
      expect(cart?.items[0]?.quantity).toBe(6);
    });
  });

  describe("removeItem", () => {
    it("removes existing item from cart", async () => {
      await repo.addItem(user.id, variantA.id, 1);
      await repo.addItem(user.id, variantB.id, 1);
      const cart = await repo.removeItem(user.id, variantA.id);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.productVariantId).toBe(variantB.id);
    });

    it("throws NotFoundError when cart item does not exist", async () => {
      await expect(repo.removeItem(user.id, variantA.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("clearCart", () => {
    it("clears all items from existing cart", async () => {
      await repo.addItem(user.id, variantA.id, 1);
      await repo.addItem(user.id, variantB.id, 2);
      const cart = await repo.clearCart(user.id);
      expect(cart.items).toEqual([]);
      const inDb = await db.cartItem.count();
      expect(inDb).toBe(0);
    });

    it("creates an empty cart when none exists", async () => {
      const cart = await repo.clearCart(user.id);
      expect(cart.userId).toBe(user.id);
      expect(cart.items).toEqual([]);
    });
  });

  describe("security", () => {
    it("does not execute SQL from crafted ids", async () => {
      const malicious = "id'; DROP TABLE \"CartItem\";--";
      await expect(repo.findByUserId(malicious)).resolves.toBeNull();
      await expect(repo.removeItem(user.id, malicious)).rejects.toThrow(NotFoundError);
      expect(await db.cartItem.count()).toBeGreaterThanOrEqual(0);
    });
  });
});