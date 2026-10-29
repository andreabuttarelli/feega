import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => ({ orgId: 'org-a', canvas: { id: 'c1', projectId: 'p1', name: 'C' }, projectBrandId: null }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));

const { GET } = await import('./+server');

const M1 = '00000000-0000-4000-8000-000000000001';
const I1 = '00000000-0000-4000-8000-000000000002';

const doc = (() => {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 60 }, 't1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
})();

function node(id: string, type: string) {
  return { id, org_id: 'org-a', canvas_id: 'c1', project_id: 'p1', deleted_at: null, type, data: { format: 'landscape', docHeadRevision: 3, posterAssetId: null, lastRenderAssetId: null }, position: { x: 0, y: 0 } };
}

function event(nodeId: string, rows: Record<string, unknown[]>) {
  const { db } = fakeDb({ assets: [], ...rows }, { filter: true });
  return {
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => db },
    params: { projectId: 'p1', canvasId: 'c1', nodeId },
    url: new URL('http://x/source?rev=3')
  } as never;
}

describe('GET the doc of a motion editor that feeds a composition', () => {
  it('answers with the head revision and its doc, the live source of the cell', async () => {
    const res = await GET(event(M1, { nodes: [node(M1, 'motion')], motion_revisions: [{ org_id: 'org-a', node_id: M1, version: 3, doc, summary: null, actor_kind: 'user' }] }));
    const body = await res.json();

    expect(body.revision).toBe(3);
    expect(body.doc.tracks[0].clips[0].id).toBe('t1');
  });

  it('is a 404 for a node that is not a motion editor, so the cell falls back to its poster', async () => {
    await expect(GET(event(I1, { nodes: [node(I1, 'image')], motion_revisions: [] }))).rejects.toMatchObject({ status: 404 });
  });
});

describe('GET with a node id that is not a uuid', () => {
  it('is a 400, not a database error, for a breakpoint view tile id', async () => {
    await expect(GET(event(`${M1}@bp:b7e8878b`, { nodes: [node(M1, 'motion')], motion_revisions: [] }))).rejects.toMatchObject({ status: 400 });
  });
});
