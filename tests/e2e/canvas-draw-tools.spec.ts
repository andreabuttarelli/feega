import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

type Clip = { id: string; component: string; props: Record<string, unknown> };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.describe('drawing inside a frame @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('rectangle, ellipse, text and pen tools create clips that save', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const clips = async (): Promise<Clip[]> => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
      const doc = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
      return doc?.tracks.flatMap((t) => t.clips) ?? [];
    };
    const shapes = async (shape: string) => (await clips()).filter((c) => c.component === 'Shape' && c.props.shape === shape).length;

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    const overlay = page.getByTestId('selection-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = (await overlay.boundingBox())!;
    const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

    async function drag(tool: string, from: { x: number; y: number }, to: { x: number; y: number }) {
      await page.getByTestId('draw-tools').locator(`[data-tool="${tool}"]`).click();
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
      await page.mouse.move(to.x, to.y);
      await page.mouse.up();
    }

    await drag('rectangle', at(0.3, 0.5), at(0.6, 0.7));
    await expect.poll(() => shapes('rect'), { timeout: 10_000 }).toBe(1);
    await expect(page.getByTestId('draw-tools').locator('[data-tool="select"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('editor-stage'), 'the frame keeps showing the live editor after a save').toHaveAttribute('data-shown', 'true');
    await shoot(page, '20-draw-rectangle');

    await drag('ellipse', at(0.65, 0.5), at(0.95, 0.7));
    await expect.poll(() => shapes('ellipse'), { timeout: 10_000 }).toBe(1);

    await drag('text', at(0.4, 0.75), at(0.9, 0.85));
    await expect.poll(async () => (await clips()).filter((c) => c.component === 'Text').length, { timeout: 10_000 }).toBe(1);

    await page.getByTestId('draw-tools').locator('[data-tool="pen"]').click();
    for (const [fx, fy] of [
      [0.2, 0.2],
      [0.8, 0.25],
      [0.5, 0.45]
    ]) {
      const p = at(fx, fy);
      await page.mouse.click(p.x, p.y);
    }
    const first = at(0.2, 0.2);
    await page.mouse.click(first.x, first.y);
    await expect.poll(() => shapes('path'), { timeout: 10_000 }).toBe(1);
    const path = (await clips()).find((c) => c.props.shape === 'path')!;
    expect(String(path.props.path)).toMatch(/Z$/i);
    await expect(page.getByTestId('editor-stage'), 'saves never hand the frame back to its stale picture').toHaveAttribute('data-shown', 'true');
    await shoot(page, '21-draw-pen');

    await page.getByTestId('edit-mode').locator('[data-mode="design"]').click();
    await expect(page.getByTestId('edit-mode').locator('[data-mode="design"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('section[aria-label="Timeline"]')).toHaveAttribute('inert', '');
    await shoot(page, '22-design-mode');
    await page.keyboard.press('e');
    await expect(page.getByTestId('edit-mode').locator('[data-mode="motion"]')).toHaveAttribute('aria-checked', 'true');
  });
});
