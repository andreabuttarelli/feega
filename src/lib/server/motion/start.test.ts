import { describe, expect, it, vi } from 'vitest';
import { MOTION_CANVAS_NAME, startMotion, type MotionStartDeps } from './start';
import { frameNodeOf, newMotionData } from '$lib/canvas/motion-node';
import { MotionFormat } from '$lib/motion/doc';
import { nodeSize } from '$lib/canvas/node-size';
import type { Db } from '$lib/server/db/client';

const db = {} as Db;
const canvas = (id: string, name: string) => ({ id, projectId: 'p1', name, viewport: null });
const node = (x: number, width: number | null) => ({ id: 'n', canvasId: 'c1', projectId: 'p1', type: 'image', displayName: null, position: { x, y: 0, z: 0 }, size: { width, height: null }, data: {}, version: 1 });

function deps(overrides: Partial<MotionStartDeps> = {}): MotionStartDeps {
  return {
    listCanvases: vi.fn(async () => [canvas('c1', 'Launch')]),
    createCanvas: vi.fn(async () => canvas('c-motion', MOTION_CANVAS_NAME)),
    listNodes: vi.fn(async () => []),
    createNode: vi.fn(async (_db: Db, input: { canvasId: string }) => ({ ...node(0, null), id: 'new-motion', canvasId: input.canvasId })),
    ...overrides
  };
}

const input = { orgId: 'org', projectId: 'p1', userId: 'u1', name: 'Spring teaser' };

describe('a new video from the dashboard is a motion node on a canvas', () => {
  it('with no canvas chosen it opens a dedicated Motion canvas, created once', async () => {
    const d = deps();
    const started = await startMotion(db, d, { ...input, canvasId: null });

    expect(d.createCanvas).toHaveBeenCalledWith(db, { orgId: 'org', projectId: 'p1', name: MOTION_CANVAS_NAME });
    expect(started).toEqual({ projectId: 'p1', canvasId: 'c-motion', nodeId: 'new-motion' });
  });

  it('reuses the Motion canvas when the project already has one', async () => {
    const d = deps({ listCanvases: vi.fn(async () => [canvas('c1', 'Launch'), canvas('c-old', MOTION_CANVAS_NAME)]) });
    const started = await startMotion(db, d, { ...input, canvasId: null });

    expect(d.createCanvas).not.toHaveBeenCalled();
    expect(started?.canvasId).toBe('c-old');
  });

  it('lands on the chosen canvas, to the right of what is already there', async () => {
    const d = deps({ listNodes: vi.fn(async () => [node(100, 400), node(-50, null)]) });
    await startMotion(db, d, { ...input, canvasId: 'c1' });

    expect(d.createNode).toHaveBeenCalledWith(db, {
      orgId: 'org',
      projectId: 'p1',
      canvasId: 'c1',
      type: 'motion',
      x: 580,
      y: 0,
      displayName: 'Spring teaser',
      data: newMotionData(),
      actor: { kind: 'user', id: 'u1' }
    });
  });

  it('refuses a canvas that is not in the project', async () => {
    const d = deps();
    expect(await startMotion(db, d, { ...input, canvasId: 'elsewhere' })).toBeNull();
    expect(d.createNode).not.toHaveBeenCalled();
  });
});

describe('a frame started from the canvas add bar', () => {
  it('lands where the canvas is looking, not to the right of everything', async () => {
    const d = deps({ listNodes: vi.fn(async () => [node(100, 400)]) });
    await startMotion(db, d, { ...input, canvasId: 'c1', at: { x: 30, y: -40 } });

    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ x: 30, y: -40 }));
  });

  it('placed at a point, it does not read the canvas nodes it will not use', async () => {
    const d = deps();
    await startMotion(db, d, { ...input, canvasId: 'c1', at: { x: 0, y: 0 } });

    expect(d.listNodes).not.toHaveBeenCalled();
  });
});

describe('a frame started from a known picture is shaped by it', () => {
  const poster = { width: 1080, height: 1350 };

  it('takes the picture format and a size of the same aspect, in the one insert', async () => {
    const d = deps();
    await startMotion(db, d, { ...input, canvasId: 'c1', picture: poster });

    const shaped = frameNodeOf(poster);
    expect(shaped.data.format).toBe(MotionFormat.Portrait);
    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ data: shaped.data, width: shaped.w, height: shaped.h }));
  });

  it('without a picture leaves the size to the format, as before', async () => {
    const d = deps();
    await startMotion(db, d, { ...input, canvasId: 'c1', format: MotionFormat.Square });

    expect(vi.mocked(d.createNode).mock.calls[0][1]).not.toHaveProperty('width');
  });
});

describe('a frame the agent places beside the nodes it is about', () => {
  it('never lands on a node that has no stored size, nor on the nodes beside it', async () => {
    const brief = { ...node(0, null), id: 'brief', type: 'doc' };
    const beside = { ...node(500, null), id: 'poster' };
    const d = deps({ listNodes: vi.fn(async () => [brief, beside]) });
    await startMotion(db, d, { ...input, canvasId: 'c1', near: ['brief'] });

    const placed = vi.mocked(d.createNode).mock.calls[0][1] as { x: number; y: number };
    const rects = [brief, beside].map((n) => ({ x: n.position.x, y: n.position.y, ...nodeSize(n.type) }));
    const mine = { x: placed.x, y: placed.y, ...nodeSize('motion', newMotionData()) };
    const overlaps = (a: typeof mine, b: typeof mine) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    expect(rects.some((r) => overlaps(mine, r))).toBe(false);
  });
});
