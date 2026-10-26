import { homedir } from 'node:os';
import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const BOX_ID = 'box';
const BOX_SIZE = 0.3;
const BOX_AT = { x: 0.3, y: 0.5 };
const BARE_AT = { x: 0.85, y: 0.15 };
const DRAG_PX = { x: 120, y: 40 };
const SHOTS = `${homedir()}/Documents/feega-videos/e2e`;
const ROTATE_REACH_PX = 14;

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

type Rect = { x: number; y: number; width: number; height: number };

const near = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < 4 && Math.abs(a.y - b.y) < 4;

const cursorAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    return el ? getComputedStyle(el).cursor : '';
  }, [x, y]);

async function staleRings(page: Page, old: Rect): Promise<number> {
  const rings = await page.getByTestId('frame-pick-box').all();
  const boxes = await Promise.all(rings.map((r) => r.boundingBox()));
  return boxes.filter((b) => b && near(b, old)).length;
}

async function drag(page: Page, from: { x: number; y: number }, during?: () => Promise<void>) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + DRAG_PX.x / 2, from.y + DRAG_PX.y / 2, { steps: 10 });
  await during?.();
  await page.mouse.move(from.x + DRAG_PX.x, from.y + DRAG_PX.y, { steps: 10 });
  await page.mouse.up();
}

async function pointIn(stage: Locator, share: { x: number; y: number }) {
  const box = (await stage.boundingBox())!;
  return { x: box.x + box.width * share.x, y: box.y + box.height * share.y };
}

test.describe('hover ring and resize cursors @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('the purple ring never stays at the old place after a drag, and edges show resize cursors', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const stage = page.locator(`[data-testid="frame-overlays"] [data-frame="${node.id}"]`);
    await expect(stage).toBeVisible({ timeout: 20_000 });

    const grab = await pointIn(stage, { x: BOX_AT.x - BOX_SIZE / 4, y: BOX_AT.y });
    await expect(async () => {
      await page.mouse.move(grab.x - 2, grab.y);
      await page.mouse.click(grab.x, grab.y);
      await expect(page.getByTestId('frame-selection')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await page.mouse.move(grab.x + 1, grab.y);
    await expect(page.getByTestId('frame-pick-box')).toBeVisible();

    const sel = page.getByTestId('frame-selection');
    const before = (await sel.boundingBox())!;
    let during = -1;
    await drag(page, { x: before.x + before.width / 3, y: before.y + before.height / 2 }, async () => {
      during = await page.getByTestId('frame-pick-box').count();
      await page.screenshot({ path: `${SHOTS}/ring-element-during.png` });
    });
    expect(during, 'no hover ring while dragging').toBe(0);
    await expect.poll(async () => near((await sel.boundingBox())!, before), { timeout: 10_000 }).toBe(false);
    await page.mouse.move(before.x + before.width / 3 + DRAG_PX.x + 1, before.y + before.height / 2 + DRAG_PX.y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/ring-element-after.png` });
    expect(await staleRings(page, before), 'no ring at the old place').toBe(0);

    const now = (await sel.boundingBox())!;
    expect(await cursorAt(page, now.x + now.width, now.y + now.height / 2)).toBe('ew-resize');
    expect(await cursorAt(page, now.x + now.width / 2, now.y + now.height)).toBe('ns-resize');
    expect(await cursorAt(page, now.x + now.width / 3, now.y)).toBe('ns-resize');
    expect(await cursorAt(page, now.x + now.width, now.y + now.height)).toBe('nwse-resize');
    expect(await cursorAt(page, now.x + now.width, now.y)).toBe('nesw-resize');
    expect(await cursorAt(page, now.x + now.width + ROTATE_REACH_PX - 2, now.y + now.height + ROTATE_REACH_PX - 2)).toContain('url(');
    await page.mouse.move(now.x + now.width, now.y + now.height / 2);
    await page.screenshot({ path: `${SHOTS}/ring-element-cursor.png` });

    const frameBefore = (await stage.boundingBox())!;
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const bare = await pointIn(stage, BARE_AT);
    await drag(page, bare);
    await expect.poll(async () => near((await stage.boundingBox())!, frameBefore), { timeout: 10_000 }).toBe(false);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/ring-frame-after.png` });
    expect(await staleRings(page, now), 'no ring left behind when the frame moved').toBe(0);

    const frameNow = (await stage.boundingBox())!;
    await page.mouse.click(frameNow.x + frameNow.width * BARE_AT.x, frameNow.y + frameNow.height * BARE_AT.y);
    await page.mouse.move(frameNow.x + frameNow.width, frameNow.y + frameNow.height);
    await expect.poll(() => cursorAt(page, frameNow.x + frameNow.width, frameNow.y + frameNow.height), { timeout: 5000 }).toBe('nwse-resize');
    await page.screenshot({ path: `${SHOTS}/ring-frame-cursor.png` });
  });
});
