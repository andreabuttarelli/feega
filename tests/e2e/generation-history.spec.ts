import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SCREENSHOT = `${process.env.HOME}/Documents/feega-videos/e2e/f3-generation-history.png`;

test.describe('generation history @real', () => {
  test.skip(!REAL_STACK, 'requires E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('a run in project A is found from the history of project B', async ({ page, session, admin, seedNode }) => {
    const otherProjectId = randomUUID();
    const marker = `history ${Date.now().toString(36)}`;

    const node = await seedNode({ type: 'text', data: {} });
    const asset = await admin
      .from('assets')
      .insert({ org_id: session.orgId, project_id: session.projectId, type: 'text', content: marker, source: 'generated', source_node_id: node.id })
      .select('id')
      .single();
    expect(asset.error).toBeNull();

    const run = await admin.from('node_runs').insert({
      org_id: session.orgId,
      node_id: node.id,
      prompt: marker,
      model: 'e2e/history-model',
      status: 'done',
      output_asset_id: asset.data!.id,
      finished_at: new Date().toISOString(),
      actor_kind: 'user',
      actor_id: session.userId
    });
    expect(run.error).toBeNull();

    const other = await admin.from('projects').insert({ id: otherProjectId, org_id: session.orgId, name: 'E2E history B', slug: `e2e-history-${otherProjectId}` });
    expect(other.error).toBeNull();

    try {
      await gotoHydrated(page, `/p/${otherProjectId}/assets?source=history`);

      const tile = page.getByTestId('history-tile').filter({ hasText: 'e2e/history-model' }).first();
      await expect(tile).toBeVisible();
      await expect(tile.getByText(marker)).toBeVisible();
      await expect(tile.getByRole('link', { name: /from/ })).toHaveAttribute('href', `/p/${session.projectId}/c/${session.canvasId}`);

      await page.screenshot({ path: SCREENSHOT, fullPage: true });

      await gotoHydrated(page, `/p/${otherProjectId}/assets?source=history&scope=project`);
      await expect(page.getByTestId('history-tile')).toHaveCount(0);
    } finally {
      await admin.from('projects').delete().eq('id', otherProjectId);
    }
  });
});
