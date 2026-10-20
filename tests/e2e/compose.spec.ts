import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.describe('compositions over the API @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('picking a template opens its editor, loaded and posted over bearer', async ({ page, session }) => {
    test.setTimeout(90_000);
    const viaPageAction: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/app\/compose[^?]*\?.*\/[a-zA-Z]/.test(req.url())) {
        viaPageAction.push(req.url());
      }
    });

    await gotoHydrated(page, `/app/compose?project=${session.projectId}`);
    await page.getByTestId('compose-templates').getByRole('button').first().click();

    await expect(page).toHaveURL(/\/app\/compose\/[0-9a-f-]+/, { timeout: 30_000 });
    await expect(page.getByTestId('compose-open-motion')).toBeVisible({ timeout: 30_000 });
    expect(viaPageAction).toEqual([]);
  });
});
