import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const SAVED_MS = 25_000;
const WIDTH = 1920;
const SIDE = 0.1;
const GAP_PX = 60;
const shape = (id: string, x: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: SIDE, height: 0.2, fills: [{ type: 'solid', color }] } });
const doc = {
  version: 5,
  fps: 30,
  width: WIDTH,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('a', 0.2, '#ff5a1f'), shape('b', 0.45, '#1f5aff'), shape('c', 0.8, '#1fff5a')] }],
  comps: {},
  assets: []
};

test.describe('smart selection spacing @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('the spacing field sets the same gap between three selected layers', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const gaps = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      const xs = (data?.doc as { tracks: { clips: { props: { x: number }; transform?: { x?: number } }[] }[] }).tracks[0].clips.map((c) => c.props.x + (c.transform?.x ?? 0)).sort((p, q) => p - q);
      return xs.slice(1).map((x, i) => Math.round((x - xs[i] - SIDE) * WIDTH));
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await page.locator(`[data-frame="${node.id}"]`).boundingBox())!;
    const on = (x: number) => ({ x: r.x + r.width * x, y: r.y + r.height / 2 });
    await page.mouse.click(on(0.2).x, on(0.2).y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(on(0.2).x, on(0.2).y);
    await page.keyboard.press('ControlOrMeta+a');

    const field = page.locator('[data-prop="gap-x"] input');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_PREFIX}-se10-before.png` });
    await field.fill(String(GAP_PX));
    await field.press('Enter');
    await field.blur();
    await expect.poll(gaps, { timeout: SAVED_MS }).toEqual([GAP_PX, GAP_PX]);
    await page.screenshot({ path: `${SHOT_PREFIX}-se10-after.png` });
  });
});
