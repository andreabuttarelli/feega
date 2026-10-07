import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';

const repo = vi.hoisted(() => ({
  findNode: vi.fn(),
  createNode: vi.fn(),
  createConnection: vi.fn(),
  listConnections: vi.fn(),
  listNodes: vi.fn(),
  patchNodeData: vi.fn()
}));
const applyEffectsNode = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), ...repo }));
vi.mock('./apply-effects', () => ({ applyEffectsNode }));

import { applyEffectsTo, makeEffectsPair } from './effects-actions';

const db = {} as Db;
const orgId = 'org-1';
const actor = { kind: 'agent' as const, id: 'user-1' };
const cutout = { id: 'shape-cutout', params: { side: 'shapes', seed: 3 }, enabled: true };

const node = (id: string, type: string, data: Record<string, unknown>) => ({
  id,
  canvasId: 'canvas-1',
  projectId: 'project-1',
  type,
  displayName: null,
  position: { x: 100, y: 50, z: 0 },
  size: { width: 300, height: null },
  data,
  version: 1
});

const image = node('image-1', 'image', { refId: 'asset-in' });

beforeEach(() => {
  vi.clearAllMocks();
  repo.createNode.mockImplementation(async (_db, input) => node('fx-new', input.type, input.data));
  repo.listNodes.mockResolvedValue([]);
  repo.createConnection.mockImplementation(async (_db, input) => ({ id: 'edge-new', ...input }));
  applyEffectsNode.mockResolvedValue({ outcome: 'applied', asset: { id: 'asset-out' } });
});

describe('applyEffectsTo', () => {
  it('on an image node: creates an effects node beside it, wires it and renders the chain', async () => {
    repo.findNode.mockResolvedValue(image);

    const out = await applyEffectsTo(db, { orgId, nodeId: 'image-1', effects: [{ id: 'posterize', params: { levels: 3 } }], actor });

    expect(out).toEqual({ outcome: 'applied', nodeId: 'fx-new', assetId: 'asset-out' });
    const created = repo.createNode.mock.calls[0][1];
    expect(created.type).toBe('effects');
    expect(created.x).toBeGreaterThan(100 + 300);
    expect(created.data).toMatchObject({ sourceRefId: 'asset-in', effects: [{ id: 'posterize', params: { levels: 3 }, enabled: true }] });
    expect(repo.createConnection.mock.calls[0][1]).toMatchObject({ sourceNodeId: 'image-1', targetNodeId: 'fx-new', targetHandle: 'images' });
    expect(applyEffectsNode).toHaveBeenCalledWith(db, { orgId, nodeId: 'fx-new', actor });
  });

  it('refuses an unknown effect or a bad param before writing anything', async () => {
    repo.findNode.mockResolvedValue(image);

    const unknown = await applyEffectsTo(db, { orgId, nodeId: 'image-1', effects: [{ id: 'blur-9000' }], actor });
    const outOfRange = await applyEffectsTo(db, { orgId, nodeId: 'image-1', effects: [{ id: 'posterize', params: { levels: 99 } }], actor });

    expect(unknown.outcome).toBe('refused');
    expect(outOfRange.outcome).toBe('refused');
    expect(repo.createNode).not.toHaveBeenCalled();
  });

  it('on an image node without effects: refused, there is nothing to apply', async () => {
    repo.findNode.mockResolvedValue(image);

    expect((await applyEffectsTo(db, { orgId, nodeId: 'image-1', actor })).outcome).toBe('refused');
  });

  it('on an effects node: replaces the stack when given, then renders', async () => {
    repo.findNode.mockResolvedValue(node('fx-1', 'effects', { effects: [], sourceRefId: 'asset-in' }));
    repo.patchNodeData.mockResolvedValue({ outcome: 'written', node: node('fx-1', 'effects', {}) });

    const out = await applyEffectsTo(db, { orgId, nodeId: 'fx-1', effects: [cutout], actor });

    expect(repo.patchNodeData.mock.calls[0][1].patch).toEqual({ effects: [cutout] });
    expect(out).toEqual({ outcome: 'applied', nodeId: 'fx-1', assetId: 'asset-out' });
  });

  it('on an effects node without effects: renders the stack already there', async () => {
    repo.findNode.mockResolvedValue(node('fx-1', 'effects', { effects: [cutout], sourceRefId: 'asset-in' }));

    await applyEffectsTo(db, { orgId, nodeId: 'fx-1', actor });

    expect(repo.patchNodeData).not.toHaveBeenCalled();
    expect(applyEffectsNode).toHaveBeenCalledWith(db, { orgId, nodeId: 'fx-1', actor });
  });

  it('refuses a node that is neither an image nor an effects node', async () => {
    repo.findNode.mockResolvedValue(node('t-1', 'text', { prompt: 'x' }));

    expect((await applyEffectsTo(db, { orgId, nodeId: 't-1', effects: [cutout], actor })).outcome).toBe('refused');
  });
});

describe('makeEffectsPair', () => {
  it('creates the twin with the other side, wired to the same image, and renders it', async () => {
    repo.findNode.mockResolvedValue(node('fx-1', 'effects', { effects: [cutout], sourceRefId: 'asset-in', refId: 'asset-a' }));
    repo.listConnections.mockResolvedValue([{ id: 'e1', sourceNodeId: 'image-1', targetNodeId: 'fx-1', sourceHandle: null, targetHandle: 'images' }]);

    const out = await makeEffectsPair(db, { orgId, nodeId: 'fx-1', actor });

    expect(out).toEqual({ outcome: 'applied', nodeId: 'fx-new', assetId: 'asset-out' });
    const twin = repo.createNode.mock.calls[0][1].data;
    expect(twin.effects[0].params).toEqual({ side: 'holes', seed: 3 });
    expect(twin.refId).toBeNull();
    expect(repo.createConnection.mock.calls[0][1]).toMatchObject({ sourceNodeId: 'image-1', targetNodeId: 'fx-new', targetHandle: 'images' });
  });

  it('on a node that already has its twin: returns the twin, creates nothing', async () => {
    const a = node('fx-1', 'effects', { effects: [cutout], sourceRefId: 'asset-in', refId: 'asset-a' });
    const b = node('fx-2', 'effects', { effects: [{ ...cutout, params: { seed: 3, side: 'holes' } }], sourceRefId: 'asset-in', refId: 'asset-b' });
    repo.findNode.mockResolvedValue(b);
    repo.listNodes.mockResolvedValue([a, b]);
    repo.listConnections.mockResolvedValue([
      { id: 'e1', sourceNodeId: 'image-1', targetNodeId: 'fx-1', sourceHandle: null, targetHandle: 'images' },
      { id: 'e2', sourceNodeId: 'image-1', targetNodeId: 'fx-2', sourceHandle: null, targetHandle: 'images' }
    ]);

    const out = await makeEffectsPair(db, { orgId, nodeId: 'fx-2', actor });

    expect(out).toEqual({ outcome: 'applied', nodeId: 'fx-1', assetId: 'asset-a' });
    expect(repo.createNode).not.toHaveBeenCalled();
    expect(applyEffectsNode).not.toHaveBeenCalled();
  });

  it('refuses a stack without a shape cutout', async () => {
    repo.findNode.mockResolvedValue(node('fx-1', 'effects', { effects: [{ id: 'posterize', params: {}, enabled: true }] }));

    expect((await makeEffectsPair(db, { orgId, nodeId: 'fx-1', actor })).outcome).toBe('refused');
    expect(repo.createNode).not.toHaveBeenCalled();
  });

  it('refuses when nothing feeds the node', async () => {
    repo.findNode.mockResolvedValue(node('fx-1', 'effects', { effects: [cutout] }));
    repo.listConnections.mockResolvedValue([]);

    expect((await makeEffectsPair(db, { orgId, nodeId: 'fx-1', actor })).outcome).toBe('refused');
  });
});
