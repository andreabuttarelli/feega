import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { scenesOf, sequenceScenes } from '$lib/motion/scenes';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { insertScene, InsertOutcome } from './insert-scene';
import type { FrameStore, StoredFrame } from './move-element';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const PARENT = '33333333-3333-4333-8333-333333333333';
const NEW = '44444444-4444-4444-8444-444444444444';

const stored = (nodeId: string, doc: MotionDoc): StoredFrame => ({ nodeId, projectId: 'p', canvasId: 'c', version: 3, doc });

const plain = (frames: number) => ({ ...newMotionDoc(MotionFormat.Landscape), durationInFrames: frames });

const sequence = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [
  { nodeId: A, durationInFrames: 60 },
  { nodeId: B, durationInFrames: 60 }
]);

function memory(frames: StoredFrame[], outcome: RevisionOutcome = RevisionOutcome.Written) {
  const written: { id: string; doc: MotionDoc }[] = [];
  const store = {
    read: async (id: string) => frames.find((f) => f.nodeId === id) ?? null,
    write: async (id: string, _version: number, doc: MotionDoc) => (written.push({ id, doc }), { outcome, head: { version: 4 }, error: 'bad' })
  } as unknown as FrameStore;
  return { store, written };
}

describe('drop a frame onto a sequence', () => {
  it('inserts it as a scene at the boundary nearest the drop time', async () => {
    const { store, written } = memory([stored(PARENT, sequence), stored(NEW, plain(45))]);

    const out = await insertScene(store, { targetId: PARENT, sourceId: NEW, at: 0.5 });

    expect(out).toMatchObject({ outcome: InsertOutcome.Done });
    expect(scenesOf(written[0].doc).map((s) => [s.nodeId, s.from])).toEqual([[A, 0], [NEW, 60], [B, 105]]);
  });

  it('refuses a target that is not a sequence, and writes nothing', async () => {
    const { store, written } = memory([stored(PARENT, plain(60)), stored(NEW, plain(45))]);

    expect(await insertScene(store, { targetId: PARENT, sourceId: NEW, at: 0.5 })).toMatchObject({ outcome: InsertOutcome.Invalid });
    expect(written).toEqual([]);
  });

  it('refuses a source that is itself a sequence', async () => {
    const { store, written } = memory([stored(PARENT, sequence), stored(NEW, sequence)]);

    expect(await insertScene(store, { targetId: PARENT, sourceId: NEW, at: 0.5 })).toMatchObject({ outcome: InsertOutcome.Invalid });
    expect(written).toEqual([]);
  });

  it('answers not found for a frame that does not exist', async () => {
    const { store } = memory([stored(PARENT, sequence)]);

    expect(await insertScene(store, { targetId: PARENT, sourceId: NEW, at: 0 })).toMatchObject({ outcome: InsertOutcome.NotFound });
  });

  it('reports a stale version as a conflict', async () => {
    const { store } = memory([stored(PARENT, sequence), stored(NEW, plain(45))], RevisionOutcome.Conflict);

    expect(await insertScene(store, { targetId: PARENT, sourceId: NEW, at: 0 })).toMatchObject({ outcome: InsertOutcome.Conflict });
  });
});
