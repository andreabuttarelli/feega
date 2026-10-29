import { openInsert, pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_MOTION_SHOTS;

test.describe('canvas bar icons @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.describe.configure({ timeout: 120_000 });

  test('the Text tool and Generate text do not share an icon', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const bar = page.getByTestId('add-bar');
    const menu = await openInsert(page);
    const textTool = await menu.locator('[data-tool="text"] svg').innerHTML();
    const generate = await menu.locator('[data-insert="text"] svg').innerHTML();
    if (SHOTS) {
      await bar.screenshot({ path: `${SHOTS}/${process.env.SHOT_NAME ?? 'bar'}.png` });
    }
    expect(generate).not.toEqual(textTool);
  });
});
