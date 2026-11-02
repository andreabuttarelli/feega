import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { setClipFlags } from '@feega/motion-core/motion/organize';
import { wrapInStack } from '$lib/motion/layout/ops';
import { holdsLock, ownLocked } from './locks';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (doc: MotionDoc, id: string, x: number) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.1, height: 0.1 } }, id));

const two = shape(shape(newMotionDoc(MotionFormat.Landscape), 'a', 0.2), 'b', 0.5);

describe('a locked layer holds still', () => {
  it('a locked element is held, an unlocked one is not', () => {
    const doc = must(setClipFlags(two, 'a', { locked: true }));

    expect(holdsLock(doc, ['a'])).toBe(true);
    expect(holdsLock(doc, ['b'])).toBe(false);
    expect(holdsLock(doc, ['a', 'b'])).toBe(true);
  });

  it('a child of a locked container is held too', () => {
    const doc = must(setClipFlags(must(wrapInStack(two, ['a', 'b'], 'row', 'lane')), 'row', { locked: true }));

    expect(holdsLock(doc, ['b'])).toBe(true);
  });

  it('a free element whose own layer is locked does not move', () => {
    const single = shape(newMotionDoc(MotionFormat.Landscape), 'own', 0.5);

    expect(ownLocked(single)).toBe(false);
    expect(ownLocked(must(setClipFlags(single, 'own', { locked: true })))).toBe(true);
  });
});
