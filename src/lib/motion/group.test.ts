import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { groupClips, ungroupClip } from './group';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function twoShapes(): MotionDoc {
  const one = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.2, y: 0.3, width: 0.1, height: 0.1 } }, 'a'));
  return ok(addClip(one, { component: 'Text', from: 10, durationInFrames: 40, props: { text: 'hi', x: 0.6, y: 0.5 } }, 'b'));
}

const topIds = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips.map((c) => c.id));
let n = 0;
const newId = () => `id${++n}`;

describe('grouping inside a frame', () => {
  it('⌘G puts the selected clips in one group clip, named Group, keeping their places and times', () => {
    const grouped = ok(groupClips(twoShapes(), ['a', 'b'], newId));
    const [group] = grouped.tracks.flatMap((t) => t.clips);

    expect(topIds(grouped)).toEqual([group.id]);
    expect(group.component).toBe('Precomp');
    expect(grouped.comps[String(group.props.comp)].name).toMatch(/^Group/);
    const inside = grouped.comps[String(group.props.comp)].tracks.flatMap((t) => t.clips);
    expect(inside.find((c) => c.id === 'a')?.props).toMatchObject({ x: 0.2, y: 0.3 });
  });

  it('⇧⌘G gives the clips back at the same place and time, and drops the group', () => {
    const grouped = ok(groupClips(twoShapes(), ['a', 'b'], newId));
    const group = grouped.tracks.flatMap((t) => t.clips)[0];
    const back = ok(ungroupClip(grouped, group.id, newId));

    expect(topIds(back).sort()).toEqual(['a', 'b']);
    expect(findClip(back, 'b')?.clip.from).toBe(10);
    expect(Object.keys(back.comps)).toEqual([]);
  });

  it('a group moved as one gives its offset to every clip when ungrouped', () => {
    const grouped = ok(groupClips(twoShapes(), ['a', 'b'], newId));
    const group = grouped.tracks.flatMap((t) => t.clips)[0];
    const moved: MotionDoc = { ...grouped, tracks: grouped.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === group.id ? { ...c, transform: { x: 0.1, y: -0.05 } } : c)) })) };
    const back = ok(ungroupClip(moved, group.id, newId));

    expect(findClip(back, 'a')?.clip.transform).toMatchObject({ x: 0.1, y: -0.05 });
  });

  it('refuses what is not a group, and a group scaled or rotated as one', () => {
    expect(ungroupClip(twoShapes(), 'a', newId).ok).toBe(false);
    const grouped = ok(groupClips(twoShapes(), ['a', 'b'], newId));
    const group = grouped.tracks.flatMap((t) => t.clips)[0];
    const turned: MotionDoc = { ...grouped, tracks: grouped.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === group.id ? { ...c, transform: { rotateZ: 30 } } : c)) })) };

    expect(ungroupClip(turned, group.id, newId).ok).toBe(false);
  });
});
