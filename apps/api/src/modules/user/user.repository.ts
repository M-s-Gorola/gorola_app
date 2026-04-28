import { ConflictError, NotFoundError } from "@gorola/shared";
import type { PrismaClient, User } from "@prisma/client";

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

export class UserRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<User | null> {
    return this.db.user.findFirst({
      where: {
        id,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
  }

  public async findByPhone(
    phone: string,
    options?: { includeDeleted?: boolean }
  ): Promise<User | null> {
    return this.db.user.findFirst({
      where: {
        phone,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
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
      return this.db.user.update({
        data: { isVerified: true },
        where: { id: existing.id }
      });
    }
    return this.db.user.create({
      data: {
        name: "",
        phone: normalized,
        isVerified: true
      }
    });
  }

  public async create(input: CreateUserInput): Promise<User> {
    try {
      return await this.db.user.create({
        data: {
          phone: input.phone,
          name: input.name,
          isVerified: input.isVerified ?? false
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2002")) {
        throw new ConflictError("User with this phone already exists", { field: "phone" }, error);
      }
      throw error;
    }
  }

  public async update(id: string, data: UpdateUserInput): Promise<User> {
    try {
      return await this.db.user.update({
        where: { id },
        data
      });
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
      return await this.db.user.update({
        where: { id },
        data: { isDeleted: true }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("User not found", { id }, error);
      }
      throw error;
    }
  }
}
