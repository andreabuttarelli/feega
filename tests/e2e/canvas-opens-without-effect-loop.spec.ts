import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SETTLE_MS = 4000;
const LOOP = 'effect_update_depth_exceeded';
const SHOT = process.env.LOOP_SHOT;

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'label', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Buy now', size: 0.12, x: 0.5, y: 0.5, width: 0.6, height: 0.25 } }] }],
  comps: {},
  assets: []
};

test.describe('canvas opens without an effect loop @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('a canvas with a frame opens without effect_update_depth_exceeded', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack ?? ''}`));
    page.on('console', (m) => {
      if (m.type() === 'error') {
        errors.push(m.text());
      }
    });

    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    if (SHOT) {
      await page.screenshot({ path: SHOT });
    }

    expect(errors.filter((e) => e.includes(LOOP))).toEqual([]);
  });
});
