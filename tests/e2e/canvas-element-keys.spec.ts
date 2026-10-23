import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 6000;
const SHORT_SETTLE_MS = 1500;
const LEFT_SHARE = { x: 0.25, y: 0.5 };
const RIGHT_SHARE = { x: 0.75, y: 0.5 };

const shape = (id: string, x: number, y: number, width: number, height: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y, width, height, fills: [{ type: 'solid', color }] } });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('left', LEFT_SHARE.x, LEFT_SHARE.y, 0.15, 0.2, '#ff5a1f'), shape('right', RIGHT_SHARE.x, RIGHT_SHARE.y, 0.15, 0.2, '#2fbf71')] }],
  comps: {},
  assets: []
};

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('element keys inside a frame @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('a digit sets the opacity and Shift+Cmd+V pastes over the selection', async ({ page, session, admin, seedNode }) => {
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
    await page.mouse.click(frame.x + frame.width * LEFT_SHARE.x, frame.y + frame.height * LEFT_SHARE.y);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1);
    await page.waitForTimeout(SHORT_SETTLE_MS);

    await page.keyboard.press('5');
    await page.waitForTimeout(SHORT_SETTLE_MS);
    await page.screenshot({ path: `${SHOTS_DIR}/r6-opacity-key-50.png` });
    await expect(page.getByText('Opacity').locator('..').locator('input').first(), 'the opacity field reads 50').toHaveValue('50');

    await page.keyboard.press('ControlOrMeta+c');
    const shown = (await tile.boundingBox())!;
    await page.mouse.click(shown.x + shown.width * RIGHT_SHARE.x, shown.y + shown.height * RIGHT_SHARE.y);
    await page.waitForTimeout(SHORT_SETTLE_MS);
    await page.keyboard.press('ControlOrMeta+Shift+v');
    await page.waitForTimeout(SHORT_SETTLE_MS);
    await page.screenshot({ path: `${SHOTS_DIR}/r6-paste-over.png` });

    await expect(page.getByText('Video 2', { exact: true }), 'the pasted copy landed on a new track over the originals').toBeVisible();
    await expect(page.getByText('Video 1', { exact: true })).toBeVisible();
  });
});
