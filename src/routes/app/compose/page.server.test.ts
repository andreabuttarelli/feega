import { beforeEach, describe, expect, it, vi } from 'vitest';

const toolScope = vi.fn(async (_event: unknown, chosen: string | null = null) => ({ db: {}, orgId: 'org', projectId: chosen ?? 'p1', userId: 'u1' }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope }));

vi.mock('$lib/server/repos/dashboard', () => ({ listRecentNodes: vi.fn(async () => []) }));

const appendRevision = vi.fn(async (_db: unknown, input: { doc: unknown; expectedVersion: number }) => ({ outcome: 'written', head: { version: input.expectedVersion + 1, doc: input.doc, summary: null, actorKind: 'user' } }));
vi.mock('$lib/server/repos/motion-revisions', () => ({ appendRevision, readHead: vi.fn(async () => null), RevisionOutcome: { Written: 'written', Conflict: 'conflict', Invalid: 'invalid' } }));

const legacy = { id: 'old', canvasId: 'c1', projectId: 'p1', type: 'composition', displayName: 'Reel', position: { x: 0, y: 0, z: 0 }, size: { width: 320, height: 240 }, data: { layout: 'coverflow', duration: 5, aspect: '16:9' }, version: 1 };
const createNode = vi.fn(async (_db: unknown, input: { canvasId: string }) => ({ id: 'm-new', canvasId: input.canvasId }));
vi.mock('$lib/server/repos/canvas', () => ({
  listCanvases: vi.fn(async () => [{ id: 'c1', projectId: 'p1', name: 'Board', viewport: null }]),
  createCanvas: vi.fn(async () => ({ id: 'c-motion', projectId: 'p1', name: 'Motion', viewport: null })),
  listNodes: vi.fn(async () => [legacy]),
  listConnections: vi.fn(async () => []),
  findNode: vi.fn(async () => legacy),
  createNode,
  patchNodeData: vi.fn(async () => ({ ok: true })),
  DataCheck: { Schema: 'schema' }
}));
const listProjectAssets = vi.fn(async (): Promise<{ id: string; type: string }[]> => []);
vi.mock('$lib/server/repos/assets', () => ({ listProjectAssets }));
vi.mock('$lib/server/studio/studio-media', () => ({ signedAssets: vi.fn(async (_db: unknown, _org: string, ids: string[]) => ({ assets: new Map(), urls: Object.fromEntries(ids.map((id) => [id, `https://cdn.test/${id}.webp`])) })) }));

const { load, actions } = await import('./+page.server');

function form(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return new Request('http://x/app/compose', { method: 'POST', body });
}

async function thrown(run: () => unknown): Promise<{ status?: number; location?: string }> {
  try {
    await run();
  } catch (e) {
    return e as { status: number; location: string };
  }
  return {};
}

describe('/app/compose starts a composition from a template', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the project and its recent compositions', async () => {
    const data = (await load({ url: new URL('http://x/app/compose') } as never)) as { projectId: string; recent: unknown[] };

    expect(data).toMatchObject({ projectId: 'p1', recent: [], samples: [] });
  });

  it('previews the templates with the project\'s own pictures', async () => {
    listProjectAssets.mockResolvedValueOnce([{ id: 'v1', type: 'video' }, { id: 'i1', type: 'image' }, { id: 'i2', type: 'image' }]);
    const data = (await load({ url: new URL('http://x/app/compose') } as never)) as { samples: string[] };

    expect(data.samples).toEqual(['https://cdn.test/i1.webp', 'https://cdn.test/i2.webp']);
  });

  it('a template becomes a saved motion video and opens in the tool', async () => {
    const redirected = await thrown(() => actions.create({ request: form({ project: 'p1', layout: 'helix', format: '1:1' }) } as never));

    expect(createNode).toHaveBeenCalledWith({}, expect.objectContaining({ type: 'motion', canvasId: 'c-motion' }));
    expect(appendRevision).toHaveBeenCalledWith({}, expect.objectContaining({ nodeId: 'm-new', expectedVersion: 0, doc: expect.objectContaining({ width: 1080, height: 1080 }) }));
    expect(redirected).toMatchObject({ status: 303, location: '/app/compose/m-new?project=p1' });
  });

  it('an unknown template is refused', async () => {
    const refused = (await actions.create({ request: form({ project: 'p1', layout: 'spiral', format: '1:1' }) } as never)) as { status: number };

    expect(refused.status).toBe(400);
    expect(createNode).not.toHaveBeenCalled();
  });

  it('a canvas composition node opens as a video on its own canvas', async () => {
    const redirected = await thrown(() => actions.fromNode({ request: form({ project: 'p1', canvas: 'c1', node: 'old' }) } as never));

    expect(createNode).toHaveBeenCalledWith({}, expect.objectContaining({ canvasId: 'c1', displayName: 'Reel' }));
    expect(appendRevision).toHaveBeenCalledWith({}, expect.objectContaining({ doc: expect.objectContaining({ width: 1920, height: 1080, durationInFrames: 150 }) }));
    expect(redirected).toMatchObject({ status: 303, location: '/app/compose/m-new?project=p1' });
  });
});
