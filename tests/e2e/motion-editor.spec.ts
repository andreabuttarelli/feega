import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const START = /^0:00\.00 \//;

test.describe('motion editor @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('Play fa avanzare il playhead, Spazio lo ferma', async ({ page, session, seedNode }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (e) => errors.push(e.message));

    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    const timecode = page.getByTestId('timecode');
    await expect(timecode).toHaveText(START);
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(timecode).not.toHaveText(START, { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    const stopped = await timecode.textContent();
    await page.waitForTimeout(500);
    await expect(timecode).toHaveText(stopped ?? '');

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
