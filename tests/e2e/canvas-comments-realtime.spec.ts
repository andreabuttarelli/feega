import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const DELIVERY_MS = 10_000;

test.describe('comments realtime @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a second window sees a comment added, edited and deleted without reloading', async ({ page, browser, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const peerContext = await browser.newContext({ storageState: await page.context().storageState(), viewport: { width: 1440, height: 900 } });
    const peer = await peerContext.newPage();

    try {
      await gotoHydrated(page, path);
      await gotoHydrated(peer, path);
      for (const w of [page, peer]) {
        await w.keyboard.press('Alt+1');
        await w.getByTestId('canvas-more').click();
        await w.getByTestId('canvas-comments').click();
        await expect(w.getByTestId('comments-panel')).toContainText('No comments yet');
      }
      await page.waitForTimeout(3000);

      await page.getByTestId('comment-draft').fill('First from window A');
      await page.getByTestId('comment-add').click();
      await expect(peer.getByTestId('comment-thread')).toContainText('First from window A', { timeout: DELIVERY_MS });
      await peer.screenshot({ path: `${SHOTS}/comments3-realtime-insert.png` });

      const mine = page.getByTestId('comment-thread').first();
      await mine.getByTestId('comment-edit').click();
      await mine.getByTestId('comment-edit-input').fill('Edited in window A');
      await mine.getByTestId('comment-edit-save').click();
      await expect(peer.getByTestId('comment-thread')).toContainText('Edited in window A', { timeout: DELIVERY_MS });
      await peer.screenshot({ path: `${SHOTS}/comments3-realtime-update.png` });

      await mine.getByTestId('comment-delete').click();
      await expect(peer.getByTestId('comment-thread')).toHaveCount(0, { timeout: DELIVERY_MS });
      await peer.screenshot({ path: `${SHOTS}/comments3-realtime-delete.png` });
    } finally {
      await peerContext.close();
    }
  });
});
