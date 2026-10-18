import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_MOTION_SHOTS;

test.describe('canvas bar icons @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.describe.configure({ timeout: 120_000 });

  test('the Text tool and Generate text do not share an icon', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const bar = page.getByTestId('add-bar');
    await bar.getByTestId('bar-mode').getByRole('radio', { name: 'Design' }).click();
    const textTool = await bar.locator('[data-tool="text"] svg').innerHTML();
    await bar.getByTestId('bar-mode').getByRole('radio', { name: 'Generate' }).click();
    const generate = await bar.getByRole('button', { name: 'Generate text', exact: true }).locator('svg').first().innerHTML();
    if (SHOTS) {
      await bar.screenshot({ path: `${SHOTS}/${process.env.SHOT_NAME ?? 'bar'}.png` });
    }
    expect(generate).not.toEqual(textTool);
  });
});
