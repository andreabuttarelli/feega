import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDraft, newDraft } from '$lib/motion/composition-draft';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { ProjectMode } from '$lib/project-mode';

const toolScope = vi.fn(async () => ({ db: {}, orgId: 'org', projectId: 'p1', userId: 'u1' }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope }));

function composed(): MotionDoc {
  const verdict = applyDraft(newMotionDoc(MotionFormat.Vertical), { ...newDraft('coverflow'), media: [{ assetId: 'a1', kind: 'image' }] });
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}

const motionRecord = { id: 'm1', canvasId: 'c-motion', projectId: 'p1', type: 'motion', displayName: 'Spring', position: { x: 0, y: 0, z: 0 }, size: { width: 420, height: 320 }, data: { format: '9:16', docHeadRevision: 2, posterAssetId: null, lastRenderAssetId: null }, version: 1 };
const findNode = vi.fn(async (): Promise<typeof motionRecord | null> => motionRecord);
vi.mock('$lib/server/repos/canvas', () => ({ findNode, patchNodeData: vi.fn(), listCanvases: vi.fn(), createCanvas: vi.fn(), listNodes: vi.fn(), createNode: vi.fn(), DataCheck: { Schema: 'schema' } }));

const head = vi.fn(async (): Promise<{ version: number; doc: MotionDoc; summary: null; actorKind: string } | null> => ({ version: 2, doc: composed(), summary: null, actorKind: 'user' }));
vi.mock('$lib/server/repos/motion-revisions', () => ({ readHead: head, appendRevision: vi.fn(), RevisionOutcome: { Written: 'written', Conflict: 'conflict', Invalid: 'invalid' } }));

vi.mock('$lib/server/repos/assets', () => ({
  listProjectAssets: vi.fn(async () => [{ id: 'a1', projectId: 'p1', type: 'image', url: 'https://cdn.test/a1.png', source: 'upload', createdAt: '2026-10-04T00:00:00Z', durationS: null }])
}));
vi.mock('$lib/server/canvas/sign-media', () => ({ signAssetPaths: vi.fn(async () => new Map()), createAssetSigningDb: vi.fn() }));
vi.mock('$lib/server/repos/brands', () => ({ findBrandLook: vi.fn(async () => null) }));
vi.mock('$lib/server/repos/projects', () => ({ listProjects: vi.fn(async () => [{ id: 'p1', name: 'Launch', brandId: null, mode: ProjectMode.Standard }]) }));
vi.mock('$lib/server/repos/node-runs', () => ({ listNodeRuns: vi.fn(async () => []) }));

const registerUploadedAsset = vi.fn(async () => ({ asset: { id: 'up1', type: 'video' }, kind: 'video' }));
vi.mock('$lib/server/canvas/upload', () => ({ registerUploadedAsset, UploadError: class extends Error {} }));

const llmStructured = vi.fn();
vi.mock('$lib/server/llm', () => ({ llmStructured }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));

const { load, actions } = await import('./+page.server');
const { fakeDb } = await import('$lib/server/db/fake-db');

const event = (fields?: Record<string, string>) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields ?? {})) {
    body.set(k, v);
  }
  return { params: { nodeId: 'm1' }, url: new URL('http://x/app/compose/m1?project=p1'), request: new Request('http://x', { method: 'POST', body }) } as never;
};

type Loaded = { draft: { layout: string; media: unknown[] } | null; editorUrl: string; canvasHref: string; head: { version: number }; assets: { id: string }[] };

describe('/app/compose/[nodeId] edits one composition video', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the saved draft, the project media and where the video lives', async () => {
    const data = (await load(event())) as Loaded;

    expect(data.draft).toMatchObject({ layout: 'coverflow', media: [{ assetId: 'a1', kind: 'image' }] });
    expect(data.head.version).toBe(2);
    expect(data.assets.map((a) => a.id)).toEqual(['a1']);
    expect(data.editorUrl).toBe('/p/p1/c/c-motion/motion/m1');
    expect(data.canvasHref).toBe('/p/p1/c/c-motion');
  });

  it('a video whose composition was removed in the motion editor still opens, with no draft', async () => {
    head.mockResolvedValueOnce({ version: 3, doc: newMotionDoc(MotionFormat.Vertical), summary: null, actorKind: 'user' });

    expect(((await load(event())) as Loaded).draft).toBeNull();
  });

  it('404s on a node that is not a motion video of this project', async () => {
    findNode.mockResolvedValueOnce(null);

    await expect(load(event())).rejects.toMatchObject({ status: 404 });
  });

  it('an uploaded video becomes a project asset the slots can use', async () => {
    const made = await actions.upload(event({ path: 'org/p1/x.mp4', file_name: 'x.mp4', mime_type: 'video/mp4', bytes: '1000' }));

    expect(registerUploadedAsset).toHaveBeenCalledWith({}, { orgId: 'org', projectId: 'p1', path: 'org/p1/x.mp4', fileName: 'x.mp4', mimeType: 'video/mp4', bytes: 1000 });
    expect(made).toEqual({ assetId: 'up1', kind: 'video' });
  });

  it('refuses an upload that is not an image or a video', async () => {
    const refused = (await actions.upload(event({ path: 'org/p1/x.pdf', file_name: 'x.pdf', mime_type: 'application/pdf', bytes: '10' }))) as { status: number };

    expect(refused.status).toBe(400);
    expect(registerUploadedAsset).not.toHaveBeenCalled();
  });

  it('edit with AI writes a spec layout for the workspace and hands it to the picker', async () => {
    const fake = fakeDb({ layouts: [] }, { filter: true });
    toolScope.mockResolvedValueOnce({ db: fake.db as never, orgId: 'org', projectId: 'p1', userId: 'u1' });
    llmStructured.mockResolvedValueOnce({ name: 'orbit', spec: { kind: 'spec', slots: 6, place: { kind: 'ring', radius: 3 } } });

    const made = (await actions.designLayout(event({ prompt: 'cards orbiting slowly' }))) as { layout: { name: string; spec: unknown } };

    expect(made.layout).toMatchObject({ name: 'orbit', spec: { kind: 'spec' } });
    expect(fake.calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: 'org', name: 'orbit', agent_key: 'compose' });
  });

  it('edit with AI refuses an empty prompt', async () => {
    expect(((await actions.designLayout(event({ prompt: ' ' }))) as { status: number }).status).toBe(400);
  });
});
