import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const SAVED_MS = 25_000;
const shape = (id: string, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.3, height: 0.3, fills: [{ type: 'solid', color }] } });
const docWith = (clips: ReturnType<typeof shape>[]) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips }],
  comps: {},
  assets: []
});

test.describe('paste into several frames @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('one copied element lands in each of the selected frames', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const data = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
    const source = await seedNode({ type: 'motion', x: 0, y: 0, data });
    const first = await seedNode({ type: 'motion', x: 0, y: 300, data });
    const second = await seedNode({ type: 'motion', x: 460, y: 300, data });
    const docs = [[source, docWith([shape('s', '#ff5a1f')])], [first, docWith([])], [second, docWith([])]] as const;
    for (const [node, doc] of docs) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    const countIn = async (id: string) => {
      const { data: rows } = await admin.from('motion_revisions').select('doc').eq('node_id', id).order('version', { ascending: false }).limit(1).single();
      return (rows?.doc as ReturnType<typeof docWith>).tracks.flatMap((t) => t.clips).length;
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const centre = async (id: string, down = 0.5) => {
      const b = (await page.locator(`[data-frame="${id}"]`).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height * down };
    };

    const s = await centre(source.id);
    await page.mouse.click(s.x, s.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(s.x, s.y);
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    const a = await centre(first.id, 0.2);
    const b = await centre(second.id, 0.2);
    await page.mouse.click(a.x, a.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(b.x, b.y);
    await page.keyboard.up('Shift');
    await page.screenshot({ path: `${SHOT_PREFIX}-se08-selected.png` });
    await page.keyboard.press('ControlOrMeta+v');

    await expect.poll(() => countIn(first.id), { timeout: SAVED_MS }).toBe(1);
    await expect.poll(() => countIn(second.id), { timeout: SAVED_MS }).toBe(1);
    await page.screenshot({ path: `${SHOT_PREFIX}-se08-pasted.png` });
  });
});
