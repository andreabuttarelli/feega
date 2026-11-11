import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';

const LATENCY_MS = 40;

vi.mock('$lib/server/canvas/sign-media', () => ({
  createAssetSigningDb: () => ({}),
  signAssetPaths: async (_db: unknown, _service: unknown, paths: { uploaded: string[] }) => {
    await new Promise((done) => setTimeout(done, LATENCY_MS));
    return new Map(paths.uploaded.map((p) => [p, `signed:${p}`]));
  }
}));

const { GET } = await import('./+server');

const FRAMES = 12;
const PHOTO = '00000000-0000-4000-8000-0000000000f1';
const frameId = (i: number) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
const withPhoto = ((): MotionDoc => {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, durationInFrames: 30, props: { assetId: PHOTO } }, 'p1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
})();

const rows = {
  orgs_members: [
    { user_id: 'u1', role: 'owner', created_at: '2026-01-01', orgs: { id: 'org-b', name: 'B', slug: 'b' }, profiles: { active_org_id: 'org-b' } },
    { user_id: 'u1', role: 'owner', created_at: '2026-01-02', orgs: { id: 'org-a', name: 'A', slug: 'a' }, profiles: { active_org_id: 'org-b' } }
  ],
  canvases: [{ id: 'c1', org_id: 'org-a', project_id: 'p1', name: 'C', viewport: null, deleted_at: null, projects: { mode: 'standard', brand_id: null } }],
  assets: [{ id: PHOTO, org_id: 'org-a', project_id: 'p1', type: 'image', url: 'org-a/p1/photo.png', mime_type: 'image/png', width: 640, height: 480, source: 'upload', created_at: '2026-11-09' }],
  brands: [],
  nodes: Array.from({ length: FRAMES }, (_, i) => ({ id: frameId(i), org_id: 'org-a', canvas_id: 'c1', project_id: 'p1', deleted_at: null, type: 'motion', data: { format: 'landscape', docHeadRevision: 3 }, position: { x: 0, y: 0 } })),
  motion_revisions: Array.from({ length: FRAMES }, (_, i) => ({ org_id: 'org-a', node_id: frameId(i), version: 3, doc: withPhoto, summary: null, actor_kind: 'user' }))
};

async function wavesToAnswer(query = ''): Promise<{ waves: number; status: number; body: { frames: Record<string, { assets: Record<string, string> }>; signed: Record<string, string> } }> {
  vi.useFakeTimers();
  const { db } = fakeDb(rows, { filter: true, latencyMs: LATENCY_MS });
  const event = {
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => db },
    params: { projectId: 'p1', canvasId: 'c1' },
    url: new URL(`http://x/sources?ids=${rows.nodes.map((n) => n.id).join(',')}${query}`),
    request: new Request('http://x/sources')
  } as never;

  let answer: Response | null = null;
  const asked = Promise.resolve(GET(event)).then((res: Response) => (answer = res), (e: { status: number }) => (answer = new Response('{}', { status: e.status })));
  let waves = 0;
  while (!answer) {
    await vi.advanceTimersByTimeAsync(LATENCY_MS);
    waves++;
  }
  await asked;
  return { waves, status: (answer as Response).status, body: await (answer as Response).json() };
}

afterEach(() => vi.useRealTimers());

describe('the sources of every frame, against a database one round trip away', () => {
  it('answers in three waves of round trips: the canvas, then frames and library together, then signing', async () => {
    const { waves, body } = await wavesToAnswer();

    expect(body.frames[frameId(0)].assets).toEqual({ [PHOTO]: `/p/p1/c/c1/assets/${PHOTO}` });
    expect(body.signed).toEqual({ [PHOTO]: 'signed:org-a/p1/photo.png' });
    expect(waves).toBe(3);
  });

  it('answers in two waves when the page names the org and the revisions it holds: the canvas check runs beside the reads', async () => {
    const { waves, body } = await wavesToAnswer(`&org=org-a&at=${rows.nodes.map(() => 3).join(',')}`);

    expect(body.frames[frameId(0)].assets).toEqual({ [PHOTO]: `/p/p1/c/c1/assets/${PHOTO}` });
    expect(body.signed).toEqual({ [PHOTO]: 'signed:org-a/p1/photo.png' });
    expect(waves).toBe(2);
  });

  it('refuses an org the canvas does not belong to, even though the reads already ran', async () => {
    const { status } = await wavesToAnswer(`&org=org-b&at=${rows.nodes.map(() => 3).join(',')}`);

    expect(status).toBe(404);
  });
});
