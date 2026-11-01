import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas, SETTLE_MS } from './seed';

const SITE = 'https://vercel.com';
const TEST_MS = 1_800_000;
const IMPORT_MS = 240_000;
const READ_MS = 1600;

const importedFrame = (page: Page): Locator => page.locator('[data-testid="frame-overlays"] [data-frame]').first();

test('clean layers on import', async ({ page, session }) => {
  test.setTimeout(TEST_MS);
  await installCursor(page);
  await openCanvas(page, session);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.waitForTimeout(SETTLE_MS);

  await recordDemo(page, { slug: 'import-layers', title: 'clean layers on import' }, async (d) => {
    await d.click(page.getByTestId('insert-open'));
    await d.click(page.getByTestId('insert-menu').locator('[data-insert="url"]'));
    await expect(page.getByTestId('url-import-dialog')).toBeVisible();
    await d.type(page.getByTestId('url-import-url'), SITE);
    await d.click(page.getByTestId('url-import-run'));

    const frame = importedFrame(page);
    await d.skip(async () => {
      await expect(page.getByTestId('url-import-dialog')).toBeHidden({ timeout: IMPORT_MS });
      await expect(frame).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(6000);
      await page.keyboard.press('Shift+Digit1');
      await page.waitForTimeout(SETTLE_MS);
    });

    const layers = page.getByTestId('layers');
    await d.look((await layers.boundingBox())!, READ_MS);
    await d.click(layers.locator('[data-kind="clip"]').nth(1));
    await d.look((await layers.boundingBox())!, READ_MS);
  });
});
