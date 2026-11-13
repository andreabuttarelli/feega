import { randomBytes, randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const frameData = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

test.describe('anyone with the link sees the canvas frames @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('an anonymous visitor draws an unpublished frame and can read nothing else', async ({ browser, session, admin, seedNode }) => {
    const frame = await seedNode({ type: 'motion', x: 0, y: 0, data: frameData });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const token = randomBytes(24).toString('base64url');
    await admin.from('canvases').update({ share_token: token, shared_at: new Date().toISOString() }).eq('id', session.canvasId);

    const visitor = await browser.newContext();
    const view = await visitor.newPage();
    const source = view.waitForResponse((r) => r.url().includes(`/s/${token}/source/${frame.id}`));
    await view.goto(`/s/${token}`);
    expect((await source).status()).toBe(HTTP_OK);
    await view.waitForTimeout(3_000);
    await view.screenshot({ path: `${SHOTS}/share-canvas-frames.png` });

    expect((await view.request.get(`/s/${token}/source/${randomUUID()}`)).status()).toBe(HTTP_NOT_FOUND);
    expect((await view.request.get(`/s/not-a-token/source/${frame.id}`)).status()).toBe(HTTP_NOT_FOUND);
    expect((await view.request.post(`/s/${token}/source/${frame.id}`)).ok()).toBe(false);
    await visitor.close();

    await admin.from('canvases').update({ share_token: null, shared_at: null }).eq('id', session.canvasId);
    expect((await (await browser.newPage()).request.get(`/s/${token}/source/${frame.id}`)).status()).toBe(HTTP_NOT_FOUND);
  });
});
