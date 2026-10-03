import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';

const toolScope = vi.fn(async (_event: unknown, chosen: string | null = null) => ({ db: {}, orgId: 'org', projectId: chosen ?? 'p1', userId: 'u1' }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope }));

vi.mock('$lib/server/repos/projects', () => ({
  createProject: vi.fn(),
  listProjects: vi.fn(async () => [{ id: 'p1', name: 'Launch', slug: 'l', brandId: null, archivedAt: null, lastActiveAt: '2026-10-03', mode: ProjectMode.Standard }])
}));
vi.mock('$lib/server/repos/dashboard', () => ({
  listRecentCanvases: vi.fn(async () => []),
  listRecentImages: vi.fn(async () => []),
  listRecentBatches: vi.fn(async () => []),
  listRecentNodes: vi.fn(async () => [{ id: 'm1', projectId: 'p1', canvasId: 'c1', name: 'Teaser', data: {}, updatedAt: '2026-10-03' }])
}));
vi.mock('$lib/server/studio/studio-media', () => ({ signedAssets: vi.fn(async () => ({ assets: new Map(), urls: {} })) }));

const canvases = [{ id: 'c1', projectId: 'p1', name: 'Board', viewport: null }];
const createNode = vi.fn(async (_db: unknown, input: { canvasId: string }) => ({ id: 'm-new', canvasId: input.canvasId }));
const createCanvas = vi.fn(async () => ({ id: 'c-motion', projectId: 'p1', name: 'Motion', viewport: null }));
vi.mock('$lib/server/repos/canvas', () => ({
  listCanvases: vi.fn(async () => canvases),
  createCanvas,
  listNodes: vi.fn(async () => []),
  createNode
}));

const { load, actions } = await import('./+page.server');

function form(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return new Request('http://x/app/motion', { method: 'POST', body });
}

async function thrown(run: () => unknown): Promise<{ status?: number; location?: string }> {
  try {
    await run();
  } catch (e) {
    return e as { status: number; location: string };
  }
  return {};
}

describe('/app/motion lists videos and starts a new one on a canvas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the motion videos of the org, each opening its editor', async () => {
    const data = (await load({ url: new URL('http://x/app/motion') } as never)) as { motions: { href: string }[]; projectId: string; canvases: { id: string }[] };
    expect(data.motions.map((m) => m.href)).toEqual(['/p/p1/c/c1/motion/m1']);
    expect(data.projectId).toBe('p1');
    expect(data.canvases.map((c) => c.id)).toEqual(['c1']);
  });

  it('a new video with no canvas chosen lands on the Motion canvas and opens the editor', async () => {
    const redirected = await thrown(() => actions.create({ request: form({ project: 'p1', canvas: '', name: 'Teaser' }) } as never));

    expect(toolScope).toHaveBeenCalledWith(expect.anything(), 'p1');
    expect(createCanvas).toHaveBeenCalledWith({}, { orgId: 'org', projectId: 'p1', name: 'Motion' });
    expect(redirected).toMatchObject({ status: 303, location: '/p/p1/c/c-motion/motion/m-new' });
  });

  it('a new video on a chosen canvas stays there', async () => {
    const redirected = await thrown(() => actions.create({ request: form({ project: 'p1', canvas: 'c1', name: '' }) } as never));
    expect(createNode).toHaveBeenCalledWith({}, expect.objectContaining({ canvasId: 'c1', type: 'motion', displayName: 'Untitled video' }));
    expect(redirected).toMatchObject({ location: '/p/p1/c/c1/motion/m-new' });
  });

  it('a canvas from another project is refused', async () => {
    const refused = (await actions.create({ request: form({ project: 'p1', canvas: 'stranger', name: 'x' }) } as never)) as { status: number };
    expect(refused.status).toBe(404);
  });
});
