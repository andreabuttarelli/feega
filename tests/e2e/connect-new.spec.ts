import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function connectNew(page: Page, from: Locator, label: string) {
  await from.click({ position: { x: 24, y: 12 } });
  await page.getByRole('button', { name: 'Connect to new…' }).click();
  await page.getByRole('menu', { name: 'Connect to new' }).getByRole('menuitem', { name: label }).click();
}

test.describe('connect to new @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('text → image → video with real clicks: nodes side by side, all in view', async ({ page, session, seedNode }) => {
    await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'A rainy coffee shop.' } });
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const nodes = page.locator('.svelte-flow__node');
    await connectNew(page, nodes.nth(0), 'Image');
    await expect(nodes).toHaveCount(2);
    await connectNew(page, nodes.nth(1), 'Video');
    await expect(nodes).toHaveCount(3);
    await page.mouse.click(5, 450);

    const boxes = await Promise.all([0, 1, 2].map(async (i) => (await nodes.nth(i).boundingBox())!));
    expect(overlaps(boxes[0], boxes[1])).toBe(false);
    expect(overlaps(boxes[1], boxes[2])).toBe(false);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width);
    expect(boxes[2].x).toBeGreaterThan(boxes[1].x + boxes[1].width);
  });
});
