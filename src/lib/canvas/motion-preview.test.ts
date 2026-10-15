import { describe, expect, it } from 'vitest';
import { Intent, PreviewMode, Sight, Still, captureFree, claimCapture, intentOf, play, previewAt, previewClock, previewMode, releaseCapture, scrubFrame, stop, type Slots } from './motion-preview';

const IDLE: Slots = { playing: null, capturing: null };

describe('the preview a cover is shot from', () => {
  const rev1 = { version: 1, html: '<p>empty</p>', width: 1920, height: 1080, fps: 30, durationInFrames: 150 };

  it('is the loaded one when it is the revision the node is at', () => {
    expect(previewAt(rev1, 1)).toBe(rev1);
  });

  it('is none while the previous revision is still loaded: a cover shot then would show the old frame', () => {
    expect(previewAt(rev1, 2)).toBeNull();
  });
});

describe('motion preview in the node', () => {
  it.each([
    [Sight.InView, Intent.Play, Still.Ready, PreviewMode.Live],
    [Sight.InView, Intent.Play, Still.Missing, PreviewMode.Live],
    [Sight.InView, Intent.Rest, Still.Ready, PreviewMode.Poster],
    [Sight.InView, Intent.Rest, Still.Missing, PreviewMode.Capture],
    [Sight.OutOfView, Intent.Play, Still.Ready, PreviewMode.Poster],
    [Sight.OutOfView, Intent.Play, Still.Missing, PreviewMode.Poster],
    [Sight.OutOfView, Intent.Rest, Still.Ready, PreviewMode.Poster],
    [Sight.OutOfView, Intent.Rest, Still.Missing, PreviewMode.Poster]
  ])('%s, %s, still %s → %s', (sight, intent, still, mode) => {
    expect(previewMode(sight, intent, still)).toBe(mode);
  });

  it('nothing plays until play is pressed', () => {
    expect(intentOf(IDLE, 'a')).toBe(Intent.Rest);
    expect(intentOf(play(IDLE, 'a'), 'a')).toBe(Intent.Play);
  });

  it('pressing play on a second node stops the first: one live player at most', () => {
    const both = play(play(IDLE, 'a'), 'b');
    expect(intentOf(both, 'a')).toBe(Intent.Rest);
    expect(intentOf(both, 'b')).toBe(Intent.Play);
  });

  it('stopping a node that is not playing leaves the playing one alone', () => {
    const playing = play(IDLE, 'b');
    expect(stop(playing, 'a')).toEqual(playing);
    expect(intentOf(stop(playing, 'b'), 'b')).toBe(Intent.Rest);
  });

  it('first frames are captured one node at a time', () => {
    const first = claimCapture(IDLE, 'a');
    expect(first.capturing).toBe('a');
    expect(claimCapture(first, 'b')).toEqual(first);
    expect(captureFree(first)).toBe(false);
    expect(releaseCapture(first, 'b')).toEqual(first);
    expect(captureFree(releaseCapture(first, 'a'))).toBe(true);
  });

  it('a scrub lands on a frame inside the video', () => {
    expect(scrubFrame(0.5, 90)).toBe(45);
    expect(scrubFrame(-1, 90)).toBe(0);
    expect(scrubFrame(2, 90)).toBe(89);
  });

  it('the clock reads the playhead against the whole length', () => {
    expect(previewClock(45, 30, 90)).toBe('00:01:15 / 00:03:00');
  });
});
