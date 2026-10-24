import { describe, expect, it } from 'vitest';
import { fakeDb, filtersOf } from '$lib/server/db/fake-db';
import { listRunHistory, RUN_HISTORY_PAGE } from './run-history';

const ORG = '11111111-1111-1111-1111-111111111111';

const row = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `run-${n}`,
  model: 'openai/gpt-image',
  prompt: `prompt ${n}`,
  cost_usd: 0.04,
  created_at: `2026-10-0${n}T00:00:00Z`,
  nodes: { id: `node-${n}`, project_id: `project-${n}`, canvas_id: `canvas-${n}`, display_name: `Node ${n}` },
  assets: { id: `asset-${n}`, type: 'image', url: `org/p/${n}.png`, mime_type: 'image/png', content: null, source: 'generated' },
  ...overrides
});

describe('la cronologia delle generazioni attraversa i progetti', () => {
  it('legge per org, solo giri finiti, i più recenti per primi', async () => {
    const { db, calls } = fakeDb({ node_runs: [row(2), row(1)] });

    const page = await listRunHistory(db, { orgId: ORG });

    expect(page.items.map((i) => i.runId)).toEqual(['run-2', 'run-1']);
    expect(filtersOf(calls, 'select')).toMatchObject({ org_id: ORG, status: 'done' });
    expect(calls[0].order?.[0]).toBe('created_at');
  });

  it('porta progetto, tela e nodo di origine di ogni giro', async () => {
    const { db } = fakeDb({ node_runs: [row(3)] });

    const [item] = (await listRunHistory(db, { orgId: ORG })).items;

    expect(item).toMatchObject({ projectId: 'project-3', canvasId: 'canvas-3', nodeId: 'node-3', nodeName: 'Node 3' });
    expect(item.asset).toMatchObject({ id: 'asset-3', type: 'image', url: 'org/p/3.png' });
  });

  it('filtra per modello e per progetto nella query, non dopo', async () => {
    const { db, calls } = fakeDb({ node_runs: [] });

    await listRunHistory(db, { orgId: ORG, model: 'openai/gpt-image', projectId: 'project-1' });

    expect(filtersOf(calls, 'select')).toMatchObject({ model: 'openai/gpt-image', 'nodes.project_id': 'project-1' });
  });

  it('chiede una riga in più per sapere se c è un altra pagina', async () => {
    const rows = Array.from({ length: RUN_HISTORY_PAGE + 1 }, (_, i) => row(1, { id: `run-${i}` }));
    const { db, calls } = fakeDb({ node_runs: rows });

    const page = await listRunHistory(db, { orgId: ORG });

    expect(calls[0].limit).toBe(RUN_HISTORY_PAGE + 1);
    expect(page.items).toHaveLength(RUN_HISTORY_PAGE);
    expect(page.nextBefore).toBe(page.items[RUN_HISTORY_PAGE - 1].createdAt);
  });

  it('la pagina dopo parte da prima dell ultimo giro visto', async () => {
    const { db, calls } = fakeDb({ node_runs: [] });

    await listRunHistory(db, { orgId: ORG, before: '2026-10-01T00:00:00Z' });

    expect(filtersOf(calls, 'select')).toMatchObject({ created_at: '2026-10-01T00:00:00Z' });
  });
});
