import { ConflictError, NotFoundError } from "@gorola/shared";
import type { PrismaClient, User } from "@prisma/client";

import { decryptPII, encryptPII, hashPII } from "../../lib/crypto.js";

export type CreateUserInput = {
  phone: string;
  name: string;
  isVerified?: boolean;
};

export type UpdateUserInput = Partial<Pick<User, "name" | "isVerified" | "phone">>;

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

function toDomainUser(user: User | null): User | null {
  if (!user) return null;
  return {
    ...user,
    phone: decryptPII(user.phone)
  };
}

export class UserRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<User | null> {
    const user = await this.db.user.findFirst({
      where: {
        id,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
    return toDomainUser(user);
  }

  public async findByPhone(
    phone: string,
    options?: { includeDeleted?: boolean }
  ): Promise<User | null> {
    const normalized = phone.trim();
    const piiHash = hashPII(normalized);
    const user = await this.db.user.findFirst({
      where: {
        OR: [
          { phoneHash: piiHash },
          { phone: normalized }
        ],
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
    return toDomainUser(user);
  }

  /**
   * Buyer OTP onboarding: reuse row by active phone or create verified buyer (`name` empty until profile step).
   */
  public async ensureBuyerByPhone(phone: string): Promise<User> {
    const normalized = phone.trim();
    const existing = await this.findByPhone(normalized);
    if (existing !== null) {
      if (existing.isVerified) {
        return existing;
      }
      const updated = await this.db.user.update({
        data: { isVerified: true },
        where: { id: existing.id }
      });
      return toDomainUser(updated)!;
    }

    const encryptedPhone = encryptPII(normalized);
    const piiHash = hashPII(normalized);

    const created = await this.db.user.create({
      data: {
        name: "",
        phone: encryptedPhone,
        phoneHash: piiHash,
        isVerified: true
      }
    });
    return toDomainUser(created)!;
  }

  public async create(input: CreateUserInput): Promise<User> {
    try {
      const normalized = input.phone.trim();
      const encryptedPhone = encryptPII(normalized);
      const piiHash = hashPII(normalized);

      const created = await this.db.user.create({
        data: {
          phone: encryptedPhone,
          phoneHash: piiHash,
          name: input.name,
          isVerified: input.isVerified ?? false
        }
      });
      return toDomainUser(created)!;
    } catch (error: unknown) {
      if (isPrismaError(error, "P2002")) {
        throw new ConflictError("User with this phone already exists", { field: "phone" }, error);
      }
      throw error;
    }
  }

  public async update(id: string, data: UpdateUserInput): Promise<User> {
    try {
      const updateData: Record<string, unknown> = { ...data };
      if (data.phone) {
        const normalized = data.phone.trim();
        updateData.phone = encryptPII(normalized);
        updateData.phoneHash = hashPII(normalized);
      }

      const updated = await this.db.user.update({
        where: { id },
        data: updateData
      });
      return toDomainUser(updated)!;
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("User not found", { id }, error);
      }
      if (isPrismaError(error, "P2002")) {
        throw new ConflictError("User with this phone already exists", { field: "phone" }, error);
      }
      throw error;
    }
  }

  public async softDelete(id: string): Promise<User> {
    try {
      const updated = await this.db.user.update({
        where: { id },
        data: { isDeleted: true }
      });
      return toDomainUser(updated)!;
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("User not found", { id }, error);
      }
      throw error;
    }
  }

  public async getMyData(userId: string): Promise<{
    profile: {
      id: string;
      name: string;
      phone: string;
      createdAt: string;
      updatedAt: string;
    };
    addresses: Array<{
      id: string;
      label: string;
      landmarkDescription: string;
      flatRoom: string | null;
      lat: number | null;
      lng: number | null;
      isDefault: boolean;
      createdAt: string;
    }>;
    orders: Array<{
      id: string;
      orderType: string;
      status: string;
      subtotal: number;
      deliveryFee: number;
      total: number;
      paymentMethod: string;
      paymentStatus: string;
      createdAt: string;
      items: Array<{
        productName: string;
        variantLabel: string;
        price: number;
        quantity: number;
      }>;
    }>;
    consents: Array<{
      id: string;
      purpose: string;
      consentVersion: string;
      noticeText: string;
      isWithdrawn: boolean;
      createdAt: string;
      withdrawnAt: string | null;
    }>;
  }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        addresses: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" }
        },
        orders: {
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            items: true
          }
        },
        consents: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!user) {
      throw new NotFoundError("User not found", { userId });
    }

    const decryptedPhone = decryptPII(user.phone);

    return {
      profile: {
        id: user.id,
        name: user.name,
        phone: decryptedPhone,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      },
      addresses: user.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        landmarkDescription: a.landmarkDescription,
        flatRoom: a.flatRoom,
        lat: a.lat ? Number(a.lat) : null,
        lng: a.lng ? Number(a.lng) : null,
        isDefault: a.isDefault,
        createdAt: a.createdAt.toISOString()
      })),
      orders: user.orders.map((o) => ({
        id: o.id,
        orderType: o.orderType,
        status: o.status,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.deliveryFee),
        total: Number(o.total),
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((item) => ({
          productName: item.productName,
          variantLabel: item.variantLabel,
          price: Number(item.price),
          quantity: item.quantity
        }))
      })),
      consents: user.consents.map((c) => ({
        id: c.id,
        purpose: c.purpose,
        consentVersion: c.consentVersion,
        noticeText: c.noticeText,
        isWithdrawn: c.isWithdrawn,
        createdAt: c.createdAt.toISOString(),
        withdrawnAt: c.withdrawnAt ? c.withdrawnAt.toISOString() : null
      }))
    };
  }

  public async updateNominee(
    userId: string,
    data: {
      nomineeName?: string | null | undefined;
      nomineeContact?: string | null | undefined;
      nomineeRelationship?: string | null | undefined;
    }
  ): Promise<{
    nomineeName: string | null;
    nomineeContact: string | null;
    nomineeRelationship: string | null;
  }> {
    const updateData: Record<string, string | null> = {};
    if (data.nomineeName !== undefined) updateData.nomineeName = data.nomineeName;
    if (data.nomineeContact !== undefined) updateData.nomineeContact = data.nomineeContact;
    if (data.nomineeRelationship !== undefined) updateData.nomineeRelationship = data.nomineeRelationship;

    const updated = await this.db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        nomineeName: true,
        nomineeContact: true,
        nomineeRelationship: true
      }
    });

    return updated;
  }

  public async getNominee(userId: string): Promise<{
    nomineeName: string | null;
    nomineeContact: string | null;
    nomineeRelationship: string | null;
  }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        nomineeName: true,
        nomineeContact: true,
        nomineeRelationship: true
      }
    });

    if (!user) {
      throw new NotFoundError("User not found", { userId });
    }

    return user;
  }

  public async markPendingDeletion(userId: string): Promise<{
    id: string;
    deletedAt: string;
    deletionScheduledFor: string;
  }> {
    const deletedAt = new Date();
    const deletionScheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        deletedAt,
        deletionScheduledFor
      }
    });

    return {
      id: updated.id,
      deletedAt: updated.deletedAt!.toISOString(),
      deletionScheduledFor: updated.deletionScheduledFor!.toISOString()
    };
  }

  public async reactivateAccount(userId: string): Promise<User> {
    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        deletedAt: null,
        deletionScheduledFor: null,
        isDeleted: false,
        isActive: true
      }
    });

    return toDomainUser(updated)!;
  }

  public async permanentPurgeAndAnonymize(userId: string): Promise<void> {
    await this.db.$transaction([
      // 1. Irreversibly anonymize user profile
      this.db.user.update({
        where: { id: userId },
        data: {
          name: "[deleted]",
          phone: `DELETED_${userId}`,
          phoneHash: null,
          isDeleted: true,
          isActive: false,
          nomineeName: null,
          nomineeContact: null,
          nomineeRelationship: null
        }
      }),
      // 2. Permanently purge saved delivery addresses
      this.db.address.deleteMany({
        where: { userId }
      }),
      // 3. Clear shopping carts
      this.db.cart.deleteMany({
        where: { userId }
      }),
      // 4. Sanitize delivery PII from orders while keeping tax totals
      this.db.order.updateMany({
        where: { userId },
        data: {
          landmarkDescription: "[deleted]",
          flatRoom: null,
          deliveryNote: null,
          deliveryLat: null,
          deliveryLng: null,
          addressLabel: null
        }
      }),
      // 5. Mark all consents as withdrawn
      this.db.consentLog.updateMany({
        where: { userId, isWithdrawn: false },
        data: {
          isWithdrawn: true,
          withdrawnAt: new Date()
        }
      })
    ]);
  }
}



