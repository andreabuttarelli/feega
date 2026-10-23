import { devices } from '@playwright/test';
import { test, expect, REAL_STACK } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SHARE_TOKEN = 'e2e-share-frame-token';
const frameData = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, interactive: false };
const PLAYER_SETTLE_MS = 3_500;

test.describe('a shared frame opens in a clean viewer @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('plays on desktop and swipes between frames on a phone', async ({ page, browser, session, admin, seedNode }) => {
    const bearer = { authorization: `Bearer ${(await admin.auth.getSession()).data.session?.access_token}` };
    const first = await seedNode({ type: 'motion', x: 0, y: 0, data: frameData });
    const second = await seedNode({ type: 'motion', x: 0, y: 500, data: frameData });
    for (const node of [first, second]) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      const published = await page.request.post(`/api/v1/motion/${node.id}/embed`, { headers: bearer });
      expect(published.status()).toBe(200);
    }
    await admin.from('canvases').update({ share_token: SHARE_TOKEN, shared_at: new Date().toISOString() }).eq('id', session.canvasId);

    const desktop = await browser.newContext();
    const view = await desktop.newPage();
    await view.goto(`/s/${SHARE_TOKEN}/${first.id}`);
    await view.waitForTimeout(PLAYER_SETTLE_MS);
    await expect(view.locator('iframe.stage')).toBeVisible();
    await expect(view.getByText('1 / 2')).toBeVisible();
    await view.screenshot({ path: `${SHOTS}/share-frame-desktop.png` });
    await desktop.close();

    const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 15'];
    const phone = await browser.newContext(iphone);
    const small = await phone.newPage();
    await small.goto(`/s/${SHARE_TOKEN}/${first.id}`);
    await small.waitForTimeout(PLAYER_SETTLE_MS);
    await small.screenshot({ path: `${SHOTS}/share-frame-mobile.png` });

    const cdp = await phone.newCDPSession(small);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 400 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 160, y: 402 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(small).toHaveURL(new RegExp(`/s/${SHARE_TOKEN}/${second.id}$`));
    await expect(small.getByText('2 / 2')).toBeVisible();
    await small.waitForTimeout(PLAYER_SETTLE_MS);
    await small.screenshot({ path: `${SHOTS}/share-frame-mobile-swiped.png` });
    await phone.close();

    await admin.from('canvases').update({ share_token: null, shared_at: null }).eq('id', session.canvasId);
    for (const node of [first, second]) {
      await page.request.delete(`/api/v1/motion/${node.id}/embed`, { headers: bearer });
    }
    const gone = await browser.newPage();
    expect((await gone.goto(`/s/${SHARE_TOKEN}/${first.id}`))?.status()).toBe(404);
  });
});
