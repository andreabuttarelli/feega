import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        {
          id: 'box',
          component: 'Shape',
          from: 0,
          durationInFrames: 150,
          props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.5, height: 0.5, fills: [{ type: 'linear-gradient', angle: 0, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 1 }] }] }
        }
      ]
    }
  ],
  comps: {},
  assets: []
};

type Head = { tracks: { clips: { props: { fills: { angle: number }[] } }[] }[] };

test.describe('gradient handles on the canvas @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('dragging the end handle down turns a linear gradient', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const end = page.getByTestId('gradient-end');
    await expect(end).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/figD-gradient-1-handles.png` });
    const at = (await end.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(centre.x, centre.y + 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/figD-gradient-2-turned.png` });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    expect((data?.[0]?.doc as Head).tracks[0].clips[0].props.fills[0].angle).toBeCloseTo(90, 0);
  });
});
