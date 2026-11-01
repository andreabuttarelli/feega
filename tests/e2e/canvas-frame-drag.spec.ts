import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { landingDoc } from './fixtures/landing-frame-doc';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const VIEWPORT = { width: 1440, height: 900 };
const VISIBLE = { x: 60, y: 60, width: 1080, height: 520 };
const FRAME_AT = { x: 200, y: 200 };
const LANDING_SIZE = { width: 1440, height: 4734 };
const LANDING_DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const ZOOMS = [0.1, 0.25, 0.5, 1, 2];
const ZOOM_TOLERANCE = 0.06;
const ZOOM_STEPS = 400;
const SETTLE_MS = 3000;
const DRAG_PX = { x: 80, y: 50 };
const MOVE_TOLERANCE_PX = 3;
const EMPTY_SPOT = { x: 1380, y: 860 };

type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

const snap = (page: Page, name: string) => page.screenshot({ path: `${SHOTS_DIR}/frame-drag-${name}.png` });

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

function visibleCentre(r: Rect): Point {
  const x0 = Math.max(VISIBLE.x, r.x);
  const y0 = Math.max(VISIBLE.y, r.y);
  const x1 = Math.min(VISIBLE.x + VISIBLE.width, r.x + r.width);
  const y1 = Math.min(VISIBLE.y + VISIBLE.height, r.y + r.height);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

async function drag(page: Page, from: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + DRAG_PX.x, from.y + DRAG_PX.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
}

function expectMoved(after: Rect, before: Rect, label: string) {
  expect(Math.abs(after.x - before.x - DRAG_PX.x), `${label}: x moved by the drag`).toBeLessThanOrEqual(MOVE_TOLERANCE_PX);
  expect(Math.abs(after.y - before.y - DRAG_PX.y), `${label}: y moved by the drag`).toBeLessThanOrEqual(MOVE_TOLERANCE_PX);
}

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('a selected frame moves whole when dragged from inside @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(300_000);

  test('frame selezionato + trascinamento dentro = si muove il frame, il figlio resta', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: FRAME_AT.x, y: FRAME_AT.y, data: LANDING_DATA });
    await admin.from('nodes').update(LANDING_SIZE).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: landingDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const unselected = (await tile.boundingBox())!;
    await page.mouse.click(visibleCentre(unselected).x, visibleCentre(unselected).y);
    await page.waitForTimeout(SETTLE_MS);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByTestId('frame-selection'), 'Escape leaves the frame selected whole').toHaveCount(0);

    for (const zoom of ZOOMS) {
      await zoomAround(page, visibleCentre((await tile.boundingBox())!), zoom);
      const before = (await tile.boundingBox())!;
      await drag(page, visibleCentre(before));
      await page.mouse.move(EMPTY_SPOT.x, EMPTY_SPOT.y);
      await snap(page, `zoom-${zoom}`);
      expectMoved((await tile.boundingBox())!, before, `zoom ${zoom}`);
      await expect(page.getByTestId('frame-selection'), `zoom ${zoom}: no child picked`).toHaveCount(0);
    }

    const { count } = await admin.from('motion_revisions').select('id', { count: 'exact', head: true }).eq('node_id', node.id);
    expect(count, 'no child moved inside the page').toBe(1);

    const box = (await tile.boundingBox())!;
    await page.mouse.click(visibleCentre(box).x, visibleCentre(box).y);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByTestId('frame-selection'), 'a plain click on a selected frame still picks the child').toHaveCount(1);
  });
});
