import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const BOX_ID = 'box';
const BOX_SIZE = 0.4;
const START = { x: 0.35, y: 0.5 };
const DRAG_PX = { x: 120, y: 40 };
const GRAB_OFFSET_PX = 50;
const SETTLE_MS = 3_000;
const SAMPLE_EVERY_MS = 100;
const WATCH_SAMPLES = 25;
const JUMP_TOLERANCE_PX = 3;
const DROP_TOLERANCE_PX = 12;
const POSITION_TOLERANCE = 0.05;
const ORANGE_SHARE_MIN = 0.5;
const PATCH_PX = 6;
const EDGE_INSET = 0.03;

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: BOX_ID, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: START.x, y: START.y, width: BOX_SIZE, height: BOX_SIZE, fills: [{ type: 'solid', color: '#ff5a1f' }] } }] }],
  comps: {},
  assets: []
};

type Clip = { id: string; props: { x: number; y: number }; transform?: { x?: number; y?: number } };
type Head = { tracks: { clips: Clip[] }[] };
type Point = { x: number; y: number };

async function boxAt(admin: SupabaseClient, nodeId: string): Promise<Point | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const clip = (data?.[0]?.doc as Head | undefined)?.tracks.flatMap((t) => t.clips).find((c) => c.id === BOX_ID);
  return clip ? { x: clip.props.x + (clip.transform?.x ?? 0), y: clip.props.y + (clip.transform?.y ?? 0) } : null;
}

const framePosition = async (admin: SupabaseClient, nodeId: string) => (await admin.from('nodes').select('x, y').eq('id', nodeId).single()).data;

async function centre(target: Locator): Promise<Point> {
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function selectBox(page: Page, stage: Locator) {
  const stageBox = (await stage.boundingBox())!;
  const point = { x: stageBox.x + stageBox.width * START.x, y: stageBox.y + stageBox.height * START.y };
  await expect(async () => {
    await page.mouse.dblclick(point.x, point.y);
    await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

async function dragSelection(page: Page): Promise<Point> {
  await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
  const middle = await centre(page.getByTestId('selection-box'));
  const from = { x: middle.x - GRAB_OFFSET_PX, y: middle.y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + DRAG_PX.x, from.y + DRAG_PX.y, { steps: 20 });
  await page.mouse.up();
  return { x: middle.x + DRAG_PX.x, y: middle.y + DRAG_PX.y };
}

async function orangeShare(page: Page, at: Point): Promise<number> {
  const clip = { x: at.x - PATCH_PX / 2, y: at.y - PATCH_PX / 2, width: PATCH_PX, height: PATCH_PX };
  const { data, info } = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let orange = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] > 50 && data[i + 1] < 140 && data[i + 2] < 90) {
      orange += 1;
    }
  }
  return orange / (info.width * info.height);
}

const emptyCanvasPoint = (page: Page) =>
  page.evaluate(() => {
    for (let y = 60; y < innerHeight; y += 20) {
      for (let x = 80; x < innerWidth; x += 20) {
        if (document.elementFromPoint(x, y)?.classList.contains('svelte-flow__pane')) {
          return { x, y };
        }
      }
    }
    return null;
  });

test.describe('moving a box inside a frame @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a dragged box stays where it was dropped, in the editor, on the closed tile and after a reload', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const canvas = `/p/${session.projectId}/c/${session.canvasId}`;
    await gotoHydrated(page, canvas);
    const stage = page.locator(`[data-motion-node="${node.id}"] [data-frame-stage]`);
    await expect(stage).toBeVisible({ timeout: 20_000 });
    const frameBefore = await framePosition(admin, node.id);
    const stageBox = (await stage.boundingBox())!;
    const at = (share: Point): Point => ({ x: stageBox.x + stageBox.width * share.x, y: stageBox.y + stageBox.height * share.y });
    const moved = { x: START.x + DRAG_PX.x / stageBox.width, y: START.y + DRAG_PX.y / stageBox.height };
    const oldOnly = at({ x: START.x - BOX_SIZE / 2 + EDGE_INSET, y: START.y });
    const newOnly = at({ x: moved.x + BOX_SIZE / 2 - EDGE_INSET, y: moved.y });

    await selectBox(page, stage);
    const dropped = await dragSelection(page);

    const first = await centre(page.getByTestId('selection-box'));
    expect(Math.hypot(first.x - dropped.x, first.y - dropped.y), 'the box lands near the cursor').toBeLessThanOrEqual(DROP_TOLERANCE_PX);
    for (let waited = 0; waited < SETTLE_MS; waited += SAMPLE_EVERY_MS) {
      const now = await centre(page.getByTestId('selection-box'));
      expect(Math.hypot(now.x - first.x, now.y - first.y), `the box went back after ${waited} ms`).toBeLessThanOrEqual(JUMP_TOLERANCE_PX);
      await page.waitForTimeout(SAMPLE_EVERY_MS);
    }

    const empty = (await emptyCanvasPoint(page))!;
    await page.mouse.click(empty.x, empty.y);
    await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: 10_000 });
    for (let i = 0; i < WATCH_SAMPLES; i++) {
      expect(await orangeShare(page, newOnly), `the closed tile misses the box at its new place, sample ${i}`).toBeGreaterThan(ORANGE_SHARE_MIN);
      expect(await orangeShare(page, oldOnly), `the closed tile shows the box at its old place, sample ${i}`).toBeLessThan(ORANGE_SHARE_MIN);
      await page.waitForTimeout(SAMPLE_EVERY_MS);
    }

    await expect.poll(async () => (await boxAt(admin, node.id))?.x ?? 0, { timeout: 10_000, message: 'the move is saved' }).toBeGreaterThan(START.x + POSITION_TOLERANCE);
    const saved = (await boxAt(admin, node.id))!;
    expect(Math.abs(saved.x - moved.x)).toBeLessThan(POSITION_TOLERANCE);
    expect(Math.abs(saved.y - moved.y)).toBeLessThan(POSITION_TOLERANCE);
    expect(await framePosition(admin, node.id), 'the frame did not move with its box').toEqual(frameBefore);

    await gotoHydrated(page, canvas);
    await expect(stage).toBeVisible({ timeout: 20_000 });
    expect(await boxAt(admin, node.id)).toEqual(saved);
    await expect.poll(() => orangeShare(page, newOnly), { timeout: 15_000, message: 'the reloaded tile shows the box where it was dropped' }).toBeGreaterThan(ORANGE_SHARE_MIN);
    expect(await orangeShare(page, oldOnly)).toBeLessThan(ORANGE_SHARE_MIN);
  });
});
