import { test, expect } from '@playwright/test';

test.describe('API Stubs', () => {
  test('E2E-016: Rider Stub Endpoints Return 501', async ({ request }) => {
    // These are backend endpoints that are currently stubs
    
    const stubs = [
      { url: '/api/v1/rider/auth/login', method: 'post' },
      { url: '/api/v1/rider/orders/active', method: 'get' },
      { url: '/api/v1/rider/orders/123/status', method: 'put' },
      { url: '/api/v1/rider/location', method: 'put' }
    ];

    for (const stub of stubs) {
      const response = await request[stub.method](stub.url);
      // Assert status is 501 Not Implemented
      expect(response.status()).toBe(501);
      
      const body = await response.json();
      expect(body.error.message).toMatch(/Not Implemented|deferred/i);
    }
  });
});
