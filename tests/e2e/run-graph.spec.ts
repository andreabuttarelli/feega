import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const NO_SUCH_MODEL = 'e2e/no-such-model';

type Ticket = { node_id: string; id: string; params: { workflow: { dependsOn: string[] } } };

test.describe('run downstream @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('run from here on a 3-node chain queues 3 runs in dependency order', async ({ page, session, seedNode, admin }) => {
    const a = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'A rainy coffee shop.', model: NO_SUCH_MODEL } });
    const b = await seedNode({ type: 'image', x: 420, y: 0, data: { prompt: 'Its sign.', model: NO_SUCH_MODEL } });
    const c = await seedNode({ type: 'video', x: 840, y: 0, data: { prompt: 'Rain on it.', model: NO_SUCH_MODEL } });
    for (const [source, target] of [[a.id, b.id], [b.id, c.id]]) {
      const edge = await admin.from('nodes_connections').insert({ org_id: session.orgId, canvas_id: session.canvasId, source_node_id: source, target_node_id: target, actor_kind: 'user', actor_id: session.userId });
      expect(edge.error).toBeNull();
    }

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

      const nodes = page.locator('.svelte-flow__node');
      await expect(nodes).toHaveCount(3);
      await nodes.nth(0).click({ position: { x: 24, y: 12 } });

      const quote = page.waitForEvent('dialog');
      await page.getByRole('button', { name: 'Run from here' }).click();
      const dialog = await quote;
      expect(dialog.message()).toContain('3 runs');
      await dialog.accept();

      await expect
        .poll(async () => {
          const { data } = await admin.from('node_runs').select('id, node_id, params').eq('org_id', session.orgId).order('started_at');
          return (data ?? []).filter((r) => (r.params as Record<string, unknown>)?.workflow).length;
        })
        .toBe(3);

      const { data } = await admin.from('node_runs').select('id, node_id, params').eq('org_id', session.orgId).order('started_at');
      const tickets = (data ?? []) as Ticket[];
      const byNode = new Map(tickets.map((t) => [t.node_id, t]));

      expect(tickets.map((t) => t.node_id)).toEqual([a.id, b.id, c.id]);
      expect(byNode.get(a.id)!.params.workflow.dependsOn).toEqual([]);
      expect(byNode.get(b.id)!.params.workflow.dependsOn).toEqual([byNode.get(a.id)!.id]);
      expect(byNode.get(c.id)!.params.workflow.dependsOn).toEqual([byNode.get(b.id)!.id]);
    } finally {
      await admin.from('node_runs').update({ status: 'failed', error: 'cancelled' }).eq('org_id', session.orgId).eq('status', 'running');
    }
  });
});
