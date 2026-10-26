import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.E2E_SHOTS ?? 'test-results';

test.describe('120 fps export @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('120 fps is offered and sends the render to our servers', async ({ page, session }) => {
    test.setTimeout(120_000);

    await gotoHydrated(page, `/app/compose?project=${session.projectId}`);
    await page.getByTestId('compose-templates').getByRole('button').first().click();
    await expect(page.getByTestId('compose-export')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('compose-export').click();
    await page.getByTestId('export-mode-video').click();

    await page.getByText('Advanced').click();
    await expect(page.getByTestId('export-fps')).toContainText('120 fps');
    await page.getByTestId('export-fps').selectOption('120');

    await expect(page.getByTestId('export-farm-reason')).toContainText('120 fps');
    await page.getByTestId('export-dialog').screenshot({ path: `${SHOTS}/export-fps-120.png` });
  });
});
