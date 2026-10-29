import { describe, expect, it } from 'vitest';
import { frameRows, layerRows } from '$lib/canvas/layers';
import { actions } from '../../../routes/p/[projectId]/c/[canvasId]/+page.server';
import { fakeDb } from '$lib/server/db/fake-db';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { DrawTool } from '$lib/motion/draw-tool';
import { drawnElement, type CanvasBox } from '$lib/motion/draw-create';

const A = '44444444-4444-4444-4444-444444444444';
const B = '55555555-5555-4555-8555-555555555555';
const FRAME = '66666666-6666-6666-6666-666666666666';

function box(clipId: string, at: CanvasBox): MotionDoc {
  const made = drawnElement({ tool: DrawTool.Rectangle, box: at }, clipId);
  if (!made.ok) {
    throw new Error(made.error);
  }
  return made.doc;
}

const elementRow = (id: string, at: CanvasBox) => ({ id, org_id: 'org', canvas_id: 'canvas', project_id: 'project', type: 'motion', display_name: 'Box', x: at.left, y: at.top, z: 0, width: at.width, height: at.height, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: 'element' }, version: 1 });

const revisionRow = (nodeId: string, doc: MotionDoc) => ({ org_id: 'org', node_id: nodeId, version: 1, doc, summary: null, actor_kind: 'user' });

const AT_A: CanvasBox = { left: 0, top: 0, width: 100, height: 50 };
const AT_B: CanvasBox = { left: 200, top: 100, width: 100, height: 100 };

function event(fields: Record<string, string>, rows: Record<string, unknown[]>) {
  const fake = fakeDb(
    {
      orgs_members: [{ user_id: 'user', org_id: 'org', role: 'owner', orgs: { id: 'org', name: 'Org', slug: 'org' } }],
      canvases: [{ id: 'canvas', org_id: 'org', project_id: 'project', name: 'Canvas', viewport: null }],
      projects: [{ id: 'project', org_id: 'org', name: 'P', slug: 'p', brand_id: null, archived_at: null, updated_at: '', mode: 'standard' }],
      nodes_connections: [],
      ...rows
    },
    { filter: true, newId: () => crypto.randomUUID() }
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

type Inserted = { x: number; y: number; width: number; height: number; display_name: string; data: Record<string, unknown> };

const inserted = (input: ReturnType<typeof event>) => input.calls.filter((c) => c.table === 'nodes' && c.op === 'insert').map((c) => c.payload as Inserted);
const revisions = (input: ReturnType<typeof event>) => input.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert').map((c) => c.payload as { doc: MotionDoc });
const deletedIds = (input: ReturnType<typeof event>) =>
  input.calls.filter((c) => c.table === 'nodes' && c.op === 'update' && (c.payload as { deleted_at?: string }).deleted_at).flatMap((c) => c.filters.filter(([k]) => k === 'id').map(([, v]) => v));
const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips);

describe('grouping free elements on the canvas', () => {
  const two = () => ({ nodes: [elementRow(A, AT_A), elementRow(B, AT_B)], motion_revisions: [revisionRow(A, box('a', AT_A)), revisionRow(B, box('b', AT_B))] });

  it('⌘G makes one Group element over both boxes, each shape where it was, and removes the two', async () => {
    const input = event({ ids: JSON.stringify([A, B]) }, two());

    const result = await actions.groupElements(input as never);

    expect(result).toMatchObject({ outcome: 'done', created: true });
    expect(inserted(input)).toMatchObject([{ x: 0, y: 0, width: 300, height: 200, display_name: 'Group', data: { kind: 'group' } }]);
    const doc = revisions(input)[0].doc;
    const a = clipsOf(doc).find((c) => c.id === 'a')!;
    expect(a.props.x).toBeCloseTo(50 / 300, 2);
    expect(a.props.y).toBeCloseTo(25 / 200, 2);
    expect(a.props.width).toBeCloseTo(100 / 300, 2);
    expect(clipsOf(doc).map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(deletedIds(input).sort()).toEqual([A, B].sort());
    expect((result as { undo: { kind: string }[] }).undo.map((u) => u.kind)).toEqual(['node.create', 'node.delete', 'node.delete']);
  });

  it('gives the group the id the client already drew it with', async () => {
    const id = '77777777-7777-4777-8777-777777777777';
    const input = event({ ids: JSON.stringify([A, B]), node_id: id }, two());

    const result = await actions.groupElements(input as never);

    expect(result).toMatchObject({ outcome: 'done' });
    expect(input.calls.find((c) => c.table === 'nodes' && c.op === 'insert')?.payload).toMatchObject({ id });
  });

  it('refuses a lone pick: one thing is not a group', async () => {
    const input = event({ ids: JSON.stringify([A, 'gone-node']) }, { nodes: [elementRow(A, AT_A)], motion_revisions: [revisionRow(A, box('a', AT_A))] });

    expect(await actions.groupElements(input as never)).toMatchObject({ status: 422 });
    expect(input.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('a group dropped on a frame puts all its shapes inside, apart as they were', async () => {
    const grouped = event({ ids: JSON.stringify([A, B]) }, two());
    await actions.groupElements(grouped as never);
    const group = { ...elementRow(FRAME, { left: 0, top: 0, width: 300, height: 200 }), display_name: 'Group' };
    const target = { ...elementRow(A, { left: 600, top: 0, width: 600, height: 400 }), data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } };

    const input = event({ source: FRAME, drop: JSON.stringify({ on: 'frame', nodeId: A, at: { x: 0.5, y: 0.5 } }) }, { nodes: [group, target], motion_revisions: [revisionRow(FRAME, revisions(grouped)[0].doc), revisionRow(A, box('t', { left: 0, top: 0, width: 600, height: 400 }))] });
    expect(await actions.moveFree(input as never)).toMatchObject({ outcome: 'done', frameId: A });

    const last = revisions(input).at(-1)!.doc;
    const [a, b] = ['a', 'b'].map((id) => clipsOf(last).find((c) => c.id === id)!);
    expect(a && b).toBeTruthy();
    expect((b.props.x as number) - (a.props.x as number)).toBeCloseTo(200 / 600, 2);
    expect(deletedIds(input)).toEqual([FRAME]);
  });

  it('⇧⌘G gives every shape of a group back as its own element, where it was', async () => {
    const grouped = event({ ids: JSON.stringify([A, B]) }, two());
    await actions.groupElements(grouped as never);
    const group = { ...elementRow(FRAME, { left: 0, top: 0, width: 300, height: 200 }), display_name: 'Group' };

    const input = event({ id: FRAME }, { nodes: [group], motion_revisions: [revisionRow(FRAME, revisions(grouped)[0].doc)] });
    const result = await actions.ungroupElement(input as never);

    expect(result).toMatchObject({ outcome: 'done' });
    const made = inserted(input).sort((p, q) => p.x - q.x);
    expect(made).toHaveLength(2);
    expect(made[0].x).toBeCloseTo(0, 0);
    expect(made[0].width).toBeCloseTo(100, 0);
    expect(made[1].x).toBeCloseTo(200, 0);
    expect(made[1].y).toBeCloseTo(100, 0);
    expect(deletedIds(input)).toEqual([FRAME]);
  });
});

describe('wrapping free elements with a stack', () => {
  const two = () => ({ nodes: [elementRow(A, AT_A), elementRow(B, AT_B)], motion_revisions: [revisionRow(A, box('a', AT_A)), revisionRow(B, box('b', AT_B))] });

  it('⇧A makes one free Stack element holding both, in a row, and removes the two', async () => {
    const id = '88888888-8888-4888-8888-888888888888';
    const input = event({ ids: JSON.stringify([A, B]), node_id: id }, two());

    const result = await actions.stackElements(input as never);

    expect(result).toMatchObject({ outcome: 'done', created: true });
    expect(input.calls.find((c) => c.table === 'nodes' && c.op === 'insert')?.payload).toMatchObject({ id });
    const [node] = inserted(input);
    expect(node).toMatchObject({ x: 0, y: 0, display_name: 'Stack' });
    expect(node.data.kind).not.toBe('group');
    const doc = revisions(input)[0].doc;
    const stack = clipsOf(doc).find((c) => !c.parent)!;
    expect(stack.autoLayout).toMatchObject({ direction: 'horizontal' });
    expect(clipsOf(doc).filter((c) => c.parent === stack.id).map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(node.width / node.height).toBeCloseTo(doc.width / doc.height, 1);
    expect(deletedIds(input).sort()).toEqual([A, B].sort());
  });

  it('wraps one free text by itself', async () => {
    const input = event({ ids: JSON.stringify([A]) }, { nodes: [elementRow(A, AT_A)], motion_revisions: [revisionRow(A, box('a', AT_A))] });

    expect(await actions.stackElements(input as never)).toMatchObject({ outcome: 'done' });
    expect(clipsOf(revisions(input)[0].doc).find((c) => c.id === 'a')!.parent).toBeTruthy();
  });

  it('lists the new stack in Layers with the wrapped element indented under it', async () => {
    const id = '99999999-9999-4999-8999-999999999999';
    const input = event({ ids: JSON.stringify([A]), node_id: id }, { nodes: [elementRow(A, AT_A)], motion_revisions: [revisionRow(A, box('a', AT_A))] });
    await actions.stackElements(input as never);
    const [node] = inserted(input);
    const doc = revisions(input)[0].doc;

    const rows = layerRows([{ id, type: 'motion', name: node.display_name, element: true }], null, { [id]: frameRows(doc, id) });

    expect(rows.map((r) => [r.label, r.depth])).toEqual([
      ['Stack', 0],
      ['Box', 1]
    ]);
  });

  it('refuses a frame', async () => {
    const frame = { ...elementRow(FRAME, AT_A), data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } };
    const input = event({ ids: JSON.stringify([FRAME]) }, { nodes: [frame], motion_revisions: [revisionRow(FRAME, box('f', AT_A))] });

    expect(await actions.stackElements(input as never)).not.toMatchObject({ outcome: 'done' });
  });
});
