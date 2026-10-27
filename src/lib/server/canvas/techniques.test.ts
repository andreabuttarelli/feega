import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const enqueueWorkflow = vi.fn();
vi.mock('$lib/server/canvas/workflow', () => ({ enqueueWorkflow: (...args: unknown[]) => enqueueWorkflow(...args) }));

import { saveFromSelection, runTechnique, TechniqueRun } from './techniques';

const ORG = 'org-1';
const PROJECT = 'proj-1';
const CANVAS = 'canvas-1';
const USER = 'user-1';
const ACTOR = { kind: 'agent' as const, id: USER };

const nodeRow = (id: string, type: string, x: number, data: Record<string, unknown>) => ({
  id, org_id: ORG, project_id: PROJECT, canvas_id: CANVAS, type, display_name: null, x, y: 0, z: 0, width: null, height: null, data, version: 1, deleted_at: null
});
const edgeRow = (id: string, source: string, target: string) => ({ id, org_id: ORG, canvas_id: CANVAS, source_node_id: source, target_node_id: target, source_handle: 'derives_from', target_handle: 'text', mode: 'fixed', deleted_at: null });

beforeEach(() => {
  vi.clearAllMocks();
  enqueueWorkflow.mockResolvedValue({ kind: 'enqueued', workflowId: 'wf-1', steps: [], runIdByNodeId: {} });
});

describe('saveFromSelection', () => {
  it('stores the selected flow with its slots, once per org and name', async () => {
    const fake = fakeDb({ nodes: [nodeRow('a', 'text', 0, { prompt: 'idea' }), nodeRow('b', 'image', 400, { prompt: 'pic' })], nodes_connections: [edgeRow('e', 'a', 'b')], techniques: [] }, { filter: true });

    const out = await saveFromSelection(fake.db, { orgId: ORG, canvasId: CANVAS, nodeIds: ['a', 'b'], name: 'idea-to-picture', actor: ACTOR });

    expect(out).toMatchObject({ outcome: 'saved', technique: { name: 'idea-to-picture', inputs: [{ node: 0, type: 'text' }], outputs: [{ node: 1, type: 'image' }] } });
    expect(fake.calls.find((c) => c.table === 'techniques' && c.op === 'insert')!.payload).toMatchObject({ org_id: ORG, name: 'idea-to-picture' });
  });

  it('refuses a selection that is not one flow', async () => {
    const fake = fakeDb({ nodes: [nodeRow('a', 'text', 0, {}), nodeRow('b', 'image', 400, {})], nodes_connections: [], techniques: [] }, { filter: true });

    const out = await saveFromSelection(fake.db, { orgId: ORG, canvasId: CANVAS, nodeIds: ['a', 'b'], name: 'x', actor: ACTOR });

    expect(out).toEqual({ outcome: 'refused', error: 'The selected nodes are not all connected' });
  });
});

describe('runTechnique', () => {
  const stored = {
    id: 'tech-1', org_id: ORG, name: 'idea-to-picture', version: 1, deleted_at: null,
    plan: {
      nodes: [{ sourceIndex: 0, type: 'text', data: { prompt: 'old' }, x: 0, y: 0 }, { sourceIndex: 1, type: 'image', data: { prompt: 'pic' }, x: 400, y: 0 }],
      edges: [{ sourceIndex: 0, targetIndex: 1, sourceHandle: 'derives_from', targetHandle: 'text' }]
    },
    inputs: [{ node: 0, type: 'text' }],
    outputs: [{ node: 1, type: 'image' }]
  };

  it('places the flow, fills the input slot and runs the inner graph', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [], techniques: [stored], canvas_events: [] }, { filter: true });

    const out = await runTechnique(fake.db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, userId: USER, techniqueId: 'tech-1', at: { x: 100, y: 100 }, inputs: [{ node: 0, value: 'a red bicycle' }], then: TechniqueRun.Run, actor: ACTOR });

    const inserted = fake.calls.filter((c) => c.table === 'nodes' && c.op === 'insert').map((c) => c.payload as { type: string; data: { prompt: string } });
    expect(inserted.map((n) => [n.type, n.data.prompt])).toEqual([['text', 'a red bicycle'], ['image', 'pic']]);
    expect(enqueueWorkflow).toHaveBeenCalledOnce();
    expect(out).toMatchObject({ outcome: 'queued', workflowId: 'wf-1' });
  });

  it('places the flow without running it when asked', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [], techniques: [stored], canvas_events: [] }, { filter: true });

    const out = await runTechnique(fake.db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, userId: USER, techniqueId: 'tech-1', at: { x: 0, y: 0 }, inputs: [], then: TechniqueRun.Place, actor: ACTOR });

    expect(enqueueWorkflow).not.toHaveBeenCalled();
    expect(out).toMatchObject({ outcome: 'placed' });
  });

  it('only places the flow when it has fewer than two generation nodes', async () => {
    const lone = { ...stored, plan: { nodes: [stored.plan.nodes[0], { sourceIndex: 1, type: 'doc', data: { content: '' }, x: 400, y: 0 }], edges: stored.plan.edges } };
    const fake = fakeDb({ nodes: [], nodes_connections: [], techniques: [lone], canvas_events: [] }, { filter: true });

    const out = await runTechnique(fake.db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, userId: USER, techniqueId: 'tech-1', at: { x: 0, y: 0 }, inputs: [], then: TechniqueRun.Run, actor: ACTOR });

    expect(enqueueWorkflow).not.toHaveBeenCalled();
    expect(out).toMatchObject({ outcome: 'placed' });
  });

  it('answers not_found for a technique of another org', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [], techniques: [{ ...stored, org_id: 'other' }] }, { filter: true });

    const out = await runTechnique(fake.db, { orgId: ORG, projectId: PROJECT, canvasId: CANVAS, userId: USER, techniqueId: 'tech-1', at: { x: 0, y: 0 }, inputs: [], then: TechniqueRun.Run, actor: ACTOR });

    expect(out).toEqual({ outcome: 'refused', error: 'technique_not_found' });
  });
});
