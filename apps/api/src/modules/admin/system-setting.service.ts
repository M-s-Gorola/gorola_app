import type { PrismaClient, SystemSetting } from "@prisma/client";

import type { SystemSettingRepository } from "./system-setting.repository.js";

export class SystemSettingService {
  public constructor(
    private readonly db: PrismaClient,
    private readonly repository: SystemSettingRepository
  ) {}

  public async getSettings(): Promise<SystemSetting[]> {
    return this.repository.getAll();
  }

  public async getSettingValue(key: string, defaultValue: string): Promise<string> {
    const setting = await this.repository.getByKey(key);
    return setting ? setting.value : defaultValue;
  }

  public async updateSettings(
    settings: { key: string; value: string }[],
    adminId: string,
    ip: string,
    userAgent: string
  ): Promise<SystemSetting[]> {
    const oldSettings = await this.repository.getAll();
    const oldValue: Record<string, string> = {};
    for (const s of oldSettings) {
      oldValue[s.key] = s.value;
    }

    const updatedSettings: SystemSetting[] = [];
    const newValue: Record<string, string> = {};

    // Execute updates inside transaction or sequentially
    await this.db.$transaction(async (tx) => {
      const RepoConstructor = this.repository.constructor as new (
        db: typeof tx
      ) => SystemSettingRepository;
      const txRepo = new RepoConstructor(tx);

      for (const item of settings) {
        const updated = await txRepo.upsert(item.key, {
          value: item.value,
          updatedBy: adminId
        });
        updatedSettings.push(updated);
        newValue[item.key] = item.value;
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorRole: "ADMIN",
          action: "ADMIN_SETTINGS_UPDATE",
          entityType: "SystemSetting",
          entityId: "system_settings",
          oldValue,
          newValue,
          ip,
          userAgent
        }
      });
    });

    return updatedSettings;
  }
}
