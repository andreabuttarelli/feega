import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const runGenNode = vi.fn();
vi.mock('$lib/server/canvas/generate', () => ({ runGenNode: (...args: unknown[]) => runGenNode(...args) }));

import { GraphScope, enqueueGraph, planGraph } from './run-graph';
import { drainWorkflowQueue } from './workflow';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const USER = '44444444-4444-4444-4444-444444444444';
const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const node = (id: string, type: string) => ({
  id,
  org_id: ORG,
  canvas_id: CANVAS,
  project_id: PROJECT,
  type,
  display_name: null,
  x: 0,
  y: 0,
  z: 0,
  width: null,
  height: null,
  data: { prompt: `p-${id}` },
  version: 1,
  deleted_at: null
});

const edge = (source: string, target: string) => ({
  id: `${source}-${target}`,
  org_id: ORG,
  canvas_id: CANVAS,
  source_node_id: source,
  target_node_id: target,
  source_handle: null,
  target_handle: null,
  mode: 'fixed',
  deleted_at: null
});

const doneRun = (nodeId: string, finishedAt: string) => ({
  id: `done-${nodeId}`,
  org_id: ORG,
  node_id: nodeId,
  prompt: 'x',
  model: null,
  params: {},
  status: 'done',
  error: null,
  output_asset_id: 'asset',
  external_job_id: null,
  cost_usd: null,
  attempts: 0,
  started_at: finishedAt,
  finished_at: finishedAt,
  actor_kind: 'user',
  actor_id: USER
});

function chain(runs: unknown[] = []) {
  const rows: Record<string, unknown[]> = {
    nodes: [node(A, 'text'), node(B, 'image'), node(C, 'video')],
    nodes_connections: [edge(A, B), edge(B, C)],
    node_runs: runs,
    canvas_events: []
  };
  return { rows, ...fakeDb(rows, { filter: true, mutate: true, store: true }) };
}

const scope = { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, userId: USER };

beforeEach(() => {
  runGenNode.mockReset();
  runGenNode.mockImplementation(async (_db: unknown, input: { nodeId: string }) => ({
    kind: 'done',
    run: { id: `gen-${input.nodeId}`, costUsd: 0.01 },
    asset: { id: `asset-${input.nodeId}`, type: 'image' }
  }));
});

const queued = (rows: Record<string, unknown[]>) =>
  (rows.node_runs as { node_id: string; params: { workflow?: unknown } }[]).filter((r) => r.params.workflow);

describe('run downstream', () => {
  it('quotes the chain before anything is queued', async () => {
    const { db, rows } = chain();

    const quote = await planGraph(db, { ...scope, graph: GraphScope.Downstream, nodeId: A });

    expect(quote.plan.ok && quote.plan.steps.map((s) => s.nodeId)).toEqual([A, B, C]);
    expect(quote.credits).toBeGreaterThan(0);
    expect(queued(rows)).toHaveLength(0);
  });

  it('a 3-node chain queues 3 runs in order, and the tick runs them in that order', async () => {
    const { db, rows } = chain();

    const out = await enqueueGraph(db, { ...scope, graph: GraphScope.Downstream, nodeId: A });

    expect(out.kind).toBe('enqueued');
    expect(queued(rows).map((r) => r.node_id)).toEqual([A, B, C]);
    expect(runGenNode).not.toHaveBeenCalled();

    await drainWorkflowQueue(db, { limit: 10 });

    expect(runGenNode.mock.calls.map(([, input]) => input.nodeId)).toEqual([A, B, C]);
  });

  it('from the middle, only the node and what it feeds', async () => {
    const { db, rows } = chain();

    await enqueueGraph(db, { ...scope, graph: GraphScope.Downstream, nodeId: B });

    expect(queued(rows).map((r) => r.node_id)).toEqual([B, C]);
  });

  it('a cycle is refused before anything is queued', async () => {
    const { db, rows } = chain();
    rows.nodes_connections.push(edge(C, A));

    const out = await enqueueGraph(db, { ...scope, graph: GraphScope.Downstream, nodeId: A });

    expect(out).toEqual({ kind: 'refused', error: 'The connections form a cycle' });
    expect(queued(rows)).toHaveLength(0);
  });
});

describe('run stale', () => {
  it('queues only the results older than their inputs', async () => {
    const { db, rows } = chain([doneRun(A, '2026-10-03T00:00:00Z'), doneRun(B, '2026-10-01T00:00:00Z'), doneRun(C, '2026-10-02T00:00:00Z')]);

    await enqueueGraph(db, { ...scope, graph: GraphScope.Stale });

    expect(queued(rows).map((r) => r.node_id)).toEqual([B, C]);
  });

  it('within a selection, only its stale nodes', async () => {
    const { db, rows } = chain([doneRun(A, '2026-10-03T00:00:00Z'), doneRun(B, '2026-10-01T00:00:00Z'), doneRun(C, '2026-10-02T00:00:00Z')]);

    await enqueueGraph(db, { ...scope, graph: GraphScope.Stale, nodeIds: [C] });

    expect(queued(rows).map((r) => r.node_id)).toEqual([C]);
  });

  it('nothing stale is refused, not an empty run', async () => {
    const { db } = chain([doneRun(A, '2026-10-01T00:00:00Z'), doneRun(B, '2026-10-02T00:00:00Z'), doneRun(C, '2026-10-03T00:00:00Z')]);

    const out = await enqueueGraph(db, { ...scope, graph: GraphScope.Stale });

    expect(out).toEqual({ kind: 'refused', error: 'Nothing to run' });
  });
});
