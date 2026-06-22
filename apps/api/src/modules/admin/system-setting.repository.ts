import { NotFoundError } from "@gorola/shared";
import type { PrismaClient, SystemSetting } from "@prisma/client";

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === code
  );
}

export class SystemSettingRepository {
  public constructor(private readonly db: PrismaClient) {}

  public async getAll(): Promise<SystemSetting[]> {
    return this.db.systemSetting.findMany({ orderBy: { key: "asc" } });
  }

  public async getByKey(key: string): Promise<SystemSetting | null> {
    return this.db.systemSetting.findUnique({ where: { key } });
  }

  public async update(
    key: string,
    data: { value: string; updatedBy: string; description?: string | null }
  ): Promise<SystemSetting> {
    try {
      return await this.db.systemSetting.update({
        where: { key },
        data: {
          value: data.value,
          updatedBy: data.updatedBy,
          ...(data.description !== undefined ? { description: data.description } : {})
        }
      });
    } catch (error: unknown) {
      if (isPrismaError(error, "P2025")) {
        throw new NotFoundError(`System setting not found: ${key}`, { key }, error);
      }
      throw error;
    }
  }

  public async upsert(
    key: string,
    data: { value: string; updatedBy: string; description?: string | null }
  ): Promise<SystemSetting> {
    return this.db.systemSetting.upsert({
      where: { key },
      update: {
        value: data.value,
        updatedBy: data.updatedBy,
        ...(data.description !== undefined ? { description: data.description } : {})
      },
      create: {
        key,
        value: data.value,
        updatedBy: data.updatedBy,
        description: data.description ?? null
      }
    });
  }
}
