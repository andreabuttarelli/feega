import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';

const lookup = vi.fn();
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: (...a: unknown[]) => lookup(...a) }));
vi.mock('$lib/server/canvas/sign-media', () => ({ createAssetSigningDb: () => ({}), signAssetPaths: async () => new Map() }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));

const { GET } = await import('./+server');

const M1 = '00000000-0000-4000-8000-000000000001';
const M2 = '00000000-0000-4000-8000-000000000002';
const ELSEWHERE = '00000000-0000-4000-8000-000000000003';
const doc = newMotionDoc(MotionFormat.Landscape);
const PHOTO = '00000000-0000-4000-8000-0000000000f1';
const withPhoto = ((): MotionDoc => {
  const added = addClip(doc, { component: 'Image', from: 0, durationInFrames: 30, props: { assetId: PHOTO } }, 'p1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
})();
const photo = { id: PHOTO, org_id: 'org-a', project_id: 'p1', type: 'image', url: 'https://cdn/photo.png', mime_type: 'image/png', width: 640, height: 480, source: 'upload', created_at: '2026-11-09' };

const node = (id: string, canvas = 'c1') => ({ id, org_id: 'org-a', canvas_id: canvas, project_id: 'p1', deleted_at: null, type: 'motion', data: { format: 'landscape', docHeadRevision: 3 }, position: { x: 0, y: 0 } });
const head = (id: string, held: MotionDoc = doc) => ({ org_id: 'org-a', node_id: id, version: 3, doc: held, summary: null, actor_kind: 'user' });

function ask(ids: string[] | string, headers: Record<string, string> = {}) {
  const { db, calls } = fakeDb({ assets: [photo], brands: [], nodes: [node(M1), node(M2), node(ELSEWHERE, 'c2')], motion_revisions: [head(M1, withPhoto), head(M2), head(ELSEWHERE)] }, { filter: true });
  const event = {
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => db },
    params: { projectId: 'p1', canvasId: 'c1' },
    url: new URL(`http://x/sources?ids=${[ids].flat().join(',')}`),
    request: new Request('http://x/sources', { headers })
  } as never;
  return { run: () => GET(event), calls };
}

beforeEach(() => lookup.mockResolvedValue({ orgId: 'org-a', canvas: { id: 'c1', projectId: 'p1', name: 'C' }, projectBrandId: null }));

describe('GET the sources of every frame on a canvas at once', () => {
  it('answers each frame with its head, and the brand tokens once', async () => {
    const body = await (await ask([M1, M2]).run()).json();

    expect(Object.keys(body.frames).sort()).toEqual([M1, M2]);
    expect(body.frames[M1].revision).toBe(3);
    expect(body.tokens).toBeTruthy();
    expect(body.frames[M1].tokens).toBeUndefined();
  });

  it('reads all heads with two queries, versions then docs, not one per frame', async () => {
    const { run, calls } = ask([M1, M2]);
    await run();

    expect(calls.filter((c) => c.table === 'motion_revisions')).toHaveLength(2);
    expect(calls.filter((c) => c.table === 'nodes')).toHaveLength(1);
  });

  it('leaves out a frame that lives on another canvas', async () => {
    const body = await (await ask([M1, ELSEWHERE]).run()).json();

    expect(Object.keys(body.frames)).toEqual([M1]);
  });

  it('says which assets of a frame are images and how big, so the page can fetch them before the frame builds', async () => {
    const body = await (await ask([M1, M2]).run()).json();

    expect(body.frames[M1].media).toEqual({ [PHOTO]: { kind: 'image', width: 640, height: 480 } });
    expect(body.frames[M2].media).toEqual({});
  });

  it('is a 404 for a user who cannot reach the canvas', async () => {
    lookup.mockResolvedValue(null);

    await expect(ask([M1]).run()).rejects.toMatchObject({ status: 404 });
  });

  it('answers 304 when the canvas sources did not change, so a reopen downloads nothing', async () => {
    const first = await ask([M1, M2]).run();
    const again = await ask([M1, M2], { 'if-none-match': first.headers.get('etag')! }).run();

    expect(again.status).toBe(304);
  });

  it('is a 400 for ids that are not node ids', async () => {
    await expect(ask([`${M1}@bp:x`]).run()).rejects.toMatchObject({ status: 400 });
    await expect(ask('nope').run()).rejects.toMatchObject({ status: 400 });
  });
});
