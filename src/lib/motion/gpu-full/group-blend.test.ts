import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { BlendMode } from '@feega/motion-core/motion/blend';
import { displayListAt, ItemKind, type GroupItem, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { groupClips } from '../group';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const square = { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, fill: '#ff0000' };
const backdrop = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { ...square, width: 1, height: 1, fill: '#336699' } }, 'under'));
const one = must(addClip(backdrop, { component: 'Shape', from: 0, durationInFrames: 90, props: square }, 'card'));
const two = must(addClip(one, { component: 'Shape', from: 0, durationInFrames: 90, props: { ...square, x: 0.6 } }, 'second'));
const patch = (doc: MotionDoc, id: string, change: Partial<MotionClip>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...change } : c)) })) });

const groupOf = (doc: MotionDoc) => {
  let n = 0;
  return must(groupClips(doc, ['card', 'second'], () => (n++ === 0 ? 'inner' : 'group')));
};
const grouped = groupOf(two);
const groupsIn = (items: Item[]): GroupItem[] => items.flatMap((i) => (i.kind === ItemKind.Group ? [i, ...groupsIn(i.items)] : []));
const own = (clip: string) => clip.split('__').pop();
const clipsIn = (items: Item[]): string[] => items.flatMap((i) => (i.kind === ItemKind.Group && i.clip === 'group' ? clipsIn(i.items) : [own(i.clip) ?? '']));

describe('blend mode on a group', () => {
  it('composites the group as one layer blended with what lies beneath', () => {
    const doc = patch(grouped, 'group', { blend: BlendMode.Overlay });
    const drawn = displayListAt(doc, 0, FEEGA_TOKENS);
    const [group] = groupsIn(drawn.items).filter((g) => g.clip === 'group');

    expect(group?.blend).toBe(BlendMode.Overlay);
    expect(clipsIn(group?.items ?? []).sort()).toEqual(['card', 'second']);
    expect(drawn.items.some((i) => i.clip === 'under')).toBe(true);
  });

  it('blends a child inside the group within it, not with the frame', () => {
    const doc = patch(groupOf(patch(two, 'card', { blend: BlendMode.Multiply })), 'group', { blend: BlendMode.Overlay });
    const [group] = groupsIn(displayListAt(doc, 0, FEEGA_TOKENS).items).filter((g) => g.clip === 'group');

    expect(group?.items.find((i) => own(i.clip) === 'card')?.blend).toBe(BlendMode.Multiply);
  });

  it('keeps a normal group flat', () => {
    expect(groupsIn(displayListAt(grouped, 0, FEEGA_TOKENS).items).filter((g) => g.clip === 'group')).toEqual([]);
  });
});
