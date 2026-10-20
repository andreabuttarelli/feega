import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { EditMode } from './edit-mode';
import { MIXED } from './mixed';
import { aabb, quadOf } from './scene-select';
import { propBoxes } from './space';
import { addClip, type OpResult } from './timeline';
import { unionBounds } from './multi-select';
import { placeBox, setPropAcross, sharedProp } from './selection-props';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (doc: MotionDoc, id: string, x: number, fill: string) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.1, height: 0.1, fill } }, id));

const base = shape(shape(newMotionDoc(MotionFormat.Landscape), 'a', 0.2, '#ff0000'), 'b', 0.5, '#00ff00');
const clips = ['a', 'b'].map((id) => findClip(base, id)!.clip);
const boxOf = (doc: MotionDoc) => unionBounds(['a', 'b'].map((id) => aabb(quadOf(doc, id, 0, propBoxes(doc)[id]))));

describe('a prop across a selection', () => {
  it('is Mixed when the clips differ', () => {
    expect(sharedProp(clips, 'fill')).toBe(MIXED);
  });

  it('is the value when every clip agrees', () => {
    expect(sharedProp(clips, 'shape')).toBe('rect');
  });

  it('is Mixed when no clip has it', () => {
    expect(sharedProp(clips, 'nothing')).toBe(MIXED);
  });

  it('is written to every clip that has it', () => {
    const edited = must(setPropAcross(base, ['a', 'b'], 'fill', '#0000ff'));

    expect(sharedProp(['a', 'b'].map((id) => findClip(edited, id)!.clip), 'fill')).toBe('#0000ff');
  });

  it('refuses a prop no clip has', () => {
    expect(setPropAcross(base, ['a', 'b'], 'nothing', 1).ok).toBe(false);
  });
});

describe('placing the box of a selection', () => {
  const before = boxOf(base);

  it('moves the box to a new top-left corner', () => {
    const moved = boxOf(must(placeBox(base, ['a', 'b'], 0, before, { x: before.left + 50, y: before.top + 20 }, EditMode.Design)));

    expect(moved.left).toBeCloseTo(before.left + 50, 3);
    expect(moved.top).toBeCloseTo(before.top + 20, 3);
  });

  it('resizes the box from its top-left corner, keeping the ratio', () => {
    const width = before.right - before.left;
    const height = before.bottom - before.top;
    const sized = boxOf(must(placeBox(base, ['a', 'b'], 0, before, { width: width * 2 }, EditMode.Design)));

    expect(sized.left).toBeCloseTo(before.left, 3);
    expect(sized.top).toBeCloseTo(before.top, 3);
    expect(sized.right - sized.left).toBeCloseTo(width * 2, 3);
    expect(sized.bottom - sized.top).toBeCloseTo(height * 2, 3);
  });
});
