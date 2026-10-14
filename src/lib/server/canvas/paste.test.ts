import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { pasteNodes } from './paste';

const ORG = '11111111-1111-1111-1111-111111111111';
const CANVAS = '22222222-2222-2222-2222-222222222222';
const SCOPE = { orgId: ORG, projectId: 'p', canvasId: CANVAS, actor: { kind: 'user' as const, id: 'user-1' } };

const emptyDb = () => fakeDb({ nodes: [], nodes_connections: [], canvas_events: [] }, { store: true }).db;

describe('pasteNodes', () => {
  it('creates the nodes, then wires the edges by their index in the paste', async () => {
    const out = await pasteNodes(emptyDb(), {
      ...SCOPE,
      nodes: [
        { type: 'text', data: { prompt: 'a' }, x: 0, y: 0 },
        { type: 'text', data: { prompt: 'b' }, x: 10, y: 0 }
      ],
      edges: [
        { sourceIndex: 0, targetIndex: 1, sourceHandle: null, targetHandle: null },
        { sourceIndex: 0, targetIndex: 9, sourceHandle: null, targetHandle: null }
      ]
    });

    if ('refused' in out) {
      throw new Error(out.refused);
    }
    expect(out.nodes).toHaveLength(2);
    expect(out.connections).toHaveLength(1);
    expect(out.connections[0]!.sourceNodeId).toBe(out.nodes[0]!.id);
  });

  it('refuses a node whose data does not fit its type', async () => {
    const out = await pasteNodes(emptyDb(), { ...SCOPE, nodes: [{ type: 'nope', data: {}, x: 0, y: 0 }], edges: [] });

    expect('refused' in out).toBe(true);
  });
});
