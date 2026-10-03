import { describe, expect, it } from 'vitest';
import { MAX_FRAMES, MotionFormat, newMotionDoc, findClip, type MotionDoc } from './doc';
import {
  ClipEdge,
  addClip,
  addTrack,
  duplicateClip,
  moveClip,
  moveTrack,
  removeClips,
  setCanvas,
  setProps,
  snapFrame,
  snapTargets,
  splitClip,
  trimClip
} from './timeline';
import { TrackKind } from './components';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function withTitle(): MotionDoc {
  return must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 30, durationInFrames: 60 }, 't1'));
}

describe('timeline operations', () => {
  it('adds a visual clip to the first visual track with default props', () => {
    const doc = withTitle();
    const found = findClip(doc, 't1');

    expect(found?.track.kind).toBe(TrackKind.Visual);
    expect(found?.clip.props.text).toBeTypeOf('string');
  });

  it('puts an audio clip on an audio track', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Audio', from: 0 }, 'a'));

    expect(findClip(doc, 'a')?.track.kind).toBe(TrackKind.Audio);
  });

  it('refuses an audio clip on a visual track', () => {
    const result = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Audio', from: 0, trackId: 'v1' }, 'a');

    expect(result.ok).toBe(false);
  });

  it('extends the doc when a clip ends after it', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 440, durationInFrames: 60 }, 't'));

    expect(doc.durationInFrames).toBe(500);
  });

  it('refuses a clip past the 60 second limit', () => {
    const result = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: MAX_FRAMES - 10, durationInFrames: 60 }, 't');

    expect(result.ok).toBe(false);
  });

  it('moves a clip in time and never before zero', () => {
    const doc = must(moveClip(withTitle(), 't1', { from: -20 }));

    expect(findClip(doc, 't1')?.clip.from).toBe(0);
  });

  it('moves a clip to another track of the same kind', () => {
    const doc = must(addTrack(withTitle(), TrackKind.Visual, 'v2'));
    const moved = must(moveClip(doc, 't1', { from: 30, trackId: 'v2' }));

    expect(findClip(moved, 't1')?.track.id).toBe('v2');
  });

  it('trims the start edge, keeping the end where it was and advancing the media offset', () => {
    const doc = must(trimClip(withTitle(), 't1', ClipEdge.Start, 50));
    const clip = findClip(doc, 't1')!.clip;

    expect([clip.from, clip.durationInFrames, clip.trimStart]).toEqual([50, 40, 20]);
  });

  it('trims the end edge but never below one frame', () => {
    const doc = must(trimClip(withTitle(), 't1', ClipEdge.End, 10));

    expect(findClip(doc, 't1')?.clip.durationInFrames).toBe(1);
  });

  it('splits at the playhead into two clips that cover the same span', () => {
    const doc = must(splitClip(withTitle(), 't1', 50, 't2'));
    const left = findClip(doc, 't1')!.clip;
    const right = findClip(doc, 't2')!.clip;

    expect([left.from, left.durationInFrames]).toEqual([30, 20]);
    expect([right.from, right.durationInFrames, right.trimStart]).toEqual([50, 40, 20]);
  });

  it('refuses a split outside the clip', () => {
    expect(splitClip(withTitle(), 't1', 10, 't2').ok).toBe(false);
  });

  it('duplicates right after the original', () => {
    const doc = must(duplicateClip(withTitle(), 't1', 'copy'));

    expect(findClip(doc, 'copy')?.clip.from).toBe(90);
  });

  it('removes several clips at once', () => {
    const doc = must(duplicateClip(withTitle(), 't1', 'copy'));
    const removed = must(removeClips(doc, ['t1', 'copy']));

    expect(removed.tracks.flatMap((t) => t.clips)).toEqual([]);
  });

  it('validates props against the component schema', () => {
    expect(setProps(withTitle(), 't1', { size: 'huge' }).ok).toBe(false);
    expect(findClip(must(setProps(withTitle(), 't1', { text: 'Hi' })), 't1')?.clip.props.text).toBe('Hi');
  });

  it('reorders tracks', () => {
    const doc = must(addTrack(withTitle(), TrackKind.Visual, 'v2'));
    const moved = must(moveTrack(doc, 'v2', 0));

    expect(moved.tracks.map((t) => t.id)).toEqual(['v2', 'v1', 'a1']);
  });

  it('changes format and duration', () => {
    const doc = must(setCanvas(withTitle(), { format: MotionFormat.Vertical, durationInFrames: 300 }));

    expect([doc.width, doc.height, doc.durationInFrames]).toEqual([1080, 1920, 300]);
  });

  it('refuses a duration that cuts a clip', () => {
    expect(setCanvas(withTitle(), { durationInFrames: 60 }).ok).toBe(false);
  });
});

describe('snap', () => {
  it('snaps to the closest target within the threshold', () => {
    expect(snapFrame(52, [30, 50, 90], 4)).toBe(50);
  });

  it('leaves the frame alone when no target is close', () => {
    expect(snapFrame(70, [30, 50, 90], 4)).toBe(70);
  });

  it('targets are clip edges of other clips, the playhead and whole seconds', () => {
    const doc = must(trimClip(must(duplicateClip(withTitle(), 't1', 'copy')), 'copy', ClipEdge.End, 155));
    const targets = snapTargets(doc, { playhead: 77, exclude: ['copy'] });

    expect(targets).toEqual(expect.arrayContaining([30, 90, 77, 0, 60, 120]));
    expect(targets).not.toContain(155);
  });
});
