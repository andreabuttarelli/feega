import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const VERSION_NAME = 'before the move';
const MOVED_X = 900;
const ORIGIN_X = 120;

test.describe('canvas versions @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('save a version, change the canvas, restore puts it back', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'text', x: ORIGIN_X, y: 120, data: { text: 'kept' } });
    const positionX = async () => (await admin.from('nodes').select('x').eq('id', node.id).single()).data?.x;

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('canvas-switcher').click();
    await page.getByTestId('canvas-versions').click();
    const dialog = page.getByTestId('canvas-versions-dialog');
    await expect(dialog).toContainText('No saved versions yet');

    await page.getByTestId('canvas-version-name').fill(VERSION_NAME);
    await page.getByTestId('canvas-version-save').click();
    await expect(page.getByTestId('canvas-version')).toContainText(VERSION_NAME);
    await page.screenshot({ path: `${SHOTS}/versions-saved.png` });

    await admin.from('nodes').update({ x: MOVED_X }).eq('id', node.id);
    expect(await positionX()).toBe(MOVED_X);

    await page.getByTestId('canvas-version-restore').first().click();
    await expect.poll(positionX).toBe(ORIGIN_X);
    await expect(dialog).toBeHidden();
    await page.screenshot({ path: `${SHOTS}/versions-restored.png` });
  });
});
