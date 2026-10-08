import { describe, expect, it } from 'vitest';
import { Detent, nearestDetent, nextDetent, sheetHeight } from './sheet-detents';

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
