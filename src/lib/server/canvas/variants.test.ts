import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { VariantInto } from '$lib/canvas/variants';

const runGenNode = vi.hoisted(() => vi.fn());
const allowlistRefusal = vi.hoisted(() => vi.fn());
const capRefusal = vi.hoisted(() => vi.fn());
const orgCreditBalance = vi.hoisted(() => vi.fn());

vi.mock('./generate', () => ({ runGenNode, VARIANT_GROUP_PARAM: 'variantGroup', VARIANT_SOURCE_PARAM: 'variantSource' }));
vi.mock('./node-model', () => ({ resolveModelIn: async (_mode: string, _medium: string, model: string | null) => ({ ok: true, model }) }));
vi.mock('$lib/server/model-allowlist/allowlist', () => ({ allowlistRefusal }));
vi.mock('$lib/server/spend-caps/gate', () => ({ capRefusal, liveCapReader: async () => ({}) }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance }));
vi.mock('$lib/server/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasModeOf: async () => 'standard', projectModeOf: async () => 'standard' }));

import { runGeneration, cancelVariants } from './variants';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const USER = '44444444-4444-4444-4444-444444444444';
const SOURCE = '55555555-5555-5555-5555-555555555555';
const INPUT_A = '66666666-6666-6666-6666-666666666666';
const MODEL = 'nano-banana-2';

const nodeRow = (id: string, type: string, data: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  id,
  org_id: ORG,
  canvas_id: CANVAS,
  project_id: PROJECT,
  type,
  display_name: null,
  x: 100,
  y: 50,
  z: 0,
  width: 300,
  height: 200,
  data,
  version: 3,
  deleted_at: null,
  ...over
});

const source = (type = 'image', data: Record<string, unknown> = {}) =>
  nodeRow(SOURCE, type, { prompt: 'a lake', model: MODEL, params: { aspectRatio: '1:1', variants: 4, variantsInto: 'nodes' }, ...data });

const wire = { id: 'c1', org_id: ORG, canvas_id: CANVAS, source_node_id: INPUT_A, target_node_id: SOURCE, source_handle: null, target_handle: 'images', mode: 'fixed', deleted_at: null };

const world = (rows: Record<string, unknown[]> = {}) =>
  fakeDb({ nodes: [source(), nodeRow(INPUT_A, 'image', {})], nodes_connections: [wire], node_runs: [], canvas_events: [], ...rows }, { filter: true, mutate: true, store: true });

const ask = (count: number, into: VariantInto, over: Record<string, unknown> = {}) => ({
  orgId: ORG,
  projectId: PROJECT,
  canvasId: CANVAS,
  nodeId: SOURCE,
  userId: USER,
  medium: 'image' as const,
  prompt: 'a lake',
  model: MODEL,
  params: { aspectRatio: '1:1', variants: count, variantsInto: into },
  expectedVersion: 3,
  count,
  into,
  ...over
});

const done = (nodeId: string) => ({ kind: 'done', run: { id: `run-${nodeId}`, nodeId }, asset: { id: `asset-${nodeId}` } });

const inserted = (calls: ReturnType<typeof world>['calls'], table: string) =>
  calls.filter((c) => c.table === table && c.op === 'insert').map((c) => c.payload as Record<string, unknown>);

beforeEach(() => {
  runGenNode.mockReset();
  runGenNode.mockImplementation(async (_db: unknown, run: { nodeId: string }) => done(run.nodeId));
  allowlistRefusal.mockReset();
  allowlistRefusal.mockResolvedValue(null);
  capRefusal.mockReset();
  capRefusal.mockResolvedValue(null);
  orgCreditBalance.mockReset();
  orgCreditBalance.mockResolvedValue(10_000);
});

describe('one variant', () => {
  it('is the plain run, untouched', async () => {
    const { db, calls } = world();

    const out = await runGeneration(db, ask(1, VariantInto.Nodes));

    expect(out.kind).toBe('done');
    expect(runGenNode).toHaveBeenCalledTimes(1);
    expect(runGenNode.mock.calls[0][1].variants).toBeUndefined();
    expect(inserted(calls, 'nodes')).toHaveLength(0);
  });
});

describe('variants into separate nodes', () => {
  it('makes four new nodes next to the source, one run each, source untouched', async () => {
    const { db, calls } = world();

    const out = await runGeneration(db, ask(4, VariantInto.Nodes));

    if (out.kind !== 'variants') {
      throw new Error(`expected variants, got ${out.kind}`);
    }
    const made = inserted(calls, 'nodes');
    expect(made).toHaveLength(4);
    expect(made.map((n) => [n.x, n.y])).toEqual([
      [440, 50],
      [780, 50],
      [440, 290],
      [780, 290]
    ]);
    expect(made.every((n) => n.type === 'image')).toBe(true);
    expect(made[0].data).toMatchObject({ prompt: 'a lake', model: MODEL, params: { aspectRatio: '1:1' } });
    expect(Object.keys((made[0].data as { params: object }).params)).not.toContain('variants');
    expect(out.nodeIds).toHaveLength(4);
    expect(runGenNode).toHaveBeenCalledTimes(4);
    expect(runGenNode.mock.calls.map((c) => c[1].nodeId).sort()).toEqual([...out.nodeIds].sort());
    expect(runGenNode.mock.calls.every((c) => c[1].nodeId !== SOURCE)).toBe(true);
  });

  it('wires every new node from the same inputs as the source', async () => {
    const { db, calls } = world();

    await runGeneration(db, ask(2, VariantInto.Nodes));

    const wired = inserted(calls, 'nodes_connections');
    expect(wired).toHaveLength(2);
    expect(wired.every((w) => w.source_node_id === INPUT_A && w.target_handle === 'images')).toBe(true);
    expect(new Set(wired.map((w) => w.target_node_id)).size).toBe(2);
  });

  it('tags the runs with one group and the source, on nodes of their own', async () => {
    const { db } = world();

    await runGeneration(db, ask(2, VariantInto.Nodes));

    const tags = runGenNode.mock.calls.map((c) => c[1].variants);
    expect(new Set(tags.map((t) => t.group)).size).toBe(1);
    expect(tags.every((t) => t.source === SOURCE && t.sharesNode === false)).toBe(true);
  });

  it('keeps going when one variant fails and says which', async () => {
    runGenNode
      .mockImplementationOnce(async (_db: unknown, run: { nodeId: string }) => done(run.nodeId))
      .mockImplementationOnce(async () => ({ kind: 'refused', error: 'render_failed' }));
    const { db } = world();

    const out = await runGeneration(db, ask(2, VariantInto.Nodes));

    if (out.kind !== 'variants') {
      throw new Error('expected variants');
    }
    expect(out.runs.map((r) => r.kind)).toEqual(['done', 'refused']);
  });
});

describe('variants into node history', () => {
  it('runs four times on the source itself and creates no node', async () => {
    const { db, calls } = world();

    const out = await runGeneration(db, ask(4, VariantInto.History));

    if (out.kind !== 'variants') {
      throw new Error('expected variants');
    }
    expect(inserted(calls, 'nodes')).toHaveLength(0);
    expect(runGenNode).toHaveBeenCalledTimes(4);
    expect(runGenNode.mock.calls.every((c) => c[1].nodeId === SOURCE && c[1].variants.sharesNode === true)).toBe(true);
    expect(out.nodeIds).toEqual([SOURCE]);
  });

  it('is a conflict, spending nothing, when the node moved on', async () => {
    const { db } = world();

    const out = await runGeneration(db, ask(4, VariantInto.History, { expectedVersion: 2 }));

    expect(out.kind).toBe('conflict');
    expect(runGenNode).not.toHaveBeenCalled();
  });
});

describe('before anything is spent', () => {
  const nothingHappened = (calls: ReturnType<typeof world>['calls']) => {
    expect(runGenNode).not.toHaveBeenCalled();
    expect(inserted(calls, 'nodes')).toHaveLength(0);
  };

  it('refuses a medium that has no variants', async () => {
    const { db, calls } = world({ nodes: [source('text')] });

    const out = await runGeneration(db, ask(2, VariantInto.Nodes, { medium: 'text' }));

    expect(out).toEqual({ kind: 'refused', error: 'variants_unsupported' });
    nothingHappened(calls);
  });

  it('refuses more variants than the medium allows', async () => {
    const { db, calls } = world({ nodes: [source('video')] });

    const out = await runGeneration(db, ask(8, VariantInto.Nodes, { medium: 'video' }));

    expect(out).toEqual({ kind: 'refused', error: 'too_many_variants' });
    nothingHappened(calls);
  });

  it('applies the model allow-list', async () => {
    allowlistRefusal.mockResolvedValue('This model is not enabled for your organization.');
    const { db, calls } = world();

    const out = await runGeneration(db, ask(4, VariantInto.Nodes));

    expect(out).toEqual({ kind: 'refused', error: 'This model is not enabled for your organization.' });
    nothingHappened(calls);
  });

  it('applies the spend caps', async () => {
    capRefusal.mockResolvedValue('cap_reached: your spending limit is reached.');
    const { db, calls } = world();

    const out = await runGeneration(db, ask(4, VariantInto.Nodes));

    expect(out).toEqual({ kind: 'refused', error: 'cap_reached: your spending limit is reached.' });
    nothingHappened(calls);
  });

  it('checks credits for the whole batch, not one run', async () => {
    orgCreditBalance.mockResolvedValue(1);
    const { db, calls } = world();

    const out = await runGeneration(db, ask(4, VariantInto.Nodes));

    expect(out).toEqual({ kind: 'refused', error: 'credits_exhausted' });
    nothingHappened(calls);
  });

  it('quotes variants times the price of one run', async () => {
    const { db } = world();

    const out = await runGeneration(db, ask(4, VariantInto.Nodes));

    if (out.kind !== 'variants') {
      throw new Error('expected variants');
    }
    expect(out.credits).toBeGreaterThan(0);
    expect(out.credits! % 4).toBe(0);
  });
});

describe('cancel all', () => {
  const tagged = (id: string, nodeId: string, over: Record<string, unknown> = {}) => ({
    id,
    org_id: ORG,
    node_id: nodeId,
    status: 'running',
    params: { variantGroup: 'g1', variantSource: SOURCE },
    started_at: '2026-10-24T00:00:00Z',
    ...over
  });

  it('fails the in-flight runs of the source batch and frees their nodes', async () => {
    const other = 'new-node';
    const { db, calls } = world({
      nodes: [source(), nodeRow(other, 'image', { running: true, runId: 'r2' }), nodeRow('stranger', 'image', { running: true, runId: 'r3' })],
      node_runs: [tagged('r1', SOURCE), tagged('r2', other), tagged('r3', 'stranger', { params: { variantGroup: 'g9', variantSource: 'elsewhere' } }), tagged('r4', other, { status: 'done' })]
    });

    const out = await cancelVariants(db, { orgId: ORG, nodeId: SOURCE });

    expect(out).toEqual({ cancelled: 2 });
    const failed = calls.filter((c) => c.table === 'node_runs' && c.op === 'update');
    expect(failed.map((c) => c.filters.find(([k]) => k === 'id')?.[1]).sort()).toEqual(['r1', 'r2']);
    expect(failed.every((c) => (c.payload as { error: string }).error === 'cancelled')).toBe(true);
  });
});
