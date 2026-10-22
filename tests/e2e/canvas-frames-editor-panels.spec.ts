import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 6000;
const RECT = { x: 0.3, y: 0.55, width: 0.2, height: 0.25 };

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        { id: 'bg', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color: '#1b2a49' }] } },
        { id: 'rect', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', ...RECT, fills: [{ type: 'solid', color: '#ff5a1f' }] } }
      ]
    }
  ],
  comps: {},
  assets: []
};

const snap = (page: Page, name: string) => page.screenshot({ path: `${SHOTS_DIR}/10b-b-${name}.png` });

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('the motion editor panels live in the canvas right bar @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('the frame shows its camera, and ? opens the shortcut card', async ({ page, session, admin, seedNode }) => {
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
    const box = (await tile.boundingBox())!;

    await page.mouse.click(box.x + box.width * (RECT.x + RECT.width / 2), box.y + box.height * (RECT.y + RECT.height / 2));
    const inspector = page.getByTestId('frame-inspector');
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await expect(inspector.getByTestId('camera-inspector')).toHaveCount(0);
    await snap(page, '1-element');

    await page.keyboard.press('Escape');
    await expect(inspector.getByTestId('camera-inspector')).toBeVisible({ timeout: 15_000 });
    await snap(page, '2-frame-camera');

    await page.keyboard.press('Shift+?');
    const help = page.getByTestId('shortcut-help');
    await expect(help).toBeVisible();
    await expect(help).toContainText('Keyboard shortcuts');
    await snap(page, '3-shortcut-help');
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
  });
});
