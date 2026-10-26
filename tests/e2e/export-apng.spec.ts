import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.E2E_SHOTS ?? 'test-results';

test.describe('APNG export @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('APNG is offered, renders on our servers and keeps transparency', async ({ page, session }) => {
    test.setTimeout(120_000);

    await gotoHydrated(page, `/app/compose?project=${session.projectId}`);
    await page.getByTestId('compose-templates').getByRole('button').first().click();
    await expect(page.getByTestId('compose-export')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('compose-export').click();
    await page.getByTestId('export-mode-video').click();

    await page.getByTestId('export-format').getByRole('radio', { name: 'APNG' }).click();

    await expect(page.getByTestId('export-farm-reason')).toContainText('APNG');
    await page.getByTestId('export-dialog').screenshot({ path: `${SHOTS}/export-apng.png` });
  });
});
