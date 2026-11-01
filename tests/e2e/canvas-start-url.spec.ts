import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SITE = 'https://example.com';

test.describe('a canvas opened with a website to import @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');

  test('opens the import dialog on that website without a page error, and drops the address from the URL', async ({ page, session }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/\/url-import$/, (route) => route.abort());

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?start_url=${encodeURIComponent(SITE)}`);

    await expect(page.getByTestId('url-import-dialog')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL((url) => !url.searchParams.has('start_url'));
    expect(errors).toEqual([]);
  });
});
