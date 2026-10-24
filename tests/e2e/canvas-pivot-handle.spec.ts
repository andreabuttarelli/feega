import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 6000;
const SHORT_SETTLE_MS = 1200;
const DRAG_STEPS = 8;
const CORNER_INSET_PX = 2;
const PIVOT_TOLERANCE = 5;

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

test.describe('the rotation origin handle @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('Alt+R shows the pivot, dragging it to a corner moves the origin there', async ({ page, session, admin, seedNode }) => {
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
    await expect(page.getByTestId('frame-selection-pivot'), 'hidden until asked for').toHaveCount(0);

    await page.keyboard.press('Alt+KeyR');
    const pivot = page.getByTestId('frame-selection-pivot');
    await expect(pivot).toHaveCount(1);
    const from = (await pivot.boundingBox())!;
    const body = (await page.getByTestId('frame-selection-body').boundingBox())!;
    await page.screenshot({ path: `${SHOTS_DIR}/r6-pivot-shown.png` });

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(body.x + CORNER_INSET_PX, body.y + CORNER_INSET_PX, { steps: DRAG_STEPS });
    await page.mouse.up();
    await page.waitForTimeout(SHORT_SETTLE_MS);
    await page.screenshot({ path: `${SHOTS_DIR}/r6-pivot-moved.png` });

    const moved = (await pivot.boundingBox())!;
    expect(Math.abs(moved.x + moved.width / 2 - body.x), 'the pivot sits on the left edge').toBeLessThanOrEqual(PIVOT_TOLERANCE);
    expect(Math.abs(moved.y + moved.height / 2 - body.y), 'the pivot sits on the top edge').toBeLessThanOrEqual(PIVOT_TOLERANCE);
  });
});
