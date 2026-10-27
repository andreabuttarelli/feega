import { test, expect } from '@playwright/test';
import { installCursor, recordDemo } from '../record';
import { REACT_SITE } from './code-frame-sites';
import { CODE_FRAME, editCanvas, openLocalCanvas, pointIn } from './code-frame-helpers';

const SIZE = { width: 900, height: 700 };

test('code frame views and variables', async ({ page }) => {
  const { projectId, canvasId } = await openLocalCanvas(page);
  const source = (await editCanvas(page, projectId, { op: 'create_node', input: { canvasId, type: 'iframe', x: 0, y: 0, data: { framework: 'react', files: REACT_SITE } } })).node.id;
  await editCanvas(page, projectId, { op: 'resize_node', input: { nodeId: source, ...SIZE } });
  const pricing = (await editCanvas(page, projectId, { op: 'create_node', input: { canvasId, type: 'iframe', x: SIZE.width + 80, y: 0, data: { sourceNodeId: source, route: '/pricing' } } })).node.id;
  await editCanvas(page, projectId, { op: 'resize_node', input: { nodeId: pricing, ...SIZE } });

  await installCursor(page);
  await page.reload();
  await expect(page.locator(CODE_FRAME)).toHaveCount(2, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Editor' }).click();
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(5000);

  await recordDemo(page, { slug: 'code-frame-views', title: 'One site, every page, live variables' }, async (d) => {
    await d.click(page.getByRole('button', { name: 'Open page in new frame' }));
    await d.type(page.getByLabel('Route for the new frame'), 'about', { click: false });
    await page.keyboard.press('Enter');
    await expect(page.locator(CODE_FRAME)).toHaveCount(3, { timeout: 20_000 });
    await page.keyboard.press('Shift+Digit1');
    await d.wait(4000);

    const vars = page.getByTestId('code-vars');
    await expect(vars.locator('[data-var=accent]')).toBeVisible({ timeout: 20_000 });
    const accent = vars.locator('[data-var=accent] input[type=text]');
    await d.click(accent);
    await page.keyboard.press('Meta+A');
    await d.type(null, '#2563eb');
    await page.keyboard.press('Enter');
    await d.wait(1200);

    const hosts = page.locator(CODE_FRAME);
    for (let i = 0; i < 3; i++) {
      const frame = page.frameLocator(`${CODE_FRAME} >> nth=${i}`);
      if (!(await frame.locator('footer').isVisible())) continue;
      const at = await pointIn(page, hosts.nth(i), frame, frame.locator('footer'));
      await d.click(at, { double: true });
      await page.keyboard.press('Meta+A');
      await d.type(null, 'Built on the canvas, shipped as code');
      await page.keyboard.press('Enter');
      break;
    }
    await d.wait(1500);
    await d.click(page.getByRole('button', { name: 'Export' }));
    await d.click(page.getByRole('menuitem', { name: /values inline/ }));
    await d.wait(1500);
  });
});
