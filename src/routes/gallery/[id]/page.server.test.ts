import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { OAUTH_RETURN_COOKIE } from '$lib/server/oauth';

const state = vi.hoisted(() => ({ world: null as null | FakeDb, userId: null as string | null }));

vi.mock('$lib/server/gallery/reader', () => ({ galleryReader: async () => ({ db: state.world!.db, userId: state.userId }) }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope: async () => ({ db: state.world!.db, orgId: 'org-2', projectId: 'p-2', userId: 'u-2' }) }));

const { load, actions } = await import('./+page.server');

const PUBLIC = 'https://public.example/media/gallery/item-1/';

function item() {
  const titled = addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello gallery' } }, 'title');
  const logo = titled.ok ? addClip(titled.doc, { component: 'Logo', from: 0, durationInFrames: 60, props: { assetId: 'g-logo' } }, 'logo') : titled;
  if (!logo.ok) {
    throw new Error(logo.error);
  }
  const doc = { ...logo.doc, assets: [{ id: 'g-logo', kind: 'image' as const, name: 'logo' }] };
  return { id: 'item-1', status: 'published', title: 'Hello', author_name: 'Feega', kind: 'motion', format: '1:1', duration_s: 15, tags: [], poster_url: null, preview_url: null, remix_count: 0, origin: null, description: '', doc, assets: [{ id: 'g-logo', kind: 'image', name: 'logo', url: `${PUBLIC}g-logo.png` }], published_at: '2026-10-08' };
}

function cookies() {
  const jar = new Map<string, string>();
  return { jar, api: { set: (k: string, v: string) => jar.set(k, v), get: (k: string) => jar.get(k), delete: (k: string) => jar.delete(k) } };
}

function event(signedIn: boolean, form: Record<string, string> = {}) {
  const body = new FormData();
  Object.entries(form).forEach(([k, v]) => body.set(k, v));
  const jar = cookies();
  return {
    jar: jar.jar,
    value: {
      params: { id: 'item-1' },
      cookies: jar.api,
      request: new Request('https://feega.app/gallery/item-1?/remix', { method: 'POST', body }),
      locals: { safeGetSession: async () => ({ user: signedIn ? { id: 'u-2' } : null, session: signedIn ? {} : null }) },
      url: new URL('https://feega.app/gallery/item-1')
    }
  };
}

beforeEach(() => {
  let n = 0;
  state.world = fakeDb({ gallery_items: [item()], canvases: [{ id: 'c-9', org_id: 'org-2', project_id: 'p-2', name: 'Motion', viewport: null }], nodes: [], assets: [], gallery_remixes: [], orgs_members: [], projects: [{ id: 'p-2', org_id: 'org-2', name: 'Mine', slug: 'mine', brand_id: null, archived_at: null, updated_at: '2026-10-08', mode: 'standard' }] }, { filter: true, newId: () => `new-${++n}` });
  state.userId = null;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { 'content-type': 'image/png' } })));
});

describe('a gallery item page', () => {
  it('shows the item and its doc to someone without an account', async () => {
    const page = (await load({ locals: {}, params: { id: 'item-1' }, cookies: cookies().api, setHeaders: () => {} } as never)) as { item: { title: string; doc: { tracks: unknown[] } }; signedIn: boolean };
    expect(page.signedIn).toBe(false);
    expect(page.item.title).toBe('Hello');
    expect(page.item.doc.tracks.length).toBeGreaterThan(0);
  });

  it('a withdrawn item is a 404', async () => {
    state.world = fakeDb({ gallery_items: [] }, { filter: true });
    await expect(load({ locals: {}, params: { id: 'item-1' }, cookies: cookies().api, setHeaders: () => {} } as never)).rejects.toMatchObject({ status: 404 });
  });

  it('remixing without an account sends to the login and comes back to the item', async () => {
    const { value, jar } = event(false);
    await expect(actions.remix(value as never)).rejects.toMatchObject({ status: 303, location: '/login' });
    expect(jar.get(OAUTH_RETURN_COOKIE)).toBe('/gallery/item-1');
  });

  it('remixing copies the doc into the project and opens the editor on it', async () => {
    const { value } = event(true, { project: 'p-2' });
    await expect(actions.remix(value as never)).rejects.toMatchObject({ status: 303, location: expect.stringMatching(/^\/p\/p-2\/c\/c-9\/motion\//) });

    const calls = state.world!.calls;
    const revision = calls.find((c) => c.table === 'motion_revisions' && c.op === 'insert')?.payload as { doc: { assets: { id: string }[]; fields: { key: string }[] } };
    expect(revision.doc.assets[0].id).not.toBe('g-logo');
    expect(revision.doc.fields.map((f) => f.key)).toEqual(['text_1', 'logo_1']);
    expect(calls.find((c) => c.table === 'gallery_remixes' && c.op === 'insert')?.payload).toMatchObject({ org_id: 'org-2', item_id: 'item-1' });
    expect(calls.filter((c) => c.table === 'storage:canvas-assets' && c.op === 'upload')).toHaveLength(1);
  });
});
