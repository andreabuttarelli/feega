import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { createFormats, FormatsOutcome } from './create-formats';
import type { FrameStore, StoredFrame } from './move-element';

function memory(source: StoredFrame | null) {
  const made: { at: { x: number; y: number }; doc: MotionDoc }[] = [];
  const store = {
    read: async (id: string) => (source && id === source.nodeId ? source : null),
    create: async (at: { x: number; y: number }, doc: MotionDoc) => {
      made.push({ at, doc });
      return `copy-${made.length}`;
    }
  } as unknown as FrameStore;
  return { store, made };
}

const frame: StoredFrame = { nodeId: 'f', projectId: 'p', canvasId: 'c', version: 3, doc: newMotionDoc(MotionFormat.Landscape), at: { x: 100, y: 50 }, row: { size: { width: 640, height: 360 } } };

describe('create formats', () => {
  it('makes one editable frame per format, in a row to the right of the source', async () => {
    const { store, made } = memory(frame);

    const out = await createFormats(store, { nodeId: 'f', targets: [{ format: MotionFormat.Square }, { size: { width: 1000, height: 500 } }] });

    expect(out).toMatchObject({ outcome: FormatsOutcome.Done, frameIds: ['copy-1', 'copy-2'] });
    expect(made.map((m) => [m.doc.width, m.doc.height])).toEqual([
      [1080, 1080],
      [1000, 500]
    ]);
    expect(made[0].at.x).toBeGreaterThan(100 + 640);
    expect(made[1].at.x).toBeGreaterThan(made[0].at.x);
    expect(made.every((m) => m.at.y === 50)).toBe(true);
    expect(out.outcome === FormatsOutcome.Done && out.undo.map((u) => u.kind)).toEqual(['node.create', 'node.create']);
  });

  it('refuses a frame that does not exist', async () => {
    expect(await createFormats(memory(null).store, { nodeId: 'f', targets: [{ format: MotionFormat.Square }] })).toMatchObject({ outcome: FormatsOutcome.NotFound });
  });

  it('refuses a size the renderer cannot make, before creating anything', async () => {
    const { store, made } = memory(frame);
    const out = await createFormats(store, { nodeId: 'f', targets: [{ format: MotionFormat.Square }, { size: { width: 9000, height: 9000 } }] });
    expect(out).toMatchObject({ outcome: FormatsOutcome.Invalid });
    expect(made).toEqual([]);
  });
});
