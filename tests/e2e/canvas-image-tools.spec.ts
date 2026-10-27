import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/anim-doc';

const IMAGE_AT = { x: 240, y: 160 };
const IMAGE_SIZE = { width: 360, height: 270 };
const RESULT_ASSET = '00000000-0000-4000-8000-000000000001';

test.describe('image tools @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('an image with a result offers background removal and upscale, and a click posts the tool', async ({ page, session, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedNode({ type: 'image', x: IMAGE_AT.x, y: IMAGE_AT.y, data: { prompt: '', refId: RESULT_ASSET, ...IMAGE_SIZE } });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3000);

    const removeBackground = page.getByRole('button', { name: 'Remove background' });
    await expect(async () => {
      await page.mouse.click(IMAGE_AT.x + 220, IMAGE_AT.y + 200);
      await expect(removeBackground).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await expect(page.getByRole('button', { name: 'Upscale 2×' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/f1-image-tools-toolbar.png` });

    const posted = page.waitForRequest((request) => request.method() === 'POST' && request.url().includes('imageTool'));
    await removeBackground.click();
    const body = (await posted).postData() ?? '';

    expect(body).toContain('remove_background');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS_DIR}/f1-image-tools-after-click.png` });
  });
});
