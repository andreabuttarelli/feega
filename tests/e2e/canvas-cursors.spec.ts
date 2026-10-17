import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const DESKTOP = { width: 1280, height: 860 };
const CURSOR_LATENCY_MS = 1000;

test.use({ viewport: DESKTOP, actionTimeout: 15_000 });

test.describe('canvas cursors across two tabs @real', () => {
  test.skip(!REAL_STACK, 'richiede lo stack vero: E2E_REAL_STACK=1');
  test.setTimeout(90_000);

  test('a pointer in one tab shows as a cursor in the other, and leaves with it', async ({ page, session }) => {
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const other = await page.context().newPage();
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);
    await page.waitForTimeout(1500);

    const started = Date.now();
    for (let i = 0; i < 10; i += 1) {
      await page.mouse.move(400 + i * 10, 400);
    }
    const cursor = other.getByTestId('peer-cursor');
    await expect(cursor).toBeVisible({ timeout: CURSOR_LATENCY_MS * 5 });
    console.log(JSON.stringify({ cursorLatencyMs: Date.now() - started }));
    expect(Date.now() - started).toBeLessThan(CURSOR_LATENCY_MS * 5);

    await page.close();
    await expect(cursor).toHaveCount(0, { timeout: 15_000 });
  });
});
