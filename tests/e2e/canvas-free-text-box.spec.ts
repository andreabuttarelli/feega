import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const FROM = { x: 360, y: 300 };
const DRAG = { width: 300, height: 80 };

async function tileRect(page: Page) {
  const tile = page.locator('[data-kind="element"][data-motion-node]').first();
  await expect(tile).toBeVisible({ timeout: 10_000 });
  return (await tile.boundingBox())!;
}

for (const [renderer, query] of [['gpu', ''], ['dom', '?renderer=dom']]) {
  test.describe(`a free text on the ${renderer} canvas is one object of the drawn size @real`, () => {
    test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

    test('a drag makes a text box exactly where and as big as the drag, and it stays after a reload', async ({ page, session, admin }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}${query}`);
      await pickBarTool(page, 'text');
      await page.mouse.move(FROM.x, FROM.y);
      await page.mouse.down();
      await page.mouse.move(FROM.x + DRAG.width / 2, FROM.y + DRAG.height / 2);
      await page.mouse.move(FROM.x + DRAG.width, FROM.y + DRAG.height);
      await page.mouse.up();

      await page.waitForTimeout(1500);
      const box = await tileRect(page);
      expect(Math.abs(box.x - FROM.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y - FROM.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - DRAG.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - DRAG.height)).toBeLessThanOrEqual(1);

      const { data } = await admin.from('nodes').select('width, height, data').eq('canvas_id', session.canvasId).is('deleted_at', null);
      expect(data).toHaveLength(1);
      expect((data![0].data as { kind?: string }).kind).toBe('element');

      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await page.reload();
      const after = await tileRect(page);
      expect(Math.abs(after.width - DRAG.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.height - DRAG.height)).toBeLessThanOrEqual(1);
    });

    test('a click makes a text at the click point', async ({ page, session }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}${query}`);
      await pickBarTool(page, 'text');
      await page.mouse.click(FROM.x, FROM.y);
      await page.waitForTimeout(1500);
      const box = await tileRect(page);
      expect(Math.abs(box.x - FROM.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y - FROM.y)).toBeLessThanOrEqual(1);
    });
  });
}
