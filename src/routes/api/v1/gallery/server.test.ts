import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';

const state = vi.hoisted(() => ({ world: null as null | FakeDb, write: true }));

vi.mock('$lib/server/db/client', async (original) => ({ ...(await original<typeof import('$lib/server/db/client')>()), createAnonDb: () => state.world!.db }));
vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.world!.db, orgId: 'org-1', userId: 'u-1', writeAllowed: state.write } }) }));
vi.mock('$lib/server/gallery/moderation', () => ({ galleryModeration: () => ({ text: async () => ({ ok: true }), media: async () => ({ ok: true }) }) }));

const search = await import('./+server');
const publish = await import('./publish/+server');
const remix = await import('./[id]/remix/+server');

function doc() {
  const titled = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello' } }, 'title');
  if (!titled.ok) {
    throw new Error(titled.error);
  }
  return titled.doc;
}

function world(mode = 'standard', published = true) {
  return fakeDb(
    {
      gallery_items: published ? [{ id: 'item-1', status: 'published', title: 'Hello', author_name: 'Feega', kind: 'motion', format: '16:9', duration_s: 15, tags: [], poster_url: null, preview_url: null, remix_count: 2, origin: null, description: '', doc: doc(), assets: [], published_at: '2026-10-08' }] : [],
      nodes: [{ id: 'n-1', org_id: 'org-1', canvas_id: 'c-1', project_id: 'p-1', type: 'motion', display_name: 'Demo', x: 0, y: 0, z: 0, width: null, height: null, version: 1, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } }],
      motion_revisions: [{ org_id: 'org-1', node_id: 'n-1', version: 1, doc: doc(), summary: null, actor_kind: 'user' }],
      projects: [{ id: 'p-1', org_id: 'org-1', name: 'P', slug: 'p', brand_id: null, archived_at: null, updated_at: '2026-10-01', mode }],
      canvases: [{ id: 'c-1', org_id: 'org-1', project_id: 'p-1', name: 'Motion', viewport: null }],
      assets: [],
      gallery_remixes: [],
      orgs_members: [{ user_id: 'u-1', role: 'owner', orgs: { id: 'org-1', name: 'Ada Studio', slug: 'ada' } }]
    },
    { filter: true, newId: (() => { let n = 0; return () => `id-${++n}`; })() }
  );
}

const post = (body: unknown) => new Request('https://feega.app/api/v1/x', { method: 'POST', body: JSON.stringify(body), headers: { authorization: 'Bearer t' } });

beforeEach(() => {
  state.world = world();
  state.write = true;
});

describe('the gallery API the CLI and MCP call', () => {
  it('searches published items without a session', async () => {
    const res = await search.GET({ url: new URL('https://feega.app/api/v1/gallery?kind=motion') } as never);
    const body = await res.json();
    expect(body.items).toEqual([expect.objectContaining({ id: 'item-1', author: 'Feega', remixes: 2, url: 'https://feega.app/gallery/item-1' })]);
  });

  it('publishes a motion node and answers with its gallery url', async () => {
    state.world = world('standard', false);
    const res = await publish.POST({ request: post({ node_id: 'n-1', title: 'Hello', tags: ['demo'] }), url: new URL('https://feega.app/api/v1/gallery/publish') } as never);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'id-1', url: 'https://feega.app/gallery/id-1' });
    expect(state.world!.calls.find((c) => c.table === 'gallery_items' && c.op === 'insert')?.payload).toMatchObject({ author_name: 'Ada Studio', actor_kind: 'agent' });
  });

  it('refuses an uncensored project with 422', async () => {
    state.world = world('uncensored');
    const res = await publish.POST({ request: post({ node_id: 'n-1', title: 'Hello' }), url: new URL('https://feega.app/x') } as never);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('uncensored_not_publishable');
  });

  it('a read-only key cannot publish or remix', async () => {
    state.write = false;
    expect((await publish.POST({ request: post({ node_id: 'n-1', title: 'x' }), url: new URL('https://feega.app/x') } as never)).status).toBe(403);
    expect((await remix.POST({ request: post({ project_id: 'p-1' }), params: { id: 'item-1' }, url: new URL('https://feega.app/x') } as never)).status).toBe(403);
  });

  it('remixes into a project of the caller and returns the editor link', async () => {
    const res = await remix.POST({ request: post({ project_id: 'p-1' }), params: { id: 'item-1' }, url: new URL('https://feega.app/x') } as never);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ project_id: 'p-1', canvas_id: 'c-1', editor_url: expect.stringMatching(/^https:\/\/feega\.app\/p\/p-1\/c\/c-1\/motion\//) });
  });

  it('remixing into a project that is not yours is a 404', async () => {
    const res = await remix.POST({ request: post({ project_id: 'p-other' }), params: { id: 'item-1' }, url: new URL('https://feega.app/x') } as never);
    expect(res.status).toBe(404);
  });
});
