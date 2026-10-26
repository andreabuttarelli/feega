import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_RENAME_SHOTS ?? '/tmp';
const SETTLE_MS = 2500;
const NAMED = 'Hero frame';
const RENAMED_IN_LAYERS = 'Hero renamed';
const TITLE_BAND_FLOW_PX = 12;

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

test.describe('renaming a canvas node @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('double-clicking the title names the frame and the name is stored', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 120, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/p2b-rename-1-before.png` });

    await page.mouse.dblclick(box.x + 24, box.y - TITLE_BAND_FLOW_PX);
    const field = page.getByTestId('node-name-input');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.keyboard.type(NAMED, { delay: 40 });
    await page.screenshot({ path: `${SHOTS}/p2b-rename-2-typing.png` });
    await page.keyboard.press('Enter');
    await expect(field).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/p2b-rename-3-after.png` });

    const stored = async () => (await admin.from('nodes').select('display_name').eq('id', frame.id).single()).data?.display_name;
    await expect.poll(stored, { timeout: 15_000 }).toBe(NAMED);

    await page.mouse.click(box.x - 200, box.y - 80);
    await page.reload();
    await page.waitForTimeout(SETTLE_MS * 2);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/p2b-rename-4-deselected.png` });
    await page.mouse.click(22, 72);
    const row = page.locator(`[data-layer="${frame.id}"][data-kind="node"]`);
    await expect(row).toContainText(NAMED);

    await row.dblclick();
    const rowField = page.getByTestId('layer-rename');
    await expect(rowField).toBeVisible();
    await rowField.fill(RENAMED_IN_LAYERS);
    await page.screenshot({ path: `${SHOTS}/p2b-rename-5-layers.png` });
    await rowField.press('Enter');
    await expect.poll(stored, { timeout: 15_000 }).toBe(RENAMED_IN_LAYERS);
    await expect(row).toContainText(RENAMED_IN_LAYERS);
  });
});
