import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { groupLight, placeLayer, settleGroups, ungroupLight } from './light-group';
import { wrapInStack } from './layout/ops';
import { shownBox } from '@feega/motion-core/motion/layout/resolve';
import { pivotBox } from '@feega/motion-core/motion/parent';
import { addClip, removeClips, setProps, type OpResult } from '@feega/motion-core/motion/timeline';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const square = (id: string, x: number, y: number) => ({ component: 'Shape' as const, from: 0, durationInFrames: 30, props: { shape: 'rect', x, y, width: 0.1, height: 0.1 }, id });

const two = () => {
  let doc = newMotionDoc(MotionFormat.Square);
  doc = must(addClip(doc, square('a', 0.2, 0.3), 'a'));
  doc = must(addClip(doc, square('b', 0.6, 0.5), 'b'));
  return doc;
};

const grouped = () => must(groupLight(two(), ['a', 'b'], 'g', 'lane'));
const boxOf = (doc: MotionDoc, id: string) => pivotBox(findClip(doc, id)!.clip.props, doc);

describe('a light group', () => {
  it('parents its members to a plain container, with no composition', () => {
    const doc = grouped();

    expect(findClip(doc, 'g')!.clip.group).toBe(true);
    expect(['a', 'b'].map((id) => findClip(doc, id)!.clip.parent)).toEqual(['g', 'g']);
    expect(Object.keys(doc.comps)).toEqual([]);
  });

  it('has the bounds of its members', () => {
    const group = boxOf(grouped(), 'g');

    expect(group.left).toBeCloseTo(0.15 * 1080, 3);
    expect(group.top).toBeCloseTo(0.25 * 1080, 3);
    expect(group.width).toBeCloseTo(0.5 * 1080, 3);
    expect(group.height).toBeCloseTo(0.3 * 1080, 3);
  });

  it('follows its members when one moves', () => {
    const moved = must(setProps(grouped(), 'b', { x: 0.9 }));
    const group = boxOf(settleGroups(moved), 'g');

    expect(group.width).toBeCloseTo(0.8 * 1080, 3);
  });

  it('deletes itself when the last member leaves', () => {
    const emptied = must(removeClips(grouped(), ['a', 'b']));

    expect(findClip(settleGroups(emptied), 'g')).toBeNull();
  });

  it('leaves a doc without groups untouched', () => {
    const doc = two();

    expect(settleGroups(doc)).toBe(doc);
  });

  it('ungroups into its members where they were', () => {
    const doc = must(ungroupLight(grouped(), 'g'));

    expect(findClip(doc, 'g')).toBeNull();
    expect(['a', 'b'].map((id) => findClip(doc, id)!.clip.parent ?? null)).toEqual([null, null]);
    expect(boxOf(doc, 'a')).toEqual(boxOf(two(), 'a'));
  });
});

const three = () => must(addClip(two(), square('c', 0.4, 0.8), 'c'));
const stacked = () => must(wrapInStack(three(), ['a', 'b', 'c'], 's', 'stack-lane'));
const orderOf = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip.autoLayout!.order;
const shown = (doc: MotionDoc, id: string) => shownBox(doc, id)!;

describe('a light group inside a stack', () => {
  it('stays a stack child where its members were', () => {
    const doc = must(groupLight(stacked(), ['b', 'c'], 'g', 'lane'));

    expect(findClip(doc, 'g')!.clip.parent).toBe('s');
    expect(orderOf(doc, 's')).toEqual(['a', 'g']);
  });

  it('keeps its members where the stack showed them', () => {
    const before = stacked();
    const doc = settleGroups(must(groupLight(before, ['b', 'c'], 'g', 'lane')));

    expect(shown(doc, 'b').left).toBeCloseTo(shown(before, 'b').left, 3);
    expect(shown(doc, 'c').left).toBeCloseTo(shown(before, 'c').left, 3);
  });

  it('ungroups back into the stack at its own place', () => {
    const doc = must(ungroupLight(must(groupLight(stacked(), ['a', 'b'], 'g', 'lane')), 'g'));

    expect(['a', 'b'].map((id) => findClip(doc, id)!.clip.parent)).toEqual(['s', 's']);
    expect(orderOf(doc, 's')).toEqual(['a', 'b', 'c']);
  });
});

const groupX = () => findClip(grouped(), 'g')!.clip.props.x as number;

describe('placing a light group', () => {
  it('moves its members with X and Y', () => {
    const doc = settleGroups(must(placeLayer(grouped(), 'g', { x: groupX() + 0.1 })));

    expect(boxOf(doc, 'a').left).toBeCloseTo(boxOf(two(), 'a').left + 108, 3);
    expect(boxOf(doc, 'g').left).toBeCloseTo(boxOf(grouped(), 'g').left + 108, 3);
  });

  it('scales its members with W and H', () => {
    const doc = settleGroups(must(placeLayer(grouped(), 'g', { width: 1 })));

    expect(boxOf(doc, 'g').width).toBeCloseTo(1080, 3);
    expect(boxOf(doc, 'a').width).toBeCloseTo(0.2 * 1080, 3);
    expect(boxOf(doc, 'g').left).toBeCloseTo(boxOf(grouped(), 'g').left, 3);
  });

  it('sets the props of anything else', () => {
    const doc = must(placeLayer(two(), 'a', { x: 0.7 }));

    expect(findClip(doc, 'a')!.clip.props.x).toBe(0.7);
  });
});
