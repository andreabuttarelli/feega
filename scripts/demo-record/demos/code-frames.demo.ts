import { test, expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { installCursor, recordDemo } from '../record';
import { REACT_SITE } from './code-frame-sites';
import { CODE_FRAME as FRAME, editCanvas as edit, openLocalCanvas, pointIn as pointInHost } from './code-frame-helpers';

const SIZE = { width: 1320, height: 820 };

const pointIn = (page: Page, frame: FrameLocator, target: Locator) => pointInHost(page, page.locator(FRAME), frame, target);

test('code frames', async ({ page }) => {
  const { projectId, canvasId } = await openLocalCanvas(page);
  const made = await edit(page, projectId, { op: 'create_node', input: { canvasId, type: 'iframe', x: 0, y: 0, data: { framework: 'react', files: REACT_SITE } } });
  await edit(page, projectId, { op: 'resize_node', input: { nodeId: made.node.id, ...SIZE } });

  await installCursor(page);
  await page.reload();
  const frame = page.frameLocator(FRAME);
  await expect(frame.locator('#hero-title')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Editor' }).click();
  await page.waitForTimeout(2500);

  await recordDemo(page, { slug: 'code-frames', title: 'React and Svelte, live on the canvas' }, async (d) => {
    await d.wait(800);
    await d.click(await pointIn(page, frame, frame.getByRole('link', { name: 'Pricing', exact: true })));
    await d.wait(700);
    await d.click(await pointIn(page, frame, frame.locator('#billing-toggle')));
    await d.wait(700);
    await d.click(await pointIn(page, frame, frame.getByRole('link', { name: 'About', exact: true })));
    await d.wait(500);
    const box = (await page.locator(FRAME).boundingBox())!;
    await d.move({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 260);
      await d.wait(160);
    }
    await d.wait(900);
    await d.click(await pointIn(page, frame, frame.getByRole('link', { name: 'Product', exact: true })));
    await d.wait(600);

    await d.click(page.getByRole('button', { name: 'Editor' }));
    await d.click(page.getByRole('tab', { name: 'pages/Home.tsx' }));
    await d.click(page.locator('.cm-line', { hasText: 'Know your numbers before the Monday meeting.' }));
    await page.keyboard.press('End');
    await d.type(null, ' Every week.');
    await expect(frame.getByText('Every week.')).toBeVisible({ timeout: 20_000 });
    await d.look((await page.locator(FRAME).boundingBox())!, 1500);
  });
});
