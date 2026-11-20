import { describe, expect, it } from 'vitest';
import { OffsetSide, flipOffset, initialOffsets } from './position-box';

describe('position box', () => {
  it('turning a side off removes the property', () => {
    expect(flipOffset({ on: true, px: 12 })).toBe('');
  });

  it('turning a side on writes the current computed offset in px', () => {
    expect(flipOffset({ on: false, px: 24 })).toBe('24px');
  });

  it('a side is on when a class sets it', () => {
    expect(initialOffsets('absolute top-3 -left-2 inset-x-0', {})).toEqual({ [OffsetSide.Top]: true, [OffsetSide.Right]: true, [OffsetSide.Bottom]: false, [OffsetSide.Left]: true });
  });

  it('with no class a side is on when it is the only non-zero side of its axis', () => {
    expect(initialOffsets('', { top: '12px', left: '24px', right: '0px', bottom: '0px' })).toEqual({ [OffsetSide.Top]: true, [OffsetSide.Right]: false, [OffsetSide.Bottom]: false, [OffsetSide.Left]: true });
  });

  it('with no class a resolved offset on both sides of an axis is not taken as set', () => {
    expect(initialOffsets('', { top: '12px', bottom: '80px', left: '24px', right: '900px' })).toEqual({ [OffsetSide.Top]: false, [OffsetSide.Right]: false, [OffsetSide.Bottom]: false, [OffsetSide.Left]: false });
  });

  it('inset sets all four sides', () => {
    expect(Object.values(initialOffsets('inset-0', {}))).toEqual([true, true, true, true]);
  });
});
