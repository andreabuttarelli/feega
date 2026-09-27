import { test, expect } from '@playwright/test';

test('unauthenticated /app redirects permanently to /login', async ({ request }) => {
  const response = await request.get('/app', { maxRedirects: 0 });

  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe('/login');
});
