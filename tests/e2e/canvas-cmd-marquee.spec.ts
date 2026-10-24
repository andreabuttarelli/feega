import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 6000;
const EDGE_PX = 30;
const MARQUEE_STEPS = 8;

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

const snap = (page: Page, name: string) => page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('cmd-drag marquee inside a frame @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('Cmd-dragging over empty frame area selects the elements it touches', async ({ page, session, admin, seedNode }) => {
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
    await page.mouse.click(frame.x + frame.width * 0.25, frame.y + frame.height * 0.5);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1);
    await page.waitForTimeout(SETTLE_MS / 3);
    const single = (await page.getByTestId('frame-selection').boundingBox())!;
    const shown = (await tile.boundingBox())!;

    await page.keyboard.down('ControlOrMeta');
    await page.mouse.move(shown.x + EDGE_PX, shown.y + EDGE_PX);
    await page.mouse.down();
    await page.mouse.move(shown.x + shown.width - EDGE_PX, Math.min(shown.y + shown.height - EDGE_PX, single.y + single.height + EDGE_PX), { steps: MARQUEE_STEPS });
    await snap(page, 'r6-cmd-marquee-dragging');
    await page.mouse.up();
    await page.keyboard.up('ControlOrMeta');
    await page.waitForTimeout(SETTLE_MS / 3);

    await snap(page, 'r6-cmd-marquee-selected');
    await expect(page.getByTestId('frame-selection'), 'both elements are selected').toHaveCount(2);
  });
});
