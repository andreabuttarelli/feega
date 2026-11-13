import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';

const SHOTS = `${process.env.HOME}/Documents/feega-videos/shots/effects-typo`;

test('templates for motion, composition and effects', async ({ page }) => {
  await installCursor(page);
  await gotoHydrated(page, '/app/templates');
  await expect(page.getByTestId('node-templates-effects')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${SHOTS}/dashboard-templates-all.png`, fullPage: true });

  await recordDemo(page, { slug: 'typo-templates', title: 'typographic effects' }, async (d) => {
    await d.click(page.locator('[data-family="composition"]'));
    await d.wait(1500);
    await page.screenshot({ path: `${SHOTS}/dashboard-templates-composition.png` });
    await d.click(page.locator('[data-family="effects"]'));
    await d.wait(1500);
    await page.screenshot({ path: `${SHOTS}/dashboard-templates-effects.png` });
    await d.move(page.locator('[data-template="fx-word-weave"]'));
    await d.wait(800);
    await d.move(page.locator('[data-template="fx-glyph-tiles"]'));
    await d.wait(800);
    await d.click(page.locator('[data-template="fx-word-field"] button[type="submit"]'));
    await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 30_000 });
    await d.wait(3000);
  });
});
