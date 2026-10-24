import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { sceneNodeIds } from '$lib/motion/scenes';
import { combineScenes, CombineOutcome } from './combine-scenes';
import type { FrameStore, StoredFrame } from './move-element';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const frame = (nodeId: string, x: number, frames: number): StoredFrame => ({
  nodeId,
  projectId: 'p',
  canvasId: 'c',
  version: 1,
  doc: { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: frames },
  at: { x, y: 0 },
  row: { size: { width: 640, height: 360 } }
});

function memory(frames: StoredFrame[]) {
  const made: { at: { x: number; y: number }; doc: MotionDoc }[] = [];
  const store = {
    read: async (id: string) => frames.find((f) => f.nodeId === id) ?? null,
    create: async (at: { x: number; y: number }, doc: MotionDoc) => (made.push({ at, doc }), 'parent')
  } as unknown as FrameStore;
  return { store, made };
}

describe('combine scenes into a video', () => {
  it('makes one parent frame with the scenes sequenced left to right, by reference', async () => {
    const { store, made } = memory([frame(C, 2000, 30), frame(A, 0, 60), frame(B, 1000, 45)]);

    const out = await combineScenes(store, { frameIds: [C, A, B] });

    expect(out).toMatchObject({ outcome: CombineOutcome.Done, frameId: 'parent' });
    const doc = made[0].doc;
    expect(sceneNodeIds(doc)).toEqual([A, B, C]);
    expect(doc.durationInFrames).toBe(135);
    expect(doc.tracks.flatMap((t) => (t.clips as MotionClip[]).map((c) => c.from))).toEqual([0, 60, 105]);
    expect(Object.keys(doc.comps)).toEqual([]);
    expect(made[0].at.y).toBeGreaterThan(360);
  });

  it('needs two frames that exist', async () => {
    const { store, made } = memory([frame(A, 0, 60)]);

    expect(await combineScenes(store, { frameIds: [A, B] })).toMatchObject({ outcome: CombineOutcome.NotFound });
    expect(made).toEqual([]);
  });
});
