import { describe, expect, it, vi } from 'vitest';
import { MOTION_CANVAS_NAME, startMotion, type MotionStartDeps } from './start';
import { newMotionData } from '$lib/canvas/motion-node';
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
