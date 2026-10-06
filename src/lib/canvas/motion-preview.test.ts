import { describe, expect, it } from 'vitest';
import { Engagement, PreviewMode, Sight, previewClock, previewMode, scrubFrame } from './motion-preview';

describe('motion preview in the node', () => {
  it('mounts the player only for a node in sight that someone is engaging', () => {
    expect(previewMode(Sight.InView, Engagement.Engaged)).toBe(PreviewMode.Live);
    expect(previewMode(Sight.InView, Engagement.Idle)).toBe(PreviewMode.Poster);
    expect(previewMode(Sight.OutOfView, Engagement.Engaged)).toBe(PreviewMode.Poster);
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
