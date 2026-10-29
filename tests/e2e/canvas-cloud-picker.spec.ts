import { openInsert, pickBarTool } from './fixtures/canvas-bar';
import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2000;
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Drive and Dropbox picker @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('asks to connect, lists a Dropbox folder and places the imported file', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    await page.route('**/cloud/google_drive/files*', (route) => route.fulfill(json(409, { error: 'not_connected' })));
    await page.route('**/cloud/dropbox/files*', (route) => route.fulfill(json(200, { entries: [{ id: '/shots', name: 'shots', folder: true, mime: null }, { id: '/a.png', name: 'a.png', folder: false, mime: null }] })));
    const imported = randomUUID();
    let importBody: Record<string, unknown> | null = null;
    await page.route('**/cloud/dropbox/import', async (route) => {
      importBody = route.request().postDataJSON();
      await route.fulfill(
        json(200, {
          asset: { id: randomUUID() },
          node: { id: imported, projectId: session.projectId, canvasId: session.canvasId, type: 'image', displayName: null, position: { x: 100, y: 100, z: 1 }, size: { width: null, height: null }, data: { name: 'a.png', mimeType: 'image/png' }, version: 1 }
        })
      );
    });

    await (await openInsert(page)).locator('[data-insert="cloud"]').click();
    await expect(page.getByTestId('cloud-picker')).toBeVisible();
    await expect(page.getByTestId('cloud-connect-link')).toHaveAttribute('href', /\/api\/v1\/cloud\/google_drive\/connect\?return=/);
    await page.screenshot({ path: `${SHOTS_DIR}/f4-cloud-connect.png` });

    await page.getByTestId('cloud-tab-dropbox').click();
    await expect(page.getByTestId('cloud-file')).toHaveText('a.png');
    await page.screenshot({ path: `${SHOTS_DIR}/f4-cloud-files.png` });

    await page.getByTestId('cloud-file').click();
    await expect(page.getByTestId('cloud-picker')).toHaveCount(0);
    expect(importBody).toMatchObject({ fileId: '/a.png', place: { canvasId: session.canvasId } });
    await expect(page.locator(`[data-testid="gpu-node"][data-id="${imported}"]`)).toHaveCount(1);
  });
});
