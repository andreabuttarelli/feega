import { describe, expect, it } from 'vitest';
import { actions } from '../../../routes/p/[projectId]/c/[canvasId]/+page.server';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { DrawTool } from '$lib/motion/draw-tool';
import { drawnElement } from '$lib/motion/draw-create';

const BOX = '44444444-4444-4444-4444-444444444444';
const FRAME = '55555555-5555-4555-8555-555555555555';
const GROUP = '66666666-6666-4666-8666-666666666666';

const MOTION = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const row = (id: string, at: { x: number; y: number; w: number; h: number }, data: Record<string, unknown>) => ({ id, org_id: 'org', canvas_id: 'canvas', project_id: 'project', type: 'motion', display_name: null, x: at.x, y: at.y, z: 0, width: at.w, height: at.h, data: { ...MOTION, ...data }, version: 1, deleted_at: null });
const revision = (nodeId: string, doc: MotionDoc) => ({ org_id: 'org', node_id: nodeId, version: 1, doc, summary: null, actor_kind: 'user' });

function boxDoc(): MotionDoc {
  const made = drawnElement({ tool: DrawTool.Rectangle, box: { left: 0, top: 0, width: 100, height: 100 } }, 'b');
  if (!made.ok) {
    throw new Error(made.error);
  }
  return made.doc;
}

function event(fields: Record<string, string>, rows: Record<string, unknown[]>) {
  const all: Record<string, unknown[]> = {
      orgs_members: [{ user_id: 'user', org_id: 'org', role: 'owner', orgs: { id: 'org', name: 'Org', slug: 'org' } }],
      canvases: [{ id: 'canvas', org_id: 'org', project_id: 'project', name: 'Canvas', viewport: null }],
      projects: [{ id: 'project', org_id: 'org', name: 'P', slug: 'p', brand_id: null, archived_at: null, updated_at: '', mode: 'standard' }],
      nodes_connections: [],
      canvas_events: [],
      ...rows
  };
  const fake = fakeDb(all, { filter: true, mutate: true, store: true, newId: () => crypto.randomUUID() });
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }
  return {
    ...fake,
    rows: all,
    request: new Request('http://localhost/c/canvas', { method: 'POST', body }),
    params: { canvasId: 'canvas', projectId: 'project' },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user' } }), db: async () => fake.db }
  };
}

type Row = { id: string; x: number; y: number; width: number; height: number; data: Record<string, unknown>; deleted_at: string | null };
const nodesOf = (input: ReturnType<typeof event>) => (input.rows?.nodes ?? []) as Row[];

describe('a group can hold a frame', () => {
  const seeded = () => ({
    nodes: [row(BOX, { x: 0, y: 0, w: 100, h: 100 }, { kind: 'element' }), row(FRAME, { x: 200, y: 0, w: 200, h: 100 }, {})],
    motion_revisions: [revision(BOX, boxDoc()), revision(FRAME, newMotionDoc(MotionFormat.Landscape))]
  });

  it('⌘G on a box and a frame makes a group over both; the frame stays a frame and joins it', async () => {
    const input = event({ ids: JSON.stringify([BOX, FRAME]) }, seeded());

    const result = (await actions.groupElements(input as never)) as { outcome: string; frameId: string };

    expect(result.outcome).toBe('done');
    const group = nodesOf(input).find((n) => n.id === result.frameId)!;
    expect(group).toMatchObject({ x: 0, y: 0, width: 400, height: 100, data: { kind: 'group' } });
    const frame = nodesOf(input).find((n) => n.id === FRAME)!;
    expect(frame.deleted_at).toBeNull();
    expect(frame.data.groupId).toBe(result.frameId);
    expect(frame.data.kind).toBeUndefined();
    expect((group as unknown as { z: number }).z, 'the group sits behind its frames, so they still take clicks').toBeLessThan((frame as unknown as { z: number }).z);
  });
});

describe('rotating a group', () => {
  const grouped = () => ({
    nodes: [row(GROUP, { x: 0, y: 0, w: 200, h: 100 }, { kind: 'group' }), row(FRAME, { x: 150, y: 25, w: 40, h: 50 }, { groupId: GROUP })],
    motion_revisions: [revision(GROUP, boxDoc()), revision(FRAME, newMotionDoc(MotionFormat.Landscape))]
  });

  it('turns the group and moves its frame around the group centre; the angles are saved', async () => {
    const input = event({ id: GROUP, degrees: '90' }, grouped());

    expect(await actions.rotateGroup(input as never)).toMatchObject({ outcome: 'done' });
    const [group, frame] = [GROUP, FRAME].map((id) => nodesOf(input).find((n) => n.id === id)!);
    expect(group.data.rotation).toBe(90);
    expect(frame.data.rotation).toBe(90);
    expect(frame.x + 20).toBeCloseTo(100, 5);
    expect(frame.y + 25).toBeCloseTo(120, 5);
  });

  it('a free shape turns as one canvas object: its node takes the angle, its place stays', async () => {
    const input = event({ id: BOX, degrees: '30' }, { nodes: [row(BOX, { x: 10, y: 20, w: 100, h: 100 }, { kind: 'element' })], motion_revisions: [revision(BOX, boxDoc())] });

    expect(await actions.rotateGroup(input as never)).toMatchObject({ outcome: 'done', turn: { id: BOX, degrees: 30 } });
    const box = nodesOf(input).find((n) => n.id === BOX)!;
    expect(box.data.rotation).toBe(30);
    expect([box.x, box.y]).toEqual([10, 20]);
  });

  it('a frame does not turn on the canvas', async () => {
    const input = event({ id: FRAME, degrees: '30' }, { nodes: [row(FRAME, { x: 0, y: 0, w: 200, h: 100 }, {})], motion_revisions: [revision(FRAME, newMotionDoc(MotionFormat.Landscape))] });

    expect(await actions.rotateGroup(input as never)).not.toMatchObject({ outcome: 'done' });
  });

  it('a rotation answers its own undo: the same turn the other way', async () => {
    const input = event({ id: GROUP, degrees: '90' }, grouped());

    expect(await actions.rotateGroup(input as never)).toMatchObject({ outcome: 'done', turn: { id: GROUP, degrees: 90 } });
  });

  it('scaling a group scales its frame: place and size', async () => {
    const input = event({ id: GROUP, width: '400', height: '50' }, grouped());

    expect(await actions.scaleGroup(input as never)).toMatchObject({ outcome: 'done' });
    expect(nodesOf(input).find((n) => n.id === FRAME)).toMatchObject({ x: 300, y: 12.5, width: 80, height: 25 });
    expect(nodesOf(input).find((n) => n.id === GROUP)).toMatchObject({ width: 400, height: 50 });
  });

  it('moving a group moves its frame by the same amount', async () => {
    const input = event({ id: GROUP, x: '30', y: '-10' }, grouped());

    expect(await actions.moveGroup(input as never)).toMatchObject({ outcome: 'done' });
    expect(nodesOf(input).find((n) => n.id === FRAME)).toMatchObject({ x: 180, y: 15 });
    expect(nodesOf(input).find((n) => n.id === GROUP)).toMatchObject({ x: 30, y: -10 });
  });

  it('ungrouping frees the frame', async () => {
    const input = event({ id: GROUP }, grouped());

    await actions.ungroupElement(input as never);

    expect(nodesOf(input).find((n) => n.id === FRAME)!.data.groupId ?? null).toBeNull();
  });
});
