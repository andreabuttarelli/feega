import { describe, expect, it } from 'vitest';
import { playedDuration, recordedAt } from './timewarp';

const warps = [{ t: 2, end: 5, play: 1 }];

describe('demo time warp', () => {
  it('plays a slow drag in its target time', () => {
    expect(playedDuration(10, warps)).toBe(8);
  });

  it('keeps time before the drag', () => {
    expect(recordedAt(1.5, warps)).toBe(1.5);
  });

  it('spreads the drag over its play time', () => {
    expect(recordedAt(2.5, warps)).toBeCloseTo(3.5);
  });

  it('shifts time after the drag', () => {
    expect(recordedAt(4, warps)).toBeCloseTo(6);
  });

  it('cuts a wait out of the played time', () => {
    const cut = [{ t: 2, end: 30, play: 0 }];
    expect(playedDuration(40, cut)).toBe(12);
    expect(recordedAt(2.5, cut)).toBeCloseTo(30.5);
  });
});
