import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

const LINK = 'https://www.figma.com/design/Hk3LumenCeramics/Lumen-landing-page?node-id=12-48';

test('import frames from a Figma link', async ({ page, session }) => {
  await installCursor(page);
  await openCanvas(page, session);

  await recordDemo(page, { slug: 'figma-import-link', title: 'import frames from a Figma link' }, async (d) => {
    await d.click(page.getByTestId('insert-open'));
    const entry = page.getByTestId('insert-menu').locator('[data-insert="figma"]');
    await d.click(entry);
    await expect(page.getByTestId('figma-import-dialog')).toBeVisible();
    await d.type(page.getByTestId('figma-import-url'), LINK);
    await d.click(page.getByTestId('figma-import-find'));
    await expect(page.getByTestId('figma-import-no-token').or(page.getByTestId('figma-import-message')).or(page.getByTestId('figma-import-frames'))).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: '/tmp/claude-501/x/figma.png' });
    await d.wait(3000);
  });
});
