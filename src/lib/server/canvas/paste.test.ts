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

  it('a copied free element lands as an element node with its size and its drawing', async () => {
    const doc = { version: 5, fps: 30, width: 400, height: 200, durationInFrames: 150, background: 'transparent', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'box', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 } }] }], comps: {}, assets: [] };
    const fake = fakeDb({ nodes: [], nodes_connections: [], canvas_events: [], motion_revisions: [{ id: 'r', org_id: ORG, node_id: 'src', version: 2, doc, summary: null, actor_kind: 'user' }] }, { store: true });

    const out = await pasteNodes(fake.db, { ...SCOPE, nodes: [{ type: 'motion', data: { format: '16:9', docHeadRevision: 2, kind: 'element' }, x: 0, y: 0, source: 'src', width: 200, height: 100 }], edges: [] });

    if ('refused' in out) {
      throw new Error(out.refused);
    }
    expect(out.nodes[0]).toMatchObject({ type: 'element', size: { width: 200, height: 100 }, data: { docHeadRevision: 1 } });
    const revision = fake.calls.find((c) => c.table === 'motion_revisions' && c.op === 'insert');
    expect(revision?.payload).toMatchObject({ node_id: out.nodes[0]!.id, version: 1, doc: { tracks: [{ clips: [{ id: 'box' }] }] } });
  });
});
