import { describe, expect, it } from 'vitest';
import { Bound, LimitUnit, formatLimit, limitOf, limitPatch, parseLimit } from './limits';
import { DEFAULT_LAYOUT_ITEM } from './model';

describe('a typed min or max', () => {
  it.each([
    ['200', { unit: LimitUnit.Px, value: 200 }],
    ['200px', { unit: LimitUnit.Px, value: 200 }],
    [' 50% ', { unit: LimitUnit.Percent, value: 50 }],
    ['12.5%', { unit: LimitUnit.Percent, value: 12.5 }]
  ])('reads %s', (text, limit) => {
    expect(parseLimit(text)).toEqual(limit);
  });

  it.each(['', 'abc', '-5', '0%', '150%', '200em'])('refuses %s', (text) => {
    expect(parseLimit(text)).toBeNull();
  });

  it('writes px and % with their unit', () => {
    expect(formatLimit({ unit: LimitUnit.Px, value: 200 })).toBe('200px');
    expect(formatLimit({ unit: LimitUnit.Percent, value: 50 })).toBe('50%');
  });
});

describe('a limit on a layout item', () => {
  it('stores a percent and clears the px of the same bound', () => {
    const item = { ...DEFAULT_LAYOUT_ITEM, minWidth: 120, ...limitPatch('width', Bound.Min, { unit: LimitUnit.Percent, value: 50 }) };
    expect(limitOf(item, 'width', Bound.Min)).toEqual({ unit: LimitUnit.Percent, value: 50 });
    expect(item.minWidth).toBeUndefined();
  });

  it('stores px and clears the percent', () => {
    const item = { ...DEFAULT_LAYOUT_ITEM, maxHeightPercent: 80, ...limitPatch('height', Bound.Max, { unit: LimitUnit.Px, value: 300 }) };
    expect(limitOf(item, 'height', Bound.Max)).toEqual({ unit: LimitUnit.Px, value: 300 });
    expect(item.maxHeightPercent).toBeUndefined();
  });

  it('reads the percent when an agent left both units set, as the layout does', () => {
    expect(limitOf({ ...DEFAULT_LAYOUT_ITEM, maxWidth: 300, maxWidthPercent: 40 }, 'width', Bound.Max)).toEqual({ unit: LimitUnit.Percent, value: 40 });
  });

  it('clears both units', () => {
    const item = { ...DEFAULT_LAYOUT_ITEM, minHeight: 10, ...limitPatch('height', Bound.Min, null) };
    expect(limitOf(item, 'height', Bound.Min)).toBeNull();
  });
});
