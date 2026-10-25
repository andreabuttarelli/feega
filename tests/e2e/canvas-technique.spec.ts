import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/shots';

const SETTLE_MS = 2000;
const PLAN = {
  nodes: [
    { sourceIndex: 0, type: 'text', data: { prompt: 'brief' }, x: 0, y: 0 },
    { sourceIndex: 1, type: 'image', data: { prompt: 'picture' }, x: 400, y: 0 }
  ],
  edges: [{ sourceIndex: 0, targetIndex: 1, sourceHandle: 'derives_from', targetHandle: 'text' }]
};

test.describe('live techniques @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');
  test.setTimeout(150_000);

  test('placing a technique makes one live node, or a copy while the node type is not allowed', async ({ page, session, admin }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const name = `e2e-${Date.now().toString(36)}`;
    const { data: made, error } = await admin
      .from('techniques' as never)
      .insert({ org_id: session.orgId, name, plan: PLAN, inputs: [{ node: 0, type: 'text' }], outputs: [{ node: 1, type: 'image' }], actor_kind: 'user', actor_id: session.userId } as never)
      .select('id')
      .single();
    expect(error).toBeNull();
    const techniqueId = (made as unknown as { id: string }).id;

    try {
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.getByRole('button', { name: 'Templates', exact: true }).click();
      await page.getByTestId('technique-pick').filter({ hasText: name }).click();
      await page.waitForTimeout(SETTLE_MS);
      await page.screenshot({ path: `${SHOTS_DIR}/tech-placed.png` });

      const { data: rows } = await admin.from('nodes').select('type,data').eq('canvas_id', session.canvasId).is('deleted_at', null);
      const types = (rows ?? []).map((r) => r.type).sort();
      if (types.includes('technique')) {
        expect(types).toEqual(['technique']);
        expect(rows![0].data).toMatchObject({ techniqueId, name });
      } else {
        expect(types).toEqual(['image', 'text']);
        await expect(page.getByTestId('technique-notice')).toContainText('copy');
      }
    } finally {
      await admin.from('techniques' as never).delete().eq('id', techniqueId);
    }
  });
});
