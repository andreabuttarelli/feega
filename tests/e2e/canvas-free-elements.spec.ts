import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';

const SHOTS = process.env.CANVAS_MOTION_SHOTS;

type Clip = { id: string; component: string; props: Record<string, unknown> };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.describe('free elements on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a box drawn on the empty canvas is a chromeless element that opens on its properties and undoes away', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    const elements = async () => {
      const { data } = await admin.from('nodes').select('id, type, data, width, height').eq('canvas_id', session.canvasId).is('deleted_at', null);
      return (data ?? []).filter((n) => (n.data as { kind?: string }).kind === 'element');
    };
    const clipsOf = async (nodeId: string): Promise<Clip[]> => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
      const doc = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
      return doc?.tracks.flatMap((t) => t.clips) ?? [];
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const bar = page.getByTestId('add-bar');
    await expect(bar).toHaveAttribute('data-context', 'canvas');
    await bar.getByTestId('draw-tools').locator('[data-tool="rectangle"]').click();
    await expect(page.getByTestId('canvas-draw')).toBeVisible();
    await shoot(page, '1-draw-tools-on-canvas');

    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
    const to = { x: from.x + 240, y: from.y + 120 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 120, from.y + 60);
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();

    await expect.poll(async () => (await elements()).length, { timeout: 10_000 }).toBe(1);
    const [element] = await elements();
    expect((await clipsOf(element.id)).map((c) => [c.component, c.props.shape])).toEqual([['Shape', 'rect']]);
    expect(element.width! / element.height!).toBeCloseTo(2, 1);
    await expect(page.getByTestId('canvas-draw'), 'one shape per pick, then back to select').toHaveCount(0);

    const node = page.locator(`[data-motion-node="${element.id}"]`);
    await expect(node).toHaveAttribute('data-kind', 'element');
    await expect(node.getByText('Open editor')).toHaveCount(0);
    const tile = page.locator('.svelte-flow__node', { has: node });
    await expect(tile.locator('.node-label'), 'a shape has no name tag').toHaveCount(0);
    await expect(tile.locator('.typed-port'), 'a shape has no ports').toHaveCount(0);
    await expect(page.getByTestId('motion-editor'), 'the new element opens on its properties').toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
    await expect(page.locator('aside.props').getByTestId('selection-head'), 'the inspector of frames, on the shape').toContainText('Shape', { timeout: 10_000 });
    await expect(page.locator('aside.props').getByTestId('selection-head')).toBeVisible();
    await shoot(page, '2-element-editing');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(bar).toHaveAttribute('data-context', 'canvas', { timeout: 10_000 });
    await page.mouse.click(pane.x + 20, pane.y + pane.height - 120);
    await expect(node.getByTestId('motion-node-poster'), 'a see-through poster replaces the live picture').toBeVisible({ timeout: 20_000 });
    await shoot(page, '3-element-poster');

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await elements()).length, { timeout: 10_000 }).toBe(0);
    await shoot(page, '4-undone');
  });
});
