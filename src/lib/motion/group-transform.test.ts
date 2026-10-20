import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { EditMode } from './edit-mode';
import { anchorOf, type Pt } from './scene-select';
import { transformAt } from './parent';
import { addClip, type OpResult } from './timeline';
import { pullFactor, resizeFactors, rotateAround, scaleAround, scaleAroundXY, snappedHandle, turnedBy } from './group-transform';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (doc: MotionDoc, id: string, x: number) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.1, height: 0.1 } }, id));

const base = [
  ['a', 0.2],
  ['b', 0.5]
].reduce((doc, [id, x]) => shape(doc, id as string, x as number), newMotionDoc(MotionFormat.Landscape));

const pivot = (doc: MotionDoc, id: string) => anchorOf(doc, id, 0);
const value = (doc: MotionDoc, id: string, key: 'scaleX' | 'rotateZ') => transformAt(findClip(doc, id)!.clip, key, 0);

describe('pulling a corner handle', () => {
  it('is 1 when the handle has not moved', () => {
    expect(pullFactor([0, 0], [100, 50], [100, 50])).toBeCloseTo(1, 6);
  });

  it('doubles when the handle goes twice as far from the anchor', () => {
    expect(pullFactor([0, 0], [100, 50], [200, 100])).toBeCloseTo(2, 6);
  });

  it('follows the diagonal only', () => {
    expect(pullFactor([0, 0], [100, 0], [200, 90])).toBeCloseTo(2, 6);
  });
});

describe('turning a selection', () => {
  it('is the angle swept around the centre', () => {
    expect(turnedBy([0, 0], [10, 0], [0, 10])).toBeCloseTo(90, 6);
  });
});

describe('scaling a selection around a point', () => {
  it('multiplies every member scale and spreads the pivots from the point', () => {
    const around: Pt = [0, 0];
    const scaled = must(scaleAround(base, ['a', 'b'], 0, around, 2, EditMode.Design));

    for (const id of ['a', 'b']) {
      expect(value(scaled, id, 'scaleX')).toBeCloseTo(2, 6);
      expect(pivot(scaled, id)[0]).toBeCloseTo(pivot(base, id)[0] * 2, 3);
      expect(pivot(scaled, id)[1]).toBeCloseTo(pivot(base, id)[1] * 2, 3);
    }
  });
});

describe('rotating a selection around a point', () => {
  it('turns every member and swings its pivot around the point', () => {
    const around = pivot(base, 'a');
    const turned = must(rotateAround(base, ['a', 'b'], 0, around, 90, EditMode.Design));
    const b = pivot(base, 'b');

    expect(value(turned, 'b', 'rotateZ')).toBeCloseTo(90, 6);
    expect(pivot(turned, 'a')[0]).toBeCloseTo(around[0], 3);
    expect(pivot(turned, 'b')[0]).toBeCloseTo(around[0] - (b[1] - around[1]), 3);
    expect(pivot(turned, 'b')[1]).toBeCloseTo(around[1] + (b[0] - around[0]), 3);
  });
});

const BOX = { left: 100, top: 100, right: 300, bottom: 200 };

describe('resizing the selection box from a handle', () => {
  it('an edge handle stretches one axis from the opposite edge', () => {
    expect(resizeFactors(BOX, [1, 0.5], [500, 150], false, false)).toEqual({ anchor: [100, 150], fx: 2, fy: 1 });
  });

  it('a corner stretches both axes freely', () => {
    const { fx, fy } = resizeFactors(BOX, [1, 1], [500, 300], false, false);

    expect([fx, fy]).toEqual([2, 2]);
    expect(resizeFactors(BOX, [1, 1], [500, 200], false, false).fy).toBe(1);
  });

  it('shift on a corner keeps the ratio', () => {
    const { fx, fy } = resizeFactors(BOX, [1, 1], [500, 200], true, false);

    expect(fx).toBeCloseTo(fy, 6);
  });

  it('alt grows from the centre', () => {
    expect(resizeFactors(BOX, [1, 0.5], [300, 150], false, true).anchor).toEqual([200, 150]);
  });
});

describe('snapping a pulled handle', () => {
  it('lands on the frame edge and leaves the idle axis alone', () => {
    const snapped = snappedHandle([1917, 99], [true, false], [], { width: 1920, height: 1080 }, 8);

    expect(snapped.point).toEqual([1920, 99]);
    expect(snapped.guides).toEqual([{ axis: 'x', at: 1920 }]);
  });
});

describe('scaling a selection by different factors per axis', () => {
  it('stretches only the wide axis', () => {
    const scaled = must(scaleAroundXY(base, ['a', 'b'], 0, [0, 0], 2, 1, EditMode.Design));

    expect(value(scaled, 'a', 'scaleX')).toBeCloseTo(2, 6);
    expect(transformAt(findClip(scaled, 'a')!.clip, 'scaleY', 0)).toBeCloseTo(1, 6);
    expect(pivot(scaled, 'a')[1]).toBeCloseTo(pivot(base, 'a')[1], 3);
  });
});
