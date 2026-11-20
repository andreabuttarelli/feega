import { describe, expect, it } from 'vitest';
import { Anchor, anchorBox, nearestAnchor, nextAnchor } from './anchors';

const AREA = { x: 0, y: 40, w: 1000, h: 800 };
const BAR = { w: 240, h: 40 };

describe('nearestAnchor', () => {
  it('a bar dropped near the bottom middle snaps to bottom centre', () => {
    expect(nearestAnchor({ x: 400, y: 760 }, AREA, BAR)).toBe(Anchor.BottomCenter);
  });

  it('a bar dropped near the top left corner snaps there', () => {
    expect(nearestAnchor({ x: 30, y: 70 }, AREA, BAR)).toBe(Anchor.TopLeft);
  });

  it('a bar dropped far right in the middle picks the closer right anchor', () => {
    expect(nearestAnchor({ x: 760, y: 600 }, AREA, BAR)).toBe(Anchor.BottomRight);
  });
});

describe('anchorBox', () => {
  it('keeps a safe margin inside the preview area', () => {
    expect(anchorBox(Anchor.TopRight, AREA, BAR)).toEqual({ x: 1000 - 16 - 240, y: 40 + 16 });
    expect(anchorBox(Anchor.BottomCenter, AREA, BAR)).toEqual({ x: 380, y: 40 + 800 - 16 - 40 });
  });
});

describe('nextAnchor', () => {
  it('arrow keys move between anchors and stop at the edges', () => {
    expect(nextAnchor(Anchor.BottomCenter, 'ArrowLeft')).toBe(Anchor.BottomLeft);
    expect(nextAnchor(Anchor.BottomCenter, 'ArrowUp')).toBe(Anchor.TopCenter);
    expect(nextAnchor(Anchor.BottomLeft, 'ArrowLeft')).toBe(Anchor.BottomLeft);
  });
});
