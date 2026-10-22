import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const VIEWPORT = { width: 1440, height: 900 };
const NEAR = { x: 0, y: 0 };
const FAR = { x: 6000, y: 4000 };

test.describe('an old editor link opens the canvas on its frame @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('the editor URL redirects to the canvas, which selects and reveals the frame', async ({ page, session, seedNode }) => {
    await page.setViewportSize(VIEWPORT);
    await seedNode({ type: 'motion', x: NEAR.x, y: NEAR.y, data: LANDSCAPE });
    const far = await seedNode({ type: 'motion', x: FAR.x, y: FAR.y, data: LANDSCAPE });
    const canvasPath = `/p/${session.projectId}/c/${session.canvasId}`;

    await gotoHydrated(page, `${canvasPath}/motion/${far.id}`);

    await expect(page).toHaveURL((url) => url.pathname === canvasPath && !url.searchParams.has('frame'), { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${far.id}"]`);
    await expect(tile).toHaveClass(/selected/, { timeout: 30_000 });
    await expect(tile).toBeInViewport();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS_DIR}/step11-frame-link.png` });
  });
});
