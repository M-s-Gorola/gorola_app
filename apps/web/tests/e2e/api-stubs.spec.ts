import { test, expect } from '@playwright/test';

test.describe('API Stubs', () => {
  test('E2E-016: Rider Stub Endpoints Return 501', async ({ request }) => {
    // 1. Authenticate to get a valid RIDER token
    const loginResponse = await request.post('/api/v1/rider/auth/login', {
      data: {
        email: 'rider1@gorola.in',
        password: 'Rider#123'
      }
    });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    const token = loginBody.data.accessToken;

    // 2. These are the remaining rider backend endpoints that are currently stubs
    const stubs = [
      { url: '/api/v1/rider/location', method: 'put' }
    ];

    for (const stub of stubs) {
      const response = await request[stub.method](stub.url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // Assert status is 501 Not Implemented
      expect(response.status()).toBe(501);
      
      const body = await response.json();
      expect(body.error.message).toMatch(/Not Implemented|deferred/i);
    }
  });
});
