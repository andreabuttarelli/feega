import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const SAVED_MS = 20_000;
const PHONE = { width: 393, height: 852 };
const shape = (id: string, x: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.3, height: 0.3, fills: [{ type: 'solid', color }] } });
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [
    { id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('a', 0.45, '#ff5a1f')] },
    { id: 'v2', kind: 'visual', name: 'Video 2', clips: [shape('b', 0.5, '#1f5aff')] },
    { id: 'v3', kind: 'visual', name: 'Video 3', clips: [shape('c', 0.55, '#1fff5a')] }
  ],
  comps: {},
  assets: []
};

test.describe('frame structure: presets, plus beside, layer menu @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('the preset resizes the frame, the plus adds a same-size frame, right-click lists the stack', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const tiles = page.getByTestId('gpu-node');
    const before = await tiles.count();
    const centre = { x: r.x + r.width / 2, y: r.y + r.height / 2 };

    await page.mouse.click(centre.x, centre.y, { button: 'right' });
    const menu = page.getByTestId('canvas-menu');
    await expect(menu.locator('[data-layer]')).toHaveCount(3, { timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_PREFIX}-se12-menu.png` });
    await menu.locator('[data-layer]').last().click();
    await expect(page.locator('[data-layer="c"].selected')).toHaveCount(1, { timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_PREFIX}-se12-picked.png` });
    await page.keyboard.press('Escape');

    const tile = (await frame.boundingBox())!;
    await page.mouse.move(tile.x + 5, tile.y + 5);
    await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2, { steps: 8 });
    const plus = page.getByTestId('add-frame-beside');
    await expect(plus).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_PREFIX}-st03-plus.png` });
    const p = (await plus.boundingBox())!;
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2, { steps: 6 });
    await page.mouse.click(p.x + p.width / 2, p.y + p.height / 2);
    await expect(tiles).toHaveCount(before + 1, { timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_PREFIX}-st03-added.png` });
    await page.keyboard.press('Escape');

    const preset = page.getByTestId('frame-preset');
    await expect(preset).toBeVisible({ timeout: 15_000 });
    await preset.selectOption('phone');
    await expect(preset).toHaveValue('phone');
    const added = page.locator(`[data-testid=gpu-node]:not([data-id="${node.id}"])`);
    await expect.poll(async () => { const b = (await added.boundingBox())!; return b.height / b.width; }, { timeout: SAVED_MS }).toBeCloseTo(PHONE.height / PHONE.width, 1);
    await page.screenshot({ path: `${SHOT_PREFIX}-st02-phone.png` });
  });

  test('the frame tool inside a frame draws a nested frame that clips its content', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      localStorage.setItem('feega.frame-edit-mode', 'design');
      localStorage.setItem('feega:canvas-bar-mode', 'design');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const nested = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      const clips = (data?.doc as { tracks: { clips: { id: string; component: string; clipContent?: boolean; props: Record<string, unknown> }[] }[] }).tracks.flatMap((t) => t.clips);
      return clips.filter((c) => c.clipContent === true && c.component === 'Shape').length;
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const corner = { x: r.x + r.width * 0.05, y: r.y + r.height * 0.1 };
    await page.mouse.click(corner.x, corner.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.dblclick(corner.x, corner.y);
    await page.getByTestId('draw-tools').locator('[data-tool="frame"]').click();
    const from = { x: r.x + r.width * 0.1, y: r.y + r.height * 0.15 };
    const to = { x: r.x + r.width * 0.4, y: r.y + r.height * 0.45 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();
    await expect.poll(nested, { timeout: SAVED_MS }).toBe(1);
    await page.screenshot({ path: `${SHOT_PREFIX}-st01-nested.png` });
  });
});
