import { describe, expect, it } from 'vitest';
import { BAR_SLOTS, BarContext, BarSlot, barContextFor } from './bottom-bar';

describe('one bottom bar, everything else behind +', () => {
  it('a selected frame is the only selection that changes the insert menu', () => {
    expect(barContextFor(null)).toBe(BarContext.Canvas);
    expect(barContextFor('frame-1')).toBe(BarContext.Frame);
  });

  it('the bar holds select, the + menu and comment, with no mode switch', () => {
    expect(BAR_SLOTS).toEqual([BarSlot.Select, BarSlot.Insert, BarSlot.Comment]);
  });
});
