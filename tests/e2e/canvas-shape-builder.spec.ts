import type { Page } from '@playwright/test';
import { barTool, pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/shots';

const SETTLE_MS = 2500;

const rect = (id: string, x: number, color: string) => ({
  id,
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  props: { shape: 'rect', x, y: 0.5, width: 0.3, height: 0.4, fills: [{ type: 'solid', color }], fill: color }
});

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [
    { id: 'v1', kind: 'visual', name: 'Video 1', clips: [rect('a', 0.35, '#ff5a1f')] },
    { id: 'v2', kind: 'visual', name: 'Video 2', clips: [rect('b', 0.55, '#1f5aff')] }
  ],
  comps: {},
  assets: []
};

type Clip = { id: string; props: Record<string, unknown> };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS_DIR}/vec-shape-builder-${name}.png` });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('feega.frame-edit-mode', 'design'));
});

test.describe('shape builder @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('click merges regions, alt-click drops one', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation: 0 } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const box = (await frame.boundingBox())!;
    const at = (u: number, v: number) => ({ x: box.x + box.width * u, y: box.y + box.height * v });
    const clips = async (): Promise<Clip[]> => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      return (data!.doc as typeof doc).tracks.flatMap((t) => t.clips) as unknown as Clip[];
    };

    const onlyA = at(0.25, 0.5);
    const overlap = at(0.45, 0.5);
    const onlyB = at(0.65, 0.5);
    await page.mouse.click(onlyA.x, onlyA.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(onlyA.x, onlyA.y);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
    await page.keyboard.down('Shift');
    await page.mouse.click(onlyB.x, onlyB.y);
    await page.keyboard.up('Shift');
    await expect(page.getByTestId('frame-selection')).toHaveCount(2, { timeout: 15_000 });

    await barTool(page, 'shape-builder');
    await shot(page, 'selected');
    await pickBarTool(page, 'shape-builder');
    const overlay = page.getByTestId('shape-builder-overlay');
    await expect(overlay).toHaveCount(1);
    await expect(overlay.locator('.region')).toHaveCount(3);
    await page.mouse.move(overlap.x, overlap.y, { steps: 4 });
    await expect(overlay.locator('.region[data-state="hover"]')).toHaveAttribute('data-members', /^(a\+b|b\+a)$/);
    await shot(page, 'hover');

    await page.mouse.click(onlyA.x, onlyA.y);
    await page.mouse.click(overlap.x, overlap.y);
    await page.keyboard.down('Alt');
    await page.mouse.click(onlyB.x, onlyB.y);
    await page.keyboard.up('Alt');
    await expect(overlay.locator('.region[data-state="merge"]')).toHaveCount(2);
    await expect(overlay.locator('.region[data-state="cut"]')).toHaveCount(1);
    await shot(page, 'picked');

    await page.keyboard.press('Enter');
    await expect(overlay).toHaveCount(0);
    await expect.poll(async () => (await clips()).map((c) => c.id).sort().join(), { timeout: 30_000 }).not.toBe('a,b');
    const built = await clips();
    expect(built).toHaveLength(1);
    expect(built[0].props.shape).toBe('path');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'built');
  });
});
