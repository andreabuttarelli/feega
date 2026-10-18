import { describe, expect, it } from 'vitest';
import { arrangeLayers, Arrange } from './layer-order';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, addTrack, type OpResult } from './timeline';
import { TrackKind } from './components';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = { component: 'Shape' as const, from: 0, durationInFrames: 60, props: { shape: 'rect' } };

function twoTracks(): MotionDoc {
  const base = ok(addClip(newMotionDoc(MotionFormat.Landscape), shape, 'a'));
  const withTop = ok(addTrack(base, TrackKind.Visual, 'top'));
  return ok(addClip(withTop, { ...shape, trackId: 'top' }, 'b'));
}

const trackOf = (doc: MotionDoc, id: string) => doc.tracks.findIndex((t) => t.clips.some((c) => c.id === id));

let n = 0;
const newId = () => `t${++n}`;

describe('arranging layers inside a frame', () => {
  it('brings a layer to the front by putting its track on top', () => {
    const doc = ok(arrangeLayers(twoTracks(), ['a'], Arrange.Front, newId));
    expect(trackOf(doc, 'a')).toBe(0);
    expect(trackOf(doc, 'b')).toBeGreaterThan(0);
  });

  it('sends a layer to the back below every other picture track, above the sound', () => {
    const doc = ok(arrangeLayers(twoTracks(), ['b'], Arrange.Back, newId));
    const visual = doc.tracks.filter((t) => t.kind === TrackKind.Visual);
    expect(visual.at(-1)?.clips.map((c) => c.id)).toEqual(['b']);
    expect(doc.tracks.at(-1)?.kind).toBe(TrackKind.Audio);
  });

  it('lifts a layer out of a shared track so only it moves', () => {
    const shared = ok(addClip(ok(addClip(newMotionDoc(MotionFormat.Landscape), shape, 'a')), shape, 'b'));
    const doc = ok(arrangeLayers(shared, ['b'], Arrange.Front, newId));
    expect(doc.tracks[0].clips.map((c) => c.id)).toEqual(['b']);
    expect(trackOf(doc, 'a')).toBeGreaterThan(0);
  });

  it('brings a layer forward or backward one step', () => {
    const three = ok(addClip(ok(addTrack(twoTracks(), TrackKind.Visual, 'highest')), { ...shape, trackId: 'highest' }, 'c'));
    expect(trackOf(ok(arrangeLayers(three, ['a'], Arrange.Forward, newId)), 'a')).toBe(trackOf(three, 'a') - 1);
    expect(trackOf(ok(arrangeLayers(three, ['c'], Arrange.Backward, newId)), 'c')).toBe(trackOf(three, 'c') + 1);
  });

  it('refuses a layer that is not in the frame', () => {
    expect(arrangeLayers(twoTracks(), ['gone'], Arrange.Front, newId).ok).toBe(false);
  });
});
