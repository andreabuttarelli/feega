import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };

test.describe('named versions @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('the current version gets a name that the history keeps', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`[data-motion-node="${node.id}"] [data-frame-stage]`).click({ position: { x: 4, y: 4 } });
    await page.getByTestId('revisions-open').click({ timeout: 20_000 });
    await page.getByTestId('version-name').fill('Client review');
    await page.getByTestId('version-name').press('Enter');

    await expect(page.getByTestId('revisions')).toContainText('Client review · v1');
    const saved = await admin.from('nodes').select('data').eq('id', node.id).single();
    expect((saved.data?.data as { versionNames?: Record<string, string> }).versionNames).toEqual({ '1': 'Client review' });
  });
});
