import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { wrapInStack } from '$lib/motion/layout/ops';
import { altCopies } from './alt-copy';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (doc: MotionDoc, id: string, x: number) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.1, height: 0.1 } }, id));

const two = shape(shape(newMotionDoc(MotionFormat.Landscape), 'a', 0.2), 'b', 0.5);

let n = 0;
const newId = () => `copy${++n}`;

describe('alt-drag copies what it drags', () => {
  it('drags fresh copies and leaves the originals in place', () => {
    const copied = altCopies(two, ['a', 'b'], newId)!;

    expect(copied.ids).toHaveLength(2);
    expect(copied.ids).not.toContain('a');
    expect(findClip(copied.doc, copied.ids[0])!.clip.props.x).toBe(0.2);
    expect(findClip(copied.doc, 'a')!.clip.props).toEqual(findClip(two, 'a')!.clip.props);
  });

  it('an alt-drag copy shows at the same moment, with what is inside it', () => {
    const late = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 20, durationInFrames: 30, props: { shape: 'rect', x: 0.2, y: 0.5, width: 0.1, height: 0.1 } }, 'late'));
    const stacked = must(wrapInStack(shape(late, 'b', 0.5), ['late', 'b'], 'row', 'lane'));
    const copied = altCopies(stacked, ['row'], newId)!;
    const kids = copied.doc.tracks.flatMap((t) => t.clips).filter((c) => c.parent === copied.ids[0]);

    expect(findClip(copied.doc, copied.ids[0])!.clip.from).toBe(findClip(stacked, 'row')!.clip.from);
    expect(kids).toHaveLength(2);
  });

  it('a copy of a stack child stays in the stack, next to it', () => {
    const stacked = must(wrapInStack(two, ['a', 'b'], 'row', 'lane'));
    const copied = altCopies(stacked, ['a'], newId)!;

    expect(findClip(copied.doc, 'row')!.clip.autoLayout!.order).toEqual(['a', copied.ids[0], 'b']);
  });
});
