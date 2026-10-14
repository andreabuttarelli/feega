import { describe, expect, it } from 'vitest';
import { PHONE_MAX, SIDE_GAP, SIDE_WIDTH, SideMode, sidePlacement } from './side-popover';

const DESKTOP = { width: 1440, height: 900 };
const row = (top: number) => ({ top, bottom: top + 28 });

describe('side popover placement', () => {
  it('sits left of the panel, its right edge a gap before the panel edge', () => {
    const at = sidePlacement({ row: row(300), edge: 1180, height: 320, viewport: DESKTOP });
    expect(at).toEqual({ mode: SideMode.Side, left: 1180 - SIDE_GAP - SIDE_WIDTH, top: 300, width: SIDE_WIDTH });
  });

  it('aligns its top with the clicked row', () => {
    expect(sidePlacement({ row: row(120), edge: 1180, height: 200, viewport: DESKTOP }).top).toBe(120);
  });

  it('is clamped inside the viewport when the row is near the bottom', () => {
    const at = sidePlacement({ row: row(820), edge: 1180, height: 320, viewport: DESKTOP });
    expect(at.top).toBe(DESKTOP.height - SIDE_GAP - 320);
  });

  it('never leaves the top of the viewport', () => {
    expect(sidePlacement({ row: row(-50), edge: 1180, height: 200, viewport: DESKTOP }).top).toBe(SIDE_GAP);
  });

  it('becomes a bottom sheet on a phone', () => {
    expect(sidePlacement({ row: row(300), edge: 300, height: 320, viewport: { width: PHONE_MAX - 1, height: 800 } }).mode).toBe(SideMode.Sheet);
  });
});
