import { NotFoundError } from "@gorola/shared";
import type { PrismaClient, Store, StoreType } from "@prisma/client";

export type CreateStoreInput = {
  name: string;
  description: string;
  phone: string;
  address: string;
  storeType?: StoreType;
  isActive?: boolean;
  weatherModeDeliveryWindow?: string | null;
};

export type UpdateStoreInput = Partial<
  Pick<Store, "name" | "description" | "phone" | "address" | "isActive" | "weatherModeDeliveryWindow">
>;

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

export class StoreRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async findById(
    id: string,
    options?: { includeDeleted?: boolean }
  ): Promise<Store | null> {
    return this.db.store.findFirst({
      where: {
        id,
        ...(options?.includeDeleted === true ? {} : { isDeleted: false })
      }
    });
  }

  /**
   * Lists stores visible to buyers/catalog: active and not soft-deleted by default.
   */
  public async findAll(options?: {
    includeInactive?: boolean;
    includeDeleted?: boolean;
  }): Promise<Store[]> {
    return this.db.store.findMany({
      where: {
        ...(options?.includeDeleted === true ? {} : { isDeleted: false }),
        ...(options?.includeInactive === true ? {} : { isActive: true })
      },
      orderBy: { name: "asc" }
    });
  }

  public async create(input: CreateStoreInput): Promise<Store> {
    return this.db.store.create({
      data: {
        name: input.name,
        description: input.description,
        phone: input.phone,
        address: input.address,
        storeType: input.storeType ?? "QUICK_COMMERCE",
        isActive: input.isActive ?? true,
        weatherModeDeliveryWindow: input.weatherModeDeliveryWindow ?? null
      }
    });
  }

  public async update(id: string, data: UpdateStoreInput): Promise<Store> {
    try {
      return await this.db.store.update({
        where: { id },
        data
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError("Store not found", { id }, error);
      }
      throw error;
    }
  }
}
