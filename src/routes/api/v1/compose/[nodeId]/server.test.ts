import { describe, expect, it, vi } from 'vitest';
import { applyDraft, newDraft } from '$lib/motion/composition-draft';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { ProjectMode } from '$lib/project-mode';

const { USER } = vi.hoisted(() => ({ USER: { id: 'u1', email: 'ada@x.it' } }));

vi.mock('$lib/server/db/client', () => ({ createUserDb: () => ({}) }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));

const toolScope = vi.fn(async (event: { url: URL }) => ({ db: {}, orgId: 'org', projectId: event.url.searchParams.get('project') ?? 'none', userId: 'u1' }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope }));

function composed(): MotionDoc {
  const verdict = applyDraft(newMotionDoc(MotionFormat.Vertical), { ...newDraft('coverflow'), media: [{ assetId: 'a1', kind: 'image' }] });
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}

const motionRecord = { id: 'm1', canvasId: 'c-motion', projectId: 'p1', type: 'motion', displayName: 'Spring', position: { x: 0, y: 0, z: 0 }, size: { width: 420, height: 320 }, data: { format: '9:16', docHeadRevision: 2, posterAssetId: null, lastRenderAssetId: null }, version: 1 };
vi.mock('$lib/server/repos/canvas', () => ({ findNode: vi.fn(async () => motionRecord), patchNodeData: vi.fn(), listCanvases: vi.fn(), createCanvas: vi.fn(), listNodes: vi.fn(), createNode: vi.fn(), DataCheck: { Schema: 'schema' } }));
vi.mock('$lib/server/repos/motion-revisions', () => ({ readHead: vi.fn(async () => ({ version: 2, doc: composed(), summary: null, actorKind: 'user' })), appendRevision: vi.fn(), RevisionOutcome: { Written: 'written', Conflict: 'conflict', Invalid: 'invalid' } }));
vi.mock('$lib/server/repos/assets', () => ({ listFontAssets: async () => [], listProjectAssets: vi.fn(async () => []) }));
vi.mock('$lib/server/canvas/sign-media', () => ({ signAssetPaths: vi.fn(async () => new Map()), createAssetSigningDb: vi.fn() }));
vi.mock('$lib/server/repos/brands', () => ({ findBrandLook: vi.fn(async () => null) }));
vi.mock('$lib/server/repos/projects', () => ({ listProjects: vi.fn(async () => [{ id: 'p1', name: 'Launch', brandId: null, mode: ProjectMode.Standard }]) }));
vi.mock('$lib/server/repos/node-runs', () => ({ listNodeRuns: vi.fn(async () => []) }));
const registerUploadedAsset = vi.fn(async () => ({ asset: { id: 'up1', type: 'video' }, kind: 'video' }));
vi.mock('$lib/server/canvas/upload', () => ({ registerUploadedAsset, UploadError: class extends Error {} }));

const { GET, POST } = await import('./+server');

const params = { nodeId: 'm1' };

function call(handler: typeof GET, path: string, init: RequestInit = {}, token = 'jwt') {
  const url = new URL(`http://x${path}`);
  const request = new Request(url, { ...init, headers: { authorization: `Bearer ${token}` } });
  return handler({ request, url, params } as never);
}

describe('the composition editor page over bearer', () => {
  it('loads the same data as the page, in the project the query names', async () => {
    const res = await call(GET, '/api/v1/compose/m1?project=p1');
    const body = (await res.json()) as { projectId: string; editorUrl: string; head: { version: number } };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ projectId: 'p1', editorUrl: '/p/p1/c/c-motion/motion/m1', head: { version: 2 } });
  });

  it('runs the page upload action', async () => {
    const form = new FormData();
    form.set('path', 'org/p1/u.mp4');
    form.set('file_name', 'u.mp4');
    form.set('mime_type', 'video/mp4');
    form.set('bytes', '10');

    const res = await call(POST, '/api/v1/compose/m1?project=p1&action=upload', { method: 'POST', body: form });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ assetId: 'up1', kind: 'video' });
  });

  it('refuses without a valid bearer', async () => {
    expect((await call(GET, '/api/v1/compose/m1?project=p1', {}, 'bad')).status).toBe(401);
  });
});
