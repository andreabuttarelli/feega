import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/anim-doc';

const IMAGE_AT = { x: 240, y: 160 };
const IMAGE_SIZE = { width: 360, height: 270 };
const CLICK_ON_IMAGE = { x: IMAGE_AT.x + 220, y: IMAGE_AT.y + 200 };
const RESULT_ASSET = '00000000-0000-4000-8000-000000000003';

test.describe('outpaint @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('choose the sides and a prompt, and the post carries both without reaching a provider', async ({ page, session, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedNode({ type: 'image', x: IMAGE_AT.x, y: IMAGE_AT.y, data: { prompt: '', refId: RESULT_ASSET, ...IMAGE_SIZE } });

    let posted = '';
    await page.route(/imageTool/, async (route) => {
      posted = route.request().postData() ?? '';
      await route.abort();
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3000);

    const outpaint = page.getByRole('button', { name: 'Outpaint…' });
    await expect(async () => {
      await page.mouse.click(CLICK_ON_IMAGE.x, CLICK_ON_IMAGE.y);
      await expect(outpaint).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await outpaint.click();

    await page.getByTestId('outpaint-top').fill('40');
    await page.getByTestId('outpaint-prompt').fill('open sky');
    await page.screenshot({ path: `${SHOTS_DIR}/f1-outpaint-dialog.png` });
    await page.getByTestId('outpaint-apply').click();

    await expect.poll(() => posted).toContain('outpaint');
    const body = decodeURIComponent(posted);
    expect(body).toContain('open sky');
    expect(body).toContain('"top":0.4');
  });
});
