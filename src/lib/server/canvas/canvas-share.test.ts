import { describe, expect, it } from 'vitest';
import { fakeDb, filtersOf } from '$lib/server/db/fake-db';
import { NODE_TYPES } from '$lib/canvas/node-data';
import { SHARED_VIEW_OF, ShareState, readSharedCanvas, setCanvasShare } from './canvas-share';

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

const sign = async (paths: { generated: string[]; uploaded: string[]; influencer: string[] }) =>
  new Map([...paths.generated, ...paths.uploaded, ...paths.influencer].map((p) => [p, `https://signed/${p}`]));

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

  it('a soft-deleted canvas reads as not found', async () => {
    const { db } = fakeDb(
      { canvases: [{ ...CANVAS, deleted_at: '2026-09-29T00:00:00.000Z' }] },
      { filter: true }
    );

    expect(await readSharedCanvas(db, 'tok-live', sign)).toBeNull();
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

  it('a shared image is signed as a preview, never as the original file', async () => {
    const { db } = sharedDb();
    const presets = new Map<string, string | undefined>();
    const recording = async (paths: { generated: string[]; uploaded: string[]; influencer: string[] }, preset?: string) => {
      [...paths.generated, ...paths.uploaded, ...paths.influencer].forEach((p) => presets.set(p, preset));
      return sign(paths);
    };

    await readSharedCanvas(db, 'tok-live', recording);

    expect(presets.get('u1/media/pic.png')).toBe('canvas1024');
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

describe('SHARED_VIEW_OF', () => {
  it('ha una vista per ogni tipo che nodes_type_check ammette, e nessuna di troppo', () => {
    expect(Object.keys(SHARED_VIEW_OF).sort()).toEqual([...NODE_TYPES].sort());
  });
});

function sourceDb(nodes: ReturnType<typeof node>[], extra: Record<string, unknown[]> = {}) {
  return fakeDb({ canvases: [CANVAS], nodes, nodes_connections: [], assets: ASSETS, ...extra }, { filter: true });
}

function product(id: string, title: string, price: number, org_id = 'org-1') {
  return {
    id,
    org_id,
    node_id: 'n-prod',
    project_id: 'project-1',
    platform: 'shopify',
    external_id: id,
    handle: id,
    title,
    description: null,
    price,
    currency: 'EUR',
    url: `https://shop.example/${id}`,
    images: [{ url: `https://cdn.example/${id}.jpg` }],
    available: true,
    synced_at: '2026-09-27T00:00:00Z'
  };
}

function post(id: string, caption: string, likes: number) {
  return {
    id,
    org_id: 'org-1',
    node_id: 'n-feed',
    project_id: 'project-1',
    platform: 'instagram',
    external_id: id,
    handle: 'nike',
    caption,
    media: { type: 'image', thumbnailUrl: `https://cdn.example/${id}.jpg`, items: [] },
    metrics: { likes },
    permalink: null,
    posted_at: '2026-09-01T00:00:00Z',
    fetched_at: '2026-09-02T00:00:00Z'
  };
}

describe('readSharedCanvas — i nodi sorgente', () => {
  it('products mostra le righe del catalogo filtrate come sulla tela', async () => {
    const { db } = sourceDb(
      [node('n-prod', 'products', { type: 'shopify', url: 'https://shop.example', filters: { price_max: 50 } })],
      { products: [product('p-cheap', 'Cap', 20), product('p-dear', 'Coat', 300)] }
    );

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.nodes[0].view).toEqual({
      kind: 'grid',
      total: 2,
      tiles: [{ key: '0', thumb: 'https://cdn.example/p-cheap.jpg', label: 'Cap', caption: 'EUR 20', badge: null }]
    });
  });

  it('social_account_feed mostra i post filtrati come sulla tela', async () => {
    const { db } = sourceDb(
      [node('n-feed', 'social_account_feed', { platform: 'instagram', handle: 'nike', filters: { min_likes: 100 } })],
      { social_posts: [post('s-hit', 'Just do it', 500), post('s-miss', 'meh', 3)] }
    );

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.nodes[0].view).toEqual({
      kind: 'grid',
      total: 2,
      tiles: [{ key: '0', thumb: 'https://cdn.example/s-hit.jpg', label: 'Just do it', caption: null, badge: null }]
    });
  });

  it('list e select mostrano gli item come scritti', async () => {
    const { db } = sourceDb([
      node('n-list', 'list', { item_kind: 'text', items: [{ text: 'uno' }, { label: 'B', text: 'due' }] }),
      node('n-sel', 'select', { index: 2 })
    ]);

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.nodes[0].view).toEqual({
      kind: 'list',
      items: [
        { label: '', text: 'uno', url: null },
        { label: 'B', text: 'due', url: null }
      ]
    });
    expect(shared?.nodes[1].view).toEqual({ kind: 'select', index: 2 });
  });

  it('effects e composition mostrano solo il risultato, mai i parametri', async () => {
    const { db } = sourceDb([
      node('n-fx', 'effects', { effects: [{ id: 'grain', params: {} }], refId: 'a-img' }),
      node('n-comp', 'composition', { layout: 'grid', refId: 'a-img' })
    ]);

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.nodes.map((n) => n.view)).toEqual([
      { kind: 'image', url: 'https://signed/u1/media/pic.png' },
      { kind: 'image', url: 'https://signed/u1/media/pic.png' }
    ]);
  });

  it("influencer mostra nome e volto, e mai quello di un'altra org", async () => {
    const { db } = sourceDb(
      [node('n-inf', 'influencer', { influencer_id: 'i-1' }), node('n-foreign', 'influencer', { influencer_id: 'i-2' })],
      {
        influencers: [
          { id: 'i-1', org_id: null, name: 'Ada', summary: 'runner', deleted_at: null },
          { id: 'i-2', org_id: 'org-2', name: 'Eve', summary: 'secret', deleted_at: null }
        ],
        influencer_views: [
          { id: 'v1', influencer_id: 'i-1', view_key: 'front', label: 'Front', storage_path: 'catalogue/i-1/front.png', sort_order: 0 }
        ]
      }
    );

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.nodes[0].view).toEqual({
      kind: 'influencer',
      name: 'Ada',
      summary: 'runner',
      photo: 'https://signed/catalogue/i-1/front.png'
    });
    expect(shared?.nodes[1].view).toEqual({ kind: 'empty' });
  });

  it('an influencer node with nobody picked yet is empty and never queries the catalogue', async () => {
    const { db, calls } = sourceDb([node('n-inf', 'influencer', {})]);

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.nodes[0].view).toEqual({ kind: 'empty' });
    expect(calls.some((c) => c.table === 'influencers')).toBe(false);
  });

  it('social_post_mockup e ads mostrano il contenuto, non gli id', async () => {
    const { db } = sourceDb([
      node('n-mock', 'social_post_mockup', { general: { caption: 'Hello', media: ['https://cdn.example/m.jpg', { url: 'https://cdn.example/n.jpg' }] } }),
      node('n-ads', 'ads', { mode: 'page', page_id: '123', page_name: 'Nike', country: 'IT' })
    ]);

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.nodes[0].view).toEqual({ kind: 'post', caption: 'Hello', media: ['https://cdn.example/m.jpg', 'https://cdn.example/n.jpg'] });
    expect(shared?.nodes[1].view).toEqual({ kind: 'ads', query: 'Nike', country: 'IT' });
    expect(JSON.stringify(shared)).not.toContain('123');
  });

  it('a post, ads, embed or document with nothing in it reads as empty, not as a blank frame', async () => {
    const { db } = sourceDb([
      node('n-mock', 'social_post_mockup', {}),
      node('n-ads', 'ads', {}),
      node('n-frame', 'iframe', {}),
      node('n-doc', 'doc', {})
    ]);

    const shared = await readSharedCanvas(db, 'tok-live', sign);

    expect(shared?.nodes.map((n) => n.view)).toEqual([{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }]);
  });
});
