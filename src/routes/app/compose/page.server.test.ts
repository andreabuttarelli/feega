import { beforeEach, describe, expect, it, vi } from 'vitest';

const toolScope = vi.fn(async (_event: unknown, chosen: string | null = null) => ({ db: {}, orgId: 'org', projectId: chosen ?? 'p1', userId: 'u1' }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope }));

const listRecentNodes = vi.fn(async (): Promise<unknown[]> => []);
vi.mock('$lib/server/repos/dashboard', () => ({ listRecentNodes }));

const readHeads = vi.fn(async (): Promise<Map<string, unknown>> => new Map());
const appendRevision = vi.fn(async (_db: unknown, input: { doc: unknown; expectedVersion: number }) => ({ outcome: 'written', head: { version: input.expectedVersion + 1, doc: input.doc, summary: null, actorKind: 'user' } }));
vi.mock('$lib/server/repos/motion-revisions', () => ({ appendRevision, readHead: vi.fn(async () => null), readHeads, RevisionOutcome: { Written: 'written', Conflict: 'conflict', Invalid: 'invalid' } }));

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
const signedAssets = vi.fn(async (_db: unknown, _org: string, ids: string[]) => ({ assets: new Map(), urls: Object.fromEntries(ids.map((id) => [id, `https://cdn.test/${id}`])) }));
vi.mock('$lib/server/studio/studio-media', () => ({ signedAssets }));

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

    expect(data).toMatchObject({ projectId: 'p1', recent: [] });
  });

  it('recent compositions arrive with poster and preview in one batch, no per-item query', async () => {
    const motion = (id: string, poster: string | null, render: string | null) => ({ id, projectId: 'p1', canvasId: 'c1', name: id, updatedAt: '2026-10-08', data: { docHeadRevision: 2, posterAssetId: poster, lastRenderAssetId: render } });
    listRecentNodes.mockResolvedValueOnce([motion('m1', 'po1', 're1'), motion('m2', null, 're2'), motion('m3', null, null)]);
    const { newDraft, applyDraft } = await import('$lib/motion/composition-draft');
    const { newMotionDoc } = await import('$lib/motion/doc');
    const verdict = applyDraft(newMotionDoc(newDraft('helix').format), newDraft('helix'));
    const doc = verdict.ok ? verdict.doc : null;
    readHeads.mockResolvedValueOnce(new Map(['m1', 'm2', 'm3'].map((id) => [id, { version: 2, doc, summary: null, actorKind: 'user' }])));

    const data = (await load({ url: new URL('http://x/app/compose') } as never)) as { recent: { id: string; posterUrl: string | null; previewUrl: string | null }[] };

    expect(readHeads).toHaveBeenCalledTimes(1);
    expect(signedAssets).toHaveBeenCalledTimes(1);
    expect(data.recent.map((r) => [r.id, r.posterUrl, r.previewUrl])).toEqual([
      ['m1', 'https://cdn.test/po1', 'https://cdn.test/re1'],
      ['m2', null, 'https://cdn.test/re2'],
      ['m3', null, null]
    ]);
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
