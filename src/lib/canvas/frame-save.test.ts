import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { setTransform, addClip } from '$lib/motion/timeline';
import { frameSaver } from './frame-save';

const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'card');
if (!added.ok) {
  throw new Error(added.error);
}
const moved = setTransform(added.doc, 'card', { x: 0.1 });
if (!moved.ok) {
  throw new Error(moved.error);
}

describe('frameSaver', () => {
  it('sends the difference against the last saved doc', async () => {
    const sent: { version: number; summary: string; ops: unknown[] }[] = [];
    const saver = frameSaver({ version: 3, doc: added.doc }, async (s) => (sent.push(s), { version: 4, doc: moved.doc }), 0);

    saver.apply(moved.doc, 'Moved');
    await saver.flush();

    expect(sent).toHaveLength(1);
    expect(sent[0].version).toBe(3);
    expect(sent[0].summary).toBe('Moved');
    expect(sent[0].ops.length).toBeGreaterThan(0);
    expect(saver.version).toBe(4);
  });

  it('keeps the edit when the save fails', async () => {
    const saver = frameSaver({ version: 3, doc: added.doc }, async () => null, 0);

    saver.apply(moved.doc, 'Moved');
    await saver.flush();

    expect(saver.doc).toBe(moved.doc);
    expect(saver.version).toBe(3);
  });

  it('tells the owner about every doc the core must draw', () => {
    const seen: unknown[] = [];
    const saver = frameSaver({ version: 3, doc: added.doc }, async () => null, 0, (doc) => seen.push(doc));

    saver.apply(moved.doc, 'Moved');

    expect(seen).toEqual([moved.doc]);
  });
});
