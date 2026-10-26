import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { groupLight, settleGroups, ungroupLight } from './light-group';
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
