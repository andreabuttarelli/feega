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
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'title', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Alpha\nBeta\nGamma', size: 0.07, x: 0.5, y: 0.5, width: 0.7, height: 0.6, align: 'left', verticalAlign: 'top' } }] }],
  comps: {},
  assets: []
};

type Head = { tracks: { clips: { props: { lists?: unknown } }[] }[] };

test.describe('lists in a canvas frame @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('shortcuts make a bulleted list, nest an item and number the last, and the lists are saved', async ({ page, session, admin, seedNode }) => {
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
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+Shift+8');
    await expect(page.getByTestId('core-text-edit').locator('[data-list-marker]').first()).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ControlOrMeta+Shift+7');
    await page.screenshot({ path: `${SHOTS}/richtext2-lists-1-editing.png` });

    await field.press('Escape');
    await expect(field).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/richtext2-lists-2-canvas.png` });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    expect((data?.[0]?.doc as Head).tracks[0].clips[0].props.lists).toEqual([
      { kind: 'bullet', level: 0 },
      { kind: 'bullet', level: 1 },
      { kind: 'number', level: 0 }
    ]);
  });
});
