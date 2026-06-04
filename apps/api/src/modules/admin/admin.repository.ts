import { ConflictError } from "@gorola/shared";
import type { Admin, PrismaClient } from "@prisma/client";

export type CreateAdminInput = {
  email: string;
  passwordHash: string;
  totpSecret?: string | null;
};

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

export class AdminRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<Admin | null> {
    return this.db.admin.findFirst({
      where: {
        id,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
  }

  public async findByEmail(
    email: string,
    options?: { includeDeleted?: boolean }
  ): Promise<Admin | null> {
    return this.db.admin.findFirst({
      where: {
        email,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
  }

  public async create(input: CreateAdminInput): Promise<Admin> {
    try {
      return await this.db.admin.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          totpSecret: input.totpSecret ?? null
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2002")) {
        throw new ConflictError(
          "Admin with this email already exists",
          { field: "email" },
          error
        );
      }
      throw error;
    }
  }

  public async updateTotpSecret(id: string, secret: string): Promise<Admin> {
    return this.db.admin.update({
      where: { id },
      data: { totpSecret: secret }
    });
  }
}
