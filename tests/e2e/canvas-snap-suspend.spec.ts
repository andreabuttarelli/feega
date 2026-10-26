import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 6000;
const SHORT_SETTLE_MS = 800;
const DRAG_STEP_PX = 12;
const DRAG_STEPS = 6;

const shape = (id: string, x: number, y: number, width: number, height: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y, width, height, fills: [{ type: 'solid', color }] } });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('left', 0.25, 0.5, 0.15, 0.2, '#ff5a1f'), shape('right', 0.75, 0.5, 0.15, 0.2, '#2fbf71')] }],
  comps: {},
  assets: []
};

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('Ctrl suspends snapping while dragging inside a frame @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('a drag shows the guide, holding Ctrl hides it', async ({ page, session, admin, seedNode }) => {
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
    const grab = { x: frame.x + frame.width * 0.25, y: frame.y + frame.height * 0.5 };
    await page.mouse.click(grab.x, grab.y);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1);
    await page.waitForTimeout(SHORT_SETTLE_MS);

    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x + DRAG_STEP_PX * DRAG_STEPS, grab.y, { steps: DRAG_STEPS });
    await expect.poll(() => page.getByTestId('frame-guide').count(), { message: 'snapping shows a guide' }).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS_DIR}/r6-snap-on.png` });

    await page.keyboard.down('Control');
    await page.mouse.move(grab.x + DRAG_STEP_PX * (DRAG_STEPS + 1), grab.y, { steps: 2 });
    await expect(page.getByTestId('frame-guide'), 'Ctrl suspends snapping: no guide').toHaveCount(0);
    await page.screenshot({ path: `${SHOTS_DIR}/r6-snap-suspended.png` });

    await page.keyboard.up('Control');
    await page.mouse.up();
  });
});
