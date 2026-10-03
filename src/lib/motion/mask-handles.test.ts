import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { MaskKind } from './mask';
import { Grab, cornerAt, dragBox, dragPoint, editMaskAt, maskBox, pointAt } from './mask-handles';
import { addClip, setKeyframes, setMask, type OpResult } from './timeline';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const FRAME = { width: 1000, height: 500 };
const box = { x: 0.5, y: 0.5, width: 0.2, height: 0.4, rotation: 0 };

describe('dragging the mask box', () => {
  it('the body moves the centre by the drag, in fractions of the frame', () => {
    expect(dragBox(box, Grab.Body, { dx: 0.1, dy: -0.1 }, FRAME)).toMatchObject({ x: 0.6, y: 0.4, width: 0.2, height: 0.4 });
  });

  it('a corner resizes against the opposite corner, which stays put', () => {
    const next = dragBox(box, Grab.BottomRight, { dx: 0.1, dy: 0.2 }, FRAME);

    expect(next.width).toBeCloseTo(0.3);
    expect(next.height).toBeCloseTo(0.6);
    expect(cornerAt(next, Grab.TopLeft, FRAME).x).toBeCloseTo(cornerAt(box, Grab.TopLeft, FRAME).x);
    expect(cornerAt(next, Grab.TopLeft, FRAME).y).toBeCloseTo(cornerAt(box, Grab.TopLeft, FRAME).y);
  });

  it('a rotated box resizes along its own axes', () => {
    const turned = { ...box, rotation: 90 };
    const next = dragBox(turned, Grab.BottomRight, { dx: 0, dy: 0.1 }, FRAME);

    expect(next.width * FRAME.width).toBeCloseTo(0.2 * FRAME.width + 0.1 * FRAME.height);
    expect(next.height).toBeCloseTo(0.4);
  });

  it('a box never turns inside out', () => {
    expect(dragBox(box, Grab.TopLeft, { dx: 0.9, dy: 0.9 }, FRAME)).toMatchObject({ width: 0, height: 0 });
  });
});

describe('dragging a polygon point', () => {
  it('moves the point inside the box, clamped to it', () => {
    const points: [number, number][] = [[0, 0], [1, 0], [0.5, 1]];
    const moved = dragPoint(points, 2, box, { dx: 0.05, dy: 0 }, FRAME);

    expect(moved[2][0]).toBeCloseTo(0.75);
    expect(dragPoint(points, 0, box, { dx: -1, dy: -1 }, FRAME)[0]).toEqual([0, 0]);
    expect(pointAt(box, [0.5, 1], FRAME)).toEqual({ x: 500, y: 350 });
  });
});

describe('committing a drag', () => {
  const doc = must(setMask(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 30, props: { assetId: 'a' } }, 'img')), 'img', { kind: MaskKind.Ellipse }));

  it('reads the box at the playhead and writes the changed props', () => {
    const keyed = must(setKeyframes(doc, 'img', 'maskX', [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 30, value: 0.8, ease: Ease.Linear }]));
    const clip = findClip(keyed, 'img')!.clip;

    expect(maskBox(clip, 45)?.x).toBeCloseTo(0.5);

    const next = must(editMaskAt(keyed, clip, { x: 0.6, y: 0.3 }, 45));
    const after = findClip(next, 'img')!.clip;

    expect(after.keyframes.maskX.find((k) => k.frame === 15)?.value).toBe(0.6);
    expect(after.mask?.y).toBe(0.3);
  });
});
