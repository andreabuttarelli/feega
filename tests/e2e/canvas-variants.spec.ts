import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;

const label = (text: string) => ({ id: 'label', component: 'Text', from: 0, durationInFrames: 150, props: { text, size: 0.12, x: 0.5, y: 0.5, width: 0.6, height: 0.25 } });
const main = (state: string, text: string) => ({ name: 'Button', durationInFrames: 150, component: { name: 'Button', set: 'main', variant: { State: state } }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [label(text)] }] });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'button', component: 'Precomp', from: 0, durationInFrames: 150, props: { comp: 'main' } }] }],
  comps: { main: main('Default', 'Buy now'), hover: main('Hover', 'Hovered') },
  assets: []
};

type Head = { tracks: { clips: { props: { comp?: string } }[] }[] };

test.describe('variants inside a canvas frame @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('picking a variant in Properties swaps the instance', async ({ page, session, admin, seedNode }) => {
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

    const variant = page.getByTestId('instance-variant');
    await expect(variant).toBeVisible({ timeout: 15_000 });
    await variant.selectOption('Hover');
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/figD-variants-1-hover.png` });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    expect((data?.[0]?.doc as Head).tracks[0].clips[0].props.comp).toBe('hover');
  });
});
