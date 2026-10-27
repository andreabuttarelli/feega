import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';

const enqueueWorkflow = vi.fn();
const cancelWorkflow = vi.fn();
vi.mock('$lib/server/canvas/workflow', async () => ({
  ...(await vi.importActual<object>('$lib/server/canvas/workflow')),
  enqueueWorkflow: (...args: unknown[]) => enqueueWorkflow(...args),
  cancelWorkflow: (...args: unknown[]) => cancelWorkflow(...args)
}));

import { cancelRows, detachInstance, openDefinition, placeInstance, previewRows, rowsProgress, runRows, InstancePlaced, runInstance } from './technique-instance';

const ORG = 'org-1';
const PROJECT = 'proj-1';
const CANVAS = 'canvas-1';
const USER = 'user-1';
const ACTOR = { kind: 'user' as const, id: USER };
const TECH = '11111111-1111-4111-8111-111111111111';
const NODE = '22222222-2222-4222-8222-222222222222';

const technique = (version: number, prompt: string) => ({
  id: TECH, org_id: ORG, name: 'idea-to-picture', version, deleted_at: null,
  plan: {
    nodes: [{ sourceIndex: 0, type: 'text', data: { prompt: 'old' }, x: 0, y: 0 }, { sourceIndex: 1, type: 'image', data: { prompt }, x: 400, y: 0 }],
    edges: [{ sourceIndex: 0, targetIndex: 1, sourceHandle: 'derives_from', targetHandle: 'text' }]
  },
  inputs: [{ node: 0, type: 'text' }],
  outputs: [{ node: 1, type: 'image' }]
});

const nodeRow = (id: string, canvasId: string, type: string, x: number, y: number, data: Record<string, unknown>) => ({
  id, org_id: ORG, project_id: PROJECT, canvas_id: canvasId, type, display_name: null, x, y, z: 0, width: null, height: null, data, version: 1, deleted_at: null
});

const canvasRow = (id: string, name: string) => ({ id, org_id: ORG, project_id: PROJECT, name, deleted_at: null, created_at: '2026-10-24', updated_at: '2026-10-24', last_edited_at: '2026-10-24', viewport: null, share_token: null, shared_at: null });

const inserted = (calls: { table: string; op: string; payload?: unknown }[], table: string) => calls.filter((c) => c.table === table && c.op === 'insert').map((c) => c.payload as Record<string, unknown> & { type?: string; data?: Record<string, unknown> });

function rejectingTechniqueNodes(db: Db): Db {
  const refused = { select: () => ({ single: async () => ({ data: null, error: { code: '23514', message: 'violates check constraint "nodes_type_check"' } }) }) };
  return { ...db, from: (table: string) => {
    const builder = db.from(table as never) as unknown as Record<string, unknown>;
    if (table !== 'nodes') {
      return builder;
    }
    return { ...builder, insert: (row: { type: string }) => (row.type === 'technique' ? refused : (builder.insert as (r: unknown) => unknown)(row)) };
  } } as unknown as Db;
}

beforeEach(() => {
  vi.clearAllMocks();
  enqueueWorkflow.mockResolvedValue({ kind: 'enqueued', workflowId: 'wf-1', steps: [], runIdByNodeId: {} });
});

const place = (db: Db) => placeInstance(db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, userId: USER, techniqueId: TECH, at: { x: 50, y: 60 }, actor: ACTOR });

describe('placeInstance', () => {
  it('places one node that points at the technique, not a copy of its graph', async () => {
    const fake = fakeDb({ nodes: [], techniques: [technique(1, 'pic')], canvas_events: [] }, { filter: true });

    const out = await place(fake.db);

    const nodes = inserted(fake.calls, 'nodes');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'technique', x: 50, y: 60, data: { techniqueId: TECH, name: 'idea-to-picture' } });
    expect(out).toMatchObject({ outcome: 'placed', mode: InstancePlaced.Live });
  });

  it('falls back to a copy, and says why, while the database does not allow the node type', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [], techniques: [technique(1, 'pic')], canvas_events: [] }, { filter: true });

    const out = await place(rejectingTechniqueNodes(fake.db));

    expect(inserted(fake.calls, 'nodes').map((n) => n.type)).toEqual(['text', 'image']);
    expect(out).toMatchObject({ outcome: 'placed', mode: InstancePlaced.Copy, message: expect.stringContaining('copy') });
  });

  it('refuses a technique of another org', async () => {
    const fake = fakeDb({ nodes: [], techniques: [{ ...technique(1, 'pic'), org_id: 'other' }] }, { filter: true });

    expect(await place(fake.db)).toEqual({ outcome: 'refused', error: 'technique_not_found' });
  });
});

describe('runInstance', () => {
  const instance = nodeRow(NODE, CANVAS, 'technique', 50, 60, { techniqueId: TECH, name: 'idea-to-picture' });
  const brief = nodeRow('doc-1', CANVAS, 'doc', 0, 0, { content: 'a red bicycle' });
  const wire = { id: 'e1', org_id: ORG, canvas_id: CANVAS, source_node_id: 'doc-1', target_node_id: NODE, source_handle: 'derives_from', target_handle: 'text', mode: 'fixed', deleted_at: null };
  const ask = { orgId: ORG, projectId: PROJECT, userId: USER, nodeId: NODE, actor: ACTOR };

  function world(version: number, imagePrompt: string) {
    return fakeDb({ nodes: [instance, brief], nodes_connections: [wire], techniques: [technique(version, imagePrompt)], canvases: [canvasRow(CANVAS, 'Main')], canvas_events: [] }, { filter: true, store: true });
  }

  it('runs the saved inner graph with what is wired into the instance', async () => {
    const fake = world(1, 'pic');

    const out = await runInstance(fake.db, ask);

    const inner = inserted(fake.calls, 'nodes').map((n) => [n.type, (n.data as { prompt: string }).prompt]);
    expect(inner).toEqual([['text', 'a red bicycle'], ['image', 'pic']]);
    expect(enqueueWorkflow).toHaveBeenCalledOnce();
    expect(out).toMatchObject({ outcome: 'queued', workflowId: 'wf-1' });
  });

  it('runs the inner graph on its own canvas, never on the canvas of the instance', async () => {
    const fake = world(1, 'pic');

    await runInstance(fake.db, ask);

    const [made] = inserted(fake.calls, 'canvases');
    expect(made).toMatchObject({ name: 'Technique runs' });
    const runCanvas = (enqueueWorkflow.mock.calls[0][1] as { canvasId: string }).canvasId;
    expect(runCanvas).not.toBe(CANVAS);
  });

  it('follows the definition: a new version changes what the same instance runs', async () => {
    const first = world(1, 'pic');
    await runInstance(first.db, ask);

    const second = world(2, 'a sharper picture');
    await runInstance(second.db, ask);

    const prompts = (fake: typeof second) => inserted(fake.calls, 'nodes').map((n) => (n.data as { prompt: string }).prompt);
    expect(prompts(first)).toEqual(['a red bicycle', 'pic']);
    expect(prompts(second)).toEqual(['a red bicycle', 'a sharper picture']);
    const stamped = second.calls.filter((c) => c.table === 'nodes' && c.op === 'update').map((c) => c.payload as { data?: { ranVersion?: number } });
    expect(stamped.some((p) => p.data?.ranVersion === 2)).toBe(true);
  });

  it('refuses a node that is not a technique instance', async () => {
    const fake = fakeDb({ nodes: [brief], techniques: [technique(1, 'pic')] }, { filter: true });

    expect(await runInstance(fake.db, { ...ask, nodeId: 'doc-1' })).toEqual({ outcome: 'refused', error: 'not_a_technique' });
  });

  it('refuses when the technique was deleted', async () => {
    const fake = fakeDb({ nodes: [instance], techniques: [{ ...technique(1, 'pic'), deleted_at: '2026-10-24' }] }, { filter: true });

    expect(await runInstance(fake.db, ask)).toEqual({ outcome: 'refused', error: 'technique_not_found' });
  });
});

describe('detachInstance', () => {
  it('replaces the instance with an explicit copy of the graph, where it stood', async () => {
    const instance = nodeRow(NODE, CANVAS, 'technique', 50, 60, { techniqueId: TECH, name: 'idea-to-picture' });
    const fake = fakeDb({ nodes: [instance], nodes_connections: [], techniques: [technique(1, 'pic')], canvas_events: [] }, { filter: true, store: true });

    const out = await detachInstance(fake.db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, nodeId: NODE, actor: ACTOR });

    expect(inserted(fake.calls, 'nodes').map((n) => [n.type, (n as { x: number }).x])).toEqual([['text', 50], ['image', 450]]);
    expect(fake.calls.some((c) => c.table === 'nodes' && c.op === 'update' && (c.payload as { deleted_at?: string }).deleted_at)).toBe(true);
    expect(out).toMatchObject({ outcome: 'detached', removedId: NODE });
  });
});

describe('openDefinition', () => {
  it('writes the saved graph on its own canvas so it can be edited and saved again', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [], techniques: [technique(3, 'pic')], canvases: [], canvas_events: [] }, { filter: true, store: true });

    const out = await openDefinition(fake.db, { orgId: ORG, projectId: PROJECT, techniqueId: TECH, actor: ACTOR });

    expect(inserted(fake.calls, 'canvases')[0]).toMatchObject({ name: 'Technique: idea-to-picture' });
    expect(inserted(fake.calls, 'nodes').map((n) => n.type)).toEqual(['text', 'image']);
    expect(out).toMatchObject({ outcome: 'opened', canvasId: expect.any(String) });
  });
});

describe('rows', () => {
  const rows = [['red bike'], ['blue bike']];
  const base = { orgId: ORG, projectId: PROJECT, userId: USER, techniqueId: TECH, actor: ACTOR };
  const world = () => fakeDb({ nodes: [], nodes_connections: [], techniques: [technique(1, 'pic')], canvases: [canvasRow(CANVAS, 'Main')], canvas_events: [] }, { filter: true, store: true });

  it('prices every row before anything is written', async () => {
    const fake = world();

    const out = await previewRows(fake.db, { ...base, rowCount: 3 });

    expect(out).toMatchObject({ outcome: 'preview', rows: 3, credits: 3 * (out as { creditsPerRow: number }).creditsPerRow });
    expect((out as { creditsPerRow: number }).creditsPerRow).toBeGreaterThan(0);
    expect(inserted(fake.calls, 'nodes')).toHaveLength(0);
  });

  it('writes one output group per row, each on its own band, and queues each', async () => {
    const fake = world();
    enqueueWorkflow.mockResolvedValueOnce({ kind: 'enqueued', workflowId: 'wf-1', steps: [], runIdByNodeId: { a: 'r1' } });
    enqueueWorkflow.mockResolvedValueOnce({ kind: 'enqueued', workflowId: 'wf-2', steps: [], runIdByNodeId: { b: 'r2' } });

    const out = await runRows(fake.db, { ...base, rows, mapping: null });

    const nodes = inserted(fake.calls, 'nodes');
    expect(nodes.map((n) => (n.data as { prompt: string }).prompt)).toEqual(['red bike', 'pic', 'blue bike', 'pic']);
    expect(new Set(nodes.map((n) => n.y)).size).toBe(2);
    expect(out).toMatchObject({ outcome: 'queued', workflowIds: ['wf-1', 'wf-2'], runIds: ['r1', 'r2'] });
  });

  it('refuses more rows than the cap and an empty list', async () => {
    const fake = world();

    expect(await runRows(fake.db, { ...base, rows: Array.from({ length: 51 }, () => []), mapping: null })).toEqual({ outcome: 'refused', error: 'too_many_rows' });
    expect(await runRows(fake.db, { ...base, rows: [], mapping: null })).toEqual({ outcome: 'refused', error: 'no_rows' });
  });

  it('maps columns to slots by the given mapping, leaving the others empty', async () => {
    const fake = world();
    enqueueWorkflow.mockResolvedValue({ kind: 'enqueued', workflowId: 'wf', steps: [], runIdByNodeId: {} });

    await runRows(fake.db, { ...base, rows: [['ignored', 'blue bike']], mapping: [1] });

    expect(inserted(fake.calls, 'nodes').map((n) => (n.data as { prompt: string }).prompt)).toEqual(['blue bike', 'pic']);
  });

  it('counts runs by state for the progress bar', async () => {
    const run = (id: string, status: string) => ({ id, org_id: ORG, node_id: 'n', prompt: null, model: null, params: {}, status, error: null, output_asset_id: null, external_job_id: null, cost_usd: null, attempts: 0, actor_id: null, started_at: 'x', finished_at: null });
    const fake = fakeDb({ node_runs: [run('r1', 'done'), run('r2', 'failed'), run('r3', 'running')] }, { filter: true });

    expect(await rowsProgress(fake.db, { runIds: ['r1', 'r2', 'r3'] })).toEqual({ total: 3, done: 1, failed: 1, running: 1 });
  });

  it('cancels every workflow of the batch', async () => {
    cancelWorkflow.mockResolvedValue({ cancelled: 2 });

    const out = await cancelRows(world().db, { orgId: ORG, workflowIds: ['wf-1', 'wf-2'] });

    expect(cancelWorkflow).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ cancelled: 4 });
  });
});
