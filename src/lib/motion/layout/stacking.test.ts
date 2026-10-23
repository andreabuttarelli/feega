import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionClip, type MotionDoc } from '../doc';
import { DEFAULT_AUTO_LAYOUT, type AutoLayout } from './model';
import { withStacking } from './stacking';

const clip = (id: string, over: Partial<MotionClip> = {}) => newClip({ id, from: 0, durationInFrames: 30, component: 'Shape', props: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }, ...over });

function docOf(clips: MotionClip[]): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Square);
  return { ...doc, tracks: clips.map((c) => ({ id: `t-${c.id}`, kind: doc.tracks[0].kind, name: '', clips: [c] })) };
}

const container = (autoLayout: Partial<AutoLayout>) => clip('c', { autoLayout: { ...DEFAULT_AUTO_LAYOUT, ...autoLayout } });
const kids = () => ['a', 'b', 'z'].map((id) => clip(id, { parent: 'c' }));
const order = (doc: MotionDoc) => doc.tracks.map((t) => t.clips[0].id);

describe('withStacking', () => {
  it('leaves the track order alone by default', () => {
    const doc = docOf([...kids(), container({ order: ['z', 'b', 'a'] })]);

    expect(withStacking(doc)).toBe(doc);
  });

  it('puts the first child of the layout on top of the others', () => {
    const doc = docOf([...kids(), container({ order: ['z', 'b', 'a'], firstOnTop: true })]);

    expect(order(withStacking(doc))).toEqual(['z', 'b', 'a', 'c']);
  });

  it('leaves the tracks of everything else where they were', () => {
    const [a, b] = kids();
    const doc = docOf([clip('x'), a, clip('y'), b, container({ order: ['b', 'a'], firstOnTop: true })]);

    expect(order(withStacking(doc))).toEqual(['x', 'b', 'y', 'a', 'c']);
  });

  it('skips children that share a track', () => {
    const [a, b] = kids();
    const doc = docOf([a, container({ order: ['b', 'a'], firstOnTop: true })]);
    const shared = { ...doc, tracks: [{ ...doc.tracks[0], clips: [a, b] }, doc.tracks[1]] };

    expect(withStacking(shared)).toBe(shared);
  });

  it('the draw order of a composition follows the same rule', () => {
    const inner = docOf([...kids(), container({ order: ['z', 'b', 'a'], firstOnTop: true })]);
    const doc = { ...docOf([]), comps: { k: { name: 'k', durationInFrames: 30, tracks: inner.tracks } } } as MotionDoc;

    expect(withStacking(doc).comps.k.tracks.map((t) => t.clips[0].id)).toEqual(['z', 'b', 'a', 'c']);
  });
});
