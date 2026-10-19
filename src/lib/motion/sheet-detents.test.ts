import { describe, expect, it } from 'vitest';
import { Detent, SNAP_PX, fitHeight, nearestDetent, nextDetent, readSheetPx, settleHeight, sheetHeight, tapHeight, writeSheetPx } from './sheet-detents';

const room = { viewport: 844, stageBottom: 300, floor: 120 };

describe('sheet detents', () => {
  it('half stops under the stage, so the preview stays visible', () => {
    expect(sheetHeight(Detent.Half, room)).toBe(844 - 300 - 120);
  });

  it('peek is a strip, full reaches the top bar', () => {
    expect(sheetHeight(Detent.Peek, room)).toBeLessThan(sheetHeight(Detent.Half, room));
    expect(sheetHeight(Detent.Full, room)).toBeGreaterThan(sheetHeight(Detent.Half, room));
  });

  it('a released drag lands on the nearest detent', () => {
    expect(nearestDetent(sheetHeight(Detent.Half, room) + 20, room)).toBe(Detent.Half);
    expect(nearestDetent(10, room)).toBe(Detent.Peek);
    expect(nearestDetent(2000, room)).toBe(Detent.Full);
  });

  it('a tap on the grabber steps up, and from full back to peek', () => {
    expect(nextDetent(Detent.Peek)).toBe(Detent.Half);
    expect(nextDetent(Detent.Half)).toBe(Detent.Full);
    expect(nextDetent(Detent.Full)).toBe(Detent.Peek);
  });
});

describe('a free-height sheet', () => {
  const stops = [Detent.Peek, Detent.Half, Detent.Full].map((d) => sheetHeight(d, room));

  it('a release near a detent snaps onto it', () => {
    expect(settleHeight(stops[1] + SNAP_PX - 1, room)).toBe(stops[1]);
    expect(settleHeight(stops[2] - SNAP_PX + 1, room)).toBe(stops[2]);
  });

  it('a release between detents stays where the finger left it', () => {
    const between = Math.round((stops[0] + stops[1]) / 2);
    expect(settleHeight(between, room)).toBe(between);
  });

  it('a release past the ends stops at peek or full', () => {
    expect(settleHeight(0, room)).toBe(stops[0]);
    expect(settleHeight(5000, room)).toBe(stops[2]);
  });

  it('a remembered height that no longer fits the screen is brought back inside', () => {
    expect(fitHeight(5000, room)).toBe(stops[2]);
    expect(fitHeight(stops[1], room)).toBe(stops[1]);
  });

  it('a tap steps from wherever the sheet is to the next detent', () => {
    expect(tapHeight(stops[0] + 10, room)).toBe(stops[1]);
    expect(tapHeight(stops[2], room)).toBe(stops[0]);
  });
});

describe('sheet memory', () => {
  const store = () => {
    const map = new Map<string, string>();
    return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } as unknown as Storage;
  };

  it('each sheet remembers its own height', () => {
    const s = store();
    writeSheetPx(s, 'layers', 300);
    writeSheetPx(s, 'properties', 500);
    expect(readSheetPx(s, 'layers')).toBe(300);
    expect(readSheetPx(s, 'properties')).toBe(500);
  });

  it('nothing remembered, or no storage, reads as null', () => {
    expect(readSheetPx(store(), 'chat')).toBeNull();
    expect(readSheetPx(null, 'chat')).toBeNull();
  });
});
