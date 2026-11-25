import { describe, expect, it } from 'vitest';
import { Edge, dockedEdge, isDocked, tabBox, TAB_LENGTH_PX, TAB_THICKNESS_PX } from './dock';

const AREA = { x: 200, y: 40, w: 1000, h: 800 };
const BAR = { w: 240, h: 40 };

describe('dockedEdge', () => {
  it('a bar inside the preview stays', () => {
    expect(dockedEdge({ x: 500, y: 700 }, AREA, BAR)).toBeNull();
  });

  it('a bar mostly below the bottom docks to the bottom at its x offset', () => {
    expect(dockedEdge({ x: 500, y: 40 + 800 - 10 }, AREA, BAR)).toEqual({ edge: Edge.Bottom, offset: 300 });
  });

  it('a bar mostly past the top docks to the top', () => {
    expect(dockedEdge({ x: 300, y: 40 - 30 }, AREA, BAR)).toEqual({ edge: Edge.Top, offset: 100 });
  });

  it('a bar mostly past the right docks to the right at its y offset', () => {
    expect(dockedEdge({ x: 200 + 1000 - 50, y: 140 }, AREA, BAR)).toEqual({ edge: Edge.Right, offset: 100 });
  });

  it('a bar mostly past the left docks to the left', () => {
    expect(dockedEdge({ x: 200 - 200, y: 340 }, AREA, BAR)).toEqual({ edge: Edge.Left, offset: 300 });
  });

  it('60 percent outside or less does not dock', () => {
    expect(dockedEdge({ x: 500, y: 40 + 800 - 16 }, AREA, BAR)).toBeNull();
  });

  it('a corner drop docks to the edge with more of the bar outside', () => {
    expect(dockedEdge({ x: 200 + 1000 - 40, y: 40 + 800 - 38 }, AREA, BAR)?.edge).toBe(Edge.Right);
  });

  it('keeps the tab inside the preview along the edge', () => {
    expect(dockedEdge({ x: 1150, y: 835 }, AREA, BAR)).toEqual({ edge: Edge.Bottom, offset: 1000 - TAB_LENGTH_PX });
  });
});

describe('tabBox', () => {
  it('a bottom tab sits on the bottom edge at the offset', () => {
    expect(tabBox({ edge: Edge.Bottom, offset: 300 }, AREA)).toEqual({ x: 500, y: 40 + 800 - TAB_THICKNESS_PX, w: TAB_LENGTH_PX, h: TAB_THICKNESS_PX });
  });

  it('a right tab sits on the right edge at the offset', () => {
    expect(tabBox({ edge: Edge.Right, offset: 100 }, AREA)).toEqual({ x: 200 + 1000 - TAB_THICKNESS_PX, y: 140, w: TAB_THICKNESS_PX, h: TAB_LENGTH_PX });
  });

  it('a top tab and a left tab sit on their edges', () => {
    expect(tabBox({ edge: Edge.Top, offset: 0 }, AREA)).toEqual({ x: 200, y: 40, w: TAB_LENGTH_PX, h: TAB_THICKNESS_PX });
    expect(tabBox({ edge: Edge.Left, offset: 0 }, AREA)).toEqual({ x: 200, y: 40, w: TAB_THICKNESS_PX, h: TAB_LENGTH_PX });
  });
});

describe('isDocked', () => {
  it('accepts a saved edge and offset and rejects anything else', () => {
    expect(isDocked({ edge: 'left', offset: 12 })).toBe(true);
    expect(isDocked({ edge: 'middle', offset: 12 })).toBe(false);
    expect(isDocked({ edge: 'left' })).toBe(false);
    expect(isDocked(null)).toBe(false);
  });
});
