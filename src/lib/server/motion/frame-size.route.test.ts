import { describe, expect, it } from 'vitest';
import { actions } from '../../../routes/p/[projectId]/c/[canvasId]/+page.server';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, setCanvas } from '$lib/motion/timeline';

const SOURCE = '44444444-4444-4444-4444-444444444444';
const TARGET = '66666666-6666-6666-6666-666666666666';
const GEN = '77777777-7777-4777-8777-777777777777';
const ASSET = '88888888-8888-4888-8888-888888888888';

function withText(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'move me' } }, 'txt');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const frameRow = (id: string) => ({ id, org_id: 'org', canvas_id: 'canvas', project_id: 'project', type: 'motion', display_name: 'Frame', x: 0, y: 0, z: 0, width: null, height: null, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null }, version: 1 });

const revisionRow = (nodeId: string, version: number, doc: MotionDoc) => ({ org_id: 'org', node_id: nodeId, version, doc, summary: null, actor_kind: 'user' });

function event(fields: Record<string, string>, rows: Record<string, unknown[]> = {}) {
  const fake = fakeDb(
    {
      orgs_members: [{ user_id: 'user', org_id: 'org', role: 'owner', orgs: { id: 'org', name: 'Org', slug: 'org' } }],
      canvases: [{ id: 'canvas', org_id: 'org', project_id: 'project', name: 'Canvas', viewport: null }],
      projects: [{ id: 'project', org_id: 'org', name: 'P', slug: 'p', brand_id: null, archived_at: null, updated_at: '', mode: 'standard' }],
      nodes: [frameRow(SOURCE), frameRow(TARGET)],
      nodes_connections: [],
      motion_revisions: [revisionRow(SOURCE, 1, withText()), revisionRow(TARGET, 1, newMotionDoc(MotionFormat.Vertical))],
      ...rows
    },
    { filter: true, newId: () => '99999999-9999-4999-8999-999999999999' }
  );
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }
  return {
    ...fake,
    request: new Request('http://localhost/c/canvas', { method: 'POST', body }),
    params: { canvasId: 'canvas', projectId: 'project' },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user' } }), db: async () => fake.db }
  };
}

const written = (input: ReturnType<typeof event>, nodeId: string) =>
  input.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert' && (c.payload as { node_id: string }).node_id === nodeId).map((c) => c.payload as { version: number; doc: MotionDoc });


const custom = (): MotionDoc => {
  const made = setCanvas(withText(), { format: MotionFormat.Custom });
  if (!made.ok) {
    throw new Error(made.error);
  }
  return made.doc;
};

describe('frameSize action', () => {
  it('a custom frame resized on the canvas saves a revision with the exact node size', async () => {
    const input = event({ node_id: SOURCE, width: '600', height: '300' }, { motion_revisions: [revisionRow(SOURCE, 1, custom())] });

    const result = await actions.frameSize(input as never);

    expect(result).toMatchObject({ outcome: 'done', undo: [{ kind: 'doc.revision', nodeId: SOURCE, before: 1, after: 2 }] });
    const [saved] = written(input, SOURCE);
    expect([saved.version, saved.doc.width, saved.doc.height, saved.doc.freeSize]).toEqual([2, 600, 300, true]);
  });

  it('elements keep their place', async () => {
    const input = event({ node_id: SOURCE, width: '600', height: '300' }, { motion_revisions: [revisionRow(SOURCE, 1, custom())] });

    await actions.frameSize(input as never);

    expect(written(input, SOURCE)[0].doc.tracks.flatMap((t) => t.clips).map((c) => c.id)).toEqual(['txt']);
  });

  it('a preset frame takes the exact size, any ratio', async () => {
    const input = event({ node_id: SOURCE, width: '600', height: '300' });

    await actions.frameSize(input as never);

    expect(written(input, SOURCE)[0].doc).toMatchObject({ width: 600, height: 300 });
  });

  it('a missing size is a 400', async () => {
    const input = event({ node_id: SOURCE });

    expect(await actions.frameSize(input as never)).toMatchObject({ status: 400 });
  });
});
