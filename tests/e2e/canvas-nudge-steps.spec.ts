import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 6000;
const SHORT_SETTLE_MS = 1000;
const DOC_WIDTH_PX = 1920;
const SAVE_MS = 20_000;
const SMALL_STEP_PX = 1;
const BIG_STEP_PX = 10;

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'box', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.3, height: 0.3, fills: [{ type: 'solid', color: '#ff5a1f' }] } }] }],
  comps: {},
  assets: []
};

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('nudging an element with the arrow keys @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('an arrow moves 1 px and Shift an arrow moves 10 px', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: FRAME_AT.x, y: FRAME_AT.y, data: LANDSCAPE });
    await admin.from('nodes').update({ width: FRAME_SIZE.width, height: FRAME_SIZE.height }).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const frame = (await tile.boundingBox())!;
    await page.mouse.click(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1);
    await page.waitForTimeout(SHORT_SETTLE_MS);

    const offsetPx = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      const clip = (data!.doc as { tracks: { clips: { transform?: { x?: number } }[] }[] }).tracks[0].clips[0];
      return Math.round((clip.transform?.x ?? 0) * DOC_WIDTH_PX);
    };

    await page.keyboard.press('ArrowRight');
    await expect.poll(offsetPx, { message: 'one pixel', timeout: SAVE_MS }).toBe(SMALL_STEP_PX);

    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(offsetPx, { message: 'ten more pixels', timeout: SAVE_MS }).toBe(SMALL_STEP_PX + BIG_STEP_PX);
    await page.screenshot({ path: `${SHOTS_DIR}/r6-nudge-steps.png` });
  });
});
