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
vi.mock('$lib/server/chat-attachments/register', () => ({ loadAttachments }));

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
    const data = (await load({ locals, cookies: cookieJar(), url: new URL('http://x/app'), parent: async () => ({ org: { id: 'org-a' } }) } as never)) as {
      dashboard: { projects: { id: string; canvases: unknown[] }[]; batches: { href: string }[] };
      tools: { id: string }[];
    };

    expect(data.dashboard.projects.map((p) => p.id)).toEqual(['p1']);
    expect(data.dashboard.projects[0].canvases).toEqual([{ id: 'c1', name: 'Board', href: '/p/p1/c/c1' }]);
    expect(data.dashboard.batches[0].href).toBe('/app/studio/b1');
    expect(data.tools.map((t) => t.id)).toEqual(['studio', 'compose', 'upscale']);
  });

  it('un ritorno alla home non rifà il giro d’ingresso: guscio e progetto vengono dal layout', async () => {
    const parent = async () => ({ org: { id: 'org-a' }, projects: [{ id: 'p1', name: 'Launch' }] });

    const data = (await load({ locals, cookies: cookieJar(), url: new URL('http://x/app'), parent } as never)) as { attachProjectId: string | null };

    expect(homePathFor).not.toHaveBeenCalled();
    expect(listMemberships).not.toHaveBeenCalled();
    expect(data.attachProjectId).toBe('p1');
  });

  it('a first-run or campaign arrival is sent on to its canvas', async () => {
    homePathFor.mockResolvedValueOnce('/p/p1/c/c1?welcome=claymation-ai');
    const redirected = await thrown(() => load({ locals, cookies: cookieJar(), url: new URL('http://x/app'), parent: async () => ({ org: { id: 'org-a' } }) } as never));
    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c1?welcome=claymation-ai' });
  });

  it('a new project opens on its first canvas', async () => {
    const redirected = await thrown(() => actions.project({ locals, cookies: cookieJar({ 'dz-org': 'org-b' }), request: form({ name: 'Spring' }) } as never));

    expect(createProject).toHaveBeenCalledWith({}, expect.objectContaining({ orgId: 'org-b', name: 'Spring' }));
    expect(createCanvas).toHaveBeenCalledWith({}, { orgId: 'org-b', projectId: 'p-new', name: 'Untitled' });
    expect(redirected).toMatchObject({ status: 303, location: '/p/p-new/c/c-new' });
  });

  it('a prompt opens a new canvas of its own and hands the words to the canvas chat', async () => {
    const brief = 'https://acme.com';
    const redirected = await thrown(() => actions.video({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: form({ brief }) } as never));

    expect(createCanvas).toHaveBeenCalledWith({}, { orgId: 'org-a', projectId: 'p1', name: 'acme.com' });
    expect(createNode).not.toHaveBeenCalled();
    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c-new?prompt=Make+a+launch+film+of+https%3A%2F%2Facme.com' });
  });

  it('a described idea reaches the chat with the words as typed', async () => {
    const redirected = await thrown(() => actions.video({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: form({ brief: 'A logo reveal' }) } as never));

    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c-new?prompt=A+logo+reveal' });
  });

  it('attachments uploaded on the home ride with the brief into the first turn', async () => {
    const body = form({ brief: 'A logo reveal', projectId: 'p1' });
    const fd = await body.formData();
    fd.append('attachment', 'a1');
    fd.append('attachment', 'stranger');
    fd.append('attachment', 'a2');
    const request = new Request('http://x/app', { method: 'POST', body: fd });
    const redirected = await thrown(() => actions.video({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request } as never));

    expect(loadAttachments).toHaveBeenCalledWith({}, { orgId: 'org-a', projectId: 'p1', ids: ['a1', 'stranger', 'a2'] });
    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c-new?prompt=A+logo+reveal&attach=a1%2Ca2' });
  });

  it('files alone are a brief', async () => {
    const fd = new FormData();
    fd.set('brief', '');
    fd.append('attachment', 'a1');
    const redirected = await thrown(() => actions.video({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: new Request('http://x/app', { method: 'POST', body: fd }) } as never));

    expect(redirected.location).toContain('attach=a1');
  });

  it('the home names the project its uploads land in', async () => {
    const data = (await load({ locals, cookies: cookieJar(), url: new URL('http://x/app'), parent: async () => ({ org: { id: 'org-a' } }) } as never)) as { attachProjectId: string | null };

    expect(data.attachProjectId).toBe('p1');
  });

  it('an empty brief is refused before anything is created', async () => {
    const refused = (await actions.video({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: form({ brief: '  ' }) } as never)) as { status: number };

    expect(refused.status).toBe(400);
    expect(createNode).not.toHaveBeenCalled();
  });

  it('the home loads the brief suggestions and no catalogue: templates live on their own page', async () => {
    const data = (await load({ locals, cookies: cookieJar(), url: new URL('http://x/app'), parent: async () => ({ org: { id: 'org-a' } }) } as never)) as Record<string, unknown> & { templates: unknown[] };

    expect(data.templates.length).toBeGreaterThan(0);
    expect(data).not.toHaveProperty('components');
    expect(data).not.toHaveProperty('posters');
    expect(data).not.toHaveProperty('gallery');
    expect(listGallery).not.toHaveBeenCalled();
  });

  it('a poster template opens a new canvas on a 4:5 still that holds it', async () => {
    const redirected = await thrown(() => actions.fromTemplate({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: form({ template: 'builtin:poster-white-shapes', format: '4:5' }) } as never));

    const doc = (appendRevision.mock.calls[0][1] as { doc: { tracks: { clips: { component: string }[] }[]; height: number; width: number; still?: unknown } }).doc;
    expect(doc.tracks.flatMap((t) => t.clips).map((c) => c.component)).toEqual(['Custom']);
    expect(doc).toMatchObject({ width: 1080, height: 1350, still: expect.anything() });
    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c-new/motion/m-new' });
  });

  it('a video template opens a new canvas whose frame already holds it', async () => {
    const redirected = await thrown(() => actions.fromTemplate({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: form({ template: 'builtin:prompt-input', format: '9:16' }) } as never));

    expect(createCanvas).toHaveBeenCalledWith({}, { orgId: 'org-a', projectId: 'p1', name: 'Prompt input' });
    expect(createNode).toHaveBeenCalledWith({}, expect.objectContaining({ canvasId: 'c-new', type: 'motion', displayName: 'Prompt input' }));
    const doc = (appendRevision.mock.calls[0][1] as { doc: { comps: Record<string, { template?: { id: string } }>; height: number; width: number } }).doc;
    expect(Object.values(doc.comps).some((c) => c.template?.id === 'builtin:prompt-input')).toBe(true);
    expect(doc.height).toBeGreaterThan(doc.width);
    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c-new/motion/m-new' });
  });

  it('an unknown component creates nothing', async () => {
    const refused = (await actions.fromTemplate({ locals, cookies: cookieJar(), url: new URL('http://x/app'), request: form({ template: 'builtin:nope' }) } as never)) as { status: number };

    expect(refused.status).toBe(404);
    expect(createCanvas).not.toHaveBeenCalled();
    expect(createNode).not.toHaveBeenCalled();
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
