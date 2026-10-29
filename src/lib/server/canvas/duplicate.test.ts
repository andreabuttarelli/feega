import { describe, expect, it } from 'vitest';
import { duplicateNodes } from './duplicate';
import { fakeDb } from '$lib/server/db/fake-db';

const scope = { orgId: 'org', projectId: 'project', canvasId: 'canvas' };

describe('duplicare una selezione', () => {
  it('crea un nodo nuovo per ogni tile scelta, con lo stesso tipo e contenuto', async () => {
    const fake = fakeDb({
      nodes: [
        { id: 'a', canvas_id: 'canvas', project_id: 'project', type: 'text', display_name: null, x: 10, y: 20, z: 0, width: null, height: null, data: { prompt: 'ciao' }, version: 1 }
      ],
      nodes_connections: []
    });

    const out = await duplicateNodes(fake.db, { ...scope, nodeIds: ['a'], actor: { kind: 'user', id: 'user' } });

    expect(out.nodes).toHaveLength(1);
    const insert = fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ type: 'text', data: { prompt: 'ciao' } });
  });

  it('sposta ogni copia del passo dato, non la lascia sopra l’originale', async () => {
    const fake = fakeDb({
      nodes: [
        { id: 'a', canvas_id: 'canvas', project_id: 'project', type: 'text', display_name: null, x: 10, y: 20, z: 0, width: null, height: null, data: {}, version: 1 }
      ],
      nodes_connections: []
    });

    await duplicateNodes(fake.db, { ...scope, nodeIds: ['a'], actor: { kind: 'user', id: 'user' } });

    const insert = fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ x: 42, y: 52 });
  });

  it('usa lo scarto chiesto quando arriva, come un trascinamento con Option', async () => {
    const fake = fakeDb({
      nodes: [
        { id: 'a', canvas_id: 'canvas', project_id: 'project', type: 'text', display_name: null, x: 10, y: 20, z: 0, width: null, height: null, data: {}, version: 1 }
      ],
      nodes_connections: []
    });

    await duplicateNodes(fake.db, { ...scope, nodeIds: ['a'], offset: { dx: 300, dy: -5 }, actor: { kind: 'user', id: 'user' } });

    const insert = fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ x: 310, y: 15 });
  });

  it('non prova a collegare un nodo scelto a uno fuori dalla selezione', async () => {
    const fake = fakeDb({
      nodes: [
        { id: 'a', canvas_id: 'canvas', project_id: 'project', type: 'text', display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data: {}, version: 1 },
        { id: 'b', canvas_id: 'canvas', project_id: 'project', type: 'image', display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data: {}, version: 1 }
      ],
      nodes_connections: [
        { id: 'e1', canvas_id: 'canvas', source_node_id: 'a', target_node_id: 'b', source_handle: 'text', target_handle: 'text' }
      ]
    });

    await duplicateNodes(fake.db, { ...scope, nodeIds: ['a'], actor: { kind: 'user', id: 'user' } });

    expect(fake.calls.some((c) => c.table === 'nodes_connections' && c.op === 'insert')).toBe(false);
  });

  it('writes each copy under the id the canvas already drew it with', async () => {
    const fake = fakeDb({
      nodes: [
        { id: 'a', canvas_id: 'canvas', project_id: 'project', type: 'text', display_name: null, x: 10, y: 20, z: 0, width: null, height: null, data: {}, version: 1 }
      ],
      nodes_connections: []
    });

    await duplicateNodes(fake.db, { ...scope, nodeIds: ['a'], copyIds: { a: 'a-copy' }, actor: { kind: 'user', id: 'user' } });

    const insert = fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ id: 'a-copy' });
  });

  it('senza id da duplicare non scrive niente', async () => {
    const fake = fakeDb({ nodes: [], nodes_connections: [] });

    const out = await duplicateNodes(fake.db, { ...scope, nodeIds: [], actor: { kind: 'user', id: 'user' } });

    expect(out.nodes).toEqual([]);
    expect(fake.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('a free element duplicates as an element node with its size and its drawing', async () => {
    const doc = { version: 5, fps: 30, width: 400, height: 200, durationInFrames: 150, background: 'transparent', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'box', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 } }] }], comps: {}, assets: [] };
    const fake = fakeDb({
      nodes: [{ id: 'e', canvas_id: 'canvas', project_id: 'project', type: 'motion', display_name: 'Box', x: 0, y: 0, z: 0, width: 200, height: 100, data: { format: '16:9', docHeadRevision: 3, kind: 'element' }, version: 1 }],
      nodes_connections: [],
      motion_revisions: [{ id: 'r', org_id: 'org', node_id: 'e', version: 3, doc, summary: null, actor_kind: 'user' }]
    });

    await duplicateNodes(fake.db, { ...scope, nodeIds: ['e'], actor: { kind: 'user', id: 'user' } });

    const insert = fake.calls.find((c) => c.table === 'nodes' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ type: 'element', width: 200, height: 100, data: { docHeadRevision: 1 } });
    expect((insert?.payload as { data: Record<string, unknown> }).data.kind).toBeUndefined();
    const revision = fake.calls.find((c) => c.table === 'motion_revisions' && c.op === 'insert');
    expect(revision?.payload).toMatchObject({ version: 1, doc: { tracks: [{ clips: [{ id: 'box' }] }] } });
  });
});
