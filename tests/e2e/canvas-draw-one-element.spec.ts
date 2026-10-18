import type { Page } from '@playwright/test';
import { barTool, pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const TOOLS = [
  ['rectangle', 'Box'],
  ['ellipse', 'Ellipse'],
  ['text', 'Text']
] as const;

async function dragOnPane(page: Page, dx: number, dy: number) {
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2);
  await page.mouse.move(from.x + dx, from.y + dy);
  await page.mouse.up();
}

test.describe('a shape drawn on the canvas is one element @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  for (const [tool, label] of TOOLS) {
    test(`a ${tool} is one row in Layers, and clicking it selects the element`, async ({ page, session }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.getByRole('button', { name: 'Layers', exact: true }).click();
      const layers = page.getByTestId('layers');

      await pickBarTool(page, tool);
      await dragOnPane(page, 240, 120);
      const element = page.locator('[data-kind="element"][data-motion-node]');
      await expect(element).toHaveCount(1, { timeout: 10_000 });
      const id = await element.getAttribute('data-motion-node');

      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(layers.getByRole('treeitem')).toHaveCount(1, { timeout: 10_000 });
      await expect(layers.getByRole('treeitem')).toContainText(label);
      await expect(layers.getByTestId('layer-fold'), 'an element is not a frame to unfold').toHaveCount(0);

      await layers.getByRole('treeitem').click();
      await expect(layers.locator(`[data-layer="${id}"]`)).toHaveAttribute('aria-selected', 'true');
      await expect(layers.getByRole('treeitem')).toHaveCount(1);
    });
  }

  test('the Frame tool sits in the bar, and a drag makes one frame of the dragged size', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frameTool = await barTool(page, 'frame');
    await expect(frameTool).toBeVisible();

    await frameTool.click();
    const zoom = await page.evaluate(() => {
      const viewport = document.querySelector('.svelte-flow__viewport') as HTMLElement;
      return new DOMMatrix(getComputedStyle(viewport).transform).a;
    });
    await dragOnPane(page, 300, 200);

    await expect.poll(async () => (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null)).data?.length, { timeout: 10_000 }).toBe(1);
    const { data } = await admin.from('nodes').select('type, width, height, data').eq('canvas_id', session.canvasId).is('deleted_at', null);
    const [frame] = data!;
    expect(frame.type).toBe('motion');
    expect((frame.data as { kind?: string }).kind ?? 'frame').toBe('frame');
    expect(frame.width).toBeCloseTo(300 / zoom, 0);
    await expect(page.locator('[data-motion-node]')).toHaveCount(1);
  });
});
