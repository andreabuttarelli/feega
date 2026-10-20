import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const BOX_ID = 'box';
const BOX_SIZE = 0.3;
const BOX_AT = { x: 0.3, y: 0.5 };
const DRAG_PX = { x: 90, y: 30 };
const GRAB_SHARE = 0.25;
const CORNER_COUNT = 4;
const SETTLE_MS = 3000;
const EDGE_TOLERANCE_PX = 3;
const SHOTS = process.env.SHOT_PREFIX ?? '';

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: BOX_ID, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: BOX_AT.x, y: BOX_AT.y, width: BOX_SIZE, height: BOX_SIZE, fills: [{ type: 'solid', color: '#ff5a1f' }] } }] }],
  comps: {},
  assets: []
};

type Point = { x: number; y: number };

async function centres(handles: Locator): Promise<Point[]> {
  const boxes = await Promise.all((await handles.all()).map((h) => h.boundingBox()));
  return boxes.map((b) => ({ x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 }));
}

async function drag(page: Page, from: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + DRAG_PX.x, from.y + DRAG_PX.y, { steps: 20 });
  await page.mouse.up();
}

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

test.describe('selection handles follow a frame child @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('after a drag the corner dots sit on the moved shape', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const stage = page.locator(`[data-motion-node="${node.id}"] [data-frame-stage]`);
    await expect(stage).toBeVisible({ timeout: 20_000 });
    const stageBox = (await stage.boundingBox())!;
    const grab = { x: stageBox.x + stageBox.width * (BOX_AT.x - BOX_SIZE / 4), y: stageBox.y + stageBox.height * BOX_AT.y };
    await expect(async () => {
      await page.mouse.click(grab.x, grab.y);
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });

    const selected = (await page.getByTestId('selection-box').boundingBox())!;
    await shot(page, '0-selected');
    await drag(page, { x: selected.x + selected.width * GRAB_SHARE, y: selected.y + selected.height / 2 });
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, '1-moved');

    const moved = (await page.getByTestId('selection-box').boundingBox())!;
    expect(moved.x, 'the selection box moved').toBeGreaterThan(selected.x + EDGE_TOLERANCE_PX);

    const dots = await centres(page.getByTestId('corner-overlay').locator('[data-corner]'));
    expect(dots).toHaveLength(CORNER_COUNT);
    for (const d of dots) {
      expect(d.x, `corner dot at ${d.x},${d.y} sits inside the moved shape`).toBeGreaterThan(moved.x - EDGE_TOLERANCE_PX);
      expect(d.x).toBeLessThan(moved.x + moved.width + EDGE_TOLERANCE_PX);
      expect(d.y).toBeGreaterThan(moved.y - EDGE_TOLERANCE_PX);
      expect(d.y).toBeLessThan(moved.y + moved.height + EDGE_TOLERANCE_PX);
    }
  });
});
