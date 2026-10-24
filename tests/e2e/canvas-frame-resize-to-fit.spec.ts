import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const SAVED_MS = 20_000;
const FIT_WIDTH = 0.4;
const shape = (id: string, x: number, color: string, extra: Record<string, unknown> = {}) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', ...extra, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.3, fills: [{ type: 'solid', color }] } });
const box = { ...shape('box', 0.5, '#2a2a2a'), props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.9, height: 0.9, fills: [{ type: 'solid', color: '#2a2a2a' }] } };
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [
    { id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('a', 0.4, '#ff5a1f', { parent: 'box' }), shape('b', 0.6, '#1f5aff', { parent: 'box' })] },
    { id: 'v2', kind: 'visual', name: 'Video 2', clips: [box] }
  ],
  comps: {},
  assets: []
};

test.describe('resize to fit @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('the shortcut shrinks a frame to its children', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const boxWidth = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      const clips = (data?.doc as typeof doc).tracks.flatMap((t) => t.clips);
      return clips.find((c) => c.id === 'box')!.props.width as number;
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const edge = { x: r.x + r.width * 0.07, y: r.y + r.height * 0.5 };
    await page.mouse.click(edge.x, edge.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(edge.x, edge.y);
    await expect(page.getByTestId('frame-selection')).toHaveAttribute('data-clip', 'box', { timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_PREFIX}-st06-before.png` });

    await page.keyboard.press('ControlOrMeta+Alt+Shift+r');
    await expect.poll(boxWidth, { timeout: SAVED_MS }).toBeCloseTo(FIT_WIDTH, 2);
    await page.screenshot({ path: `${SHOT_PREFIX}-st06-after.png` });
  });
});
