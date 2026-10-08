import { describe, expect, it } from 'vitest';
import { PreviewCue, PreviewInput, playingAfter } from './preview-play';

describe('which card plays its preview', () => {
  it('hovering a card plays it, leaving stops it', () => {
    const on = playingAfter(null, 'a', PreviewCue.Enter, PreviewInput.Hover);

    expect(on).toBe('a');
    expect(playingAfter(on, 'a', PreviewCue.Leave, PreviewInput.Hover)).toBeNull();
  });

  it('on touch the card scrolled into view plays, one at a time', () => {
    const first = playingAfter(null, 'a', PreviewCue.InView, PreviewInput.Touch);
    const second = playingAfter(first, 'b', PreviewCue.InView, PreviewInput.Touch);

    expect(second).toBe('b');
    expect(playingAfter(second, 'a', PreviewCue.OutOfView, PreviewInput.Touch)).toBe('b');
    expect(playingAfter(second, 'b', PreviewCue.OutOfView, PreviewInput.Touch)).toBeNull();
  });

  it('scrolling past does not play on desktop, hover does not on touch', () => {
    expect(playingAfter(null, 'a', PreviewCue.InView, PreviewInput.Hover)).toBeNull();
    expect(playingAfter(null, 'a', PreviewCue.Enter, PreviewInput.Touch)).toBeNull();
  });
});
