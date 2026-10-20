import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { EditMode } from './edit-mode';
import { aabb, quadOf } from './scene-select';
import { propBoxes } from './space';
import { addClip, type OpResult } from './timeline';
import { groupMove, rectOf, swept, toggled, unionBounds } from './multi-select';

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

const boundsOf = (doc: MotionDoc, id: string) => aabb(quadOf(doc, id, 0, propBoxes(doc)[id]));

describe('toggling a selection', () => {
  it('adds an id that is not selected', () => {
    expect(toggled(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes an id that is selected', () => {
    expect(toggled(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('sweeping a marquee', () => {
  const boxes = {
    a: { left: 0, top: 0, right: 10, bottom: 10 },
    b: { left: 20, top: 0, right: 30, bottom: 10 },
    c: { left: 100, top: 100, right: 110, bottom: 110 }
  };

  it('selects what the rectangle touches, in any drag direction', () => {
    expect(swept(boxes, rectOf([25, 5], [5, 20]), [])).toEqual(['a', 'b']);
  });

  it('keeps the base selection when extending', () => {
    expect(swept(boxes, rectOf([0, 0], [5, 5]), ['c'])).toEqual(['c', 'a']);
  });

  it('selects nothing from an empty rectangle', () => {
    expect(swept(boxes, rectOf([50, 50], [60, 60]), [])).toEqual([]);
  });

  it('spans every member in the box around a selection', () => {
    expect(unionBounds([boxes.a, boxes.b])).toEqual({ left: 0, top: 0, right: 30, bottom: 10 });
  });
});

describe('moving a selection together', () => {
  const box = unionBounds(['a', 'b'].map((id) => boundsOf(base, id)));
  const input = { doc: base, ids: ['a', 'b'], frame: 0, mode: EditMode.Design, others: [], size: { width: 1920, height: 1080 }, reach: 0, box };

  it('moves every member by the same offset', () => {
    const moved = must(groupMove({ ...input, offset: [40, 10] }).result);

    for (const id of ['a', 'b']) {
      expect(boundsOf(moved, id).left - boundsOf(base, id).left).toBeCloseTo(40, 4);
      expect(boundsOf(moved, id).top - boundsOf(base, id).top).toBeCloseTo(10, 4);
    }
  });

  it('snaps the whole box to the frame edge, keeping the gap between members', () => {
    const { result, guides } = groupMove({ ...input, offset: [-box.left + 3, 0], reach: 8 });
    const moved = must(result);

    expect(guides).toContainEqual({ axis: 'x', at: 0 });
    expect(boundsOf(moved, 'a').left).toBeCloseTo(0, 4);
    expect(boundsOf(moved, 'b').left - boundsOf(moved, 'a').left).toBeCloseTo(boundsOf(base, 'b').left - boundsOf(base, 'a').left, 4);
  });
});
