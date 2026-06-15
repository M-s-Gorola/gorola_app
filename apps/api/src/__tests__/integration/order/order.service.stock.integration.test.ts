import { ConflictError, ForbiddenError, UnprocessableEntityError } from "@gorola/shared";
import type { Category, PrismaClient, Product, ProductVariant, Store, User } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../../lib/prisma.js";
import { CategoryRepository } from "../../../modules/catalog/category.repository.js";
import { ProductRepository } from "../../../modules/catalog/product.repository.js";
import { ProductVariantRepository } from "../../../modules/catalog/variant.repository.js";
import { StockMovementRepository } from "../../../modules/inventory/stock-movement.repository.js";
import { OrderRepository } from "../../../modules/order/order.repository.js";
import { OrderService } from "../../../modules/order/order.service.js";
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

function makeOrderInput(
  userId: string,
  storeId: string,
  variant: ProductVariant,
  qty: number
) {
  return {
    userId,
    storeId,
    subtotal: String(Number(variant.price) * qty),
    deliveryFee: "0",
    total: String(Number(variant.price) * qty),
    paymentMethod: "COD" as const,
    landmarkDescription: "Test landmark area near clock tower",
    items: [
      {
        productVariantId: variant.id,
        productName: "O Product",
        variantLabel: variant.label,
        price: String(variant.price),
        quantity: qty
      }
    ],
    changedBy: "buyer:integration"
  };
}

describe("OrderService stock (integration)", () => {
  const db = getPrismaClient();
  const userRepo = new UserRepository(db);
  const storeRepo = new StoreRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const productRepo = new ProductRepository(db);
  const variantRepo = new ProductVariantRepository(db);
  const orderRepo = new OrderRepository(db);
  const stockMovements = new StockMovementRepository(db);
  const service = new OrderService(db, orderRepo, variantRepo, stockMovements);

  let user: User;
  let store: Store;
  let category: Category;
  let subCategory: { id: string };
  let product: Product;
  let variant: ProductVariant;

  beforeEach(async () => {
    await clean(db);
    user = await userRepo.create({ phone: "+919600000001", name: "OS User" });
    store = await storeRepo.create({
      name: "OS Store",
      description: "d",
      phone: "+911200000001",
      address: "Mall"
    });
    category = await categoryRepo.create({ slug: "os-cat", name: "OS Cat", imageUrl: "https://example.com/cat.jpg" });
    subCategory = await db.subCategory.create({
      data: { slug: "os-sub", name: "OS Sub", categoryId: category.id }
    });
    product = await productRepo.create({
      storeId: store.id,
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: "O Product",
      description: "d",
      imageUrl: "https://o.jpg"
    });
    variant = await variantRepo.create({
      productId: product.id,
      label: "S",
      price: "25",
      stockQty: 10,
      unit: "u"
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("deducts stock and records SALE movements for each line", async () => {
    const order = await service.placeOrderWithStock(
      makeOrderInput(user.id, store.id, variant, 2)
    );
    expect(order.status).toBe("PLACED");
    const v2 = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(v2.stockQty).toBe(8);
    const mov = await stockMovements.findByOrderId(order.id);
    expect(mov).toHaveLength(1);
    expect(mov[0]!.type).toBe("SALE");
    expect(mov[0]!.stockQtyAfter).toBe(8);
  });

  it("rejects with 422 line item details when not enough stock", async () => {
    let caught: unknown;
    try {
      await service.placeOrderWithStock(makeOrderInput(user.id, store.id, variant, 20));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnprocessableEntityError);
    const err = caught as UnprocessableEntityError;
    const items = err.details?.lineItems as
      | Array<{ requested: number; available: number }>
      | undefined;
    expect(items?.[0]?.requested).toBe(20);
  });

  it("does not create an order when pre-check fails", async () => {
    await expect(
      service.placeOrderWithStock(makeOrderInput(user.id, store.id, variant, 100))
    ).rejects.toBeInstanceOf(UnprocessableEntityError);
    expect(await db.order.count()).toBe(0);
  });

  it("throws ForbiddenError when a line variant belongs to another store", async () => {
    const otherStore = await storeRepo.create({
      name: "Off",
      description: "d",
      phone: "+911200000002",
      address: "Y"
    });
    const otherProduct = await productRepo.create({
      storeId: otherStore.id,
      categoryId: category.id,
      subCategoryId: subCategory.id,
      name: "Other P",
      description: "d",
      imageUrl: "x"
    });
    const otherVariant = await variantRepo.create({
      productId: otherProduct.id,
      label: "O",
      price: "1",
      stockQty: 5,
      unit: "u"
    });
    const input = makeOrderInput(user.id, store.id, variant, 1);
    input.items.push({
      productVariantId: otherVariant.id,
      productName: "X",
      variantLabel: "O",
      price: "1",
      quantity: 1
    });
    input.subtotal = "26";
    input.total = "26";
    await expect(service.placeOrderWithStock(input)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("cancels and restores stock with CANCELLATION_RESTORE movements", async () => {
    const order = await service.placeOrderWithStock(
      makeOrderInput(user.id, store.id, variant, 2)
    );
    const afterSale = (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } }))
      .stockQty;
    const cancelled = await service.cancelOrderWithStockRestore(
      order.id,
      "buyer:integration",
      "changed mind"
    );
    expect(cancelled.status).toBe("CANCELLED");
    const v3 = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(v3.stockQty).toBe(10);
    const mov = await stockMovements.findByOrderId(order.id);
    expect(mov.some((m) => m.type === "SALE")).toBe(true);
    expect(mov.some((m) => m.type === "CANCELLATION_RESTORE")).toBe(true);
    expect(mov[mov.length - 1]!.type).toBe("CANCELLATION_RESTORE");
    void afterSale;
  });

  it("is idempotent when order already CANCELLED", async () => {
    const order = await service.placeOrderWithStock(
      makeOrderInput(user.id, store.id, variant, 1)
    );
    await service.cancelOrderWithStockRestore(order.id, "s");
    const again = await service.cancelOrderWithStockRestore(order.id, "s");
    expect(again.status).toBe("CANCELLED");
  });

  it("rejects cancel when order is delivered", async () => {
    const order = await service.placeOrderWithStock(
      makeOrderInput(user.id, store.id, variant, 1)
    );
    await orderRepo.updateStatus(order.id, "DELIVERED", "store");
    await expect(
      service.cancelOrderWithStockRestore(order.id, "x")
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("only one of two concurrent orders for the last unit can succeed", async () => {
    const one = await variantRepo.update(variant.id, { stockQty: 1 });
    expect(one.stockQty).toBe(1);
    const in1 = makeOrderInput(user.id, store.id, variant, 1);
    const in2 = { ...in1, changedBy: "other" as const };
    const [a, b] = await Promise.allSettled([service.placeOrderWithStock(in1), service.placeOrderWithStock(in2)]);
    const ok = [a, b].filter((x) => x.status === "fulfilled");
    const fail = [a, b].filter((x) => x.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect(
      (fail[0] as PromiseRejectedResult).reason
    ).toBeInstanceOf(UnprocessableEntityError);
    expect(await db.order.count()).toBe(1);
    const vEnd = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(vEnd.stockQty).toBe(0);
  });
});
