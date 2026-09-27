import { describe, expect, it } from 'vitest';
import { fakeDb, filtersOf } from '$lib/server/db/fake-db';
import { ShareState, readSharedCanvas, setCanvasShare } from './canvas-share';

const SCOPE = { orgId: 'org-1', canvasId: 'canvas-1' };

const CANVAS = { id: 'canvas-1', org_id: 'org-1', name: 'Moodboard', share_token: 'tok-live' };

function node(id: string, type: string, data: Record<string, unknown>, deleted_at: string | null = null) {
  return {
    id,
    canvas_id: 'canvas-1',
    project_id: 'project-1',
    org_id: 'org-1',
    type,
    display_name: null,
    x: 10,
    y: 20,
    z: 0,
    width: null,
    height: null,
    data,
    version: 1,
    deleted_at
  };
}

const ASSETS = [
  { id: 'a-img', org_id: 'org-1', type: 'image', source: 'generated', url: 'u1/media/pic.png', content: null },
  { id: 'a-txt', org_id: 'org-1', type: 'text', source: 'generated', url: null, content: 'hello copy' }
];

const sign = async (paths: { generated: string[]; uploaded: string[] }) =>
  new Map([...paths.generated, ...paths.uploaded].map((p) => [p, `https://signed/${p}`]));

function sharedDb() {
  return fakeDb(
    {
      canvases: [CANVAS],
      nodes: [
        node('n-img', 'image', { prompt: 'p', refId: 'a-img' }),
        node('n-txt', 'text', { prompt: 'p', refId: 'a-txt' }),
        node('n-doc', 'doc', { content: '# Title' }),
        node('n-gone', 'image', { prompt: 'p', refId: 'a-img' }, '2026-09-01T00:00:00Z')
      ],
      nodes_connections: [
        { id: 'e1', canvas_id: 'canvas-1', org_id: 'org-1', source_node_id: 'n-txt', target_node_id: 'n-img', source_handle: null, target_handle: 'text', mode: 'fixed', deleted_at: null }
      ],
      assets: ASSETS
    },
    { filter: true }
  );
}

describe('setCanvasShare', () => {
  it('mints an unguessable token scoped to the org and canvas', async () => {
    const { db, calls } = fakeDb({ canvases: [] });

    const token = await setCanvasShare(db, { ...SCOPE, state: ShareState.On });

    expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    const update = calls.find((c) => c.op === 'update')!;
    expect(update.table).toBe('canvases');
    expect(update.payload).toMatchObject({ share_token: token });
    expect(filtersOf(calls, 'update')).toMatchObject({ id: 'canvas-1', org_id: 'org-1' });
  });

  it('a second share is a new token: the old link dies', async () => {
    const { db } = fakeDb({ canvases: [] });

    const first = await setCanvasShare(db, { ...SCOPE, state: ShareState.On });
    const second = await setCanvasShare(db, { ...SCOPE, state: ShareState.On });

    expect(second).not.toBe(first);
  });

  it('off clears the token', async () => {
    const { db, calls } = fakeDb({ canvases: [] });

    const token = await setCanvasShare(db, { ...SCOPE, state: ShareState.Off });

    expect(token).toBeNull();
    expect(calls.find((c) => c.op === 'update')!.payload).toMatchObject({ share_token: null, shared_at: null });
  });
});

describe('readSharedCanvas', () => {
  it('an unknown token reads nothing', async () => {
    const { db } = sharedDb();

    expect(await readSharedCanvas(db, 'nope', sign)).toBeNull();
  });

  it('an empty token never matches a revoked canvas', async () => {
    const { db } = sharedDb();

    expect(await readSharedCanvas(db, '', sign)).toBeNull();
  });

  it('a live token returns the nodes, signed media and text, without deleted nodes', async () => {
    const { db } = sharedDb();

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.name).toBe('Moodboard');
    expect(shared?.nodes.map((n) => n.id)).toEqual(['n-img', 'n-txt', 'n-doc']);
    expect(shared?.nodes[0].view).toEqual({ kind: 'image', url: 'https://signed/u1/media/pic.png' });
    expect(shared?.nodes[1].view).toEqual({ kind: 'text', text: 'hello copy' });
    expect(shared?.nodes[2].view).toEqual({ kind: 'doc', content: '# Title' });
    expect(shared?.edges).toEqual([{ id: 'e1', source: 'n-txt', target: 'n-img' }]);
  });

  it('never exposes the org, the project or the prompts', async () => {
    const { db } = sharedDb();

    const shared = await readSharedCanvas(db, 'tok-live', sign);
    const json = JSON.stringify(shared);

    expect(json).not.toContain('org-1');
    expect(json).not.toContain('project-1');
    expect(json).not.toContain('"prompt"');
  });
});
