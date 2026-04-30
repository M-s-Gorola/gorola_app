import { NotFoundError, ValidationError } from "@gorola/shared";
import type { Cart, CartItem, PrismaClient } from "@prisma/client";

export type CartWithItems = Cart & {
  items: CartItem[];
};

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

async function getCartWithItems(db: PrismaClient, cartId: string): Promise<CartWithItems> {
  return db.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: {
      items: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export class CartRepository {
  private readonly variantMutationTails = new Map<string, Promise<unknown>>();

  public constructor(private readonly db: PrismaClient) {}

  private enqueueVariantMutation<T>(
    userId: string,
    productVariantId: string,
    work: () => Promise<T>
  ): Promise<T> {
    const key = `${userId}::${productVariantId}`;
    const prev = this.variantMutationTails.get(key) ?? Promise.resolve();
    const next = prev.then(work);
    this.variantMutationTails.set(
      key,
      next.then(
        (): undefined => undefined,
        (): undefined => undefined
      )
    );
    return next;
  }

  public async findByUserId(userId: string): Promise<CartWithItems | null> {
    return this.db.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }

  public async addItem(
    userId: string,
    productVariantId: string,
    quantity: number
  ): Promise<CartWithItems> {
    if (quantity <= 0) {
      throw new ValidationError("Quantity must be greater than zero", { quantity });
    }

    return this.enqueueVariantMutation(userId, productVariantId, async () => {
      try {
        const cart = await this.db.cart.upsert({
          where: { userId },
          update: {},
          create: { userId }
        });

        const existing = await this.db.cartItem.findUnique({
          where: {
            cartId_productVariantId: {
              cartId: cart.id,
              productVariantId
            }
          }
        });

        if (existing) {
          await this.db.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + quantity }
          });
        } else {
          await this.db.cartItem.create({
            data: {
              cartId: cart.id,
              productVariantId,
              quantity
            }
          });
        }

        return getCartWithItems(this.db, cart.id);
      } catch (error: unknown) {
        if (isPrismaError(error, "P2003")) {
          throw new NotFoundError("User or product variant not found", { userId, productVariantId }, error);
        }
        throw error;
      }
    });
  }

  public async removeItem(userId: string, productVariantId: string): Promise<CartWithItems> {
    return this.enqueueVariantMutation(userId, productVariantId, async () => {
      const cart = await this.db.cart.findUnique({ where: { userId } });
      if (!cart) {
        throw new NotFoundError("Cart item not found", { userId, productVariantId });
      }

      const existing = await this.db.cartItem.findUnique({
        where: {
          cartId_productVariantId: {
            cartId: cart.id,
            productVariantId
          }
        }
      });

      if (!existing) {
        throw new NotFoundError("Cart item not found", { userId, productVariantId });
      }

      await this.db.cartItem.delete({ where: { id: existing.id } });
      return getCartWithItems(this.db, cart.id);
    });
  }

  public async updateQty(
    userId: string,
    productVariantId: string,
    quantity: number
  ): Promise<CartWithItems> {
    if (quantity <= 0) {
      throw new ValidationError("Quantity must be greater than zero", { quantity });
    }

    return this.enqueueVariantMutation(userId, productVariantId, async () => {
      const cart = await this.db.cart.findUnique({ where: { userId } });
      if (!cart) {
        throw new NotFoundError("Cart item not found", { userId, productVariantId });
      }

      const existing = await this.db.cartItem.findUnique({
        where: {
          cartId_productVariantId: {
            cartId: cart.id,
            productVariantId
          }
        }
      });

      if (!existing) {
        throw new NotFoundError("Cart item not found", { userId, productVariantId });
      }

      await this.db.cartItem.update({
        where: { id: existing.id },
        data: { quantity }
      });

      return getCartWithItems(this.db, cart.id);
    });
  }

  public async clearCart(userId: string): Promise<CartWithItems> {
    let cart = await this.db.cart.findUnique({ where: { userId } });

    if (!cart) {
      try {
        cart = await this.db.cart.create({ data: { userId } });
      } catch (error: unknown) {
        if (isPrismaError(error, "P2003")) {
          throw new NotFoundError("User not found", { userId }, error);
        }
        throw error;
      }
    }

    await this.db.cartItem.deleteMany({ where: { cartId: cart.id } });
    return getCartWithItems(this.db, cart.id);
  }
}