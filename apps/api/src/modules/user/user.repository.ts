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
}
