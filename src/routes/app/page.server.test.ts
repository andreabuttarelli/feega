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
vi.mock('$lib/server/repos/canvas', async (original) => ({ ...(await original<object>()), createCanvas, listCanvases, listNodes: vi.fn(async () => []), createNode }));

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

const { load, actions } = await import('./+page.server');

const locals = { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => ({}) };

function cookieJar(values: Record<string, string> = {}) {
  return { get: (name: string) => values[name], set: vi.fn(), delete: vi.fn() };
}

async function thrown(run: () => unknown): Promise<{ status?: number; location?: string }> {
  try {
    await run();
  } catch (e) {
    return e as { status: number; location: string };
  }
  return {};
}

function form(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return new Request('http://x/app', { method: 'POST', body });
}

describe('/app is the dashboard for a returning user', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads projects, tools and the latest outputs of the chosen org', async () => {
    const data = (await load({ locals, cookies: cookieJar(), parent: async () => ({ org: { id: 'org-a' } }) } as never)) as {
      dashboard: { projects: { id: string; canvases: unknown[] }[]; batches: { href: string }[] };
      tools: { id: string }[];
    };

    expect(data.dashboard.projects.map((p) => p.id)).toEqual(['p1']);
    expect(data.dashboard.projects[0].canvases).toEqual([{ id: 'c1', name: 'Board', href: '/p/p1/c/c1' }]);
    expect(data.dashboard.batches[0].href).toBe('/app/studio/b1');
    expect(data.tools.map((t) => t.id)).toEqual(['studio', 'compose', 'upscale']);
  });

  it('a first-run or campaign arrival is sent on to its canvas', async () => {
    homePathFor.mockResolvedValueOnce('/p/p1/c/c1?welcome=claymation-ai');
    const redirected = await thrown(() => load({ locals, cookies: cookieJar(), parent: async () => ({ org: { id: 'org-a' } }) } as never));
    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c1?welcome=claymation-ai' });
  });

  it('a new project opens on its first canvas', async () => {
    const redirected = await thrown(() => actions.project({ locals, cookies: cookieJar({ 'dz-org': 'org-b' }), request: form({ name: 'Spring' }) } as never));

    expect(createProject).toHaveBeenCalledWith({}, expect.objectContaining({ orgId: 'org-b', name: 'Spring' }));
    expect(createCanvas).toHaveBeenCalledWith({}, { orgId: 'org-b', projectId: 'p-new', name: 'Untitled' });
    expect(redirected).toMatchObject({ status: 303, location: '/p/p-new/c/c-new' });
  });

  it('a brief starts a motion video on the Motion canvas and opens the chat with it', async () => {
    const brief = 'https://acme.com';
    const redirected = await thrown(() => actions.video({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: form({ brief }) } as never));

    expect(createNode).toHaveBeenCalledWith({}, expect.objectContaining({ orgId: 'org-a', projectId: 'p1', canvasId: 'c-motion', type: 'motion', displayName: 'acme.com' }));
    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c-motion/motion/m-new?brief=https%3A%2F%2Facme.com' });
  });

  it('an empty brief is refused before anything is created', async () => {
    const refused = (await actions.video({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: form({ brief: '  ' }) } as never)) as { status: number };

    expect(refused.status).toBe(400);
    expect(createNode).not.toHaveBeenCalled();
  });

  it('the home shows the gallery to remix and the brief templates', async () => {
    const data = (await load({ locals, cookies: cookieJar(), parent: async () => ({ org: { id: 'org-a' } }) } as never)) as { gallery: { id: string }[]; templates: { id: string }[] };

    expect(data.gallery.map((g) => g.id)).toEqual(['g1']);
    expect(data.templates.length).toBeGreaterThan(0);
  });

  it('switching workspace remembers a membership, never a stranger org', async () => {
    const jar = cookieJar();
    await thrown(() => actions.workspace({ locals, cookies: jar, request: form({ orgId: 'org-b' }) } as never));
    expect(jar.set).toHaveBeenCalledWith('dz-org', 'org-b', expect.objectContaining({ path: '/' }));

    const stranger = cookieJar();
    const refused = (await actions.workspace({ locals, cookies: stranger, request: form({ orgId: 'org-x' }) } as never)) as { status: number };
    expect(refused.status).toBe(404);
    expect(stranger.set).not.toHaveBeenCalled();
  });
});
