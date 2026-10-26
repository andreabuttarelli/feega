import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_TEXT_SHOTS ?? '/tmp';
const SETTLE_MS = 2500;
const TYPED = 'Ciao dal canvas';

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'title', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Hello world', size: 0.12, x: 0.5, y: 0.5, width: 0.7, height: 0.25 } }] }],
  comps: {},
  assets: []
};

type Head = { tracks: { clips: { props: Record<string, number | string> }[] }[] };

test.describe('typing a text over a core frame @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('double-click opens the caret over the text and Esc saves it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const before = (await host.boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/text-edit-1-before.png` });

    await page.mouse.dblclick(before.x + before.width / 2, before.y + before.height / 2);
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(TYPED, { delay: 60 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/text-edit-2-during.png` });
    const during = (await host.boundingBox())!;
    expect(Math.abs(during.width - before.width)).toBeLessThan(1);

    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/text-edit-3-after.png` });
    const after = (await host.boundingBox())!;
    expect(Math.abs(after.width - before.width)).toBeLessThan(1);
    expect(Math.abs(after.height - before.height)).toBeLessThan(1);

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    expect((data?.[0]?.doc as Head).tracks[0].clips[0].props.text).toBe(TYPED);
  });
});
