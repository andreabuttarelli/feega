import { describe, expect, it } from 'vitest';
import { DOCK_EDGE, Dock, Edge, frameIn, freeArea } from './free-area';

const SCREEN = { width: 1280, height: 720 };

describe('docked regions', () => {
  it('each region docks to one edge, declared once', () => {
    expect(DOCK_EDGE).toEqual({
      [Dock.TopBar]: Edge.Top,
      [Dock.LeftBar]: Edge.Left,
      [Dock.LeftPanel]: Edge.Left,
      [Dock.RightPanel]: Edge.Right,
      [Dock.Timeline]: Edge.Bottom
    });
  });
});

describe('free area', () => {
  it('is what the bar, the timeline and the right column leave', () => {
    const docked = [
      { dock: Dock.TopBar, box: { left: 0, top: 0, right: 1280, bottom: 44 } },
      { dock: Dock.Timeline, box: { left: 0, top: 360, right: 880, bottom: 720 } },
      { dock: Dock.RightPanel, box: { left: 880, top: 44, right: 1280, bottom: 720 } }
    ];

    expect(freeArea(SCREEN, docked)).toEqual({ top: 44, right: 400, bottom: 360, left: 0 });
  });

  it('an open left panel pushes the free area right of it', () => {
    const docked = [
      { dock: Dock.LeftBar, box: { left: 0, top: 0, right: 48, bottom: 720 } },
      { dock: Dock.LeftPanel, box: { left: 48, top: 0, right: 328, bottom: 720 } }
    ];

    expect(freeArea(SCREEN, docked).left).toBe(328);
  });

  it('a phone splits the bar in groups on top and keeps transport and tabs at the bottom', () => {
    const phone = { width: 390, height: 844 };
    const docked = [
      { dock: Dock.TopBar, box: { left: 0, top: 0, right: 150, bottom: 56 } },
      { dock: Dock.TopBar, box: { left: 150, top: 0, right: 390, bottom: 56 } },
      { dock: Dock.Timeline, box: { left: 0, top: 400, right: 390, bottom: 720 } },
      { dock: Dock.Timeline, box: { left: 0, top: 720, right: 390, bottom: 844 } }
    ];

    expect(freeArea(phone, docked)).toEqual({ top: 56, right: 0, bottom: 444, left: 0 });
  });

  it('ignores hidden regions and the part of a region outside the screen', () => {
    const docked = [
      { dock: Dock.TopBar, box: { left: 0, top: 0, right: 0, bottom: 0 } },
      { dock: Dock.LeftBar, box: { left: -48, top: 0, right: 0, bottom: 720 } }
    ];

    expect(freeArea(SCREEN, docked)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe('framing the edited node', () => {
  const free = { left: 0, top: 44, width: 1280 - 400, height: 720 - 44 - 360 };

  it('centres the node in the free area and fits it inside the margin', () => {
    const view = frameIn({ x: 100, y: 100, width: 400, height: 250 }, SCREEN, { top: 44, right: 400, bottom: 360, left: 0 }, 4);
    const left = 100 * view.zoom + view.x;
    const top = 100 * view.zoom + view.y;
    const right = free.left + free.width - (left + 400 * view.zoom);
    const bottom = free.top + free.height - (top + 250 * view.zoom);

    expect(left - free.left).toBeCloseTo(right, 5);
    expect(top - free.top).toBeCloseTo(bottom, 5);
    expect(Math.min(left - free.left, top - free.top)).toBeGreaterThanOrEqual(32 - 1e-9);
  });

  it('never zooms past the cap, and stays centred when capped', () => {
    const view = frameIn({ x: 0, y: 0, width: 10, height: 10 }, SCREEN, { top: 0, right: 0, bottom: 0, left: 0 }, 2);

    expect(view.zoom).toBe(2);
    expect(view.x + 10).toBeCloseTo(640, 5);
    expect(view.y + 10).toBeCloseTo(360, 5);
  });
});
