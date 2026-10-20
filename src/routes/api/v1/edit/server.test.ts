import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

const ORG = 'org-1';
const NODE = 'node-1';

const state = vi.hoisted(() => ({ writeAllowed: true, db: null as unknown }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: 'u-1', writeAllowed: state.writeAllowed } }) }));
vi.mock('$lib/server/org-data/reach', () => ({ callerReach: async () => null }));
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiAction: async () => undefined }));
vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: async () => [], insertOrgTemplate: vi.fn(), deleteOrgTemplate: vi.fn() }));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/assets')>()), listFontAssets: async () => [], listProjectAssets: async () => [] }));
vi.mock('$lib/server/canvas/sign-media', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/canvas/sign-media')>()), signAssetPaths: async () => new Map(), createAssetSigningDb: () => ({}) }));
vi.mock('$lib/server/repos/projects', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/projects')>()), findProjectById: async () => ({ id: 'p-1', brandId: null, mode: 'standard' }) }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  patchNodeData: vi.fn(async () => ({ ok: true })),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: 'p-1', type: 'motion', displayName: 'Poster', data: { format: '4:5' }, version: 1 } : null
}));

const { POST } = await import('./+server');

const post = (body: unknown) => {
  const url = new URL('https://feega.test/api/v1/edit');
  return POST({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }), url } as never);
};

const head = async () => (await readHead(state.db as never, { orgId: ORG, nodeId: NODE }))?.doc as MotionDoc;

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips);

beforeEach(async () => {
  const fake = revisionsDb();
  state.db = fake.db;
  state.writeAllowed = true;
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Portrait), actor: { kind: 'user', id: 'u-1' }, summary: 'start' });
});

describe('POST /api/v1/edit routes one op or a batch to the registry that owns it', () => {
  it('a frame op on a target frame is saved as a new revision', async () => {
    const res = await post({ op: 'add_shape', target: NODE, input: { kind: 'rect', start: 0 } });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tool: 'add_shape', version: 2 });
    expect(clipsOf(await head())).toHaveLength(1);
  });

  it('an element is addressed by frame and element id', async () => {
    const added = await (await post({ op: 'add_shape', target: NODE, input: { kind: 'rect', start: 0 } })).json();
    const clipId = added.output.clip_id;

    const res = await post({ op: 'set_props', target: NODE, element: clipId, input: { props: { opacity: 0.5 } } });

    expect(res.status).toBe(200);
  });

  it('a batch of frame ops on one frame lands as one revision, all or none', async () => {
    const res = await post({ op: 'batch', ops: [{ op: 'add_shape', target: NODE, input: { kind: 'rect', start: 0 } }, { op: 'add_shape', target: NODE, input: { kind: 'ellipse', start: 0 } }] });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.applied).toBe(2);
    expect(clipsOf(await head())).toHaveLength(2);
    expect((await readHead(state.db as never, { orgId: ORG, nodeId: NODE }))?.version).toBe(2);
  });

  it('a refused op in a frame batch leaves the frame as it was', async () => {
    const res = await post({ op: 'batch', ops: [{ op: 'add_shape', target: NODE, input: { kind: 'rect', start: 0 } }, { op: 'remove_clip', target: NODE, input: { clip_ids: ['nope'] } }] });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(clipsOf(await head())).toHaveLength(0);
  });

  it('a read-only key cannot edit a frame', async () => {
    state.writeAllowed = false;

    expect((await post({ op: 'add_shape', target: NODE, input: { kind: 'rect' } })).status).toBe(403);
  });

  it('describe lists the ops, and a missing op is refused', async () => {
    const listed = await (await post({ op: 'describe' })).json();

    expect(listed.ops.length).toBeGreaterThan(200);
    expect((await post({})).status).toBe(400);
  });
});
