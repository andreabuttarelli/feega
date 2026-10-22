import type { Page } from '@playwright/test';
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

  test('a tile move, an element nudge and a tile move undo in reverse order', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const frame = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const tile = await seedNode({ type: 'motion', x: 200, y: 900, data: { format: '16:9', docHeadRevision: null, posterAssetId: null, lastRenderAssetId: null } });

    const shapeX = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1).single();
      return (data?.doc as typeof doc).tracks[0].clips[0].props.x;
    };
    const tileX = async () => {
      const { data } = await admin.from('nodes').select('x').eq('id', tile.id).single();
      return Number(data?.x);
    };
    const pane = page.locator('.svelte-flow__pane');
    const drag = async () => {
      await pane.click({ position: { x: 10, y: 10 } });
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
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(shapeX, { timeout: SAVED_MS }).not.toBe(START_X);
    const nudged = await shapeX();

    await drag();
    await expect.poll(tileX, { timeout: SAVED_MS }).toBeGreaterThan(firstTile);
    await shot(page, 'edited');

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(tileX, { timeout: SAVED_MS }).toBe(firstTile);
    expect(await shapeX()).toBe(nudged);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(shapeX, { timeout: SAVED_MS }).toBe(START_X);
    expect(await tileX()).toBe(firstTile);
    await shot(page, 'undone-frame');

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(tileX, { timeout: SAVED_MS }).toBe(startTile);

    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(tileX, { timeout: SAVED_MS }).toBe(firstTile);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(shapeX, { timeout: SAVED_MS }).toBe(nudged);
    await shot(page, 'redone');
  });
});
