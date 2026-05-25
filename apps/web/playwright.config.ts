import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  globalSetup: './tests/e2e/global-setup.ts',
  expect: {
    timeout: 10000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests to avoid Redis key conflicts for the test user. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://127.0.0.1:5180',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Launch options to map subdomain domains natively inside Chromium */
    launchOptions: {
      args: ['--host-resolver-rules=MAP * 127.0.0.1'],
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-se',
      use: { 
        ...devices['iPhone SE'],
        browserName: 'chromium',
      },
    }
  ],

  /* Run your local servers. Use production builds in CI for stability, dev mode locally for speed. */
  webServer: [
    {
      command: process.env.CI 
        ? 'pnpm --filter @gorola/web preview --port 5180 --host 127.0.0.1' 
        : 'pnpm --filter @gorola/web dev --port 5180 --host 127.0.0.1',
      url: 'http://127.0.0.1:5180',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:3002',
        PORT_API: '3002',
        VITE_E2E_PROXY: 'true',
      }
    },
    {
      command: process.env.CI 
        ? 'PORT=3002 pnpm --filter @gorola/api exec node dist/app.js' 
        : 'pnpm --filter @gorola/api dev',
      url: 'http://127.0.0.1:3002/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL_TEST!,
        CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5180,http://store.gorola.com:5180,http://admin.gorola.com:5180,http://rider.gorola.com:5180',
        HOST: '127.0.0.1',
        PORT: '3002',
        GOROLA_DUMMY_OTP: '123456',
        NODE_ENV: 'test',
        OTEL_ENABLED: 'false'
      }
    },
  ],
});
