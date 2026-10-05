import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => ({ orgId: 'org-a', canvas: { id: 'c1', projectId: 'p1', name: 'C' }, projectBrandId: null }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));

const { GET } = await import('./+server');

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
    const res = await GET(event('m1', { nodes: [node('m1', 'motion')], motion_revisions: [{ org_id: 'org-a', node_id: 'm1', version: 3, doc, summary: null, actor_kind: 'user' }] }));
    const body = await res.json();

    expect(body.revision).toBe(3);
    expect(body.doc.tracks[0].clips[0].id).toBe('t1');
  });

  it('is a 404 for a node that is not a motion editor, so the cell falls back to its poster', async () => {
    await expect(GET(event('i1', { nodes: [node('i1', 'image')], motion_revisions: [] }))).rejects.toMatchObject({ status: 404 });
  });
});
