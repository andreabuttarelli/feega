import { test, expect } from '@playwright/test';

test('unauthenticated /app sends to /login without a cacheable redirect', async ({ request }) => {
  const response = await request.get('/app', { maxRedirects: 0 });

  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/login');
});
