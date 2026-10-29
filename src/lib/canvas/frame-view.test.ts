import { describe, expect, it } from 'vitest';
import { FRAME_VIEW_DEFAULT, FrameView, contentViews, flipView, shows } from './frame-view';

describe('frame view toggles', () => {
  it('shows the pixel grid and the guides, not the outlines, by default', () => {
    expect(shows(FRAME_VIEW_DEFAULT, FrameView.PixelGrid)).toBe(true);
    expect(shows(FRAME_VIEW_DEFAULT, FrameView.Guides)).toBe(true);
    expect(shows(FRAME_VIEW_DEFAULT, FrameView.Outlines)).toBe(false);
  });

  it('flips one toggle and leaves the others', () => {
    const next = flipView(FRAME_VIEW_DEFAULT, FrameView.Outlines);

    expect(shows(next, FrameView.Outlines)).toBe(true);
    expect(shows(next, FrameView.PixelGrid)).toBe(true);
    expect(shows(flipView(next, FrameView.Outlines), FrameView.Outlines)).toBe(false);
  });

  it('keeps outlines, pixel grid and guides for a breakpoint view, without rulers and pivot', () => {
    const all = { ...FRAME_VIEW_DEFAULT, [FrameView.Outlines]: true, [FrameView.Rulers]: true, [FrameView.Pivot]: true };
    const next = contentViews(all);

    expect(shows(next, FrameView.Outlines)).toBe(true);
    expect(shows(next, FrameView.PixelGrid)).toBe(true);
    expect(shows(next, FrameView.Guides)).toBe(true);
    expect(shows(next, FrameView.Rulers)).toBe(false);
    expect(shows(next, FrameView.Pivot)).toBe(false);
  });
});
