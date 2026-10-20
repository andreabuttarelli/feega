import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, setTransform, type OpResult } from './timeline';
import { cornerHandleAt, cornerLocalPoint } from './corner-handles';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const RECT = { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 };
const NO_RADIUS = [0, 0, 0, 0] as const;
const FRAME = 0;
const SHIFT = 0.1;

const placed = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: RECT }, 'back'));
const clipId = placed.tracks[0].clips[0].id;
const clipIn = (doc: MotionDoc) => findClip(doc, clipId)!.clip;

describe('the corner handles follow the shape', () => {
  it('a shape that was moved carries its handles with it', () => {
    const moved = must(setTransform(placed, clipId, { x: SHIFT }));

    const before = cornerHandleAt(placed, clipIn(placed), FRAME, 0, NO_RADIUS);
    const after = cornerHandleAt(moved, clipIn(moved), FRAME, 0, NO_RADIUS);

    expect(after[0] - before[0]).toBeCloseTo(SHIFT * placed.width);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it('a dragged point reads back in the shape own space', () => {
    const moved = must(setTransform(placed, clipId, { x: SHIFT }));
    const handle = cornerHandleAt(moved, clipIn(moved), FRAME, 2, NO_RADIUS);

    const local = cornerLocalPoint(moved, clipIn(moved), FRAME, handle);
    const unmoved = cornerHandleAt(placed, clipIn(placed), FRAME, 2, NO_RADIUS);

    expect(local[0]).toBeCloseTo(unmoved[0]);
    expect(local[1]).toBeCloseTo(unmoved[1]);
  });
});
