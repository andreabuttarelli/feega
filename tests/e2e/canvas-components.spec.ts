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
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'label', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Buy now', size: 0.12, x: 0.5, y: 0.5, width: 0.6, height: 0.25 } }] }],
  comps: {},
  assets: []
};

type Clip = { component: string; props: { comp?: string; overrides?: Record<string, { text?: string }> } };
type Head = { tracks: { clips: Clip[] }[]; comps: Record<string, { component?: { name: string } }> };

test.describe('components inside a canvas frame @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('⌥⌘K makes a component, its instance takes a text override', async ({ page, session, admin, seedNode }) => {
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
    await expect(page.getByTestId('frame-selection').first()).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Alt+Meta+k');
    const inspector = page.getByTestId('instance-inspector');
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('instance-text').fill('Sold out');
    await page.getByTestId('instance-text').press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/figD-components-1-instance.png` });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const head = data?.[0]?.doc as Head;
    const instance = head.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
    expect(head.comps[instance.props.comp!].component?.name).toBe('Component 1');
    expect(instance.props.overrides?.label?.text).toBe('Sold out');
  });
});
