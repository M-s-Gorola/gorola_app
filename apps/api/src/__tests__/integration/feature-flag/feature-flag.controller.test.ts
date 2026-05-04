import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { afterAll,beforeAll, describe, expect, it } from 'vitest';

import { getPrismaClient } from '../../../lib/prisma.js';
import { registerAppRoutes } from '../../../routes.js';
import { createServer } from '../../../server.js';

describe('FeatureFlagController (Integration)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = getPrismaClient();
    app = await createServer({
      registerRoutes: registerAppRoutes,
    });
    // In actual app, routes are registered in routes.ts
    // For this test, we expect them to be registered via registerAppRoutes in routes.ts
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/feature-flags/:key', () => {
    it('should return 200 and the flag value', async () => {
      // Seed flag
      await prisma.featureFlag.upsert({
        where: { key: 'TEST_FLAG_ACTIVE' },
        update: { value: true },
        create: { key: 'TEST_FLAG_ACTIVE', value: true, updatedBy: 'test' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/feature-flags/TEST_FLAG_ACTIVE',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.key).toBe('TEST_FLAG_ACTIVE');
      expect(body.data.value).toBe(true);
    });

    it('should return 200 and value false for non-existent flag', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/feature-flags/MISSING_FLAG',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.key).toBe('MISSING_FLAG');
      expect(body.data.value).toBe(false);
    });
  });
});
