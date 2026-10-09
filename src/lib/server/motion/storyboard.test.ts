import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { storyboardSchema, MediaKind } from '$lib/motion/storyboard';
import { storyboardStore } from './storyboard';

const scope = { orgId: 'org', projectId: 'project', motionNodeId: 'motion', title: 'Launch', actor: { kind: 'agent' as const, id: 'user', agentKey: 'motion' } };

const row = (id: string, canvas: string, type: string, data: Record<string, unknown>, x = 0) => ({ id, org_id: 'org', canvas_id: canvas, project_id: 'project', type, display_name: null, x, y: 0, z: 0, width: null, height: null, data, version: 1, deleted_at: null });

const BOARD = storyboardSchema.parse({
  beats: [{ act: 'problem', kind: 'scene', title: 'Folders', intent: 'the mess', emotion: 'tense', intensity: 0.4, duration: 3, media: ['shot'] }]
});

describe('storyboardStore', () => {
  it('opens a canvas for the video the first time, writes the cards there and links it on the motion node', async () => {
    let n = 0;
    const fake = fakeDb({ nodes: [row('motion', 'home', 'motion', { format: '9:16' })], canvases: [], nodes_connections: [], canvas_events: [] }, { filter: true, newId: () => `new${++n}` });

    const out = await storyboardStore(fake.db, scope).write(BOARD, { shot: MediaKind.Image });

    const canvas = fake.calls.find((c) => c.table === 'canvases' && c.op === 'insert');
    expect(canvas?.payload).toMatchObject({ org_id: 'org', project_id: 'project', name: 'Launch · storyboard' });
    const inserted = fake.calls.filter((c) => c.table === 'nodes' && c.op === 'insert').map((c) => c.payload as Record<string, unknown>);
    expect(inserted.map((p) => p.type)).toEqual(['doc', 'doc', 'image']);
    expect(inserted.every((p) => p.canvas_id === out.canvasId)).toBe(true);
    const link = fake.calls.find((c) => c.table === 'nodes' && c.op === 'update');
    expect(link?.payload).toMatchObject({ data: { format: '9:16', storyboard: { canvasId: out.canvasId, placed: expect.arrayContaining([expect.any(String)]) } } });
    expect(fake.calls.filter((c) => c.table === 'nodes_connections' && c.op === 'insert')).toHaveLength(1);
  });

  it('rewrites on the same canvas, removing only the cards it placed before: what the user added stays', async () => {
    const fake = fakeDb(
      {
        nodes: [row('motion', 'home', 'motion', { storyboard: { canvasId: 'board', placed: ['old'] } }), row('old', 'board', 'doc', { content: '## old' }), row('mine', 'board', 'image', { assetId: 'a' })],
        canvases: [{ id: 'board', org_id: 'org', project_id: 'project', name: 'x', viewport: null, deleted_at: null }],
        nodes_connections: [],
        canvas_events: []
      },
      { filter: true }
    );

    await storyboardStore(fake.db, scope).write(BOARD, {});

    expect(fake.calls.some((c) => c.table === 'canvases' && c.op === 'insert')).toBe(false);
    const removed = fake.calls.filter((c) => c.table === 'nodes' && c.op === 'update' && (c.payload as Record<string, unknown>).deleted_at);
    expect(removed.map((c) => Object.fromEntries(c.filters).id)).toEqual(['old']);
  });

  it('reads the linked canvas back, user edits included', async () => {
    const fake = fakeDb(
      {
        nodes: [row('motion', 'home', 'motion', { storyboard: { canvasId: 'board', placed: [] } }), row('c', 'board', 'doc', { content: '## edited by the user' }), row('m', 'board', 'image', { prompt: '', assetId: 'asset' }, 10)],
        nodes_connections: [{ id: 'e', org_id: 'org', canvas_id: 'board', source_node_id: 'm', target_node_id: 'c', source_handle: null, target_handle: 'images', mode: 'fixed', deleted_at: null }]
      },
      { filter: true }
    );

    const read = await storyboardStore(fake.db, scope).read();

    expect(read).toMatchObject({ canvasId: 'board', cards: [{ node_id: 'c', text: '## edited by the user' }], media: [{ node_id: 'm', asset_id: 'asset', for: ['c'] }] });
  });

  it('reads nothing when the video has no storyboard yet', async () => {
    const fake = fakeDb({ nodes: [row('motion', 'home', 'motion', {})] }, { filter: true });

    expect(await storyboardStore(fake.db, scope).read()).toBeNull();
  });

  it('edits a card of its own board, and refuses a node on another canvas', async () => {
    const fake = fakeDb({ nodes: [row('motion', 'home', 'motion', { storyboard: { canvasId: 'board', placed: [] } }), row('c', 'board', 'doc', { content: 'a', public: false }), row('far', 'home', 'doc', { content: 'b' })], canvas_events: [] }, { filter: true });
    const store = storyboardStore(fake.db, scope);

    expect(await store.edit('far', 'x')).toMatchObject({ ok: false });
    expect(await store.edit('c', '## new')).toMatchObject({ ok: true });
    expect(fake.calls.find((c) => c.table === 'nodes' && c.op === 'update')?.payload).toMatchObject({ data: { content: '## new' } });
  });

  it('links a card to the clips that play it, with the editor that plays them', async () => {
    const fake = fakeDb({ nodes: [row('motion', 'home', 'motion', { storyboard: { canvasId: 'board', placed: [] } }), row('c', 'board', 'doc', { content: 'a', public: false }), row('far', 'home', 'doc', { content: 'b', public: false })], canvas_events: [] }, { filter: true });
    const store = storyboardStore(fake.db, scope);

    expect(await store.link('far', ['clip'])).toMatchObject({ ok: false });
    expect(await store.link('c', ['clip'])).toMatchObject({ ok: true });
    expect(fake.calls.find((c) => c.table === 'nodes' && c.op === 'update')?.payload).toMatchObject({ data: { beat: { editor: '/p/project/c/home/motion/motion', clipIds: ['clip'] } } });
  });
});
