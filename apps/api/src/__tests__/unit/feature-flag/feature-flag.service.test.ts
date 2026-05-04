import type { FeatureFlag,PrismaClient } from '@prisma/client';
import { beforeEach,describe, expect, it, vi } from 'vitest';

import { FeatureFlagRepository } from '../../../modules/feature-flag/feature-flag.repository.js';
import { FeatureFlagService } from '../../../modules/feature-flag/feature-flag.service.js';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let repository: FeatureFlagRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = {} as unknown as PrismaClient;
    repository = new FeatureFlagRepository(prisma);
    service = new FeatureFlagService(repository);

    vi.spyOn(repository, 'getByKey').mockImplementation(async (key: string) => {
      if (key === 'EXISTING_FLAG') {
        return {
          key,
          value: true,
          description: null,
          updatedBy: 'admin',
          updatedAt: new Date(),
        } as FeatureFlag;
      }
      return null;
    });
  });

  describe('getFlagValue', () => {
    it('should return the flag value if it exists', async () => {
      const value = await service.getFlagValue('EXISTING_FLAG');
      expect(value).toBe(true);
    });

    it('should return false if the flag does not exist', async () => {
      const value = await service.getFlagValue('NON_EXISTENT_FLAG');
      expect(value).toBe(false);
    });

    it('should return false if the flag value is false', async () => {
      vi.spyOn(repository, 'getByKey').mockResolvedValueOnce({
        key: 'FALSE_FLAG',
        value: false,
        description: null,
        updatedBy: 'admin',
        updatedAt: new Date(),
      } as FeatureFlag);

      const value = await service.getFlagValue('FALSE_FLAG');
      expect(value).toBe(false);
    });
  });
});
