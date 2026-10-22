import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const RED = '#ff0000';
const GREEN = '#00ff00';

const frame = (text: string, styled: boolean) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 't', component: 'Text', from: 0, durationInFrames: 150, ...(styled ? { styleRef: 'Brand' } : {}), props: { text, size: 0.12, x: 0.5, y: 0.5, width: 0.6, height: 0.25, ...(styled ? { color: RED } : {}) } }] }],
  comps: {},
  assets: [],
  ...(styled ? { styles: { Brand: { kind: 'colour', color: RED } } } : {})
});

type Head = { tracks: { clips: { styleRef?: string; props: { color?: string } }[] }[] };

test.describe('styles shared by the frames of a canvas @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('a style from one frame applies in another, and editing it restyles both', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const data = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
    const a = await seedNode({ type: 'motion', x: 540, y: 80, data });
    const b = await seedNode({ type: 'motion', x: 80, y: 80, data });
    for (const [node, doc] of [
      [a, frame('Brand', true)],
      [b, frame('Other', false)]
    ] as const) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const hostA = page.locator(`[data-testid="frame-overlays"] [data-frame="${a.id}"]`);
    const hostB = page.locator(`[data-testid="frame-overlays"] [data-frame="${b.id}"]`);
    await expect(hostB).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const boxB = (await hostB.boundingBox())!;
    await page.mouse.click(boxB.x + 4, boxB.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2);

    const pick = page.getByTestId('clip-style');
    await expect(pick).toBeVisible({ timeout: 15_000 });
    await pick.selectOption('Brand');
    await page.waitForTimeout(SETTLE_MS);

    const boxA = (await hostA.boundingBox())!;
    await page.mouse.click(boxA.x + 4, boxA.y + 4);
    await expect(page.getByTestId('style-library')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('style-library-colour-Brand').fill(GREEN);
    await page.waitForTimeout(SETTLE_MS * 2);
    await page.screenshot({ path: `${SHOTS}/figD-styles-1-shared.png` });

    const head = async (nodeId: string) => {
      const { data: rows } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
      return (rows?.[0]?.doc as Head).tracks[0].clips[0];
    };
    for (const node of [a, b]) {
      await expect.poll(async () => (await head(node.id)).props.color, { timeout: 20_000 }).toBe(GREEN);
      expect((await head(node.id)).styleRef).toBe('Brand');
    }
  });
});
