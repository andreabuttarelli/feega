import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 6000;
const SIZE_TOLERANCE_PX = 3;
const RECT = { x: 0.3, y: 0.55, width: 0.2, height: 0.25 };
const NUDGE = 10;

const shape = (id: string, x: number, y: number, width: number, height: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y, width, height, fills: [{ type: 'solid', color }] } });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('bg', 0.5, 0.5, 1, 1, '#1b2a49'), shape('rect', RECT.x, RECT.y, RECT.width, RECT.height, '#ff5a1f')] }],
  comps: {},
  assets: []
};

const snap = (page: Page, name: string) => page.screenshot({ path: `${SHOTS_DIR}/props-tab-${name}.png` });

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('the frame inspector lives in the right bar Properties tab @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('selecting an element opens Properties, an edit lands, Chat and back keep the frame', async ({ page, session, admin, seedNode }) => {
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
    const start = (await tile.boundingBox())!;

    await expect(page.getByTestId('right-bar').getByRole('tab')).toHaveText(['Properties', 'Chat', 'Guides']);
    await snap(page, '1-no-selection');

    await page.mouse.click(start.x + start.width * (RECT.x + RECT.width / 2), start.y + start.height * (RECT.y + RECT.height / 2));
    const inspector = page.getByTestId('frame-inspector');
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('side-tab-properties')).toHaveAttribute('aria-selected', 'true');
    await page.waitForTimeout(SETTLE_MS);
    await snap(page, '2-element-selected');

    const field = inspector.locator('input[type="number"], input[inputmode="decimal"], input[inputmode="numeric"]').first();
    const next = (Number(await field.inputValue()) + NUDGE).toFixed(2);
    await field.fill(next);
    await field.press('Enter');
    await expect(field).toHaveValue(next);
    await snap(page, '3-edited');

    await page.getByTestId('side-tab-chat').click();
    await expect(inspector).toBeHidden();
    await snap(page, '4-chat');
    await page.getByTestId('side-tab-properties').click();
    await expect(inspector).toBeVisible();
    await expect(field).toHaveValue(next);
    await snap(page, '5-back-to-properties');

    const after = (await tile.boundingBox())!;
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(after[key] - start[key]), `frame ${key}`).toBeLessThanOrEqual(SIZE_TOLERANCE_PX);
    }
  });
});
