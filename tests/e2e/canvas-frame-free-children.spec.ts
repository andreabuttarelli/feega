import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const BOX_ID = 'box';
const BOX_SIZE = 0.3;
const BOX_AT = { x: 0.3, y: 0.5 };
const BARE_AT = { x: 0.85, y: 0.15 };
const DRAG_PX = { x: 90, y: 30 };
const GRAB_SHARE = 0.25;
const MOVED_MIN = 0.03;
const FRAME_MOVED_MIN_PX = 20;

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

type Clip = { id: string; props: { x: number; y: number }; transform?: { x?: number; y?: number } };
type Head = { tracks: { clips: Clip[] }[] };
type Point = { x: number; y: number };

async function boxAt(admin: SupabaseClient, nodeId: string): Promise<Point | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const clip = (data?.[0]?.doc as Head | undefined)?.tracks.flatMap((t) => t.clips).find((c) => c.id === BOX_ID);
  return clip ? { x: clip.props.x + (clip.transform?.x ?? 0), y: clip.props.y + (clip.transform?.y ?? 0) } : null;
}

const framePosition = async (admin: SupabaseClient, nodeId: string) => (await admin.from('nodes').select('x, y').eq('id', nodeId).single()).data as Point;

async function pointIn(stage: Locator, share: Point): Promise<Point> {
  const box = (await stage.boundingBox())!;
  return { x: box.x + box.width * share.x, y: box.y + box.height * share.y };
}

async function dragFrom(page: Page, from: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + DRAG_PX.x, from.y + DRAG_PX.y, { steps: 20 });
  await page.mouse.up();
}

test.describe('children of a frame are free on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a click picks the child, a drag moves it, bare background moves the frame, Delete removes the child', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const stage = page.locator(`[data-motion-node="${node.id}"] [data-frame-stage]`);
    await expect(stage).toBeVisible({ timeout: 20_000 });

    const grab = await pointIn(stage, { x: BOX_AT.x - BOX_SIZE / 4, y: BOX_AT.y });
    await expect(async () => {
      await page.mouse.click(grab.x, grab.y);
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });

    const frameBefore = await framePosition(admin, node.id);
    const selectedBox = (await page.getByTestId('selection-box').boundingBox())!;
    await dragFrom(page, { x: selectedBox.x + selectedBox.width * GRAB_SHARE, y: selectedBox.y + selectedBox.height / 2 });
    await expect.poll(async () => (await boxAt(admin, node.id))?.x ?? 0, { timeout: 15_000, message: 'the child moved inside the frame' }).toBeGreaterThan(BOX_AT.x + MOVED_MIN);
    expect(await framePosition(admin, node.id), 'the frame stayed where it was').toEqual(frameBefore);

    const bare = await pointIn(stage, BARE_AT);
    await dragFrom(page, bare);
    await expect
      .poll(async () => Math.hypot((await framePosition(admin, node.id)).x - frameBefore.x, (await framePosition(admin, node.id)).y - frameBefore.y), { timeout: 15_000, message: 'the frame moved when dragged by its bare background' })
      .toBeGreaterThan(FRAME_MOVED_MIN_PX);

    const child = await boxAt(admin, node.id);
    const again = await pointIn(stage, { x: child!.x - BOX_SIZE / 4, y: child!.y });
    await page.mouse.click(again.x, again.y);
    await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Delete');
    await expect.poll(() => boxAt(admin, node.id), { timeout: 15_000, message: 'Delete removed the selected child' }).toBeNull();
  });
});
