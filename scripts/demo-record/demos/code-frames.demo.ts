import { test, expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { installCursor, recordDemo } from '../record';
import { REACT_SITE } from './code-frame-sites';

const FRAME = '[data-testid=code-frame]';
const SIZE = { width: 1320, height: 820 };

type Point = { x: number; y: number };

async function edit(page: Page, projectId: string, body: Record<string, unknown>) {
  const res = await page.request.post('/api/v1/edit', { data: { project_id: projectId, ...body } });
  return res.json();
}

async function pointIn(page: Page, frame: FrameLocator, target: Locator): Promise<Point> {
  const box = (await page.locator(FRAME).boundingBox())!;
  const inner = await frame.locator('body').evaluate(() => innerWidth);
  const k = box.width / inner;
  const r = await target.evaluate((e) => {
    const b = e.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  return { x: box.x + r.x * k, y: box.y + r.y * k };
}

test('code frames', async ({ page }) => {
  await page.goto('/');
  const [, projectId, canvasId] = page.url().match(/\/p\/([^/]+)\/c\/([^/?]+)/)!;

  const listed = await edit(page, projectId, { op: 'list_nodes', input: { canvasId } });
  for (const node of listed.nodes ?? []) {
    await edit(page, projectId, { op: 'delete_node', target: node.id });
  }
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
