import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.E2E_SHOTS ?? 'test-results';

test.describe('GIF export options @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a GIF offers loop, frame rate and width, and a boomerang changes the estimate', async ({ page, session }) => {
    test.setTimeout(120_000);

    await gotoHydrated(page, `/app/compose?project=${session.projectId}`);
    await page.getByTestId('compose-templates').getByRole('button').first().click();
    await expect(page.getByTestId('compose-export')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('compose-export').click();
    await page.getByTestId('export-mode-video').click();

    await expect(page.getByTestId('export-gif-loop')).toHaveCount(0);
    await page.getByTestId('export-format').getByRole('radio', { name: 'GIF' }).click();

    const loop = page.getByTestId('export-gif-loop');
    await expect(loop.getByRole('radio', { name: 'Loop forever' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('export-gif-fps')).toHaveValue('15');
    await expect(page.getByTestId('export-gif-width')).toHaveValue('640');

    const before = await page.getByTestId('export-quote').innerText();
    await loop.getByRole('radio', { name: 'Boomerang' }).click();
    await page.getByTestId('export-gif-fps').selectOption('30');
    await page.getByTestId('export-gif-width').selectOption('1280');
    await expect(loop.getByRole('radio', { name: 'Boomerang' })).toHaveAttribute('aria-checked', 'true');
    expect(await page.getByTestId('export-quote').innerText()).not.toBe(before);

    await page.getByTestId('export-dialog').screenshot({ path: `${SHOTS}/export-gif-options.png` });
  });
});
