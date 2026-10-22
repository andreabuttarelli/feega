import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { Grip, aabb, quadOf, type Bounds } from '$lib/motion/scene-select';
import { guessedBoxes } from '$lib/motion/move-element';
import { transformAt } from '$lib/motion/parent';
import { dragClips, measuredGaps, nudgeClips, type Drag } from './frame-transform';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (x: number) => ({ component: 'Shape', from: 0, durationInFrames: 900, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2 } }) as const;
const DOC = must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), shape(0.5), 'card')), shape(0.85), 'side'));
const BOXES = guessedBoxes(DOC);
const NO_KEYS = { shift: false, alt: false };
const REACH = 8;
const CORNER_BOTTOM_RIGHT = 2;

const drag = (over: Partial<Drag>): Drag => ({ doc: DOC, ids: ['card'], frame: 0, boxes: BOXES, grip: Grip.Move, handle: 0, from: [900, 500], to: [900, 500], keys: NO_KEYS, reach: REACH, ...over });
const boundsOf = (doc: MotionDoc, id: string): Bounds => aabb(quadOf(doc, id, 0, BOXES[id]));
const centre = (b: Bounds) => [(b.left + b.right) / 2, (b.top + b.bottom) / 2];

describe('dragClips', () => {
  it('snaps a moved element to the edge of a sibling and shows the guide', () => {
    const before = boundsOf(DOC, 'card');
    const near = boundsOf(DOC, 'side').left - before.right - 3;

    const { result, guides } = dragClips(drag({ to: [900 + near, 500] }));

    expect(boundsOf(must(result), 'card').right).toBeCloseTo(boundsOf(DOC, 'side').left);
    expect(guides).toContainEqual({ axis: 'x', at: boundsOf(DOC, 'side').left });
  });

  it('locks a Shift move to the dominant axis', () => {
    const { result } = dragClips(drag({ to: [1000, 530], keys: { shift: true, alt: false }, reach: 0 }));

    expect(centre(boundsOf(must(result), 'card'))[1]).toBeCloseTo(centre(boundsOf(DOC, 'card'))[1]);
  });

  it('resizes from the centre while Alt is held', () => {
    const corner = boundsOf(DOC, 'card');

    const { result } = dragClips(drag({ grip: Grip.Scale, handle: CORNER_BOTTOM_RIGHT, from: [corner.right, corner.bottom], to: [corner.right + 50, corner.bottom + 30], keys: { shift: false, alt: true }, reach: 0 }));

    const after = boundsOf(must(result), 'card');
    expect(centre(after)[0]).toBeCloseTo(centre(corner)[0]);
    expect(after.right - after.left).toBeCloseTo(corner.right - corner.left + 100);
  });

  it('resizes several elements as one group', () => {
    const group = { left: boundsOf(DOC, 'card').left, right: boundsOf(DOC, 'side').right, top: boundsOf(DOC, 'card').top, bottom: boundsOf(DOC, 'card').bottom };

    const { result } = dragClips(drag({ ids: ['card', 'side'], grip: Grip.Scale, handle: CORNER_BOTTOM_RIGHT, from: [group.right, group.bottom], to: [group.right + 100, group.bottom], reach: 0 }));

    expect(boundsOf(must(result), 'card').left).toBeCloseTo(group.left);
    expect(boundsOf(must(result), 'side').right).toBeCloseTo(group.right + 100);
  });

  it('rotates an element around its anchor', () => {
    const c = centre(boundsOf(DOC, 'card'));

    const { result } = dragClips(drag({ grip: Grip.Rotate, from: [c[0] + 100, c[1]], to: [c[0], c[1] + 100] }));

    expect(transformAt(findClip(must(result), 'card')!.clip, 'rotateZ', 0)).toBeCloseTo(90);
  });

  it('refuses a clip that is not in the doc', () => {
    expect(dragClips(drag({ ids: ['gone'], to: [1, 1] })).result.ok).toBe(false);
  });
});

describe('nudgeClips', () => {
  it('moves the picked elements by whole frame pixels', () => {
    const before = boundsOf(DOC, 'card');

    const after = boundsOf(must(nudgeClips(DOC, ['card'], 0, [10, -1])), 'card');

    expect(after.left - before.left).toBeCloseTo(10);
    expect(after.top - before.top).toBeCloseTo(-1);
  });
});

describe('measuredGaps', () => {
  it('measures the gap between the picked and the hovered element', () => {
    const gaps = measuredGaps(DOC, 0, BOXES, ['card'], 'side');

    expect(gaps).toEqual([expect.objectContaining({ axis: 'x', from: boundsOf(DOC, 'card').right, to: boundsOf(DOC, 'side').left })]);
  });

  it('measures nothing over the picked element itself', () => {
    expect(measuredGaps(DOC, 0, BOXES, ['card'], 'card')).toEqual([]);
  });
});
