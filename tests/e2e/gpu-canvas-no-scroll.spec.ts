import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

test.describe('the GPU canvas never scrolls under the camera @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');

  test('focus outside the view keeps the canvas, its bar and its drawing in place', async ({ page, session, seedNode }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'here' } });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
    const bar = await page.getByTestId('add-bar').boundingBox();

    const wrap = page.locator('.wrap.svelte-flow');
    await wrap.evaluate((el) => {
      const tall = document.createElement('div');
      tall.style.cssText = 'position:absolute;left:4000px;top:4000px;width:10px;height:10px';
      tall.tabIndex = -1;
      el.appendChild(tall);
      tall.focus();
      el.scrollTo(400, 400);
    });
    expect(await wrap.evaluate((el) => [el.scrollTop, el.scrollLeft]), 'the canvas wrap scrolled').toEqual([0, 0]);
    expect((await page.getByTestId('add-bar').boundingBox())!.y, 'the add bar moved').toBe(bar!.y);
  });
});
