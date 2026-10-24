import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SCREENSHOT = `${process.env.HOME}/Documents/feega-videos/e2e/f3-settings-models.png`;

test.describe('settings models @real', () => {
  test.skip(!REAL_STACK, 'requires E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('lists models per medium with the allow-list form', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/settings/models`);

    for (const medium of ['image', 'video', 'model3d']) {
      await expect(page.getByTestId(`allowlist-${medium}`)).toBeVisible();
    }
    await expect(page.getByTestId('allowlist-image').locator('input[type="checkbox"]').first()).toBeVisible();

    await page.screenshot({ path: SCREENSHOT, fullPage: true });
  });
});
