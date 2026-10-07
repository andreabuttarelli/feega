import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from './brand';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import { composeHtml } from './hyperframes/compose';
import { ClipEdge, addClip, snapTargets, type OpResult } from './timeline';
import {
  Align,
  addMarker,
  alignClips,
  distributeClips,
  loopFrame,
  markerFrame,
  clipsTo,
  nudgeClips,
  removeMarker,
  sequenceClips,
  setClipFlags,
  setTrackFlags,
  setWorkArea,
  shownTracks,
  staggerClips,
  trimClipsAt
} from './organize';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const three = (() => {
  let d = newMotionDoc(MotionFormat.Square);
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'One' } }, 'a'));
  d = must(addClip(d, { component: 'Title', from: 10, durationInFrames: 20, props: { text: 'Two' } }, 'b'));
  d = must(addClip(d, { component: 'Shape', from: 40, durationInFrames: 10 }, 'c'));
  return d;
})();
const at = (d: MotionDoc, id: string) => findClip(d, id)!.clip.from;
const end = (d: MotionDoc, id: string) => at(d, id) + findClip(d, id)!.clip.durationInFrames;

describe('markers', () => {
  it('comp markers are labelled, sorted, and survive the schema', () => {
    const d = must(addMarker(must(addMarker(three, { frame: 60, label: 'Drop' })), { frame: 15, label: 'Intro' }));
    expect(d.markers!.map((m) => m.label)).toEqual(['Intro', 'Drop']);
    expect(parseMotionDoc(d).ok).toBe(true);
  });

  it('a label is unique per owner, and a clip marker sits in the clip time', () => {
    const d = must(addMarker(three, { frame: 15, label: 'Intro' }));
    expect(addMarker(d, { frame: 20, label: 'Intro' }).ok).toBe(false);
    const clipped = must(addMarker(d, { frame: 5, label: 'Beat', clipId: 'b' }));
    expect(markerFrame(clipped, 'Beat')).toBe(15);
    expect(markerFrame(clipped, 'Intro')).toBe(15);
    expect(markerFrame(clipped, 'nope')).toBeNull();
  });

  it('markers are snap targets', () => {
    const d = must(addMarker(three, { frame: 77, label: 'Hit' }));
    expect(snapTargets(d, { playhead: 0, exclude: [] })).toContain(77);
  });

  it('removing by label', () => {
    const d = must(removeMarker(must(addMarker(three, { frame: 77, label: 'Hit' })), 'Hit'));
    expect(d.markers).toEqual([]);
  });
});

describe('work area', () => {
  it('is clamped into the video and needs at least one frame', () => {
    expect(must(setWorkArea(three, { from: -5, to: 9999 })).workArea).toEqual({ from: 0, to: three.durationInFrames });
    expect(setWorkArea(three, { from: 30, to: 30 }).ok).toBe(false);
    expect(must(setWorkArea(three, null)).workArea).toBeNull();
  });

  it('looping playback wraps at the out point back to the in point', () => {
    const d = must(setWorkArea(three, { from: 30, to: 60 }));
    expect(loopFrame(d, 59)).toBe(59);
    expect(loopFrame(d, 60)).toBe(30);
    expect(loopFrame(d, 10)).toBe(30);
    expect(loopFrame(three, 449)).toBe(449);
  });
});

describe('hide, lock, solo, shy', () => {
  it('hide and lock are doc fields on tracks and clips', () => {
    const d = must(setClipFlags(must(setTrackFlags(three, three.tracks[0].id, { locked: true })), 'a', { hidden: true }));
    expect(d.tracks[0].locked).toBe(true);
    expect(findClip(d, 'a')!.clip.hidden).toBe(true);
    expect(parseMotionDoc(d).ok).toBe(true);
  });

  it('the renderer leaves out hidden clips and hidden tracks', () => {
    const html = (d: MotionDoc) => composeHtml({ doc: d, tokens: FEEGA_TOKENS, assets: {} });
    expect(html(three)).toContain('data-clip="a"');
    expect(html(must(setClipFlags(three, 'a', { hidden: true })))).not.toContain('data-clip="a"');
    const trackHidden = must(setTrackFlags(three, three.tracks[0].id, { hidden: true }));
    expect(html(trackHidden)).not.toContain('data-clip="b"');
  });

  it('solo and shy only change what the editor shows', () => {
    const id = three.tracks[0].id;
    expect(shownTracks(three, { solo: [], shy: [id], hideShy: true, filter: '' }).map((t) => t.id)).not.toContain(id);
    expect(shownTracks(three, { solo: [], shy: [id], hideShy: false, filter: '' }).map((t) => t.id)).toContain(id);
  });

  it('the layer search keeps tracks whose name or clips match', () => {
    const shown = shownTracks(three, { solo: [], shy: [], hideShy: false, filter: 'two' });
    expect(shown.flatMap((t) => t.clips.map((c) => c.id))).toEqual(['b']);
  });
});

describe('arranging selected clips in time', () => {
  it('nudge moves every selected clip, never before zero', () => {
    const d = must(nudgeClips(three, ['a', 'b'], -5));
    expect([at(d, 'a'), at(d, 'b')]).toEqual([0, 5]);
  });

  it('[ moves each selected clip to start at the playhead, ] to end there', () => {
    const started = must(clipsTo(three, ['a', 'c'], ClipEdge.Start, 12));
    expect([at(started, 'a'), at(started, 'c'), end(started, 'c')]).toEqual([12, 12, 22]);

    const ended = must(clipsTo(three, ['b'], ClipEdge.End, 50));
    expect([at(ended, 'b'), end(ended, 'b')]).toEqual([30, 50]);
  });

  it('] never moves a clip before zero', () => {
    expect(at(must(clipsTo(three, ['a'], ClipEdge.End, 5)), 'a')).toBe(0);
  });

  it('alt+[ and alt+] trim every selected clip to the playhead', () => {
    const trimmed = must(trimClipsAt(three, ['a', 'b'], ClipEdge.End, 20));
    expect([end(trimmed, 'a'), end(trimmed, 'b')]).toEqual([20, 20]);

    const cut = must(trimClipsAt(three, ['b'], ClipEdge.Start, 15));
    expect([at(cut, 'b'), end(cut, 'b')]).toEqual([15, 30]);
  });

  it('sequence lays them end to end in their current order, from the first start', () => {
    const d = must(sequenceClips(three, ['c', 'a', 'b'], 0));
    expect([at(d, 'a'), at(d, 'b'), at(d, 'c')]).toEqual([0, 30, 50]);
  });

  it('stagger offsets each start by a fixed step', () => {
    const d = must(staggerClips(three, ['a', 'b', 'c'], 6));
    expect([at(d, 'a'), at(d, 'b'), at(d, 'c')]).toEqual([0, 6, 12]);
  });

  it('align snaps starts or ends to the first or last of them', () => {
    expect(['a', 'b', 'c'].map((id) => at(must(alignClips(three, ['a', 'b', 'c'], Align.Start)), id))).toEqual([0, 0, 0]);
    const ends = must(alignClips(three, ['a', 'b', 'c'], Align.End));
    expect(['a', 'b', 'c'].map((id) => end(ends, id))).toEqual([50, 50, 50]);
  });

  it('distribute spaces the starts evenly between the first and the last', () => {
    const d = must(distributeClips(three, ['a', 'b', 'c']));
    expect([at(d, 'a'), at(d, 'b'), at(d, 'c')]).toEqual([0, 20, 40]);
  });

  it('a locked clip is not moved', () => {
    const locked = must(setClipFlags(three, 'b', { locked: true }));
    expect(nudgeClips(locked, ['a', 'b'], 3).ok).toBe(false);
  });
});
