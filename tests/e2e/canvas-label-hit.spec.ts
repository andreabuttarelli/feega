import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { labelScale, labelZoomStep } from '../../src/lib/canvas/core/label-size';

const VIEWPORT = { width: 1440, height: 900 };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 480, height: 300 };
const FRAME_DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const ZOOMS = [0.1, 0.25, 0.5, 1, 2];
const ZOOM_TOLERANCE = 0.06;
const ZOOM_STEPS = 400;
const SETTLE_MS = 2000;
const DRAG_PX = { x: 60, y: 40 };
const MOVE_TOLERANCE_PX = 3;
const LABEL_LEADING = 1.3;
const LABEL_GAP_PAD = 6;
const LABEL_SIZE = 12;
const OUTSIDE_PX = 6;
const ICON_CENTRE_PX = 6;

type Point = { x: number; y: number };

const doc = {
  version: 5,
  fps: 30,
  width: 1600,
  height: 900,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }] }],
  comps: {},
  assets: []
};

async function zoomOf(page: Page): Promise<number> {
  return page.locator('.svelte-flow__viewport').first().evaluate((el) => Number(/scale\(([\d.]+)\)/.exec(el.getAttribute('style') ?? '')?.[1] ?? 1));
}

async function zoomAround(page: Page, at: Point, target: number) {
  await page.mouse.move(at.x, at.y);
  await page.keyboard.down('Control');
  for (let i = 0; i < ZOOM_STEPS; i++) {
    const z = await zoomOf(page);
    if (Math.abs(z - target) / target < ZOOM_TOLERANCE) {
      break;
    }
    await page.mouse.wheel(0, z < target ? -4 : 4);
  }
  await page.keyboard.up('Control');
  await page.waitForTimeout(SETTLE_MS);
}

async function drag(page: Page, from: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + DRAG_PX.x, from.y + DRAG_PX.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
}

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('a frame label is a grip for the frame at every zoom @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(300_000);

  test('dragging the visible label moves the frame, a hair above it does not', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: FRAME_AT.x, y: FRAME_AT.y, data: FRAME_DATA });
    await admin.from('nodes').update(FRAME_SIZE).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    for (const zoom of ZOOMS) {
      const centre = (await tile.boundingBox())!;
      await zoomAround(page, { x: centre.x + centre.width / 2, y: centre.y + centre.height / 2 }, zoom);
      const now = await zoomOf(page);
      const scale = labelScale(labelZoomStep(now)) * now;
      const before = (await tile.boundingBox())!;
      const bottom = before.y - LABEL_GAP_PAD * scale;
      const line = LABEL_SIZE * LABEL_LEADING * scale;
      const inside = { x: before.x + ICON_CENTRE_PX * scale, y: bottom - line / 2 };

      await drag(page, { x: inside.x, y: bottom - line - OUTSIDE_PX });
      const unmoved = (await tile.boundingBox())!;
      expect(Math.abs(unmoved.x - before.x), `zoom ${zoom}: a grab above the label leaves the frame`).toBeLessThanOrEqual(MOVE_TOLERANCE_PX);

      await drag(page, inside);
      const moved = (await tile.boundingBox())!;
      expect(Math.abs(moved.x - before.x - DRAG_PX.x), `zoom ${zoom}: x moved by the drag`).toBeLessThanOrEqual(MOVE_TOLERANCE_PX);
      expect(Math.abs(moved.y - before.y - DRAG_PX.y), `zoom ${zoom}: y moved by the drag`).toBeLessThanOrEqual(MOVE_TOLERANCE_PX);
    }
  });
});
