import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const WORD = 5;

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

type Head = { tracks: { clips: { props: { runs?: unknown } }[] }[] };

test.describe('rich text in a canvas frame @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('a selected word turns bold and red, and the range is saved', async ({ page, session, admin, seedNode }) => {
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
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await page.screenshot({ path: `${SHOTS}/figD-rich-text-0-dblclick.png` });
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('End');
    for (let i = 0; i < WORD; i++) {
      await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.keyboard.press('ControlOrMeta+b');
    await expect(page.getByTestId('text-range-bar')).toBeVisible();
    await page.getByTestId('text-range-colour').fill('#ff0000');
    await page.screenshot({ path: `${SHOTS}/figD-rich-text-1-editing.png` });

    await field.press('Escape');
    await expect(field).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/figD-rich-text-2-after.png` });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    expect((data?.[0]?.doc as Head).tracks[0].clips[0].props.runs).toEqual([{ start: 6, end: 11, weight: 700, color: '#ff0000' }]);
  });
});
