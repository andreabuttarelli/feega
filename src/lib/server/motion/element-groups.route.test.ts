import { describe, expect, it } from 'vitest';
import { frameRows, layerRows } from '$lib/canvas/layers';
import { actions } from '../../../routes/p/[projectId]/c/[canvasId]/+page.server';
import { fakeDb } from '$lib/server/db/fake-db';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { DrawTool } from '$lib/motion/draw-tool';
import { drawnElement, type CanvasBox } from '$lib/motion/draw-create';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { pivotBox } from '@feega/motion-core/motion/parent';

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

describe('framing free elements on the canvas', () => {
  const two = () => ({ nodes: [elementRow(A, AT_A), elementRow(B, AT_B)], motion_revisions: [revisionRow(A, box('a', AT_A)), revisionRow(B, box('b', AT_B))] });

  it('⌥⌘G makes one frame whose stage covers both boxes, each where it was, and removes the two', async () => {
    const id = '99999999-9999-4999-8999-999999999999';
    const input = event({ ids: JSON.stringify([A, B]), node_id: id }, two());

    const result = await actions.frameElements(input as never);

    expect(result).toMatchObject({ outcome: 'done', created: true });
    expect(input.calls.find((c) => c.table === 'nodes' && c.op === 'insert')?.payload).toMatchObject({ id });
    const [made] = inserted(input);
    expect(made).toMatchObject({ x: 0, y: 0, width: 300, height: 200, display_name: 'Frame', data: { format: 'custom' } });
    const doc = revisions(input)[0].doc;
    expect(doc.surface).toBeTruthy();
    const a = clipsOf(doc).find((c) => c.id === 'a')!;
    expect(a.props.x).toBeCloseTo(50 / 300, 2);
    expect(a.props.width).toBeCloseTo(100 / 300, 2);
    expect(deletedIds(input).sort()).toEqual([A, B].sort());
  });

  it('frames a single element too, as Figma does', async () => {
    const input = event({ ids: JSON.stringify([A]) }, { nodes: [elementRow(A, AT_A)], motion_revisions: [revisionRow(A, box('a', AT_A))] });

    expect(await actions.frameElements(input as never)).toMatchObject({ outcome: 'done' });
    expect(inserted(input)[0]).toMatchObject({ width: 100 });
  });

  it('refuses a frame among the picks: frames nest by dropping, not by framing', async () => {
    const frame = { ...elementRow(B, AT_B), data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } };
    const input = event({ ids: JSON.stringify([A, B]) }, { nodes: [elementRow(A, AT_A), frame], motion_revisions: [revisionRow(A, box('a', AT_A)), revisionRow(B, box('b', AT_B))] });

    expect(await actions.frameElements(input as never)).toMatchObject({ status: 422 });
    expect(input.calls.some((c) => c.op === 'insert')).toBe(false);
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

  it('a stack sent again with an id that already exists inserts nothing and removes nothing', async () => {
    const id = '88888888-8888-4888-8888-888888888888';
    const rows = two();
    const input = event({ ids: JSON.stringify([A, B]), node_id: id }, { ...rows, nodes: [...rows.nodes, { ...elementRow(id, AT_A), display_name: 'Stack', deleted_at: '2026-11-02T00:00:00Z' }] });

    const result = await actions.stackElements(input as never);

    expect(result).toMatchObject({ outcome: 'done', frameId: id, created: false, undo: [] });
    expect(inserted(input)).toEqual([]);
    expect(deletedIds(input)).toEqual([]);
  });
});

describe('wrapping free elements with a stack, as they are laid out', () => {
  const C = '12121212-1212-4212-8212-121212121212';
  const D = '13131313-1313-4313-8313-131313131313';
  const S1 = '14141414-1414-4414-8414-141414141414';
  const S2 = '15151515-1515-4515-8515-151515151515';

  const rects = (at: Record<string, CanvasBox>) => ({
    nodes: Object.entries(at).map(([id, b]) => elementRow(id, b)),
    motion_revisions: Object.entries(at).map(([id, b]) => revisionRow(id, box(`clip-${id.slice(0, 2)}`, b)))
  });

  async function wrap(rows: Record<string, unknown[]>, ids: string[], id: string) {
    const input = event({ ids: JSON.stringify(ids), node_id: id }, rows);
    const result = await actions.stackElements(input as never);
    const [node] = inserted(input);
    return { result, node, doc: revisions(input)[0]?.doc };
  }

  function laidBoxes(node: Inserted, doc: MotionDoc) {
    const laid = withAutoLayout(doc);
    return Object.fromEntries(
      clipsOf(laid).map((c) => {
        const b = pivotBox(c.props, { width: node.width, height: node.height });
        return [c.id, { left: node.x + b.left, top: node.y + b.top, width: b.width, height: b.height }];
      })
    );
  }

  const stackRow = (id: string, n: Inserted) => ({ ...elementRow(id, { left: n.x, top: n.y, width: n.width, height: n.height }), display_name: 'Stack' });

  it('wrapping two stacks keeps each stack with its own children', async () => {
    const top = await wrap(rects({ [A]: { left: 0, top: 0, width: 100, height: 80 }, [B]: { left: 160, top: 0, width: 100, height: 80 } }), [A, B], S1);
    const bottom = await wrap(rects({ [C]: { left: 0, top: 200, width: 100, height: 80 }, [D]: { left: 160, top: 200, width: 100, height: 80 } }), [C, D], S2);

    const outer = await wrap({ nodes: [stackRow(S1, top.node), stackRow(S2, bottom.node)], motion_revisions: [revisionRow(S1, top.doc), revisionRow(S2, bottom.doc)] }, [S1, S2], '16161616-1616-4616-8616-161616161616');

    expect(outer.result).toMatchObject({ outcome: 'done' });
    const all = clipsOf(outer.doc);
    const root = all.filter((c) => !c.parent);
    expect(root).toHaveLength(1);
    const inner = all.filter((c) => c.parent === root[0].id);
    expect(inner).toHaveLength(2);
    expect(inner.every((c) => c.autoLayout)).toBe(true);
    expect(inner.map((s) => all.filter((c) => c.parent === s.id).length)).toEqual([2, 2]);
    expect(root[0].autoLayout).toMatchObject({ direction: 'vertical' });
    const boxes = laidBoxes(outer.node, outer.doc);
    const leaves = all.filter((c) => !c.autoLayout).map((c) => boxes[c.id]).sort((p, q) => p.top - q.top || p.left - q.left);
    expect(leaves.map((b) => [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)])).toEqual([
      [0, 0, 100, 80],
      [160, 0, 100, 80],
      [0, 200, 100, 80],
      [160, 200, 100, 80]
    ]);
  });

  it('three rects 60 apart keep the gap of 60 and do not move', async () => {
    const at = { [A]: { left: 0, top: 0, width: 100, height: 80 }, [B]: { left: 160, top: 0, width: 100, height: 80 }, [C]: { left: 320, top: 0, width: 100, height: 80 } };
    const { node, doc } = await wrap(rects(at), [A, B, C], S1);

    expect(node).toMatchObject({ x: 0, y: 0, width: 420, height: 80 });
    const root = clipsOf(doc).find((c) => !c.parent)!;
    expect((root.autoLayout!.gap * node.width) / doc.width).toBeCloseTo(60, 0);
    const boxes = laidBoxes(node, doc);
    const lefts = clipsOf(doc).filter((c) => c.parent === root.id).map((c) => Math.round(boxes[c.id].left)).sort((p, q) => p - q);
    expect(lefts).toEqual([0, 160, 320]);
  });

  it('rects placed one under the other become a vertical stack', async () => {
    const at = { [A]: { left: 0, top: 0, width: 100, height: 80 }, [B]: { left: 0, top: 120, width: 100, height: 80 } };
    const { node, doc } = await wrap(rects(at), [A, B], S1);

    expect(clipsOf(doc).find((c) => !c.parent)!.autoLayout).toMatchObject({ direction: 'vertical' });
    expect(node).toMatchObject({ width: 100, height: 200 });
  });

  it('staggered rects are hugged whole, none clipped', async () => {
    const at = { [A]: { left: -420, top: 240, width: 60, height: 40 }, [B]: { left: -300, top: 260, width: 60, height: 40 }, [C]: { left: -180, top: 280, width: 60, height: 40 } };
    const { node, doc } = await wrap(rects(at), [A, B, C], S1);

    expect(node.height).toBe(40);
    const geometry = (d: MotionDoc) => clipsOf(d).map((c) => [c.id, ...['x', 'y', 'width', 'height'].map((k) => Number((c.props[k] as number).toFixed(3)))]);
    expect(geometry(doc)).toEqual(geometry(withAutoLayout(doc)));
    const boxes = laidBoxes(node, doc);
    for (const c of clipsOf(doc).filter((k) => k.parent)) {
      const b = boxes[c.id];
      expect(Math.round(b.height)).toBe(40);
      expect(b.top).toBeGreaterThanOrEqual(node.y - 0.5);
      expect(b.top + b.height).toBeLessThanOrEqual(node.y + node.height + 0.5);
    }
  });
});
