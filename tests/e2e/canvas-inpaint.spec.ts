import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/anim-doc';

const IMAGE_AT = { x: 240, y: 160 };
const IMAGE_SIZE = { width: 360, height: 270 };
const CLICK_ON_IMAGE = { x: IMAGE_AT.x + 220, y: IMAGE_AT.y + 200 };
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const RESULT_ASSET = '00000000-0000-4000-8000-000000000002';

test.describe('inpaint @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('paint a mask, add a prompt, and the post carries both without reaching a provider', async ({ page, session, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedNode({ type: 'image', x: IMAGE_AT.x, y: IMAGE_AT.y, data: { prompt: '', refId: RESULT_ASSET, ...IMAGE_SIZE } });

    await page.route(new RegExp(`/assets/${RESULT_ASSET}`), (route) => route.fulfill({ contentType: 'image/png', body: PNG_1X1 }));
    let posted = '';
    await page.route(/imageTool/, async (route) => {
      posted = route.request().postData() ?? '';
      await route.abort();
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3000);

    const inpaint = page.getByRole('button', { name: 'Inpaint…' });
    await expect(async () => {
      await page.mouse.click(CLICK_ON_IMAGE.x, CLICK_ON_IMAGE.y);
      await expect(inpaint).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await inpaint.click();

    await page.getByTestId('inpaint-dialog').locator('img').evaluate((img: HTMLImageElement) => {
      img.style.width = '400px';
      img.style.height = '300px';
    });
    const surface = page.getByTestId('inpaint-surface');
    await expect(surface).toBeVisible();
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 6 });
    await page.mouse.up();
    await page.getByTestId('inpaint-prompt').fill('a red hat');
    await page.screenshot({ path: `${SHOTS_DIR}/f1-inpaint-dialog.png` });

    await page.getByTestId('inpaint-apply').click();

    await expect.poll(() => posted).toContain('inpaint');
    expect(decodeURIComponent(posted)).toContain('a red hat');
    expect(decodeURIComponent(posted)).toContain('"strokes"');
  });
});
