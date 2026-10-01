import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const listMemberships = vi.fn();
const findCanvasForUser = vi.fn();
const publish = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({
  listMemberships: (...a: unknown[]) => listMemberships(...a)
}));
vi.mock('$lib/server/canvas/lookup', () => ({
  findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a)
}));
vi.mock('$lib/server/publishing', () => ({
  publisher: {
    kind: 'zernio',
    publish: (...a: unknown[]) => publish(...a),
    postStatus: vi.fn().mockResolvedValue({ status: 'scheduled', url: null, error: null, scheduledFor: null }),
    deletePost: vi.fn()
  }
}));
vi.mock('$lib/server/canvas-catalogue', () => ({ canvasModelCatalogue: vi.fn() }));

const { actions } = await import('./+page.server');

const ORG = 'org-1';
const CANVAS = 'canvas-1';
const BRAND = 'brand-1';
const PLANNED = '2099-10-02T08:00:00.000Z';
const STAMP = '2026-09-29T10:00:00.000Z';

function seed(over: Record<string, unknown> = {}) {
  return {
    brands: [{ id: BRAND, org_id: ORG, name: 'Acme', slug: 'acme' }],
    nodes: [
      { id: 'node-cal', org_id: ORG, canvas_id: CANVAS, deleted_at: null, type: 'calendar', data: { view: 'week', scope: 'canvas', anchor: '2099-10-01' }, position: { x: 0, y: 0 } },
      { id: 'node-img', org_id: ORG, canvas_id: CANVAS, deleted_at: null, type: 'image', data: { assetId: 'asset-1' }, position: { x: 0, y: 0 } }
    ],
    post_sources: [{ post_id: 'post-1', node_id: 'node-img', role: 'media' }],
    posts: [
      {
        id: 'post-1',
        org_id: ORG,
        brand_id: BRAND,
        caption: 'Ciao',
        per_platform: null,
        media: [{ assetId: 'asset-1', order: 0, role: 'media' }],
        status: 'draft',
        planned_for: PLANNED,
        updated_at: STAMP,
        created_at: STAMP,
        zernio_post_ids: {},
        ...over
      }
    ],
    social_accounts: [
      { id: 'acc-1', org_id: ORG, brand_id: BRAND, platform: 'instagram', zernio_account_id: 'zern-1', status: 'connected' }
    ],
    assets: [{ id: 'asset-1', org_id: ORG, type: 'image', url: 'https://cdn.feega.app/asset-1.jpg', source: null }]
  };
}

function event(fields: Record<string, string | string[]>, db: unknown) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      fd.append(key, v);
    }
  }
  return {
    request: { formData: async () => fd },
    params: { canvasId: CANVAS, projectId: 'project-1' },
    locals: {
      safeGetSession: async () => ({ session: {}, user: { id: 'user-1' } }),
      db: async () => db
    }
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  listMemberships.mockResolvedValue([]);
  findCanvasForUser.mockResolvedValue({ orgId: ORG, canvas: { projectId: 'project-1' } });
});

describe('actions.calendar_posts', () => {
  it('scope tela: i post nati da nodi di questa tela, con la data pianificata', async () => {
    const { db } = fakeDb(seed(), { filter: true });

    const result = (await actions.calendar_posts(event({ scope: 'canvas' }, db))) as { posts: { id: string; plannedFor: string }[] };

    expect(result.posts.map((p) => [p.id, p.plannedFor])).toEqual([['post-1', PLANNED]]);
  });

  it('scope brand senza brand scelto è un errore leggibile', async () => {
    const { db } = fakeDb(seed(), { filter: true });

    const result = await actions.calendar_posts(event({ scope: 'brand' }, db));

    expect(result).toMatchObject({ status: 400, data: { error: 'brand_required' } });
  });
});

describe('actions.plan_post', () => {
  it('sposta la bozza con l’updated_at atteso', async () => {
    const { db } = fakeDb(seed(), { filter: true, mutate: true });

    const result = await actions.plan_post(
      event({ post_id: 'post-1', planned_for: '2099-10-05T08:00:00.000Z', expected_updated_at: STAMP }, db)
    );

    expect(result).toMatchObject({ planned: { outcome: 'planned', plannedFor: '2099-10-05T08:00:00.000Z' } });
  });

  it('un updated_at vecchio risponde 409', async () => {
    const { db } = fakeDb(seed(), { filter: true, mutate: true });

    const result = await actions.plan_post(
      event({ post_id: 'post-1', planned_for: '2099-10-05T08:00:00.000Z', expected_updated_at: '2000-01-01T00:00:00.000Z' }, db)
    );

    expect(result).toMatchObject({ status: 409, data: { error: 'conflict' } });
  });
});

describe('actions.create_post con planned_for', () => {
  it('una selezione lasciata su un giorno diventa bozza con quella data', async () => {
    const { db, calls } = fakeDb(seed(), { filter: true });

    await actions.create_post(event({ brand_id: BRAND, node_id: ['node-img'], planned_for: PLANNED }, db));

    const insert = calls.find((c) => c.table === 'posts' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ planned_for: PLANNED, brand_id: BRAND });
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('actions.schedule_post: dalla bozza al provider', () => {
  it('consegna agli account connessi del brand alla data pianificata e segna ready', async () => {
    publish.mockResolvedValue({ ok: true, postId: 'zernio-1' });
    const { db, calls } = fakeDb(seed(), { filter: true });

    const result = await actions.schedule_post(event({ post_id: 'post-1' }, db));

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'zern-1', scheduledFor: PLANNED, content: 'Ciao' }));
    expect(result).toMatchObject({ scheduled: { ok: true } });
    const statusWrite = calls.find((c) => c.table === 'posts' && c.op === 'update' && (c.payload as { status?: string }).status);
    expect(statusWrite?.payload).toMatchObject({ status: 'ready' });
  });

  it('una bozza senza data non parte', async () => {
    const { db } = fakeDb(seed({ planned_for: null }), { filter: true });

    const result = await actions.schedule_post(event({ post_id: 'post-1' }, db));

    expect(result).toMatchObject({ status: 422, data: { error: 'not_planned' } });
    expect(publish).not.toHaveBeenCalled();
  });

  it('una data passata non pubblica subito per sbaglio', async () => {
    const { db } = fakeDb(seed({ planned_for: '2000-01-01T00:00:00.000Z' }), { filter: true });

    const result = await actions.schedule_post(event({ post_id: 'post-1' }, db));

    expect(result).toMatchObject({ status: 422, data: { error: 'planned_in_past' } });
    expect(publish).not.toHaveBeenCalled();
  });

  it('il provider che rifiuta torna come errore con il motivo', async () => {
    publish.mockResolvedValue({ ok: false, error: 'token expired' });
    const { db } = fakeDb(seed(), { filter: true });

    const result = await actions.schedule_post(event({ post_id: 'post-1' }, db));

    expect(result).toMatchObject({ status: 422, data: { error: 'delivery_failed' } });
  });
});

describe('connecting material to a calendar plans it', () => {
  it('the edge lands, then create_post drafts the source on the picked day', async () => {
    const { db, calls } = fakeDb({ ...seed(), nodes_connections: [] }, { filter: true });

    const connected = await actions.connect(
      event({ source_node_id: 'node-img', target_node_id: 'node-cal', kind: 'derives_from', target_handle: 'images' }, db)
    );
    expect(connected).toMatchObject({ connection: { sourceNodeId: 'node-img', targetNodeId: 'node-cal' } });

    await actions.create_post(event({ brand_id: BRAND, node_id: ['node-img'], planned_for: PLANNED }, db));

    const insert = calls.find((c) => c.table === 'posts' && c.op === 'insert');
    expect(insert?.payload).toMatchObject({ planned_for: PLANNED, brand_id: BRAND });
  });
});
