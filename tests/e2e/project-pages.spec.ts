import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PAGES = [
  { path: 'assets', api: 'assets' },
  { path: 'influencers', api: 'influencers' },
  { path: 'brands/new', api: 'brand-new' }
];

test.describe('project pages load over the API @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  for (const { path, api } of PAGES) {
    test(`${path} loads from its bearer twin`, async ({ page, session }) => {
      const loaded = page.waitForResponse((r) => r.url().includes(`/api/v1/projects/${session.projectId}/pages/${api}`));
      await gotoHydrated(page, `/p/${session.projectId}/${path}`);

      expect((await loaded).status()).toBe(200);
      await expect(page.locator('main, [role="main"], body').first()).toBeVisible();
    });
  }
});
