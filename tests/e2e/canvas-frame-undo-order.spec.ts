import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHOT_PREFIX ?? '';
const SETTLE_MS = 2500;
const SAVED_MS = 20_000;
const START_X = 0.3;
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: START_X, y: 0.5, width: 0.2, height: 0.3, fills: [{ type: 'solid', color: '#ff5a1f' }] } }] }],
  comps: {},
  assets: []
};

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

test.describe('one undo history across the canvas and frames @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('a tile move, an element delete and a tile move undo in reverse order', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const frame = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const tile = await seedNode({ type: 'motion', x: 1100, y: 150, data: { format: '16:9', docHeadRevision: null, posterAssetId: null, lastRenderAssetId: null } });

    const clips = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1).single();
      return (data?.doc as typeof doc).tracks.flatMap((t) => t.clips).length;
    };
    const tileX = async () => {
      const { data } = await admin.from('nodes').select('x').eq('id', tile.id).single();
      return Number(data?.x);
    };
    const pane = page.locator('.svelte-flow__pane');
    const drag = async () => {
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await pane.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
      const box = (await page.locator(`[data-motion-node="${tile.id}"]`).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
      await page.mouse.up();
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const startTile = await tileX();

    await drag();
    await expect.poll(tileX, { timeout: SAVED_MS }).toBeGreaterThan(startTile);
    const firstTile = await tileX();

    await pane.click({ position: { x: 10, y: 10 } });
    const r = (await page.locator(`[data-frame="${frame.id}"]`).boundingBox())!;
    const shape = { x: r.x + r.width * START_X, y: r.y + r.height / 2 };
    await page.mouse.click(shape.x, shape.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(shape.x, shape.y);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
    await page.keyboard.press('Delete');
    await expect.poll(clips, { timeout: SAVED_MS }).toBe(0);

    await shot(page, 'deleted');
    await drag();
    await shot(page, 'dragged-again');
    await expect.poll(tileX, { timeout: SAVED_MS }).toBeGreaterThan(firstTile);
    await shot(page, 'edited');

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(tileX, { timeout: SAVED_MS }).toBe(firstTile);
    expect(await clips()).toBe(0);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(clips, { timeout: SAVED_MS }).toBe(1);
    expect(await tileX()).toBe(firstTile);
    await shot(page, 'undone-frame');

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(tileX, { timeout: SAVED_MS }).toBe(startTile);

    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(tileX, { timeout: SAVED_MS }).toBe(firstTile);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(clips, { timeout: SAVED_MS }).toBe(0);
    await shot(page, 'redone');
  });

  test('a box drawn on the canvas undoes in one step and redoes in one', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const live = async () => {
      const { data } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null);
      return (data ?? []).length;
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pickBarTool(page, 'rectangle');
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const from = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * 0.3 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 100, from.y + 60);
    await page.mouse.move(from.x + 200, from.y + 120);
    await page.mouse.up();
    await expect.poll(live, { timeout: SAVED_MS }).toBe(1);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'inserted');

    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(live, { timeout: SAVED_MS }).toBe(0);
    await shot(page, 'insert-undone');

    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(live, { timeout: SAVED_MS }).toBe(1);
  });
});
