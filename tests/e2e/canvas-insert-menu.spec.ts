import { openInsert } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/editor-modes`;
const PHONE = { width: 390, height: 844 };

test.describe('the + insert menu @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('one + opens tools, generate, import and templates; the bar keeps its zoom', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const bar = page.getByTestId('add-bar');
    await expect(bar.getByRole('radiogroup')).toHaveCount(0);
    await expect(bar.getByTestId('canvas-zoom')).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/insert-1-bar.png` });

    const menu = await openInsert(page);
    for (const section of ['tools', 'generate', 'import', 'templates']) {
      await expect(menu.locator(`[data-section="${section}"]`)).toBeVisible();
    }
    await page.screenshot({ path: `${SHOTS_DIR}/insert-2-menu.png` });

    const before = await page.locator('[data-testid="gpu-node"]').count();
    await menu.locator('[data-insert="text"]').click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator('[data-testid="gpu-node"]')).toHaveCount(before + 1, { timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS_DIR}/insert-3-added.png` });

    await (await openInsert(page)).locator('[data-tool="rectangle"]').click();
    await expect((await openInsert(page)).locator('[data-tool="rectangle"]')).toHaveClass(/on/);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('insert-menu')).toHaveCount(0);
  });

  test('the phone Insert sheet renders the same sections', async ({ page, session }) => {
    await page.setViewportSize(PHONE);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    const sheet = page.getByTestId('insert-sheet');
    for (const section of ['tools', 'generate', 'import', 'templates']) {
      await expect(sheet.locator(`[data-section="${section}"]`)).toHaveCount(1);
    }
    await page.screenshot({ path: `${SHOTS_DIR}/insert-4-phone-sheet.png` });
  });
});
