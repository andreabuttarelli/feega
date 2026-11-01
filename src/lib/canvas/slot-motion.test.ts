import { describe, expect, it } from 'vitest';
import { SLOT_MIN_SCALE, SLOT_MOVE_MS, SLOT_STAGGER_MS, SlotPhase, slotFrame, slotTiming } from './slot-motion';

describe('bar slots fade and resize when the mode changes', () => {
  it('reduced motion is instant', () => {
    expect(slotTiming(SlotPhase.Enter, 3, true)).toEqual({ duration: 0, delay: 0 });
    expect(slotTiming(SlotPhase.Leave, 3, true)).toEqual({ duration: 0, delay: 0 });
  });

  it('entering slots are staggered, leaving ones are not', () => {
    expect(slotTiming(SlotPhase.Enter, 2, false)).toEqual({ duration: SLOT_MOVE_MS, delay: 2 * SLOT_STAGGER_MS });
    expect(slotTiming(SlotPhase.Leave, 2, false).delay).toBe(0);
  });

  it('an entering slot starts hidden and small and ends at its natural size', () => {
    expect(slotFrame(SlotPhase.Enter, 0, 100)).toEqual({ opacity: 0, scale: SLOT_MIN_SCALE, widthPx: 0 });
    expect(slotFrame(SlotPhase.Enter, 1, 100)).toEqual({ opacity: 1, scale: 1, widthPx: 100 });
  });

  it('a leaving slot is fully faded before its width has finished collapsing', () => {
    const midway = slotFrame(SlotPhase.Leave, 0.4, 100);
    expect(midway.opacity).toBe(0);
    expect(midway.widthPx).toBeGreaterThan(0);
    expect(slotFrame(SlotPhase.Leave, 0, 100).widthPx).toBe(0);
  });
});
