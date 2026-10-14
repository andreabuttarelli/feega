import { describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';

const ORG = 'org-1';
const A = '77777777-7777-4777-8777-777777777777';
const B = '88888888-8888-4888-8888-888888888888';
const GEN = '99999999-9999-4999-8999-999999999999';
const ASSET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const state = vi.hoisted(() => ({ fake: null as FakeDb | null, writeAllowed: true }));
vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.fake!.db, orgId: ORG, userId: 'u-1', writeAllowed: state.writeAllowed } }) }));

const { POST } = await import('./+server');

const node = (id: string, type: string, data: Record<string, unknown>) => ({ id, org_id: ORG, canvas_id: 'c', project_id: 'p', type, display_name: null, x: 0, y: 0, z: 0, width: null, height: null, data, version: 1 });
const frameData = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, props: { text: 'hi' } }, 'txt');

function seed() {
  state.fake = fakeDb(
    {
      nodes: [node(A, 'motion', frameData), node(B, 'motion', frameData), node(GEN, 'video', { prompt: 'waves', refId: ASSET })],
      projects: [{ id: 'p', org_id: ORG, name: 'P', slug: 'p', brand_id: null, archived_at: null, updated_at: '', mode: 'standard' }],
      motion_revisions: [
        { org_id: ORG, node_id: A, version: 1, doc: added.ok ? added.doc : null, summary: null, actor_kind: 'user' },
        { org_id: ORG, node_id: B, version: 1, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actor_kind: 'user' }
      ],
      assets: [{ id: ASSET, org_id: ORG, project_id: 'p', type: 'video', url: 'v.mp4', content: null, mime_type: 'video/mp4', bytes: 1, width: 1280, height: 720, duration_s: 3, source: 'generated', source_node_id: GEN, uncensored: false, created_at: '' }],
      canvas_events: [{}]
    },
    { filter: true }
  );
}

const post = (body: unknown) => {
  const url = new URL('https://feega.test/api/v1/motion/elements');
  return POST({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }), url } as never);
};

const clipsWritten = (nodeId: string) =>
  state.fake!.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert' && (c.payload as { node_id: string }).node_id === nodeId).map((c) => (c.payload as { doc: { tracks: { clips: { id: string; component: string }[] }[] } }).doc.tracks.flatMap((t) => t.clips));

describe('POST /api/v1/motion/elements', () => {
  it('moves an element from one frame to another', async () => {
    seed();
    const res = await post({ frame_id: A, element_id: 'txt', to_frame_id: B, x: 0.3, y: 0.3 });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'done', frame_id: B, element_id: 'txt' });
    expect(clipsWritten(B).map((clips) => clips.map((c) => c.id))).toEqual([['txt']]);
    expect(clipsWritten(A)).toEqual([[]]);
  });

  it('places a generated video in a frame as a video element', async () => {
    seed();
    const res = await post({ node_id: GEN, to_frame_id: B });

    expect(res.status).toBe(200);
    expect(clipsWritten(B)[0].map((c) => c.component)).toEqual(['Video']);
  });

  it('a request naming both an element and a node is a 400', async () => {
    seed();
    expect((await post({ frame_id: A, element_id: 'txt', node_id: GEN })).status).toBe(400);
  });

  it('a read-only key is refused', async () => {
    seed();
    state.writeAllowed = false;
    expect((await post({ node_id: GEN, to_frame_id: B })).status).toBe(403);
    state.writeAllowed = true;
  });
});
