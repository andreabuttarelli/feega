import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';

const homePathFor = vi.fn(async () => '/app');
vi.mock('$lib/server/tenancy/entry', async (original) => ({ ...(await original<object>()), homePathFor }));

const project = { id: 'p1', name: 'Launch', slug: 'launch', brandId: null, archivedAt: null, lastActiveAt: '2026-10-03', mode: ProjectMode.Standard };
const listProjects = vi.fn(async () => [project]);
const createProject = vi.fn(async (_db: unknown, input: { name: string }) => ({ ...project, id: 'p-new', name: input.name }));
vi.mock('$lib/server/repos/projects', () => ({ listProjects, createProject }));

const createCanvas = vi.fn(async (_db: unknown, input: { name: string }) => ({ id: input.name === 'Motion' ? 'c-motion' : 'c-new', projectId: 'p-new', name: input.name, viewport: null }));
const listCanvases = vi.fn(async () => [{ id: 'c1', projectId: 'p1', name: 'Board', viewport: null }]);
const createNode = vi.fn(async (_db: unknown, input: { canvasId: string }) => ({ id: 'm-new', canvasId: input.canvasId }));
const patchNodeData = vi.fn(async () => ({}));
vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), createCanvas, listCanvases, listNodes: vi.fn(async () => []), createNode, patchNodeData }));

const appendRevision = vi.fn(async (_db: unknown, input: { doc: unknown }) => ({ outcome: 'written', head: { version: 1, doc: input.doc, summary: null, actorKind: 'user' } }));
vi.mock('$lib/server/repos/motion-revisions', async (original) => ({ ...(await original<object>()), appendRevision }));
vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: vi.fn(async () => []) }));

vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: vi.fn(async (_db: unknown, input: { projectId: string }) => ({ orgId: 'org-a', project: { id: input.projectId } })) }));

const listGallery = vi.fn(async () => [{ id: 'g1', title: 'Launch', authorName: 'Feega', kind: 'motion', format: 'landscape', durationS: 8, tags: [], posterUrl: null, previewUrl: null, remixCount: 0, remixedFrom: null }]);
vi.mock('$lib/server/repos/gallery', () => ({ listGallery }));

vi.mock('$lib/server/repos/dashboard', () => ({
  listRecentCanvases: vi.fn(async () => [{ id: 'c1', projectId: 'p1', name: 'Board', updatedAt: '2026-10-03' }]),
  listRecentImages: vi.fn(async () => []),
  listRecentBatches: vi.fn(async () => [{ id: 'b1', projectId: 'p1', name: 'Autumn', status: 'running', createdAt: '2026-10-03' }]),
  listRecentNodes: vi.fn(async () => [])
}));
vi.mock('$lib/server/studio/studio-media', () => ({ signedAssets: vi.fn(async () => ({ assets: new Map(), urls: {} })) }));

const listMemberships = vi.fn(async () => [
  { org: { id: 'org-a', name: 'A', slug: 'a' }, role: 'owner' },
  { org: { id: 'org-b', name: 'B', slug: 'b' }, role: 'member' }
]);
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships }));

const loadAttachments = vi.fn(async (_db: unknown, input: { ids: string[] }) => input.ids.filter((id) => id !== 'stranger').map((id) => ({ assetId: id, kind: 'image', name: `${id}.png`, mimeType: 'image/png', bytes: 1 })));

const { USER, DB } = vi.hoisted(() => ({ USER: { id: 'u1', email: 'ada@x.it', created_at: '2020-01-01T00:00:00Z' }, DB: {} }));
vi.mock('$lib/server/db/client', () => ({ createUserDb: () => DB }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));
vi.mock('$lib/server/repos/profiles', async (original) => ({ ...(await original<object>()), ensureProfile: vi.fn(async () => ({ name: 'Ada', email: 'ada@x.it', avatarUrl: null })) }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance: vi.fn(async () => 42) }));

const page = await import('../../../../../app/+page.server');
const templates = await import('../../../../../app/templates/+page.server');
const canvases = await import('../../../../../app/canvases/+page.server');
const motion = await import('../../../../../app/motion/+page.server');
const { appShell } = await import('$lib/server/dashboard/app-shell');
const { GET, POST } = await import('./+server');

const locals = { safeGetSession: async () => ({ session: {}, user: USER }), db: async () => DB };

function cookieJar(values: Record<string, string> = {}) {
  return { get: (name: string) => values[name], set: vi.fn(), delete: vi.fn() };
}

async function outcome(run: () => unknown): Promise<{ status: number; body: unknown }> {
  try {
    return { status: 200, body: { data: await run() } };
  } catch (e) {
    const thrown = e as { status: number; location?: string; body?: { message: string } };
    return thrown.location ? { status: 200, body: { redirect: thrown.location } } : { status: thrown.status, body: { error: thrown.body?.message } };
  }
}

async function api(method: 'GET' | 'POST', path: string, init: { token?: string; body?: FormData } = {}) {
  const url = new URL(`https://feega.test/api/v1/me/pages/${path}`);
  const pageName = url.pathname.split('/').at(-1)!;
  const headers: Record<string, string> = init.token === undefined ? { authorization: 'Bearer jwt' } : init.token ? { authorization: `Bearer ${init.token}` } : {};
  const request = new Request(url, { method, headers, body: init.body });
  const handler = (method === 'GET' ? GET : POST) as (e: unknown) => Promise<Response>;
  const res = await handler({ request, url, params: { page: pageName } });
  return { status: res.status, body: await res.json() };
}

function form(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return body;
}

describe('/api/v1/me/pages: the dashboard pages over the API, with the same answers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('the home loads what the /app page loads', async () => {
    const shell = await appShell({ locals, cookies: cookieJar({ 'dz-org': 'org-b' }) } as never);
    const expected = await outcome(() => page.load({ locals, cookies: cookieJar({ 'dz-org': 'org-b' }), url: new URL('https://feega.test/app'), parent: async () => shell } as never));

    expect(await api('GET', 'home?org=org-b')).toEqual(expected);
  });

  it('the templates page loads what /app/templates loads', async () => {
    const expected = await outcome(() => templates.load({ locals, cookies: cookieJar(), url: new URL('https://feega.test/app/templates') } as never));
    expect(await api('GET', 'templates')).toEqual(expected);
  });

  it('the canvases page loads what /app/canvases loads', async () => {
    const shell = await appShell({ locals, cookies: cookieJar() } as never);
    const expected = await outcome(() => canvases.load({ locals, cookies: cookieJar(), url: new URL('https://feega.test/app/canvases'), parent: async () => shell } as never));
    expect(await api('GET', 'canvases')).toEqual(expected);
  });

  it('the motion page loads what /app/motion loads, for the project in the query', async () => {
    const expected = await outcome(() => motion.load({ locals, cookies: cookieJar(), url: new URL('https://feega.test/app/motion?project=p1') } as never));
    expect(await api('GET', 'motion?project=p1')).toEqual(expected);
  });

  it('a new project answers with the canvas the page action redirects to', async () => {
    const expected = await outcome(() => page.actions.project({ locals, cookies: cookieJar({ 'dz-org': 'org-b' }), request: new Request('https://feega.test/app', { method: 'POST', body: form({ name: 'Spring' }) }) } as never));

    expect(expected).toEqual({ status: 200, body: { redirect: '/p/p-new/c/c-new' } });
    expect(await api('POST', 'home?org=org-b&action=project', { body: form({ name: 'Spring' }) })).toEqual(expected);
  });

  it('an action failure keeps its status and message', async () => {
    const failure = (await page.actions.video({ locals, cookies: cookieJar(), url: new URL('https://feega.test/app'), request: new Request('https://feega.test/app', { method: 'POST', body: form({ brief: '' }) }) } as never)) as { status: number; data: unknown };

    expect(await api('POST', 'home?action=video', { body: form({ brief: '' }) })).toEqual({ status: failure.status, body: failure.data });
  });

  it('an unknown page or action is a 404, a missing or bad token a 401', async () => {
    expect((await api('GET', 'nope')).status).toBe(404);
    expect((await api('POST', 'home?action=nope', { body: form({}) })).status).toBe(404);
    expect(await api('GET', 'home', { token: '' })).toEqual({ status: 401, body: { error: 'missing_bearer' } });
    expect(await api('GET', 'home', { token: 'bad' })).toEqual({ status: 401, body: { error: 'invalid_token' } });
  });
});
