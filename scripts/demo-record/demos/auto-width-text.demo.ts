import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { barTool } from '../../../tests/e2e/fixtures/canvas-bar';
import { installCursor, recordDemo } from '../record';

test('auto width text', async ({ page, session }) => {
  await installCursor(page);
  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  const tool = await barTool(page, 'text');
  await page.waitForTimeout(2000);
  const pane = (await page.locator('.svelte-flow').boundingBox())!;

  await recordDemo(page, { slug: 'auto-width-text', title: 'text that grows as you type' }, async (d) => {
    await d.click(tool);
    await d.click({ x: pane.x + pane.width * 0.25, y: pane.y + pane.height * 0.45 });
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeFocused({ timeout: 15_000 });
    await d.type(field, 'Auto width grows with every keystroke', { click: false });
    await d.key('Escape');
    await d.wait(1500);
  });
});
