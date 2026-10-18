import { test, expect, REAL_STACK } from './fixtures/session';

const SERVER_ERROR = 500;

test.describe('a canvas with a group opens on the DOM renderer @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');

  test('the page renders on the server instead of answering 500', async ({ page, session, seedNode }) => {
    await seedNode({ type: 'motion', x: 0, y: 0, data: { kind: 'group', format: '16:9', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } });
    const response = await page.goto(`/p/${session.projectId}/c/${session.canvasId}?renderer=dom`, { waitUntil: 'load' });
    expect(response!.status()).toBeLessThan(SERVER_ERROR);
    await expect(page.locator('.svelte-flow').first()).toBeVisible({ timeout: 30_000 });
  });
});
