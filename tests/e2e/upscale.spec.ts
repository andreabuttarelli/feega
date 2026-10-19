import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.describe('upscaler over the API @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('the page loads from the dashboard pages endpoint', async ({ page, session }) => {
    const loaded = page.waitForResponse((r) => r.url().includes('/api/v1/me/pages/upscale'));
    await gotoHydrated(page, `/app/upscale?project=${session.projectId}`);

    expect((await loaded).status()).toBe(200);
    await expect(page.locator('main.stage')).toBeVisible();
  });
});
